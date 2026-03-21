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
    password?: string;
  };
  logging: {
    webhook?: string;
    level: string;
  };
}

export interface BotStatus {
  running: boolean;
  connectedServers: number;
  port: number;
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
    SQLITE_DB: config.database.path || 'C:/mlbb-data/database/dot.db',
    POSTGRESQL_URL: config.database.url || '',
    WEB_PORT: config.web.port.toString(),
    WEB_PASSWORD: config.web.password || '',
    DOT_LOGGER_WEBHOOK: config.logging.webhook || '',
    DEBUG: process.env.DEBUG || 'dot:*',
    NODE_ENV: 'production'
  };
}
