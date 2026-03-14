import { RESTPostAPIApplicationCommandsJSONBody } from "discord-api-types/v10";
import {
	AutocompleteInteraction,
	ChatInputCommandInteraction,
	EmbedBuilder,
	EmbedField,
	SlashCommandBuilder
} from "discord.js";
import { ChallongeTournament } from "../database/orm";
import { AutocompletableCommand } from "../SlashCommand";
import { getLogger, Logger } from "../util/logger";
import { authenticateHost, autocompleteTournament, tournamentOption } from "./database";

export class InfoCommand extends AutocompletableCommand {
	#logger = getLogger("command:info");

	constructor() {
		super();
	}

	static override get meta(): RESTPostAPIApplicationCommandsJSONBody {
		return new SlashCommandBuilder()
			.setName("info")
			.setDescription("Check the details of a tournament.")
			.setDMPermission(false)
			.setDefaultMemberPermissions(0)
			.addStringOption(tournamentOption)
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
			where: { tournamentId },
			relations: ["enrolledPlayers"]
		});

		if (!(await authenticateHost(tournament, interaction))) {
			// rejection messages handled in helper
			return;
		}

		// For capacity: 0 means unlimited, otherwise show the limit
		const capacity = tournament.participantLimit === 0 ? "Unlimited" : `${tournament.participantLimit}`;

		const fields: EmbedField[] = [
			{ name: ":ticket: Capacity", value: capacity, inline: true },
			{
				name: ":tickets: CSV Enrolled",
				value: `**${tournament.enrolledPlayers.length}** players`,
				inline: true
			},
			{ name: ":notepad_spiral: Format", value: tournament.format, inline: true },
			{ name: ":hourglass: Status", value: tournament.status, inline: true }
		];

		const hosts = tournament.hosts.map(snowflake => `<@${snowflake}>`).join(" ");
		fields.push({ name: ":smile: Hosts", value: hosts, inline: true });

		const embed = new EmbedBuilder()
			.setTitle(`**${tournament.name}**`)
			.setFields(fields)
			.setFooter({ text: "Tournament details as of request time" });

		// Only set description if it exists and is not empty
		if (tournament.description) {
			embed.setDescription(tournament.description);
		}

		await interaction.reply({ embeds: [embed] });
	}
}
