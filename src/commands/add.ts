import { CommandDefinition } from "../Command";
import { addTournament, extractChallongeId } from "../util/tournament";
import { getLogger } from "../util/logger";
import { EnrolledPlayer } from "../database/orm";
import { TournamentFormat, TournamentStatus } from "../database/interface";

const logger = getLogger("command:add");

const command: CommandDefinition = {
	name: "add",
	requiredArgs: ["url", "...name"],
	optionalArgs: [],
	executor: async (msg, args, support) => {
		await support.organiserRole.authorise(msg);

		if (args.length < 2) {
			await msg.reply(
				`Missing tournament name. Expected format: !add https://challonge.com/xyz name`
			);
			return;
		}

		const url = args[0];
		const customName = args.slice(1).join(" ");

		// Validate URL format using centralized function
		try {
			extractChallongeId(url);
		} catch {
			await msg.reply(
				`Invalid Challonge URL. Expected format: !add https://challonge.com/xyz name`
			);
			return;
		}

		// Use shared service to add tournament
		const result = await addTournament(url, customName, msg.guildId!, msg.author.id);

		if (!result.success) {
			await msg.reply(result.error!);
			return;
		}

		logger.verbose(
			JSON.stringify({
				channel: msg.channelId,
				message: msg.id,
				user: msg.author.id,
				tournament: customName,
				command: "add",
				event: "success"
			})
		);

		// Auto-sync after adding tournament
		try {
			const tournamentData = await support.challonge.getTournament(result.challongeId);

			// Match enrolled players to Challonge participants by team name and store challongeId
			const enrolledPlayers = await EnrolledPlayer.find({
				where: { tournamentId: result.customName }
			});

			let matchedCount = 0;
			for (const enrolled of enrolledPlayers) {
				const challongePlayer = tournamentData.players.find(
					p => p.name.toLowerCase() === enrolled.team.toLowerCase()
				);

				if (challongePlayer && !enrolled.challongeId) {
					enrolled.challongeId = challongePlayer.challongeId;
					await enrolled.save();
					matchedCount++;
				}
			}

			// Map Challonge state to TournamentStatus
			let status: TournamentStatus | undefined;
			if (tournamentData.state) {
				switch (tournamentData.state) {
					case "pending":
						status = TournamentStatus.PREPARING;
						break;
					case "underway":
						status = TournamentStatus.IPR;
						break;
					case "complete":
						status = TournamentStatus.COMPLETE;
						break;
				}
			}

			// Map Challonge tournament type to TournamentFormat
			let format: TournamentFormat | undefined;
			if (tournamentData.format) {
				format = tournamentData.format as TournamentFormat;
			}

			const participantLimit = tournamentData.signupCap ?? 0;

			await support.database.synchronise(result.customName, {
				name: tournamentData.name,
				description: tournamentData.desc,
				players: tournamentData.players.map(({ challongeId, discordId }) => ({ challongeId, discordId })),
				status,
				format,
				participantLimit
			});

			logger.info(`Tournament "${result.customName}" auto-synced after adding via Discord command`);

			await msg.reply(
				`Tournament **${result.customName}** has been added and synced!\n\n` +
					`Challonge URL: ${result.url}\n` +
					`Challonge ID: ${result.challongeId}\n` +
					`Host: <@${result.userId}>\n` +
					`Status: ${status || "preparing"}\n` +
					`Format: ${format || "unknown"}`
			);
		} catch (syncError) {
			logger.error(`Auto-sync failed for tournament "${result.customName}":`, syncError);
			await msg.reply(
				`Tournament **${result.customName}** has been added!\n\n` +
					`Challonge URL: ${result.url}\n` +
					`Challonge ID: ${result.challongeId}\n` +
					`Host: <@${result.userId}>\n\n` +
					`⚠️ Auto-sync failed. Use \`!sync ${result.customName}\` to sync manually.`
			);
		}
	}
};

export default command;
