# Desktop App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the MLBB Tournament Bot into an Electron desktop app with GUI configuration, embedded web interface, and standalone executables for Windows and macOS.

**Architecture:** Hybrid Electron app where the main process manages the existing Discord bot as a child process. The renderer process provides a GUI for configuration and monitoring. IPC handles communication between UI and bot.

**Tech Stack:** Electron, Node.js, TypeScript, Express (existing), Discord.js (existing)

---

## Task 1: Set Up Electron Project Structure

**Files:**
- Create: `electron/tsconfig.json`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Modify: `package.json` (add Electron dependencies)

**Step 1: Create Electron TypeScript config**

Create `electron/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "../dist/electron",
    "types": ["node"]
  },
  "include": ["*.ts"]
}
```

**Step 2: Update package.json with Electron dependencies**

Add to `package.json`:

```json
{
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0"
  },
  "scripts": {
    "electron:dev": "electron ./dist/electron/main.js",
    "electron:build": "tsc -p electron/tsconfig.json",
    "build:win": "npm run build && npm run electron:build && electron-builder --win",
    "build:mac": "npm run build && npm run electron:build && electron-builder --mac",
    "build:all": "npm run build && npm run electron:build && electron-builder --win --mac"
  }
}
```

Run: `npm install --save-dev electron electron-builder`

Expected: New dependencies installed, no errors

**Step 3: Create minimal Electron main process**

Create `electron/main.ts`:

```typescript
import { app, BrowserWindow } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

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

  // Load from UI folder (will create in next task)
  mainWindow.loadFile(path.join(__dirname, '../ui/index.html'));
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

**Step 4: Create preload script**

Create `electron/preload.ts`:

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  startBot: (config: BotConfig) => ipcRenderer.send('start-bot', config),
  stopBot: () => ipcRenderer.send('stop-bot'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  onBotLog: (callback: (log: string) => void) => {
    ipcRenderer.on('bot-log', (_event, log) => callback(log));
  },
  onBotStatus: (callback: (status: BotStatus) => void) => {
    ipcRenderer.on('bot-status', (_event, status) => callback(status));
  },
  onBotError: (callback: (error: string) => void) => {
    ipcRenderer.on('bot-error', (_event, error) => callback(error));
  }
});

interface BotConfig {
  discord: { token: string };
  challonge: { username: string; token: string };
  bot: { defaultPrefix: string; defaultToRole: string };
  database: { type: string; path: string };
  web: { port: number };
}

interface BotStatus {
  running: boolean;
  connectedServers: number;
  port: number;
}
```

**Step 5: Create electron-builder config**

Create `electron-builder.yml`:

```yaml
appId: com.mlbb.tournament-bot
productName: MLBB Tournament Bot
directories:
  output: dist/installers
  buildResources: assets
files:
  - dist/electron/**/*
  - dist/src/**/*
  - ui/**/*
  - data/**/*
win:
  target: nsis
  icon: assets/icon.ico
mac:
  target: dmg
  icon: assets/icon.icns
```

**Step 6: Build and test**

Run: `npm run electron:build`

Expected: `dist/electron/main.js` and `dist/electron/preload.js` created

**Step 7: Commit**

```bash
git add electron/ package.json package-lock.json electron-builder.yml
git commit -m "feat: add Electron project structure and build setup"
```

---

## Task 2: Create Basic UI Structure

**Files:**
- Create: `ui/index.html`
- Create: `ui/renderer.ts`
- Create: `ui/styles.css`

**Step 1: Create base HTML structure**

Create `ui/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MLBB Tournament Bot</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <div id="config-screen" class="screen">
      <h1>MLBB Tournament Bot - Setup</h1>
      <form id="config-form">
        <h2>Discord Configuration</h2>
        <label>Bot Token: <input type="password" id="discord-token" required></label>

        <h2>Challonge Configuration</h2>
        <label>Username: <input type="text" id="challonge-username" required></label>
        <label>API Key: <input type="password" id="challonge-token" required></label>

        <h2>Bot Settings</h2>
        <label>Command Prefix: <input type="text" id="bot-prefix" value="!" required></label>
        <label>TO Role Name: <input type="text" id="bot-to-role" value="Organizer" required></label>

        <div class="buttons">
          <button type="submit">Save & Start Bot</button>
          <button type="button" id="load-config">Load Config</button>
        </div>
      </form>
    </div>

    <div id="dashboard-screen" class="screen hidden">
      <header>
        <h1>MLBB Bot</h1>
        <div class="status-indicator">
          <span id="status-dot"></span>
          <span id="status-text">Stopped</span>
          <button id="settings-btn">⚙</button>
          <button id="stop-btn">⏹</button>
        </div>
      </header>

      <section id="network-info">
        <h3>Network Access</h3>
        <div class="url-row">
          <span>Local:</span>
          <code id="local-url">http://localhost:3000</code>
          <button class="copy-btn" data-target="local-url">📋 Copy</button>
        </div>
        <div class="url-row">
          <span>Network:</span>
          <code id="network-url">http://192.168.1.105:3000</code>
          <button class="copy-btn" data-target="network-url">📋 Copy</button>
        </div>
        <p>Other users on your network can use the Network URL</p>
      </section>

      <section id="logs">
        <h3>Live Logs <label><input type="checkbox" id="auto-scroll" checked> Auto-scroll</label></h3>
        <div id="log-container"></div>
      </section>

      <div class="buttons">
        <button id="web-interface-btn">🌐 Web Interface</button>
        <button id="export-logs-btn">📋 Export Logs</button>
      </div>
    </div>
  </div>

  <script src="renderer.js"></script>
</body>
</html>
```

