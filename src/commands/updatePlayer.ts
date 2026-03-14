import { CommandDefinition } from "../Command";
import { ChallongeTournament } from "../database/orm/ChallongeTournament";
import { EnrolledPlayer } from "../database/orm/EnrolledPlayer";
import { isTournamentOrganizer } from "../util";
import { getLogger } from "../util/logger";

const logger = getLogger("command:update-player");

const command: CommandDefinition = {
	name: "update-player",
	requiredArgs: ["email"],
	optionalArgs: ["fields...", "tournamentId"],
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	executor: async (msg, args, _support) => {
		// Permission check
		if (!isTournamentOrganizer(msg.member) && !msg.member?.permissions.has("Administrator")) {
			await msg.reply("❌ Only Tournament Organizers can use this command.");
			return;
		}

		if (!msg.guild) return;

		// Parse arguments: email is first, rest are field:value pairs, optionally tournament ID at end
		const email = args[0];
		const fieldUpdates: Record<string, string> = {};
		let tournamentIdArg: string | undefined;

		// Process remaining args
		for (let i = 1; i < args.length; i++) {
			const arg = args[i];

			// Check if this looks like a tournament ID (no colon)
			if (!arg.includes(":")) {
				tournamentIdArg = arg;
				break;
			}

			// Parse field:value
			const [field, ...valueParts] = arg.split(":");
			const value = valueParts.join(":");

			if (!field || !value) {
				await msg.reply(`❌ Invalid format: "${arg}". Use format: field:value`);
				return;
			}

			const normalizedField = field.toLowerCase();
			const validFields = ["email", "name", "team", "discord"];

			if (!validFields.includes(normalizedField)) {
				await msg.reply(`❌ Invalid field: "${field}". Valid fields are: ${validFields.join(", ")}.`);
				return;
			}

			fieldUpdates[normalizedField] = value;
		}

		// Check if any fields were provided
		if (Object.keys(fieldUpdates).length === 0) {
			await msg.reply("❌ No fields to update. Use format: `dot!update-player email field:value [field2:value2] [tournamentId]`\n\nExample: `dot!update-player john@example.com discord:rangotengo team:rango`");
			return;
		}

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

		// Store old values for logging and response
		const updates: Array<{ field: string; old: string; new: string }> = [];
		const oldEmail = enrolledPlayer.email;

		// Apply all updates
		for (const [field, value] of Object.entries(fieldUpdates)) {
			// Get old value before update
			let oldValue: string | undefined;
			switch (field) {
				case "email":
					oldValue = enrolledPlayer.email;
					enrolledPlayer.email = value;
					break;
				case "name":
					oldValue = enrolledPlayer.name;
					enrolledPlayer.name = value;
					break;
				case "team":
					oldValue = enrolledPlayer.team;
					enrolledPlayer.team = value;
					break;
				case "discord":
					oldValue = enrolledPlayer.discordUsername;
					enrolledPlayer.discordUsername = value;
					break;
			}

			updates.push({ field, old: oldValue || "(empty)", new: value });
		}

		// Save changes
		await enrolledPlayer.save();

		logger.info(`Updated player ${oldEmail}: ${JSON.stringify(updates)} for tournament ${tournament.tournamentId}`);

		// Build success message
		let responseMsg = `✅ Successfully updated **${enrolledPlayer.name}** (${oldEmail}):\n`;
		responseMsg += updates.map(u => `\`${u.field}\`: "${u.old}" → "${u.new}"`).join("\n");

		await msg.reply(responseMsg);
	}
};

export default command;
