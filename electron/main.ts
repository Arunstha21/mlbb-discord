import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import { loadConfig, saveConfig, configToEnv, BotConfig, BotStatus } from './config';

let mainWindow: BrowserWindow | null = null;
let webWindow: BrowserWindow | null = null;
let botProcess: ChildProcess | null = null;
let currentConfig: BotConfig | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../ui/index.html'));

  // Check for existing config and notify renderer
  const existingConfig = loadConfig();
  if (existingConfig) {
    currentConfig = existingConfig;
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.send('config-loaded', existingConfig);
    });
  }
}

function getNetworkIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function startBot(config: BotConfig): void {
  if (botProcess) {
    stopBot();
  }

  currentConfig = config;
  saveConfig(config);

  const env = configToEnv(config);
  env.MLBB_CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

  // Spawn bot process
  botProcess = spawn(process.execPath, ['dist/index.js'], {
    env: { ...process.env, ...env },
    stdio: 'pipe'
  });

  botProcess.stdout?.on('data', (data: Buffer) => {
    const log = data.toString();
    mainWindow?.webContents.send('bot-log', log);
    console.log(`[BOT] ${log}`);
  });

  botProcess.stderr?.on('data', (data: Buffer) => {
    const log = data.toString();
    mainWindow?.webContents.send('bot-log', log);
    console.error(`[BOT ERROR] ${log}`);
  });

  botProcess.on('error', (error: Error) => {
    mainWindow?.webContents.send('bot-error', error.message);
    console.error('Failed to start bot:', error);
  });

  botProcess.on('exit', (code: number | null) => {
    const status: BotStatus = {
      running: false,
      connectedServers: 0,
      port: config.web.port
    };
    mainWindow?.webContents.send('bot-status', status);
    botProcess = null;
    if (code !== 0 && code !== null) {
      mainWindow?.webContents.send('bot-error', `Bot exited with code ${code}`);
    }
  });

  // Send initial status after a short delay
  setTimeout(() => {
    const status: BotStatus = {
      running: true,
      connectedServers: 0, // Will be updated by bot
      port: config.web.port
    };
    mainWindow?.webContents.send('bot-status', status);
  }, 1000);
}

function stopBot(): void {
  if (botProcess) {
    botProcess.kill('SIGTERM');
    botProcess = null;
  }
}

function createWebWindow(port: number): void {
  if (webWindow) {
    webWindow.focus();
    return;
  }

  webWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'MLBB Bot - Web Interface',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  webWindow.loadURL(`http://localhost:${port}`);

  webWindow.on('closed', () => {
    webWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-status', (): BotStatus => {
  return {
    running: botProcess !== null,
    connectedServers: 0,
    port: currentConfig?.web.port || 3000
  };
});

ipcMain.on('start-bot', (_event, config: BotConfig) => {
  startBot(config);
});

ipcMain.on('stop-bot', () => {
  stopBot();
});

ipcMain.handle('get-network-ip', (): { local: string; network: string } => {
  return {
    local: 'localhost',
    network: getNetworkIP()
  };
});

ipcMain.on('open-web-interface', () => {
  if (currentConfig) {
    createWebWindow(currentConfig.web.port);
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  ipcMain.handle('get-network-ip', () => {
    return {
      local: 'localhost',
      network: getNetworkIP()
    };
  });
});

app.on('window-all-closed', () => {
  stopBot();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopBot();
});
