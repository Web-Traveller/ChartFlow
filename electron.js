const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let pyProc = null;

function startBackend() {
  const isPackaged = app.isPackaged;
  const backendDir = isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, 'backend');

  const venvPython = process.platform === 'win32'
    ? path.join(backendDir, 'venv', 'Scripts', 'python.exe')
    : path.join(backendDir, 'venv', 'bin', 'python');

  console.log(`[Electron] Spawning backend process in ${backendDir} using: ${venvPython}`);

  pyProc = spawn(venvPython, ['-m', 'uvicorn', 'main:app', '--port', '8000'], {
    cwd: backendDir,
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });

  pyProc.stdout.on('data', (data) => {
    console.log(`[FastAPI] ${data.toString().trim()}`);
  });

  pyProc.stderr.on('data', (data) => {
    console.error(`[FastAPI Error] ${data.toString().trim()}`);
  });

  pyProc.on('close', (code) => {
    console.log(`[Electron] FastAPI backend exited with code ${code}`);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 850,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#090A0C',
    title: 'ChartFlow Terminal'
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';
  if (isDev) {
    win.loadURL('http://localhost:5174/');
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  startBackend();
  // Wait 1.5 seconds for the FastAPI server to spin up before loading BrowserWindow
  setTimeout(createWindow, 1500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (pyProc) {
    console.log('[Electron] Terminating backend process...');
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', pyProc.pid, '/f', '/t']);
    } else {
      pyProc.kill('SIGTERM');
    }
    pyProc = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  if (pyProc) {
    pyProc.kill('SIGKILL');
  }
});
