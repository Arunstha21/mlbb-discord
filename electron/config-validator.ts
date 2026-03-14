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
