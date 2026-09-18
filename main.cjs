const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

let mainWindow;

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

app.whenReady().then(() => {
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
