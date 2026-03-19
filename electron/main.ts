import * as path from 'path';
import * as fs from 'fs';
import { spawn, execSync, ChildProcess } from 'child_process';
import * as os from 'os';
import * as Electron from 'electron';
import type { BrowserWindow as BrowserWindowType } from 'electron';
import { loadConfig, saveConfig, configToEnv, BotConfig, BotStatus } from './config';
import { findAvailablePort } from './port-detector';

const { app, BrowserWindow, ipcMain } = Electron;

let mainWindow: BrowserWindowType | null = null;
let webWindow: BrowserWindowType | null = null;
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

  // Handle downloads anywhere in the window (including iframes)
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    const defaultPath = path.join(app.getPath('downloads'), item.getFilename());
    
    item.setSaveDialogOptions({
      title: 'Save File',
      defaultPath: defaultPath,
      buttonLabel: 'Save'
    });

    item.once('done', (event, state) => {
      if (state === 'completed') {
        const savePath = item.getSavePath();
        console.log('[DEBUG] Download completed:', savePath);
        Electron.shell.showItemInFolder(savePath);
      } else {
        console.log('[DEBUG] Download failed or cancelled:', state);
      }
    });
  });

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

function findNodeBinary(): string | null {
  // 1. Try the Electron companion node binary (works in dev mode)
  const electronNodeBin = process.execPath.replace(/electron/i, 'node');
  if (electronNodeBin !== process.execPath && fs.existsSync(electronNodeBin)) {
    return electronNodeBin;
  }

  // 2. Check common system paths (macOS GUI apps don't inherit shell PATH)
  const commonPaths = [
    '/usr/local/bin/node',
    '/opt/homebrew/bin/node',           // Apple Silicon Homebrew
    '/usr/bin/node',
    path.join(os.homedir(), '.nvm/current/bin/node'),  // nvm
    path.join(os.homedir(), '.local/share/fnm/aliases/default/bin/node'), // fnm
  ];

  // Also check nvm versions directory for any installed version
  const nvmDir = path.join(os.homedir(), '.nvm/versions/node');
  if (fs.existsSync(nvmDir)) {
    try {
      const versions = fs.readdirSync(nvmDir).sort().reverse();
      for (const ver of versions) {
        commonPaths.push(path.join(nvmDir, ver, 'bin/node'));
      }
    } catch {
      // Ignore read errors
    }
  }

  for (const nodePath of commonPaths) {
    if (fs.existsSync(nodePath)) {
      console.log('[DEBUG] Found node at:', nodePath);
      return nodePath;
    }
  }

  // 3. Try 'which node' as a last resort
  try {
    const whichResult = execSync('which node', {
      encoding: 'utf-8',
      env: {
        ...process.env,
        PATH: `${process.env.PATH || ''}:/usr/local/bin:/opt/homebrew/bin:/usr/bin`
      }
    }).trim();
    if (whichResult && fs.existsSync(whichResult)) {
      console.log('[DEBUG] Found node via which:', whichResult);
      return whichResult;
    }
  } catch {
    // 'which' failed — node not found in PATH
  }

  // 4. Last fallback: bare 'node' — may work if PATH is set
  console.warn('[WARN] Could not find node binary at known paths, trying bare "node"');
  return 'node';
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

  // Find a working node binary
  const nodeExec = findNodeBinary();
  if (!nodeExec) {
    const errorMsg = 'Could not find Node.js binary. Please ensure Node.js is installed and accessible.';
    console.error('[ERROR]', errorMsg);
    mainWindow.webContents.send('bot-error', errorMsg);
    return;
  }

  const botPath = path.join(__dirname, '../index.js');

  const botCwd = path.dirname(botPath);

  console.log('[DEBUG] Spawning bot process:');
  console.log('[DEBUG]   nodeExec:', nodeExec);
  console.log('[DEBUG]   botPath:', botPath);
  console.log('[DEBUG]   botCwd:', botCwd);
  console.log('[DEBUG]   DEBUG env:', env.DEBUG);

  // Spawn bot process
  botProcess = spawn(nodeExec, [botPath], {
    env: { ...process.env, ...env },
    stdio: 'pipe',
    windowsHide: true,
    cwd: botCwd
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
    console.error('[ERROR] Bot process error event:', error);
    mainWindow?.webContents.send('bot-error', error.message);
    console.error('Failed to start bot:', error);
  });

  console.log('[DEBUG] Bot process spawned, PID:', botProcess.pid);
  console.log('[DEBUG] Waiting for stdout/stderr...');

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
  // Set up cache directories to avoid Windows permission issues
  const userDataPath = app.getPath('userData');
  const cachePath = path.join(userDataPath, 'Cache');

  // Configure Chromium to use our cache directory
  app.commandLine.appendSwitch('disk-cache-dir', cachePath);
  app.commandLine.appendSwitch('disk-cache-size', '104857600'); // 100MB

  // Disable GPU cache to prevent errors (optional, can help on Windows)
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

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
