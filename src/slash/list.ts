import { RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v10";
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { ChallongeTournament } from "../database/orm";
import { splitText } from "../util/index";
import { OrganiserRoleProvider } from "../role/organiser";
import { SlashCommand } from "../SlashCommand";
import { getLogger, Logger } from "../util/logger";

export class ListCommand extends SlashCommand {
	#logger = getLogger("command:list");

	constructor(private organiserRole: OrganiserRoleProvider) {
		super();
	}

	static override get meta(): RESTPostAPIApplicationCommandsJSONBody {
		return new SlashCommandBuilder()
			.setName("list")
			.setDescription("Enumerate all tournaments in this server.")
			.setDMPermission(false)
			.setDefaultMemberPermissions(0)
			.toJSON();
	}

	protected override get logger(): Logger {
		return this.#logger;
	}

	protected override async execute(interaction: ChatInputCommandInteraction<"cached">): Promise<void> {
		const toRole = await this.organiserRole.get(interaction.guild);
		if (!interaction.member.roles.cache.has(toRole)) {
			this.#logger.verbose(`Rejected /list attempt from ${interaction.user} in ${interaction.guildId}.`);
			await interaction.reply({ content: `You cannot use this.`, ephemeral: true });
			return;
		}

		const owningDiscordServer = interaction.guildId;
		const challonge = await ChallongeTournament.find({ where: { owningDiscordServer }, relations: [] });
		
		let text = "__Tournaments (ID | name | description | status)__\n";
		if (challonge.length) {
			text += challonge.map(t => `${t.tournamentId} | ${t.name} | ${t.description} | ${t.status}`).join("\n");
		} else {
			text += "None";
		}
		const [first, ...rest] = splitText(text);
		await interaction.reply(first);
		for (const message of rest) {
			await interaction.followUp(message);
		}
	}
}
