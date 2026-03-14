import { contextBridge, ipcRenderer } from 'electron';

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