**Step 2: Create styles**

Create `ui/styles.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1e1e2e;
  color: #cdd6f4;
  height: 100vh;
  overflow: hidden;
}

.screen {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.hidden {
  display: none !important;
}

/* Config Screen */
#config-screen {
  max-width: 600px;
  margin: 0 auto;
}

#config-screen h1 {
  text-align: center;
  margin-bottom: 30px;
  color: #89b4fa;
}

#config-screen h2 {
  margin: 20px 0 10px;
  color: #89b4fa;
  font-size: 1.1em;
}

#config-screen label {
  display: block;
  margin: 10px 0;
}

#config-screen input[type="text"],
#config-screen input[type="password"] {
  width: 100%;
  padding: 10px;
  margin-top: 5px;
  background: #313244;
  border: 1px solid #45475a;
  color: #cdd6f4;
  border-radius: 6px;
}

.buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

button {
  padding: 10px 20px;
  background: #89b4fa;
  color: #1e1e2e;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}

button:hover {
  background: #b4befe;
}

/* Dashboard */
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #45475a;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
}

#status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #f38ba8;
}

#status-dot.running {
  background: #a6e3a1;
}

#network-info {
  background: #313244;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.url-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0;
}

.url-row code {
  flex: 1;
  background: #1e1e2e;
  padding: 5px 10px;
  border-radius: 4px;
  font-family: monospace;
}

.copy-btn {
  padding: 5px 10px;
  font-size: 0.8em;
}

#logs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#logs h3 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

#log-container {
  flex: 1;
  background: #1e1e2e;
  border-radius: 8px;
  padding: 15px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.9em;
  line-height: 1.5;
}

.log-line {
  margin: 2px 0;
}

.log-error {
  color: #f38ba8;
}

.log-info {
  color: #89b4fa;
}
```

**Step 3: Create basic renderer script**

Create `ui/renderer.ts`:

```typescript
// Type definitions for Electron API
interface ElectronAPI {
  startBot: (config: BotConfig) => void;
  stopBot: () => void;
  getStatus: () => Promise<BotStatus>;
  onBotLog: (callback: (log: string) => void) => void;
  onBotStatus: (callback: (status: BotStatus) => void) => void;
  onBotError: (callback: (error: string) => void) => void;
}

interface BotConfig {
  discord: { token: string };
  challonge: { username: string; token: string };
  bot: { defaultPrefix: string; defaultToRole: string };
  database: { type: string; path: string };
  web: { port: number };
}

interface BotStatus {
  running: boolean;
  connectedServers: number;
  port: number;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// DOM elements
const configScreen = document.getElementById('config-screen')!;
const dashboardScreen = document.getElementById('dashboard-screen')!;
const configForm = document.getElementById('config-form')!;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkExistingConfig();
});

function setupEventListeners(): void {
  configForm.addEventListener('submit', handleConfigSubmit);
  document.getElementById('load-config')?.addEventListener('click', loadConfigFromFile);
  document.getElementById('stop-btn')?.addEventListener('click', handleStopBot);
  document.getElementById('web-interface-btn')?.addEventListener('click', openWebInterface);
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', handleCopyUrl);
  });
}

function checkExistingConfig(): void {
  // Check if config exists
  window.electronAPI.getStatus().then(status => {
    if (status.running) {
      showDashboard();
    }
  }).catch(() => {
    showConfigScreen();
  });
}

function showConfigScreen(): void {
  configScreen.classList.remove('hidden');
  dashboardScreen.classList.add('hidden');
}

function showDashboard(): void {
  configScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');
}

function handleConfigSubmit(e: Event): void {
  e.preventDefault();
  const config: BotConfig = {
    discord: { token: (document.getElementById('discord-token') as HTMLInputElement).value },
    challonge: {
      username: (document.getElementById('challonge-username') as HTMLInputElement).value,
      token: (document.getElementById('challonge-token') as HTMLInputElement).value
    },
    bot: {
      defaultPrefix: (document.getElementById('bot-prefix') as HTMLInputElement).value,
      defaultToRole: (document.getElementById('bot-to-role') as HTMLInputElement).value
    },
    database: { type: 'sqlite', path: './data/dot.db' },
    web: { port: 3000 }
  };
  window.electronAPI.startBot(config);
}

function loadConfigFromFile(): void {
  // TODO: Implement file picker
  console.log('Load config from file');
}

function handleStopBot(): void {
  window.electronAPI.stopBot();
}

function openWebInterface(): void {
  window.open('http://localhost:3000', '_blank');
}

function handleCopyUrl(e: Event): void {
  const target = (e.currentTarget as HTMLElement).dataset.target;
  if (target) {
    const urlElement = document.getElementById(target);
    if (urlElement) {
      navigator.clipboard.writeText(urlElement.textContent || '');
    }
  }
}
```

