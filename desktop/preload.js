/**
 * preload.js — Contextbridge between renderer and main process.
 *
 * Exposes a safe `window.electronAPI` object containing only the methods
 * the UI actually needs, keeping nodeIntegration disabled.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // Backend process
  startBackend: (settings) => ipcRenderer.invoke('backend:start', settings),
  stopBackend: () => ipcRenderer.invoke('backend:stop'),
  backendStatus: () => ipcRenderer.invoke('backend:status'),
  backendPort: () => ipcRenderer.invoke('backend:port'),

  // Log streaming from main process → renderer
  onBackendLog: (callback) => {
    const handler = (_event, line) => callback(line);
    ipcRenderer.on('backend:log', handler);
    // Return unsubscribe function
    return () => ipcRenderer.removeListener('backend:log', handler);
  },

  // Shell helpers
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
});
