import { AutocompleteInteraction, ChatInputCommandInteraction, ContextMenuCommandInteraction, SlashCommandStringOption } from "discord.js";
import { ILike } from "typeorm";
import { TournamentStatus } from "../database/interface";
import { ChallongeTournament } from "../database/orm";

export const tournamentOption = new SlashCommandStringOption()
	.setName("tournament")
	.setDescription("The ID of the tournament.")
	.setRequired(true)
	.setAutocomplete(true);

export async function autocompleteTournament(interaction: AutocompleteInteraction<"cached">): Promise<void> {
	const partialName = interaction.options.getFocused();
	const owningDiscordServer = interaction.guildId;
	const tournaments = await ChallongeTournament.find({
		where: [
			{ owningDiscordServer, status: TournamentStatus.IPR, tournamentId: ILike(`%${partialName}%`) },
			{ owningDiscordServer, status: TournamentStatus.PREPARING, tournamentId: ILike(`%${partialName}%`) }
		]
	});
	const matchingTournaments = tournaments.slice(0, 25).map(t => {
		return { name: t.name, value: t.tournamentId };
	});
	await interaction.respond(matchingTournaments);
}

export async function authenticateHost(
	tournament: ChallongeTournament,
	interaction: ChatInputCommandInteraction<"cached"> | ContextMenuCommandInteraction<"cached">
): Promise<boolean> {
	const method = interaction.deferred ? "editReply" : "reply";
	if (tournament.owningDiscordServer !== interaction.guildId) {
		await interaction[method]({
			content: `That tournament isn't in this server.`,
			ephemeral: !interaction.deferred
		});
		return false;
	}
	if (!tournament.hosts.includes(interaction.user.id)) {
		await interaction[method]({ content: `You cannot use this.`, ephemeral: !interaction.deferred });
		return false;
	}
	return true;
}