**Step 4: Build and test**

Run: `npm run electron:build && npm run electron:dev`

Expected: Electron window opens with config screen visible

**Step 5: Commit**

```bash
git add ui/
git commit -m "feat: add basic UI structure with config screen and dashboard"
```

---

## Task 3: Update Config System to Support JSON

**Files:**
- Modify: `src/config/index.ts`
- Create: `electron/config.ts`

**Step 1: Create config types and utilities**

Create `electron/config.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface BotConfig {
  version: string;
  discord: { token: string };
  challonge: { username: string; token: string };
  bot: {
    defaultPrefix: string;
    defaultToRole: string;
    participantRole?: string;
  };
  database: {
    type: 'sqlite' | 'postgresql';
    path?: string;
    url?: string;
  };
  web: {
    port: number;
    autoIncrement: boolean;
  };
  logging: {
    webhook?: string;
    level: string;
  };
}

const CONFIG_FILE = 'config.json';

export function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE);
}

export function loadConfig(): BotConfig | null {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data) as BotConfig;
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
  return null;
}

export function saveConfig(config: BotConfig): void {
  try {
    const configPath = getConfigPath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config:', error);
    throw error;
  }
}

export function configToEnv(config: BotConfig): NodeJS.ProcessEnv {
  return {
    DISCORD_TOKEN: config.discord.token,
    CHALLONGE_USERNAME: config.challonge.username,
    CHALLONGE_TOKEN: config.challonge.token,
    DOT_DEFAULT_PREFIX: config.bot.defaultPrefix,
    DOT_DEFAULT_TO_ROLE: config.bot.defaultToRole,
    DOT_PARTICIPANT_ROLE: config.bot.participantRole || 'Participant',
    SQLITE_DB: config.database.path || './data/dot.db',
    POSTGRESQL_URL: config.database.url || '',
    WEB_PORT: config.web.port.toString(),
    DOT_LOGGER_WEBHOOK: config.logging.webhook || '',
    NODE_ENV: 'production'
  };
}
```

**Step 2: Update existing config loader**

Modify `src/config/index.ts`:

```typescript
import dotenv from "dotenv";

// Check if running in Electron with JSON config
let useJsonConfig = false;

// Check for config.json path passed via environment
const configPath = process.env.MLBB_CONFIG_PATH;
if (configPath) {
  try {
    const fs = require('fs');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      // Set environment variables from config
      process.env.DISCORD_TOKEN = config.discord.token;
      process.env.CHALLONGE_USERNAME = config.challonge.username;
      process.env.CHALLONGE_TOKEN = config.challonge.token;
      process.env.DOT_DEFAULT_PREFIX = config.bot.defaultPrefix;
      process.env.DOT_DEFAULT_TO_ROLE = config.bot.defaultToRole;
      process.env.DOT_PARTICIPANT_ROLE = config.bot.participantRole || 'Participant';
      process.env.SQLITE_DB = config.database.path || './data/dot.db';
      process.env.POSTGRESQL_URL = config.database.url || '';
      process.env.WEB_PORT = config.web.port?.toString() || '3000';
      process.env.DOT_LOGGER_WEBHOOK = config.logging.webhook || '';
      process.env.NODE_ENV = 'production';
      useJsonConfig = true;
    }
  } catch (error) {
    console.error('Error loading JSON config:', error);
  }
}

// Fallback to dotenv if not using JSON config
if (!useJsonConfig) {
  dotenv.config();
}

function assertEnv(envvar: string): string {
  const value = process.env[envvar];
  if (value === undefined) {
    throw new Error(`Missing environment variable ${envvar}`);
  }
  return value;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function getConfig() {
  return {
    challongeUsername: assertEnv("CHALLONGE_USERNAME"),
    challongeToken: assertEnv("CHALLONGE_TOKEN"),
    defaultPrefix: assertEnv("DOT_DEFAULT_PREFIX"),
    defaultTORole: assertEnv("DOT_DEFAULT_TO_ROLE"),
    participantRole: process.env.DOT_PARTICIPANT_ROLE || "Participant",
    discordToken: assertEnv("DISCORD_TOKEN"),
    postgresqlUrl: process.env.POSTGRESQL_URL || "",
    sqliteDb: process.env.SQLITE_DB || "",
    webPort: parseInt(process.env.WEB_PORT || "3000", 10)
  };
}

export const helpMessage = `🏆 **MLBB Tournament Bot** 🏆

Your friendly tournament management bot for Discord!

