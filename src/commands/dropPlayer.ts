import { CommandDefinition } from "../Command";
import { ChallongeTournament } from "../database/orm/ChallongeTournament";
import { EnrolledPlayer } from "../database/orm/EnrolledPlayer";
import { isTournamentOrganizer } from "../util";
import { getLogger } from "../util/logger";

const logger = getLogger("command:drop-player");

const command: CommandDefinition = {
	name: "drop-player",
	requiredArgs: ["email"],
	optionalArgs: ["tournamentId"],
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	executor: async (msg, args, _support) => {
		// Permission check
		if (!isTournamentOrganizer(msg.member) && !msg.member?.permissions.has("Administrator")) {
			await msg.reply("❌ Only Tournament Organizers can use this command.");
			return;
		}

		if (!msg.guild) return;

		// Parse arguments: email is first, tournament ID is optional second argument
		const email = args[0];
		const tournamentIdArg = args[1];

		// Resolve tournament
		let tournament;
		if (tournamentIdArg) {
			tournament = await ChallongeTournament.findOne({
				where: { tournamentId: tournamentIdArg }
			});
			if (!tournament) {
				await msg.reply(`❌ Tournament with ID "${tournamentIdArg}" not found.`);
				return;
			}
		} else {
			tournament = await ChallongeTournament.findOne({
				where: { owningDiscordServer: msg.guild.id }
			});
			if (!tournament) {
				await msg.reply("❌ No tournament found for this server.");
				return;
			}
		}

		// Find enrolled player by email
		const enrolledPlayer = await EnrolledPlayer.findOne({
			where: { tournament: { tournamentId: tournament.tournamentId }, email },
			relations: ["tournament"]
		});

		if (!enrolledPlayer) {
			await msg.reply(`❌ No enrolled player found with email "${email}" in tournament "${tournament.name}".`);
			return;
		}

		// Store player info for confirmation
		const playerName = enrolledPlayer.name || "Unknown";
		const playerTeam = enrolledPlayer.team || "No team";
		const wasVerified = enrolledPlayer.verified;

		// Remove the player
		await enrolledPlayer.remove();

		logger.info(`Dropped player ${playerName} (${email}) from tournament ${tournament.tournamentId}`);

		// Build success message
		let successMsg = `✅ Successfully dropped **${playerName}** (${email}) from tournament **${tournament.name}**.\n`;
		successMsg += `📋 Team: ${playerTeam} | Verified: ${wasVerified ? "Yes" : "No"}`;

		if (wasVerified) {
			successMsg += `\n\n⚠️ This player was verified. You may want to remove their roles manually.`;
		}

		await msg.reply(successMsg);
	}
};

export default command;
