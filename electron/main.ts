import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import { loadConfig, saveConfig, configToEnv, BotConfig, BotStatus } from './config';
import { findAvailablePort } from './port-detector';

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

  // Load from ui folder (relative to project root, not dist/electron)
  mainWindow.loadFile(path.join(__dirname, '../../ui/index.html'));

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

async function startBot(config: BotConfig): Promise<void> {
  if (botProcess) {
    stopBot();
  }

  // Find available port if configured
  let port = config.web.port;
  if (config.web.autoIncrement) {
    try {
      port = await findAvailablePort(port);
    } catch (error) {
      mainWindow?.webContents.send('bot-error', 'Could not find available port');
      return;
    }
  }

  // Update config with actual port
  const finalConfig = { ...config, web: { ...config.web, port } };
  currentConfig = finalConfig;
  saveConfig(finalConfig);

  // Notify renderer of actual port
  mainWindow?.webContents.send('port-detected', { port });

  const env = configToEnv(finalConfig);
  env.MLBB_CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
  env.WEB_PORT = port.toString();

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
      port: finalConfig.web.port
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
      port: finalConfig.web.port
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

ipcMain.on('start-bot', async (_event, config: BotConfig) => {
  await startBot(config);
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
