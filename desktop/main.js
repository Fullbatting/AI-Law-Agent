/**
 * main.js — Electron main process
 *
 * Responsibilities:
 *  1. Create the BrowserWindow and load the renderer UI
 *  2. Spawn / monitor the Python FastAPI backend as a child process
 *  3. Persist user settings (env vars) via electron-store (JSON file)
 *  4. Expose IPC handlers used by the renderer via preload.js
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const os = require('os');

// ─── Settings (simple JSON store) ───────────────────────────────────────────
const CONFIG_DIR = path.join(app.getPath('userData'), 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

const DEFAULT_SETTINGS = {
  API_PORT: 8000,
  DATABASE_URL: 'postgresql://localhost:5432/legaldb',
  LLM_BACKEND: 'ollama',
  LLM_URL: 'http://localhost:11434',
  EMBEDDING_MODEL: 'snunlp/KR-SBERT-V40K-kl',
  EMBEDDING_DIM: 768,
  TOP_K: 6,
  BM25_K: 10,
  DISCLAIMER: '본 답변은 법률적 참고용입니다.',
};

function loadSettings() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    }
  } catch (_) {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

// ─── Python backend process management ──────────────────────────────────────
let backendProcess = null;
let backendPort = DEFAULT_SETTINGS.API_PORT;

function getBackendScript() {
  // In packaged app resources are in process.resourcesPath
  const resourceBase = app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, '..', 'backend');
  return path.join(resourceBase, 'server.py');
}

function getPythonExecutable() {
  // Prefer bundled python (e.g. from pyinstaller), fall back to system
  const candidates = [
    path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), 'python', 'python'),
    path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), 'python', 'python3'),
    'python3',
    'python',
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch (_) {}
  }
  return 'python3';
}

function buildEnvForBackend(settings) {
  const env = { ...process.env };
  const keys = [
    'DATABASE_URL', 'LLM_BACKEND', 'LLM_URL',
    'EMBEDDING_MODEL', 'EMBEDDING_DIM', 'TOP_K', 'BM25_K', 'DISCLAIMER',
  ];
  for (const k of keys) {
    if (settings[k] !== undefined) env[k] = String(settings[k]);
  }
  env.API_PORT = String(settings.API_PORT || 8000);
  return env;
}

function startBackend(settings, logCallback) {
  if (backendProcess) return; // already running

  backendPort = settings.API_PORT || 8000;
  const script = getBackendScript();
  const python = getPythonExecutable();
  const env = buildEnvForBackend(settings);

  logCallback(`[launcher] Starting backend: ${python} ${script} (port ${backendPort})`);

  backendProcess = spawn(python, [script], { env, cwd: path.dirname(script) });

  backendProcess.stdout.on('data', (data) => {
    logCallback(`[backend] ${data.toString().trimEnd()}`);
  });
  backendProcess.stderr.on('data', (data) => {
    logCallback(`[backend:err] ${data.toString().trimEnd()}`);
  });
  backendProcess.on('exit', (code) => {
    logCallback(`[launcher] Backend exited with code ${code}`);
    backendProcess = null;
  });
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    // backendProcess is set to null by the 'exit' event handler
  }
}

function checkBackendHealth(port) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/health', method: 'GET', timeout: 3000 },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// ─── Window ──────────────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    title: 'AI Law Agent',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => stopBackend());

// ─── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('settings:load', () => loadSettings());

ipcMain.handle('settings:save', (_event, settings) => {
  saveSettings(settings);
  return { ok: true };
});

ipcMain.handle('backend:start', (_event, settings) => {
  saveSettings(settings);
  if (backendProcess) return { ok: false, error: 'Already running' };
  startBackend(settings, (line) => {
    if (mainWindow) mainWindow.webContents.send('backend:log', line);
  });
  return { ok: true };
});

ipcMain.handle('backend:stop', () => {
  stopBackend();
  return { ok: true };
});

ipcMain.handle('backend:status', async () => {
  if (!backendProcess) return { running: false };
  const healthy = await checkBackendHealth(backendPort);
  return { running: !!backendProcess, healthy, port: backendPort };
});

ipcMain.handle('backend:port', () => backendPort);

ipcMain.handle('shell:openExternal', (_event, url) => shell.openExternal(url));
