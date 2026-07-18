const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let pyProc = null;

function initializeUserData() {
  const isPackaged = app.isPackaged;
  if (!isPackaged) {
    console.log('[Electron] Running in development mode, skipping user data directory initialization.');
    return;
  }

  const userDataPath = app.getPath('userData');
  const dbDestDir = path.join(userDataPath, 'db');
  const storageDestDir = path.join(userDataPath, 'storage');

  console.log(`[Electron] Initializing user data directory at: ${userDataPath}`);

  // Create directories if they don't exist
  if (!fs.existsSync(dbDestDir)) {
    fs.mkdirSync(dbDestDir, { recursive: true });
  }
  if (!fs.existsSync(storageDestDir)) {
    fs.mkdirSync(storageDestDir, { recursive: true });
  }

  const sourceResourcesPath = process.resourcesPath;

  // Copy DuckDB file if it does not exist in destination
  const dbSourceFile = path.join(sourceResourcesPath, 'db', 'market_data.duckdb');
  const dbDestFile = path.join(dbDestDir, 'market_data.duckdb');
  if (fs.existsSync(dbSourceFile)) {
    if (!fs.existsSync(dbDestFile)) {
      console.log(`[Electron] Copying initial database from ${dbSourceFile} to ${dbDestFile}`);
      fs.copyFileSync(dbSourceFile, dbDestFile);
    }
  } else {
    console.error(`[Electron Error] Source database file not found at: ${dbSourceFile}`);
  }

  // Copy preset storage files
  const storageSourceDir = path.join(sourceResourcesPath, 'backend', 'storage');
  if (fs.existsSync(storageSourceDir)) {
    const files = fs.readdirSync(storageSourceDir);
    for (const file of files) {
      const sourceFile = path.join(storageSourceDir, file);
      const destFile = path.join(storageDestDir, file);
      if (fs.statSync(sourceFile).isFile() && !fs.existsSync(destFile)) {
        console.log(`[Electron] Copying config preset from ${sourceFile} to ${destFile}`);
        fs.copyFileSync(sourceFile, destFile);
      }
    }
  } else {
    console.warn(`[Electron Warning] Source storage presets not found at: ${storageSourceDir}`);
  }
}

function startBackend() {
  const isPackaged = app.isPackaged;
  const backendDir = isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, 'backend');

  const venvPython = process.platform === 'win32'
    ? path.join(backendDir, 'venv', 'Scripts', 'python.exe')
    : path.join(backendDir, 'venv', 'bin', 'python');

  console.log(`[Electron] Spawning backend process in ${backendDir} using: ${venvPython}`);

  // Call user data copy/setup function
  initializeUserData();

  const spawnEnv = { 
    ...process.env, 
    PYTHONUNBUFFERED: '1' 
  };

  if (isPackaged) {
    spawnEnv.CHARTFLOW_USER_DATA_PATH = app.getPath('userData');
  }

  pyProc = spawn(venvPython, ['-m', 'uvicorn', 'main:app', '--port', '8000'], {
    cwd: backendDir,
    env: spawnEnv
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
