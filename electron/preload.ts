import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for the Electron API exposed to renderer
interface BotConfig {
  version: string;
  discord: { token: string };
  challonge: { username: string; token: string };
  bot: {
    defaultPrefix: string;
    defaultToRole: string;
    participantRole?: string;
  };
  database: { type: string; path?: string; url?: string };
  web: {
    port: number;
    autoIncrement: boolean;
  };
  logging: { webhook?: string; level: string };
}

interface BotStatus {
  running: boolean;
  connectedServers: number;
  port: number;
}

interface ElectronAPI {
  startBot: (config: BotConfig) => void;
  stopBot: () => void;
  getStatus: () => Promise<BotStatus>;
  getNetworkIP: () => Promise<{ local: string; network: string }>;
  onBotLog: (callback: (log: string) => void) => void;
  onBotStatus: (callback: (status: BotStatus) => void) => void;
  onBotError: (callback: (error: string) => void) => void;
  onConfigLoaded: (callback: (config: BotConfig) => void) => void;
  onPortDetected: (callback: (port: number) => void) => void;
  removeAllListeners: (channel: string) => void;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
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
  },
  onPortDetected: (callback: (port: number) => void) => {
    ipcRenderer.on('port-detected', (_event, { port }) => callback(port));
  },
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
} as ElectronAPI);
