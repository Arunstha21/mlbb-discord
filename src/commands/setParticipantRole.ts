import { CommandDefinition } from "../Command";
import { ChallongeTournament } from "../database/orm/ChallongeTournament";
import { isTournamentOrganizer } from "../util";
import { getLogger } from "../util/logger";

const logger = getLogger("command:setParticipantRole");

const command: CommandDefinition = {
	name: "set-participant-role",
	requiredArgs: ["tournamentId", "@role"],
	executor: async (msg, args) => {
		// Permission check
		if (!isTournamentOrganizer(msg.member) && !msg.member?.permissions.has("Administrator")) {
			await msg.reply("❌ Only Tournament Organizers can use this command.");
			return;
		}

		if (!msg.guild) return;

		const tournamentId = args[0];
		const roleMention = args[1];

		// Find tournament
		const tournament = await ChallongeTournament.findOne({
			where: { tournamentId }
		});

		if (!tournament) {
			await msg.reply(`❌ Tournament with ID "${tournamentId}" not found.`);
			return;
		}

		// Try to parse role mention (<@&roleId> format) or fall back to role name
		let roleName: string;
		const roleIdMatch = roleMention.match(/^<@&(\d+)>$/);
		if (roleIdMatch) {
			const roleId = roleIdMatch[1];
			const role = await msg.guild.roles.fetch(roleId).catch(() => null);
			if (!role) {
				await msg.reply("❌ Role not found in this server.");
				return;
			}
			roleName = role.name;
		} else {
			// Accept plain role name as fallback
			roleName = roleMention.replace(/^@/, "");
			const role = msg.guild.roles.cache.find(r => r.name === roleName);
			if (!role) {
				await msg.reply(`❌ Role "${roleName}" not found in this server. Please mention the role directly (e.g., @Participant).`);
				return;
			}
		}

		// Update tournament
		tournament.participantRoleName = roleName;
		await tournament.save();

		logger.info(`Set participant role to "${roleName}" for tournament ${tournamentId}`);

		await msg.reply(`✅ Participant role for tournament **${tournament.name}** set to **${roleName}**.`);
	}
};

export default command;