**📋 Tournament Commands:**
• \`dot!add <url> <name>\` - Add a tournament via Challonge URL (TO only)
• \`dot!info [id]\` - Show tournament details (id optional if only one tournament)
• \`dot!list\` - List all ongoing tournaments
• \`dot!status [id] [new_status]\` - View or change tournament status (id optional if only one tournament)
• \`dot!sync [id]\` - Sync tournament info with Challonge (id optional if only one tournament)
• \`dot!update [id] name description\` - Update tournament info (id optional if only one tournament)

**👥 Host Management:**
• \`dot!addhost [id] @user\` - Add a tournament host (id optional if only one tournament)
• \`dot!removehost [id] @user\` - Remove a tournament host (id optional if only one tournament)

**📝 Registration & Setup:**
• \`dot!check\` - Auto-verify yourself or open an onboarding ticket
• \`dot!email <email>\` - Request email verification
• \`dot!verify <code>\` - Verify your email address
• \`dot!enroll [id] <CSV>\` - Enroll players via CSV attachment (id optional if only one tournament)
• \`dot!verify-player [id] <@user> <email>\` - Manually verify a player by email (TO only)
• \`dot!set-participant-role <id> <@role>\` - Set participant role for a tournament (TO only)
• \`dot!drop-player <email> [id]\` - Drop an enrolled player by email (TO only, id optional if only one tournament)
• \`dot!update-player <email> <field:value> [id]\` - Update enrolled player info (TO only, id optional if only one tournament)

**🎮 Match Management:**
• \`dot!matches [id] [download]\` - List all matches with round numbers and match IDs, or download schedule as CSV (id/download optional)
• \`dot!round [id] channel round\` - Start a round with match threads (id optional if only one tournament)
• \`dot!schedule [id] <CSV>\` - Import match schedule via CSV attachment (TO only, id optional if only one tournament)
• \`dot!score [id] score\` - Report your match score (id optional if only one tournament)
• \`dot!forcescore [id] score @winner\` - Override score as TO (id optional if only one tournament)

**🔧 Utility:**
• \`dot!coin\` / \`dot!toss\` - Flip a coin
• \`dot!close\` - Close an onboarding ticket (TO only)

**💡 Tip:** The \`id\` parameter is optional when there's only one tournament in the server!

**Need help?** Contact a Tournament Organizer!`;
```

**Step 3: Build and verify**

Run: `npm run build`

Expected: No TypeScript errors, `dist/config/index.js` created

**Step 4: Commit**

```bash
git add src/config/index.ts electron/config.ts
git commit -m "feat: add JSON config support alongside existing .env"
```

---

## Task 4: Implement Bot Process Management

**Files:**
- Modify: `electron/main.ts`

**Step 1: Update main.ts with bot process management**

Replace `electron/main.ts` with:

```typescript
import { app, BrowserWindow, ipcMain, ChildProcess } from 'electron';
import * as path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as os from 'os';
import { loadConfig, saveConfig, configToEnv, BotConfig, BotStatus } from './config';

