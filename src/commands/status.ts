import { CommandDefinition } from "../Command";
import { TournamentStatus } from "../database/interface";
import { isTournamentHost } from "../util/discord";
import { getLogger } from "../util/logger";
import { resolveTournamentId } from "../util/tournament";
import { ChallongeTournament } from "../database/orm";

const logger = getLogger("command:status");

const statusEmoji = {
	[TournamentStatus.PREPARING]: "🟡",
	[TournamentStatus.IPR]: "🟢",
	[TournamentStatus.COMPLETE]: "🏁"
} as const;

const command: CommandDefinition = {
	name: "status",
	requiredArgs: [],
	optionalArgs: ["id", "newStatus"],
	executor: async (msg, args, support) => {
		// If no args, show current status
		if (args.length === 0) {
			const id = await resolveTournamentId(undefined, msg.guildId);
			const tournament = await support.database.getTournament(id);

			await msg.reply(
				`**${tournament.name}** Status\n` +
				`Current Status: ${statusEmoji[tournament.status]} **${tournament.status}**\n\n` +
				`To change status, use: \`dot!status [id] <new_status>\`\n` +
				`Available statuses: \`preparing\`, \`in progress\`, \`complete\``
			);
			return;
		}

		// Handle Discord autocomplete weirdness - if we got 1 arg with a space, split it
		if (args.length === 1 && args[0].includes(" ")) {
			args = args[0].split(/\s+/);
		}

		// If only 1 arg, show status for that tournament
		if (args.length === 1) {
			const id = await resolveTournamentId(args[0], msg.guildId);
			const tournament = await support.database.getTournament(id);

			await msg.reply(
				`**${tournament.name}** Status\n` +
				`Current Status: ${statusEmoji[tournament.status]} **${tournament.status}**`
			);
			return;
		}

		// 2+ args: treat as [id] <newStatus>
		let providedId: string | undefined;
		let newStatusString: string;

		if (args.length === 2) {
			// Could be [id, status] or just [status] if id is omitted
			// Check if first arg looks like a status
			const possibleStatuses = ["preparing", "in", "progress", "ipr", "complete"];
			const firstArgLower = args[0].toLowerCase();

			if (possibleStatuses.includes(firstArgLower) || firstArgLower === "in") {
				// First arg is a status, no id provided
				newStatusString = args.join(" "); // Join in case it's "in progress"
			} else {
				// First arg is id, second is status
				providedId = args[0];
				newStatusString = args[1];
			}
		} else {
			// More than 2 args - assume first is id, rest is status
			providedId = args[0];
			newStatusString = args.slice(1).join(" ");
		}

		// Parse the new status
		let newStatus: TournamentStatus;
		const statusLower = newStatusString.toLowerCase().trim();

		if (statusLower === "preparing" || statusLower === "pending") {
			newStatus = TournamentStatus.PREPARING;
		} else if (statusLower === "in progress" || statusLower === "ipr" || statusLower === "underway") {
			newStatus = TournamentStatus.IPR;
		} else if (statusLower === "complete" || statusLower === "completed" || statusLower === "finished") {
			newStatus = TournamentStatus.COMPLETE;
		} else {
			await msg.reply(
				`❌ **Invalid Status**\n\n` +
				`Available statuses:\n` +
				`• \`preparing\` - Tournament is being set up\n` +
				`• \`in progress\` (or \`ipr\`) - Tournament is running\n` +
				`• \`complete\` - Tournament has finished\n\n` +
				`Usage: \`dot!status [id] <new_status>\``
			);
			return;
		}

		const id = await resolveTournamentId(providedId, msg.guildId);

		// Authenticate as host
		await support.database.authenticateHost(id, msg.author.id, msg.guildId, undefined, isTournamentHost(msg.member, id));

		// Update the status
		const tournament = await ChallongeTournament.findOne({ where: { tournamentId: id } });
		if (!tournament) {
			await msg.reply(`❌ Tournament \`${id}\` not found.`);
			return;
		}

		const oldStatus = tournament.status;
		tournament.status = newStatus;
		await tournament.save();

		logger.info(`Tournament ${id} status changed from ${oldStatus} to ${newStatus} by ${msg.author.id}`);

		await msg.reply(
			`✅ **Tournament Status Updated**\n\n` +
			`**${tournament.name}**\n` +
			`${statusEmoji[oldStatus]} ${oldStatus} → ${statusEmoji[newStatus]} **${newStatus}**`
		);
	}
};

export default command;
