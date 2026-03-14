import { RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v10";
import { AutocompleteInteraction, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { ChallongeTournament } from "../database/orm";
import { AutocompletableCommand } from "../SlashCommand";
import { getLogger, Logger } from "../util/logger";
import {
	authenticateHost,
	autocompleteTournament,
	tournamentOption
} from "./database";

export class UpdateCommand extends AutocompletableCommand {
	#logger = getLogger("command:update");

	constructor() {
		super();
	}

	static override get meta(): RESTPostAPIApplicationCommandsJSONBody {
		return new SlashCommandBuilder()
			.setName("update")
			.setDescription("Update the details of a tournament.")
			.setDMPermission(false)
			.setDefaultMemberPermissions(0)
			.addStringOption(tournamentOption)
			.addStringOption(option => option.setName("name").setDescription("The new name of the tournament."))
			.addStringOption(option =>
				option.setName("description").setDescription("The new description of the tournament.")
			)
			.toJSON();
	}

	protected override get logger(): Logger {
		return this.#logger;
	}

	override async autocomplete(interaction: AutocompleteInteraction<"cached">): Promise<void> {
		autocompleteTournament(interaction);
	}

	protected override async execute(interaction: ChatInputCommandInteraction<"cached">): Promise<void> {
		const tournamentId = interaction.options.getString("tournament", true);
		const tournament = await ChallongeTournament.findOneOrFail({
			where: { tournamentId }
		});

		if (!(await authenticateHost(tournament, interaction))) {
			// rejection messages handled in helper
			return;
		}

		const name = interaction.options.getString("name");
		const description = interaction.options.getString("description");

		let updated = false;

		if (name) {
			tournament.name = name;
			updated = true;
		}
		if (description) {
			tournament.description = description;
			updated = true;
		}

		if (!updated) {
			await interaction.reply({ content: `You must provide at least one detail to update a tournament.`, ephemeral: true });
			return;
		}

		await tournament.save();

		await interaction.reply(
			`Tournament updated with the following details:\nName: ${tournament.name}\nDescription: ${
				tournament.description
			}`
		);
	}
}
