/**
 * Constants for Discord bot configuration.
 * Centralizes hardcoded strings to avoid duplication.
 */

// Error messages
export const TO_COMMAND_BLOCKED = "You are a Tournament Organizer. You do not need to verify or use participant commands.";

export const NO_TOURNAMENTS_FOUND = "No tournaments found in this server.";

// Discord channel and role names
export const TICKET_CHANNEL_PREFIX = "ticket-";

export const TICKETS_CATEGORY_NAME = "tickets";

/**
 * Generates the participant role name for a tournament.
 * @param tournamentId - The tournament ID
 * @returns The participant role name
 */
export function getParticipantRoleName(tournamentId: string): string {
	return `MC-${tournamentId}-player`;
}

// Team role configuration
export const TEAM_ROLE_HOIST = false;
export const TEAM_ROLE_MENTIONABLE = true;
