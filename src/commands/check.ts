import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	EmbedBuilder,
	PermissionsBitField
} from "discord.js";
import { CommandDefinition } from "../Command";
import { EnrolledPlayer } from "../database/orm/EnrolledPlayer";
import { ChallongeTournament } from "../database/orm/ChallongeTournament";
import { getLogger } from "../util/logger";
import { isTournamentOrganizer, assignParticipantRole, getParticipantRoleName, TO_COMMAND_BLOCKED, TICKETS_CATEGORY_NAME, TICKET_CHANNEL_PREFIX } from "../util";

const logger = getLogger("command:check");

const command: CommandDefinition = {
	name: "check-in",
	requiredArgs: [],
	executor: async (msg, _args, support) => {
		if (isTournamentOrganizer(msg.member)) {
			await msg.reply(TO_COMMAND_BLOCKED);
			return;
		}

		if (!msg.guild) return;

		// First, find the tournaments for this guild
		const tournaments = await ChallongeTournament.find({
			where: { owningDiscordServer: msg.guild.id }
		});

		// Block if all tournaments have check-in disabled
		if (tournaments.length > 0 && tournaments.every(t => t.checkInDisabled)) {
			await msg.reply("❌ Check in is already closed. Please contact the Tournament Organizer for assistance.");
			return;
		}

		// Then, find all enrolled players for those tournaments
		const tournamentIds = tournaments.map(t => t.tournamentId);

		let enrolledPlayers: EnrolledPlayer[] = [];
		if (tournamentIds.length > 0) {
			for (const tournamentId of tournamentIds) {
				const playersForTournament = await EnrolledPlayer.find({
					where: { tournamentId },
					relations: ["tournament"]
				});
				enrolledPlayers.push(...playersForTournament);
			}
		}

		const matchForms = [msg.author.username.toLowerCase()];
		if (msg.author.globalName) matchForms.push(msg.author.globalName.toLowerCase());
		// Member displayName requires fetching member if not cached, but author is user.
		const member = await msg.guild.members.fetch(msg.author.id).catch(() => null);
		if (member && member.displayName) matchForms.push(member.displayName.toLowerCase());

		const matchedPlayer = enrolledPlayers.find(
			p =>
				(p.discordUsername && matchForms.includes(p.discordUsername.toLowerCase())) ||
				(p.name && matchForms.includes(p.name.toLowerCase()))
		);

		if (matchedPlayer) {
			// If tournament relation is not loaded, fetch it manually
			if (!matchedPlayer.tournament) {
				const tournament = await ChallongeTournament.findOne({
					where: { tournamentId: matchedPlayer.tournamentId }
				});
				if (!tournament) {
					logger.error(`Could not find tournament with ID ${matchedPlayer.tournamentId}`);
					await msg.reply("An error occurred during verification. Please ask a TO for help.");
					return;
				}
				matchedPlayer.tournament = tournament;
			}

			// Block if this player's tournament has check-in disabled
			if (matchedPlayer.tournament.checkInDisabled) {
				await msg.reply("❌ Check in is already closed. Please contact the Tournament Organizer for assistance.");
				return;
			}

			if (matchedPlayer.verified) {
				// Check if user has the participant role
				const hasRole = member?.roles.cache.some(role =>
					role.name === getParticipantRoleName(matchedPlayer.tournament)
				);

				if (!hasRole && member) {
					const roleAssigned = await assignParticipantRole(member, matchedPlayer.tournament, logger, support.participantRole);
					if (roleAssigned) {
						await msg.reply(`Welcome back! Your participant role for **${matchedPlayer.tournament.name}** has been restored.`);
						return;
					}
				}

				await msg.reply(`You are already verified for the tournament **${matchedPlayer.tournament.name}**.`);
				return;
			}

			// If player has OTP set, they must use !verify command instead
			if (matchedPlayer.otp) {
				await msg.reply(`We found your enrollment, but you need to verify using your OTP. Please use \`!verify <your_otp>\` command in a ticket channel. Use \`!check-in\` again to create a ticket if needed.`);
				return;
			}

			// Auto-verify based on local database match
			// Players are verified by Discord username matching enrolled data
			// Team roles are assigned separately, Challonge uses team names
			try {
				matchedPlayer.verified = true;
				matchedPlayer.discordId = msg.author.id;
				matchedPlayer.discordUsername = msg.author.username;
				await matchedPlayer.save();

				// Assign participant role
				if (member) {
					const roleAssigned = await assignParticipantRole(member, matchedPlayer.tournament, logger, support.participantRole);
					if (!roleAssigned) {
						logger.warn(`Failed to assign participant role to ${msg.author.tag} during check command`);
					}
				}

				await msg.reply(
					`You have been successfully verified as **${matchedPlayer.name}** for **${matchedPlayer.tournament.name}**! You've been given the Participant role.`
				);
				return;
			} catch (err) {
				logger.error(`Error auto-verifying ${msg.author.tag} via check command:`, err);
				await msg.reply("An error occurred during verification. Please try again later or open a ticket.");
				return;
			}
		}

		// If no match was found, open an onboarding ticket
		const category = msg.guild.channels.cache.find(
			ch => ch.name.toLowerCase() === TICKETS_CATEGORY_NAME && ch.type === ChannelType.GuildCategory
		);

		// Check if user already has an open ticket by fetching all channels
		const allChannels = await msg.guild.channels.fetch();
		const existingTicket = allChannels.find(ch =>
			ch?.type === ChannelType.GuildText &&
			ch.name === `${TICKET_CHANNEL_PREFIX}${msg.author.username}`
		);

		if (existingTicket) {
			await msg.reply(`You already have an open ticket: <#${existingTicket.id}>`);
			return;
		}

		try {
			const channel = await msg.guild.channels.create({
				name: `${TICKET_CHANNEL_PREFIX}${msg.author.username}`,
				type: ChannelType.GuildText,
				parent: category?.id,
				permissionOverwrites: [
					{
						id: msg.guild.roles.everyone.id,
						deny: [PermissionsBitField.Flags.ViewChannel]
					},
					{
						id: msg.author.id,
						allow: [
							PermissionsBitField.Flags.ViewChannel,
							PermissionsBitField.Flags.SendMessages,
							PermissionsBitField.Flags.ReadMessageHistory,
							PermissionsBitField.Flags.AttachFiles,
							PermissionsBitField.Flags.EmbedLinks
						]
					}
				],
				reason: `Onboarding ticket via !check-in for ${msg.author.tag}`
			});

			const welcomeEmbed = new EmbedBuilder()
				.setTitle("Verification Missing")
				.setDescription(
					`Hi <@${msg.author.id}>, we couldn't automatically verify you based on your username.\n\nPlease use the command \`!email <your_email>\` in this channel to verify your identity and get your participant roles. If you need help, a Tournament Organizer will be with you shortly.`
				)
				.setColor("#00b0f4");

			const closeButton = new ButtonBuilder()
				.setCustomId("close_ticket")
				.setLabel("Close Ticket")
				.setStyle(ButtonStyle.Danger);

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(closeButton);

			await channel.send({
				content: `<@${msg.author.id}>`,
				embeds: [welcomeEmbed],
				components: [row]
			});

			await msg.reply(`We couldn't automatically verify you. A private ticket has been opened for you: <#${channel.id}>`);
		} catch (err) {
			logger.error(`Error creating ticket for ${msg.author.tag}:`, err);
			await msg.reply(`We couldn't verify you, and there was an issue creating a ticket. Please ask a TO for help.`);
		}
	}
};

export default command;