let mainWindow: BrowserWindow | null = null;
let botProcess: ChildProcessWithoutNullStreams | null = null;
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

  botProcess.stdout.on('data', (data) => {
    const log = data.toString();
    mainWindow?.webContents.send('bot-log', log);
    console.log(`[BOT] ${log}`);
  });

  botProcess.stderr.on('data', (data) => {
    const log = data.toString();
    mainWindow?.webContents.send('bot-log', log);
    console.error(`[BOT ERROR] ${log}`);
  });

  botProcess.on('error', (error) => {
    mainWindow?.webContents.send('bot-error', error.message);
    console.error('Failed to start bot:', error);
  });

  botProcess.on('exit', (code) => {
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
```

**Step 2: Update preload.ts with additional API**

Add to `electron/preload.ts` (update the contextBridge.exposeInMainWorld):

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  startBot: (config: BotConfig) => ipcRenderer.send('start-bot', config),
  stopBot: () => ipcRenderer.send('stop-bot'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  getNetworkIP: () => ipcRenderer.invoke('get-network-ip'),
  onBotLog: (callback: (log: string) => void) => {
    ipcRenderer.on('bot-log', (_event, log) => callback(log));
  },
  onBotStatus: (callback: (status: BotStatus) => void) => {
    ipcRenderer.on('bot-status', (_event, status) => callback(status));
  },
  onBotError: (callback: (error: string) => void) => {
    ipcRenderer.on('bot-error', (_event, error) => callback(error));
  },
  onConfigLoaded: (callback: (config: BotConfig) => void) => {
    ipcRenderer.on('config-loaded', (_event, config) => callback(config));
  }
});
```

**Step 3: Build and test**

Run: `npm run electron:build && npm run electron:dev`

Expected: Electron opens, can start/stop bot from UI

**Step 4: Commit**

```bash
git add electron/main.ts electron/preload.ts
git commit -m "feat: implement bot process management with IPC"
```

---

## Task 5: Connect UI to Bot Process

**Files:**
- Modify: `ui/renderer.ts`
- Modify: `ui/index.html`

**Step 1: Update renderer.ts with full functionality**

Replace `ui/renderer.ts` with:

```typescript
interface ElectronAPI {
  startBot: (config: BotConfig) => void;
  stopBot: () => void;
  getStatus: () => Promise<BotStatus>;
  getNetworkIP: () => Promise<{ local: string; network: string }>;
  onBotLog: (callback: (log: string) => void) => void;
  onBotStatus: (callback: (status: BotStatus) => void) => void;
  onBotError: (callback: (error: string) => void) => void;
  onConfigLoaded: (callback: (config: BotConfig) => void) => void;
}

interface BotConfig {
  version: string;
  discord: { token: string };
  challonge: { username: string; token: string };
  bot: {
    defaultPrefix: string;
    defaultToRole: string;
    participantRole?: string;
  };
  database: { type: string; path?: string };
  web: { port: number };
  logging: { webhook?: string; level: string };
}

interface BotStatus {
  running: boolean;
  connectedServers: number;
  port: number;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// DOM elements
const configScreen = document.getElementById('config-screen')!;
const dashboardScreen = document.getElementById('dashboard-screen')!;
const configForm = document.getElementById('config-form')!;
const statusDot = document.getElementById('status-dot')!;
const statusText = document.getElementById('status-text')!;
const logContainer = document.getElementById('log-container')!;
const localUrlElement = document.getElementById('local-url')!;
const networkUrlElement = document.getElementById('network-url')!;
const autoScrollCheckbox = document.getElementById('auto-scroll') as HTMLInputElement;

let autoScroll = true;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupIPCHandlers();
  loadNetworkInfo();
});

function setupEventListeners(): void {
  configForm.addEventListener('submit', handleConfigSubmit);
  document.getElementById('load-config')?.addEventListener('click', loadConfigFromFile);
  document.getElementById('stop-btn')?.addEventListener('click', handleStopBot);
  document.getElementById('settings-btn')?.addEventListener('click', () => showConfigScreen());
  document.getElementById('web-interface-btn')?.addEventListener('click', openWebInterface);
  document.getElementById('export-logs-btn')?.addEventListener('click', exportLogs);
  autoScrollCheckbox?.addEventListener('change', (e) => {
    autoScroll = (e.target as HTMLInputElement).checked;
  });
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', handleCopyUrl);
  });
}

function setupIPCHandlers(): void {
  window.electronAPI.onBotLog((log: string) => {
    appendLog(log);
  });

  window.electronAPI.onBotStatus((status: BotStatus) => {
    updateStatus(status);
  });

  window.electronAPI.onBotError((error: string) => {
    appendLog(`ERROR: ${error}`, true);
  });

  window.electronAPI.onConfigLoaded((config: BotConfig) => {
    populateConfigForm(config);
    showDashboard();
  });
}

async function loadNetworkInfo(): Promise<void> {
  try {
    const ips = await window.electronAPI.getNetworkIP();
    localUrlElement.textContent = `http://${ips.local}:3000`;
    networkUrlElement.textContent = `http://${ips.network}:3000`;
  } catch (error) {
    console.error('Failed to get network IP:', error);
  }
}

function showConfigScreen(): void {
  configScreen.classList.remove('hidden');
  dashboardScreen.classList.add('hidden');
}

function showDashboard(): void {
  configScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');
}

function populateConfigForm(config: BotConfig): void {
  (document.getElementById('discord-token') as HTMLInputElement).value = config.discord.token;
  (document.getElementById('challonge-username') as HTMLInputElement).value = config.challonge.username;
  (document.getElementById('challonge-token') as HTMLInputElement).value = config.challonge.token;
  (document.getElementById('bot-prefix') as HTMLInputElement).value = config.bot.defaultPrefix;
  (document.getElementById('bot-to-role') as HTMLInputElement).value = config.bot.defaultToRole;
}

function handleConfigSubmit(e: Event): void {
  e.preventDefault();
  const config: BotConfig = {
    version: '1.0.0',
    discord: { token: (document.getElementById('discord-token') as HTMLInputElement).value },
    challonge: {
      username: (document.getElementById('challonge-username') as HTMLInputElement).value,
      token: (document.getElementById('challonge-token') as HTMLInputElement).value
    },
    bot: {
      defaultPrefix: (document.getElementById('bot-prefix') as HTMLInputElement).value,
      defaultToRole: (document.getElementById('bot-to-role') as HTMLInputElement).value
    },
    database: { type: 'sqlite', path: './data/dot.db' },
    web: { port: 3000 },
    logging: { level: 'info' }
  };

  // Basic validation
  if (!config.discord.token || !config.challonge.username || !config.challonge.token) {
    alert('Please fill in all required fields');
    return;
  }

  window.electronAPI.startBot(config);
  showDashboard();
}

function loadConfigFromFile(): void {
  // Config is auto-loaded by Electron, this button is for manual reload
  window.location.reload();
}

function handleStopBot(): void {
  if (confirm('Are you sure you want to stop the bot?')) {
    window.electronAPI.stopBot();
    statusDot.classList.remove('running');
    statusText.textContent = 'Stopped';
  }
}

