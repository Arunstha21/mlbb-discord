import { Guild, ThreadChannel } from "discord.js";
import { MatchSchedule } from "../database/orm/MatchSchedule";
import { EnrolledPlayer } from "../database/orm/EnrolledPlayer";
import { ChallongeTournament } from "../database/orm/ChallongeTournament";
import { Not, IsNull } from "typeorm";
import { WebsitePlayer, WebsiteWrapperChallonge } from "../website/challonge";

/**
 * Adds a newly verified user to existing match threads for their matches.
 * This is necessary because private threads don't show previous messages to users
 * who join after the thread was created.
 *
 * @param guild - The Discord guild
 * @param player - The newly verified enrolled player
 * @param challongeService - The Challonge service for fetching match data
 * @returns Number of threads the user was added to
 */
export async function addUserToMatchThreads(
	guild: Guild,
	player: EnrolledPlayer,
	challongeService: WebsiteWrapperChallonge
): Promise<number> {
	if (!player.discordId) {
		return 0;
	}

	try {
		const member = await guild.members.fetch(player.discordId).catch(() => null);
		if (!member) {
			return 0;
		}

		// Find the tournament to get Challonge info
		const tournament = await ChallongeTournament.findOne({
			where: { tournamentId: player.tournamentId }
		});

		if (!tournament) {
			return 0;
		}

		// If no round is active, don't add user to any threads
		if (tournament.activeRound === null || tournament.activeRound === undefined) {
			return 0;
		}

		// Get all match schedules for this tournament's active round that have threads
		const schedules = await MatchSchedule.find({
			where: {
				tournamentId: player.tournamentId,
				roundNumber: tournament.activeRound,
				threadId: Not(IsNull())
			}
		});

		if (schedules.length === 0) {
			return 0;
		}

		// Get matches from Challonge to find which matches involve this player
		const allMatches = await challongeService.getMatches(tournament.challongeTournamentId, false);
		const allPlayers = await challongeService.getPlayers(tournament.challongeTournamentId);

		// Find the player's Challonge ID by name or team
		const playerChallonge = allPlayers.find((p: WebsitePlayer) => {
			// Match by player name first, then by team name
			return p.name === player.name || (player.team && p.name === player.team);
		});

		if (!playerChallonge) {
			return 0;
		}

		// Find all match IDs where this player participates
		const playerMatchIds = allMatches
			.filter(m => m.player1 === playerChallonge.challongeId || m.player2 === playerChallonge.challongeId)
			.map(m => m.matchId);

		// Find schedules with threads for these matches
		const relevantSchedules = schedules.filter(s => playerMatchIds.includes(s.matchId));

		let addedCount = 0;
		for (const schedule of relevantSchedules) {
			if (!schedule.threadId) continue;

			try {
				// Fetch the thread
				const thread = await guild.channels.fetch(schedule.threadId).catch(() => null);
				if (!thread || !(thread instanceof ThreadChannel)) {
					continue;
				}

				// Check if user is already a member of the thread
				if (thread.members.cache.has(member.id)) {
					continue;
				}

				// Add the user to the thread
				await thread.members.add(member.id, `User ${player.name} verified after thread creation`);

				// Send a mention message so the user gets notified
				await thread.send(`👋 <@${member.id}> has been verified for **${player.team || player.name}** and added to this match thread (Round ${tournament.activeRound}).`);

				addedCount++;

			} catch {
				// Silently skip errors for individual threads
			}
		}

		return addedCount;

	} catch {
		// Silently return 0 on any error
		return 0;
	}
}
