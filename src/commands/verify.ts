import { EmbedBuilder } from "discord.js";
import { CommandDefinition } from "../Command";
import { EnrolledPlayer } from "../database/orm/EnrolledPlayer";
import { ChallongeTournament } from "../database/orm/ChallongeTournament";
import { getLogger } from "../util/logger";
import { isTournamentOrganizer, assignParticipantRole, TO_COMMAND_BLOCKED, NO_TOURNAMENTS_FOUND, addUserToMatchThreads, TICKET_CHANNEL_PREFIX } from "../util";

const logger = getLogger("command:verify");

const command: CommandDefinition = {
	name: "verify",
	requiredArgs: ["otp"],
	executor: async (msg, args, support) => {
		if (isTournamentOrganizer(msg.member)) {
			await msg.reply(TO_COMMAND_BLOCKED);
			return;
		}

		// Restrict to ticket channels only
		const isTicketChannel =
			msg.channel.isTextBased() &&
			"name" in msg.channel &&
			typeof msg.channel.name === "string" &&
			msg.channel.name.startsWith(TICKET_CHANNEL_PREFIX);

		if (!isTicketChannel) {
			await msg.reply("This command can only be used in ticket channels. Please use `!check-in` to create a ticket.");
			return;
		}

		const otp = parseInt(args[0], 10);
		if (isNaN(otp)) {
			await msg.reply("Please provide a valid numeric OTP.");
			return;
		}

		// Find tournaments in this guild
		const tournaments = await ChallongeTournament.find({
			where: { owningDiscordServer: msg.guildId! }
		});

		if (tournaments.length === 0) {
			await msg.reply(NO_TOURNAMENTS_FOUND);
			return;
		}

		const tournamentIds = tournaments.map(t => t.tournamentId);

		// Find unverified enrolled players
		const players = await EnrolledPlayer.find({
			where: { discordId: msg.author.id, verified: false },
			relations: ["tournament"]
		});

		const guildPlayers = players.filter(p => tournamentIds.includes(p.tournamentId));

		if (guildPlayers.length === 0) {
			const embed = new EmbedBuilder()
				.setTitle("Verification Failed")
				.setDescription("No pending verification found for you. Please use `!email <your_email>` first.")
				.setColor(0xff0000);
			await msg.reply({ embeds: [embed] });
			return;
		}

		// We assume all pending records for this user in this guild have the same OTP,
		// since !email sets it for all of them at once.
		const matchingPlayer = guildPlayers.find(p => p.otp === otp);

		if (!matchingPlayer) {
			const embed = new EmbedBuilder()
				.setTitle("Verification Failed")
				.setDescription("Invalid OTP provided. Please try again.")
				.setColor(0xff0000);
			await msg.reply({ embeds: [embed] });
			return;
		}

		// Verification passed! Process all linked tournaments
		const successfulTournaments: string[] = [];

		// Process all matching players in parallel for better performance
		const matchingPlayers = guildPlayers.filter(p => p.otp === otp);

		// Fetch member once for all operations
		const member = msg.member || await msg.guild?.members.fetch(msg.author.id).catch(() => null);

		const verificationPromises = matchingPlayers.map(async (player) => {
			try {
				// Mark player as verified in the database
				player.verified = true;
				player.otp = undefined;
				await player.save();

				// Assign participant role
				if (member && player.tournament) {
					const roleAssigned = await assignParticipantRole(member, player.tournament, logger, support.participantRole);
					if (!roleAssigned) {
						logger.warn(`Failed to assign participant role to ${msg.author.tag} during verify command`);
					}
				}

				// Add user to existing match threads if verification happened after thread creation
				if (msg.guild) {
					await addUserToMatchThreads(msg.guild, player, support.challonge);
				}

				return {
					success: true,
					tournamentId: player.tournamentId
				};
			} catch (err) {
				logger.error(`Failed to verify player ${player.name} for ${player.tournamentId}:`, err);
				return {
					success: false,
					tournamentId: player.tournamentId
				};
			}
		});

		const results = await Promise.all(verificationPromises);

		for (const result of results) {
			if (result.success) {
				successfulTournaments.push(result.tournamentId);
			}
		}

		if (successfulTournaments.length > 0) {
			let desc = "You have been successfully verified and added to the tournament roster!";

			// Auto-close the ticket channel if verification happened inside one
			const isTicketChannel =
				msg.channel.isTextBased() &&
				"name" in msg.channel &&
				typeof msg.channel.name === "string" &&
				msg.channel.name.startsWith(TICKET_CHANNEL_PREFIX);

			if (isTicketChannel) {
				desc += "\n\n🎟️ This ticket will be automatically closed in **5 seconds**. Welcome!";
			}

			const embed = new EmbedBuilder()
				.setTitle("Verification Successful")
				.setDescription(desc)
				.setColor(0x00ff00);
			await msg.reply({ embeds: [embed] });

			if (isTicketChannel) {
				setTimeout(async () => {
					try {
						await msg.channel.delete("Ticket auto-closed after successful verification");
					} catch (e) {
						logger.error("Failed to auto-close ticket channel after verification:", e);
					}
				}, 5000);
			}
		} else {
			const embed = new EmbedBuilder()
				.setTitle("Verification Failed")
				.setDescription("An error occurred during verification. Please try again or contact a Tournament Organizer.")
				.setColor(0xff0000);
			await msg.reply({ embeds: [embed] });
		}
	}
};

export default command;