function updateStatus(status: BotStatus): void {
  if (status.running) {
    statusDot.classList.add('running');
    statusText.textContent = 'Running';
  } else {
    statusDot.classList.remove('running');
    statusText.textContent = 'Stopped';
  }
}

function appendLog(log: string, isError = false): void {
  const lines = log.trim().split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      const div = document.createElement('div');
      div.className = `log-line ${isError ? 'log-error' : 'log-info'}`;
      div.textContent = line;
      logContainer.appendChild(div);

      // Keep only last 1000 lines
      while (logContainer.children.length > 1000) {
        logContainer.removeChild(logContainer.firstChild!);
      }

      if (autoScroll) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }
  });
}

function openWebInterface(): void {
  const port = 3000;
  window.open(`http://localhost:${port}`, '_blank');
}

function exportLogs(): void {
  const logs = logContainer.innerText;
  const blob = new Blob([logs], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mlbb-bot-logs-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleCopyUrl(e: Event): void {
  const target = (e.currentTarget as HTMLElement).dataset.target;
  if (target) {
    const urlElement = document.getElementById(target);
    if (urlElement) {
      navigator.clipboard.writeText(urlElement.textContent || '');
      const btn = e.currentTarget as HTMLElement;
      const originalText = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    }
  }
}
```

**Step 2: Add hidden input for config loading**

Add to `ui/index.html` in the config form (after the buttons):

```html
<input type="file" id="config-file-input" accept=".json" style="display: none;">
```

**Step 3: Build and test**

Run: `npm run electron:build && npm run electron:dev`

Expected: Full UI functionality working - config, start/stop, logs display

**Step 4: Commit**

```bash
git add ui/renderer.ts ui/index.html
git commit -m "feat: connect UI to bot process with full IPC integration"
```

---

## Task 6: Add Embedded Web Interface Window

**Files:**
- Modify: `electron/main.ts`
- Modify: `ui/renderer.ts`

**Step 1: Add web window handler to main.ts**

Add to `electron/main.ts`:

```typescript
let webWindow: BrowserWindow | null = null;

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

// Add IPC handler
ipcMain.on('open-web-interface', () => {
  if (currentConfig) {
    createWebWindow(currentConfig.web.port);
  }
});
```

**Step 2: Update preload.ts**

Add to `electron/preload.ts` in the exposed API:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods ...
  openWebInterface: () => ipcRenderer.send('open-web-interface'),
});
```

**Step 3: Update renderer.ts**

Modify the `openWebInterface` function in `ui/renderer.ts`:

```typescript
function openWebInterface(): void {
  window.electronAPI.openWebInterface();
}
```

**Step 4: Build and test**

Run: `npm run electron:build && npm run electron:dev`

Expected: Clicking "Web Interface" opens embedded window with bot's web interface

**Step 5: Commit**

```bash
git add electron/main.ts electron/preload.ts ui/renderer.ts
git commit -m "feat: add embedded web interface window"
```

---

## Task 7: Build and Package

**Files:**
- Create: `assets/icon.ico` (Windows icon)
- Create: `assets/icon.icns` (macOS icon)
- Modify: `package.json`

**Step 1: Create asset directory**

Run: `mkdir -p assets`

**Step 2: Create placeholder icon file (optional)**

Note: For production, replace with actual icons. For now, electron-builder will use default icons.

**Step 3: Update package.json with build metadata**

Add to `package.json`:

```json
{
  "main": "dist/electron/main.js",
  "build": {
    "appId": "com.mlbb.tournament-bot",
    "productName": "MLBB Tournament Bot",
    "directories": {
      "output": "dist/installers",
      "buildResources": "assets"
    },
    "files": [
      "dist/electron/**/*",
      "dist/src/**/*",
      "ui/**/*",
      "data/**/*"
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "mac": {
      "target": "dmg",
      "icon": "assets/icon.icns",
      "category": "public.app-category.utilities"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

**Step 4: Build for Windows**

Run: `npm run build:win`

Expected: `dist/installers/MLBB Tournament Bot Setup X.X.X.exe` created

**Step 5: Build for macOS**

Run: `npm run build:mac`

Expected: `dist/installers/MLBB Tournament Bot-X.X.X.dmg` created

**Step 6: Test Windows build**

On Windows machine:
1. Run the `.exe` installer
2. Launch the app
3. Verify config screen appears
4. Enter credentials and start bot
5. Verify dashboard shows logs
6. Verify web interface opens

**Step 7: Test macOS build**

On macOS machine:
1. Open the `.dmg` file
2. Drag app to Applications
3. Launch the app
4. Verify same functionality as Windows

**Step 8: Commit**

```bash
git add package.json assets/
git commit -m "feat: add build configuration for Windows and macOS"
```

---

## Task 8: Add Error Handling & Port Detection

**Files:**
- Modify: `electron/main.ts`
- Create: `electron/port-detector.ts`

**Step 1: Create port detector utility**

Create `electron/port-detector.ts`:

```typescript
import * as net from 'net';

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
}

export async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
```

**Step 2: Update main.ts to use port detection**

Modify the `startBot` function in `electron/main.ts`:

```typescript
import { findAvailablePort } from './port-detector';

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

  // ... rest of bot spawning logic
}
```

**Step 3: Update preload.ts to expose port event**

Add to `electron/preload.ts`:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods ...
  onPortDetected: (callback: (port: number) => void) => {
    ipcRenderer.on('port-detected', (_event, { port }) => callback(port));
  }
});
```

