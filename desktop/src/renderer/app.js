/**
 * app.js — Renderer process script (loaded from index.html)
 *
 * Communicates with the Electron main process exclusively through
 * window.electronAPI (exposed via preload.js / contextBridge).
 */

/* ── Helpers ── */
const $ = (id) => document.getElementById(id);

/* ── Page navigation ── */
const navBtns = document.querySelectorAll('nav button[data-page]');
navBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    navBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.page').forEach((p) => p.classList.remove('visible'));
    $(`page-${btn.dataset.page}`).classList.add('visible');
  });
});

/* ── Log console ── */
function appendLog(line) {
  const el = $('logConsole');
  el.textContent += line + '\n';
  el.scrollTop = el.scrollHeight;
}

window.electronAPI.onBackendLog((line) => appendLog(line));

$('btnClearLog').addEventListener('click', () => { $('logConsole').textContent = ''; });

/* ── Status bar update ── */
async function refreshStatus() {
  const status = await window.electronAPI.backendStatus();
  const dot  = $('statusDot');
  const text = $('statusText');
  const hBadge = $('hBackend');

  if (status.running && status.healthy) {
    dot.className = 'dot green';
    text.textContent = `백엔드 실행 중 — http://127.0.0.1:${status.port}`;
    hBadge.className = 'badge badge-ok';
    hBadge.textContent = '정상';
  } else if (status.running) {
    dot.className = 'dot grey';
    text.textContent = '백엔드 시작 중…';
    hBadge.className = 'badge badge-pend';
    hBadge.textContent = '시작 중';
  } else {
    dot.className = 'dot red';
    text.textContent = '백엔드 꺼짐';
    hBadge.className = 'badge badge-err';
    hBadge.textContent = '꺼짐';
  }

  $('btnStart').disabled = status.running;
  $('btnStop').disabled  = !status.running;
}

setInterval(refreshStatus, 4000);
refreshStatus();

/* ── Dashboard: start / stop ── */
$('btnStart').addEventListener('click', async () => {
  const settings = await gatherSettings();
  $('btnStart').disabled = true;
  appendLog('[UI] 서버 시작 요청…');
  const result = await window.electronAPI.startBackend(settings);
  if (!result.ok) appendLog(`[UI] 시작 실패: ${result.error}`);
  refreshStatus();
});

$('btnStop').addEventListener('click', async () => {
  $('btnStop').disabled = true;
  appendLog('[UI] 서버 중지 요청…');
  await window.electronAPI.stopBackend();
  refreshStatus();
});

$('btnHealth').addEventListener('click', () => refreshStatus());

/* ── Settings ── */
async function loadSettingsToForm() {
  const s = await window.electronAPI.loadSettings();
  $('cfgPort').value       = s.API_PORT        || 8000;
  $('cfgLlmBackend').value = s.LLM_BACKEND     || 'ollama';
  $('cfgDbUrl').value      = s.DATABASE_URL     || '';
  $('cfgLlmUrl').value     = s.LLM_URL          || '';
  $('cfgEmbModel').value   = s.EMBEDDING_MODEL  || '';
  $('cfgEmbDim').value     = s.EMBEDDING_DIM    || 768;
  $('cfgTopK').value       = s.TOP_K            || 6;
  $('cfgBm25K').value      = s.BM25_K           || 10;
  $('cfgDisclaimer').value = s.DISCLAIMER       || '';
}

function gatherSettings() {
  return window.electronAPI.loadSettings().then((defaults) => ({
    ...defaults,
    API_PORT:        parseInt($('cfgPort').value)    || 8000,
    LLM_BACKEND:     $('cfgLlmBackend').value.trim(),
    DATABASE_URL:    $('cfgDbUrl').value.trim(),
    LLM_URL:         $('cfgLlmUrl').value.trim(),
    EMBEDDING_MODEL: $('cfgEmbModel').value.trim(),
    EMBEDDING_DIM:   parseInt($('cfgEmbDim').value)  || 768,
    TOP_K:           parseInt($('cfgTopK').value)    || 6,
    BM25_K:          parseInt($('cfgBm25K').value)   || 10,
    DISCLAIMER:      $('cfgDisclaimer').value.trim(),
  }));
}

$('btnSaveSettings').addEventListener('click', async () => {
  const s = await gatherSettings();
  await window.electronAPI.saveSettings(s);
  const msg = $('settingsSaved');
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 2500);
});

$('btnReloadSettings').addEventListener('click', loadSettingsToForm);

loadSettingsToForm();

/* ── Query ── */
$('btnQuery').addEventListener('click', async () => {
  const question = $('queryInput').value.trim();
  if (!question) return;

  const status = await window.electronAPI.backendStatus();
  if (!status.running) {
    $('answerBox').textContent = '⚠ 백엔드가 실행 중이지 않습니다. 대시보드에서 서버를 먼저 시작하세요.';
    return;
  }

  const port = status.port || 8000;
  const answerBox = $('answerBox');
  answerBox.textContent = '';
  answerBox.classList.add('streaming');
  $('btnQuery').disabled = true;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      answerBox.textContent = `오류: HTTP ${response.status}`;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE chunks
      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // keep incomplete tail

      for (const part of parts) {
        const lines = part.split('\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (data.text)  answerBox.textContent += data.text;
              if (data.line)  answerBox.textContent += data.line + '\n';
              if (data.stage) answerBox.textContent += `[${data.stage}] `;
            } catch (_) {
              answerBox.textContent += line.slice(5).trim() + '\n';
            }
          }
        }
      }
      answerBox.scrollTop = answerBox.scrollHeight;
    }
  } catch (err) {
    answerBox.textContent = `연결 오류: ${err.message}`;
  } finally {
    answerBox.classList.remove('streaming');
    $('btnQuery').disabled = false;
  }
});

$('btnClear').addEventListener('click', () => {
  $('queryInput').value   = '';
  $('answerBox').textContent = '응답이 여기에 표시됩니다.';
});

/* ── Index ── */
$('btnIndex').addEventListener('click', async () => {
  const status = await window.electronAPI.backendStatus();
  if (!status.running) {
    alert('백엔드가 실행 중이지 않습니다. 서버를 먼저 시작하세요.');
    return;
  }

  const source  = $('indexSource').value.trim() || 'sample_legal.json';
  const port    = status.port || 8000;
  const logEl   = $('indexLog');
  logEl.textContent = '';
  $('btnIndex').disabled = true;

  try {
    const response = await fetch(`http://127.0.0.1:${port}/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    });

    if (!response.ok) {
      logEl.textContent += `오류: HTTP ${response.status}\n`;
      return;
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const part of parts) {
        for (const line of part.split('\n')) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (data.line !== undefined) logEl.textContent += data.line + '\n';
              if (data.done) logEl.textContent += `\n색인 완료 (종료 코드: ${data.returncode})\n`;
            } catch (_) {
              logEl.textContent += line.slice(5) + '\n';
            }
          }
        }
      }
      logEl.scrollTop = logEl.scrollHeight;
    }
  } catch (err) {
    logEl.textContent += `오류: ${err.message}\n`;
  } finally {
    $('btnIndex').disabled = false;
  }
});
