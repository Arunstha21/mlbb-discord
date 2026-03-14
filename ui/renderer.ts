// Type definitions for Electron API
export {};

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
  showDashboard();
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