**Step 4: Update renderer.ts to handle port changes**

Add to `ui/renderer.ts` in the setupIPCHandlers function:

```typescript
window.electronAPI.onPortDetected?.((port: number) => {
  localUrlElement.textContent = `http://localhost:${port}`;
  networkUrlElement.textContent = `http://${networkUrlElement.textContent?.split('://')[1]?.split(':')[0] || 'localhost'}:${port}`;
});
```

**Step 5: Build and test**

Run: `npm run electron:build && npm run electron:dev`

Expected: If port 3000 is in use, bot starts on 3001 and UI updates

**Step 6: Commit**

```bash
git add electron/port-detector.ts electron/main.ts electron/preload.ts ui/renderer.ts
git commit -m "feat: add port detection and auto-increment for web server"
```

---

## Task 9: Add Config Validation

**Files:**
- Create: `electron/config-validator.ts`
- Modify: `ui/renderer.ts`

**Step 1: Create config validator**

Create `electron/config-validator.ts`:

```typescript
import { BotConfig } from './config';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateConfig(config: Partial<BotConfig>): ValidationError[] {
  const errors: ValidationError[] = [];

  // Discord token validation (should be 59+ chars, base64-like)
  if (!config.discord?.token) {
    errors.push({ field: 'discord-token', message: 'Discord token is required' });
  } else if (config.discord.token.length < 50) {
    errors.push({ field: 'discord-token', message: 'Discord token appears invalid (too short)' });
  }

  // Challonge validation
  if (!config.challonge?.username) {
    errors.push({ field: 'challonge-username', message: 'Challonge username is required' });
  }

  if (!config.challonge?.token) {
    errors.push({ field: 'challonge-token', message: 'Challonge API key is required' });
  } else if (config.challonge.token.length < 20) {
    errors.push({ field: 'challonge-token', message: 'Challonge API key appears invalid (too short)' });
  }

  // Bot settings
  if (!config.bot?.defaultPrefix) {
    errors.push({ field: 'bot-prefix', message: 'Command prefix is required' });
  } else if (config.bot.defaultPrefix.length > 10) {
    errors.push({ field: 'bot-prefix', message: 'Command prefix should be 10 characters or less' });
  }

  if (!config.bot?.defaultToRole) {
    errors.push({ field: 'bot-to-role', message: 'TO role name is required' });
  }

  return errors;
}

export function displayErrors(errors: ValidationError[]): string {
  return errors.map(e => `${e.field}: ${e.message}`).join('\n');
}
```

**Step 2: Update renderer.ts to use validator**

Add to `ui/renderer.ts`:

```typescript
function validateFormConfig(): ValidationError[] {
  const config: Partial<BotConfig> = {
    discord: { token: (document.getElementById('discord-token') as HTMLInputElement).value },
    challonge: {
      username: (document.getElementById('challonge-username') as HTMLInputElement).value,
      token: (document.getElementById('challonge-token') as HTMLInputElement).value
    },
    bot: {
      defaultPrefix: (document.getElementById('bot-prefix') as HTMLInputElement).value,
      defaultToRole: (document.getElementById('bot-to-role') as HTMLInputElement).value
    }
  };

  // Validation rules
  const errors: ValidationError[] = [];

  if (!config.discord?.token) {
    errors.push({ field: 'discord-token', message: 'Discord token is required' });
  } else if (config.discord.token.length < 50) {
    errors.push({ field: 'discord-token', message: 'Discord token appears invalid' });
  }

  if (!config.challonge?.username) {
    errors.push({ field: 'challonge-username', message: 'Username is required' });
  }

  if (!config.challonge?.token || config.challonge.token.length < 20) {
    errors.push({ field: 'challonge-token', message: 'API key is required and must be valid' });
  }

  if (!config.bot?.defaultPrefix) {
    errors.push({ field: 'bot-prefix', message: 'Prefix is required' });
  }

  if (!config.bot?.defaultToRole) {
    errors.push({ field: 'bot-to-role', message: 'TO role name is required' });
  }

  return errors;
}

interface ValidationError {
  field: string;
  message: string;
}

function handleConfigSubmit(e: Event): void {
  e.preventDefault();

  const errors = validateFormConfig();
  if (errors.length > 0) {
    alert('Configuration errors:\n' + errors.map(e => `• ${e.message}`).join('\n'));
    return;
  }

  // ... rest of existing code
}
```

**Step 3: Build and test**

Run: `npm run electron:build && npm run electron:dev`

Expected: Invalid configs show error alerts, valid configs proceed

**Step 4: Commit**

```bash
git add electron/config-validator.ts ui/renderer.ts
git commit -m "feat: add config validation with user-friendly error messages"
```

---

## Task 10: Final Testing & Documentation

**Files:**
- Modify: `README.md`
- Create: `docs/DESKTOP_APP_SETUP.md`

**Step 1: Update main README**

Add to `README.md`:

```markdown
## Desktop App

