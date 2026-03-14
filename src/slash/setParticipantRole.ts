import { RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v10";
import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../SlashCommand";
import { ChallongeTournament } from "../database/orm/ChallongeTournament";
import { getLogger, Logger } from "../util/logger";

export class SetParticipantRoleCommand extends SlashCommand<"cached"> {
	#logger = getLogger("slash:setParticipantRole");

	protected override get logger(): Logger {
		return this.#logger;
	}

	static override get meta(): RESTPostAPIApplicationCommandsJSONBody {
		return new SlashCommandBuilder()
			.setName("set-participant-role")
			.setDescription("Set the participant role for a tournament (TO only)")
			.setDMPermission(false)
			.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
			.addStringOption(option =>
				option
					.setName("tournament")
					.setDescription("The tournament ID")
					.setRequired(true)
			)
			.addRoleOption(option =>
				option
					.setName("role")
					.setDescription("The role to assign to verified participants")
					.setRequired(true)
			)
			.toJSON();
	}

	protected override async execute(interaction: ChatInputCommandInteraction<"cached">): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const tournamentId = interaction.options.getString("tournament", true);
		const role = interaction.options.getRole("role", true);

		// Find tournament
		const tournament = await ChallongeTournament.findOne({ where: { tournamentId } });

		if (!tournament) {
			await interaction.editReply(`❌ Tournament with ID "${tournamentId}" not found.`);
			return;
		}

		// Update tournament
		tournament.participantRoleName = role.name;
		await tournament.save();

		this.#logger.info(`Set participant role to "${role.name}" for tournament ${tournamentId}`);

		await interaction.editReply(
			`✅ Participant role for tournament **${tournament.name}** set to **${role.name}**.\n` +
			`Future verifications will assign this role to players.`
		);
	}
}
