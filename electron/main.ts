import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import { loadConfig, saveConfig, configToEnv, BotConfig, BotStatus } from './config';
import { findAvailablePort } from './port-detector';

let mainWindow: BrowserWindow | null = null;
let webWindow: BrowserWindow | null = null;
let botProcess: ChildProcess | null = null;
let currentConfig: BotConfig | null = null;

// Store IPC handlers for cleanup
const ipcHandlers: { [key: string]: (...args: any[]) => any } = {};

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    show: false
  });

  // Load from ui folder (relative to project root, not dist/electron)
  mainWindow.loadFile(path.join(__dirname, '../../ui/index.html'));

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Check for existing config and notify renderer
  const existingConfig = loadConfig();
  if (existingConfig && mainWindow) {
    currentConfig = existingConfig;
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow?.webContents.send('config-loaded', existingConfig);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

  if (!mainWindow) {
    throw new Error('Main window not available');
  }

  // Find available port if configured
  let port = config.web.port;
  if (config.web.autoIncrement) {
    try {
      port = await findAvailablePort(port);
    } catch (error) {
      mainWindow.webContents.send('bot-error', 'Could not find available port');
      return;
    }
  }

  // Update config with actual port
  const finalConfig = { ...config, web: { ...config.web, port } };
  currentConfig = finalConfig;
  saveConfig(finalConfig);

  // Notify renderer of actual port
  mainWindow.webContents.send('port-detected', { port });

  const env = configToEnv(finalConfig);
  env.MLBB_CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
  env.WEB_PORT = port.toString();

  // Use the system node binary, not the Electron binary (process.execPath),
  // to avoid macOS showing a second Electron app icon in the dock.
  const nodeBin = process.execPath.replace(/electron/i, 'node');
  const nodeExec = require('fs').existsSync(nodeBin) ? nodeBin : 'node';

  // Spawn bot process
  botProcess = spawn(nodeExec, ['dist/index.js'], {
    env: { ...process.env, ...env },
    stdio: 'pipe',
    windowsHide: true
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

  botProcess.on('exit', (code: number | null, signal: string | null) => {
    const status: BotStatus = {
      running: false,
      connectedServers: 0,
      port: finalConfig.web.port
    };
    mainWindow?.webContents.send('bot-status', status);
    botProcess = null;
    if (code !== 0 && code !== null) {
      const exitMessage = signal
        ? `Bot process terminated by signal: ${signal}`
        : `Bot exited with code ${code}`;
      mainWindow?.webContents.send('bot-error', exitMessage);
    }
  });

  // Send initial status after a short delay to ensure bot has started
  setTimeout(() => {
    if (botProcess) {
      const status: BotStatus = {
        running: true,
        connectedServers: 0, // Will be updated by bot
        port: finalConfig.web.port
      };
      mainWindow?.webContents.send('bot-status', status);
    }
  }, 1000);
}

function stopBot(): void {
  if (botProcess) {
    const currentProcess = botProcess;
    currentProcess.kill('SIGTERM');
    // Also try SIGKILL after a timeout if the process doesn't exit
    const timeout = setTimeout(() => {
      try {
        currentProcess.kill('SIGKILL');
      } catch (e) {
        // Ignored
      }
    }, 5000);
    currentProcess.on('exit', () => clearTimeout(timeout));
    botProcess = null;
  }
}



// IPC Handlers with proper cleanup support
function registerIpcHandlers(): void {
  // Use invoke for handlers that return values
  ipcMain.handle('get-status', (): BotStatus => {
    return {
      running: botProcess !== null,
      connectedServers: 0,
      port: currentConfig?.web.port || 3000
    };
  });

  ipcMain.handle('get-network-ip', (): { local: string; network: string } => {
    return {
      local: 'localhost',
      network: getNetworkIP()
    };
  });

  // Use send for one-way messages
  ipcMain.on('start-bot', async (_event: Electron.IpcMainEvent, config: BotConfig) => {
    try {
      await startBot(config);
    } catch (error) {
      console.error('Error starting bot:', error);
    }
  });

  ipcMain.on('stop-bot', () => {
    stopBot();
  });
}

function unregisterIpcHandlers(): void {
  // Remove all handlers to prevent memory leaks
  ipcMain.removeHandler('get-status');
  ipcMain.removeHandler('get-network-ip');
  ipcMain.removeAllListeners('start-bot');
  ipcMain.removeAllListeners('stop-bot');
}

// App lifecycle
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  stopBot();
  unregisterIpcHandlers();
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
  unregisterIpcHandlers();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  mainWindow?.webContents.send('bot-error', `Fatal error: ${error.message}`);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled Rejection:', reason);
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  mainWindow?.webContents.send('bot-error', `Unhandled rejection: ${errorMessage}`);
});
