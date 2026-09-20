const { app, BrowserWindow, Menu, shell } = require('electron');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

let mainWindow;
let octopProcess = null;
const OCTOP_HOST = process.env.OCTOP_HOST || '127.0.0.1';
const OCTOP_PORT = process.env.OCTOP_PORT || '8088';

function octopDir() {
  const candidates = [
    process.env.OCTOP_DIR,
    path.join(__dirname, 'vendor', 'octop'),
    path.resolve(__dirname, '..', 'Octop')
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'pyproject.toml'))) || null;
}

async function octopHealthy() {
  try {
    const response = await fetch('http://' + OCTOP_HOST + ':' + OCTOP_PORT + '/api/health');
    return response.ok;
  } catch (_) {
    return false;
  }
}

async function ensureOctop() {
  if (await octopHealthy()) {
    console.log('[Octop] already running at http://' + OCTOP_HOST + ':' + OCTOP_PORT);
    return;
  }
  const dir = octopDir();
  if (!dir) {
    console.warn('[Octop] submodule not initialized; run: git submodule update --init --recursive');
    return;
  }
  const localBin = path.join(dir, '.venv', 'bin', 'octop');
  const command = fs.existsSync(localBin) ? localBin : 'uv';
  const args = fs.existsSync(localBin)
    ? ['run', '--host', OCTOP_HOST, '--port', OCTOP_PORT]
    : ['run', 'octop', 'run', '--host', OCTOP_HOST, '--port', OCTOP_PORT];
  octopProcess = spawn(command, args, {
    cwd: dir,
    env: { ...process.env, OCTOP_BIND_HOST: OCTOP_HOST, OCTOP_PORT },
    stdio: 'inherit'
  });
  octopProcess.on('error', (error) => console.warn('[Octop] failed to start:', error.message));
  octopProcess.on('exit', (code, signal) => {
    if (octopProcess) console.log('[Octop] exited (' + (code == null ? signal : code) + ')');
    octopProcess = null;
  });
  for (let i = 0; i < 30; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (await octopHealthy()) {
      console.log('[Octop] ready at http://' + OCTOP_HOST + ':' + OCTOP_PORT);
      return;
    }
  }
  console.warn('[Octop] startup timeout; AgentOS will continue in offline mode');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: 'Agent OS Desktop',
    backgroundColor: '#0b0c10',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 14, y: 13 },
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    visualEffectState: 'active',
    fullscreenable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  // AgentOS owns the desktop chrome; keep native traffic lights out of the custom menubar.
  if (process.platform === 'darwin' && typeof mainWindow.setWindowButtonVisibility === 'function') {
    mainWindow.setWindowButtonVisibility(false);
  }

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

function toggleFullscreen() {
  if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
}

app.whenReady().then(async () => {
  await ensureOctop();
  createWindow();
  const menu = Menu.buildFromTemplate([
    {
      label: 'Agent OS',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Full Screen', accelerator: 'CmdOrCtrl+Shift+F', click: toggleFullscreen },
        { role: 'reload' },
        { role: 'toggleDevTools' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (octopProcess && !octopProcess.killed) {
    octopProcess.kill('SIGTERM');
    octopProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