A desktop application is available for easy deployment without requiring Node.js or Docker setup.

### Building the Desktop App

```bash
# Build for Windows
npm run build:win

# Build for macOS
npm run build:mac

# Build for both
npm run build:all
```

Installers are created in `dist/installers/`.

### Using the Desktop App

1. Run the installer and launch MLBB Tournament Bot
2. Enter your Discord bot token and Challonge credentials
3. Click "Save & Start Bot"
4. Access the web interface via the "🌐 Web Interface" button

See [docs/DESKTOP_APP_SETUP.md](docs/DESKTOP_APP_SETUP.md) for detailed setup instructions.
```

**Step 2: Create desktop app setup guide**

Create `docs/DESKTOP_APP_SETUP.md`:

```markdown
# Desktop App Setup Guide

## Installation

### Windows
1. Download `MLBB Tournament Bot Setup.exe`
2. Run the installer
3. Choose installation directory (default: `%LOCALAPPDATA%\Programs\mlbb-tournament-bot`)
4. Click "Finish" to launch the app

### macOS
1. Download `MLBB Tournament Bot-X.X.X.dmg`
2. Open the disk image
3. Drag "MLBB Tournament Bot" to Applications
4. Launch from Applications folder

## First Time Setup

1. **Discord Bot Token**
   - Go to https://discord.com/developers/applications
   - Create an application or select existing
   - Go to "Bot" section and click "Reset Token" (or copy existing)
   - Enable necessary intents (Server Members, Message Content)
   - Copy the token

2. **Challonge Credentials**
   - Go to https://challonge.com/settings/developer
   - Copy your API key
   - Your username is your Challonge username

3. **Bot Settings**
   - Command Prefix: Character(s) to prefix commands (default: `!`)
   - TO Role Name: Discord role name for Tournament Organizers (default: `Organizer`)

## Network Access

The web interface is accessible from other devices on your network:

- **Local URL**: http://localhost:3000 (only on this machine)
- **Network URL**: http://192.168.x.x:3000 (accessible from other devices)

Click the 📋 button to copy the URL to clipboard.

## Troubleshooting

### Bot won't start
- Verify Discord token is correct
- Check that port 3000 is not in use (app will try 3001, 3002, etc.)
- Check the logs in the dashboard for error messages

### Can't access web interface from other devices
- Ensure both devices are on the same network
- Check firewall settings on the machine running the bot
- Verify the network URL is correct

### Bot keeps disconnecting
- Check your internet connection
- Verify Discord token hasn't been reset
- Check Discord status at https://discordstatus.com
```

**Step 3: Run full test suite**

Run: `npm test`

Expected: All existing tests pass

**Step 4: Test desktop app manually**

- [ ] Windows installer runs correctly
- [ ] macOS installer runs correctly
- [ ] First-run config screen appears
- [ ] Saving config and starting bot works
- [ ] Dashboard displays logs
- [ ] Web interface button opens embedded window
- [ ] Stop bot button works
- [ ] Config persists across app restarts
- [ ] Network IP detection works
- [ ] Port auto-increment works when 3000 is busy
- [ ] Config validation rejects invalid inputs

**Step 5: Create final commit**

```bash
git add README.md docs/DESKTOP_APP_SETUP.md
git commit -m "docs: add desktop app setup documentation"
```

---

## Summary

This implementation plan creates a complete Electron desktop app that:

1. **Packages existing bot** - No changes to bot logic required
2. **Provides GUI configuration** - Easy setup without editing .env files
3. **Manages bot lifecycle** - Start/stop controls with status monitoring
4. **Shows live logs** - Real-time bot output in dashboard
5. **Embeds web interface** - Opens web UI within the app
6. **Detects network IP** - Shows URL for other devices on network
7. **Handles ports** - Auto-increments if default port is busy
8. **Validates config** - Catches errors before starting bot
9. **Builds executables** - Standalone installers for Windows and macOS
10. **Persists config** - Saves settings across app restarts

**Total estimated tasks:** 10
**Estimated time:** 6-8 hours for implementation
**Testing time:** 2-3 hours

## Dependencies to Install

```bash
npm install --save-dev electron@^33.0.0 electron-builder@^25.0.0
```

## Files Created/Modified

**Created:**
- `electron/` - All Electron main process code
- `ui/` - HTML/CSS/JS for renderer process
- `assets/` - Icons for packaged app
- `docs/DESKTOP_APP_SETUP.md` - Setup documentation

**Modified:**
- `package.json` - Added Electron dependencies and build scripts
- `src/config/index.ts` - Added JSON config support

## Notes for Implementation

- Use `@types/electron` for TypeScript support
- Test on both Windows and macOS before release
- Consider code signing for production releases
- Add auto-update capability (electron-updater) for future versions
- Source maps are included for debugging; disable for production builds
