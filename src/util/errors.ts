import { TournamentStatus } from "../database/interface";

export class UserError extends Error {}

export class FetchError extends Error {
	name = "FetchError";
	constructor(message: string, public cause?: Error) {
		super(message);
	}
}

export class ChallongeAPIError extends Error {}

export class ChallongeIDConflictError extends ChallongeAPIError {
	constructor(readonly tournamentId: string) {
		super(`Tournament ID ${tournamentId} already taken.`);
	}
}

export class TournamentNotFoundError extends UserError {
	constructor(readonly tournamentId: string) {
		super(`Unknown tournament ${tournamentId}.`);
		this.tournamentId = tournamentId;
	}
}

export class UnauthorisedHostError extends UserError {
	constructor(readonly hostId: string, readonly tournamentId: string) {
		super(`You are not authorised to use this command. Only tournament hosts can manage **${tournamentId}**.`);
	}
}

export class UnauthorisedPlayerError extends UserError {
	constructor(readonly playerId: string, readonly tournamentId: string) {
		super(`User ${playerId} not a player in tournament ${tournamentId}.`);
	}
}

export class UnauthorisedTOError extends UserError {
	constructor(readonly to: string) {
		super(`User ${to} not authorised to create tournaments in this server.`);
	}
}

export class AssertTextChannelError extends UserError {
	channelId: string;

	constructor(channelId: string) {
		super(`Channel ${channelId} is not a valid text channel`);
		this.channelId = channelId;
	}
}

export class BlockedDMsError extends UserError {
	constructor(userId: string) {
		super(`User <@${userId}> does not accept DMs from me! Please ask them to change their settings to allow this.`);
	}
}

export class AssertStatusError extends UserError {
	constructor(
		readonly tournamentId: string,
		readonly requiredStatus: TournamentStatus,
		readonly currentStatus: TournamentStatus
	) {
		super(`Tournament ${tournamentId} must be ${requiredStatus}, but is currently ${currentStatus}.`);
	}
}

/**
 * Checks if a tournament is complete and throws an error if so.
 * Use this in commands that should not run on completed tournaments.
 *
 * @param tournamentName - The name of the tournament (for error message)
 * @param status - The current status of the tournament
 * @throws {UserError} If tournament status is COMPLETE
 */
export function assertTournamentNotComplete(tournamentName: string, status: TournamentStatus): void {
	if (status === TournamentStatus.COMPLETE) {
		throw new UserError(`**${tournamentName}** has already concluded!`);
	}
}
