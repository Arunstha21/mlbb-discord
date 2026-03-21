import { EmbedBuilder } from "discord.js";
import { CommandDefinition } from "../Command";
import { ChallongeTournament } from "../database/orm/ChallongeTournament";
import { EnrolledPlayer } from "../database/orm/EnrolledPlayer";
import { assignParticipantRole, isTournamentOrganizer, parseUserMention, addUserToMatchThreads } from "../util";
import { getLogger } from "../util/logger";

const logger = getLogger("command:verifyPlayer");

const command: CommandDefinition = {
	name: "verify-player",
	requiredArgs: ["@user", "email"],
	optionalArgs: ["tournamentId"],
	executor: async (msg, args, support) => {
		// Permission check
		if (!isTournamentOrganizer(msg.member) && !msg.member?.permissions.has("Administrator")) {
			await msg.reply("❌ Only Tournament Organizers can use this command.");
			return;
		}

		if (!msg.guild) return;

		// Parse arguments
		const userMention = args[0];
		const email = args[1].trim().toLowerCase();
		const tournamentIdArg = args[2];

		// Parse user mention
		const userId = parseUserMention(userMention);
		if (!userId) {
			await msg.reply("❌ First argument must be a user mention (e.g., @user).");
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

		// Find enrolled player by email (case-insensitive)
		const enrolledPlayer = await EnrolledPlayer.createQueryBuilder("player")
			.innerJoinAndSelect("player.tournament", "tournament")
			.where("tournament.tournamentId = :tournamentId", { tournamentId: tournament.tournamentId })
			.andWhere("LOWER(player.email) = LOWER(:email)", { email })
			.getOne();

		if (!enrolledPlayer) {
			await msg.reply(`❌ No enrolled player found with email "${email}" in tournament "${tournament.name}".`);
			return;
		}

		// Check if already verified to different user
		if (enrolledPlayer.verified && enrolledPlayer.discordId !== userId) {
			const warnEmbed = new EmbedBuilder()
				.setTitle("⚠️ Already Verified")
				.setDescription(`Player ${enrolledPlayer.name} (${email}) is already verified as <@${enrolledPlayer.discordId}>.\n\nDo you want to reassign to <@${userId}>?`)
				.setColor("#FF9900");

			await msg.reply({ embeds: [warnEmbed] });
			// For simplicity, we'll require them to use a different flow or contact support
			return;
		}

		// Get mentioned user
		const member = await msg.guild.members.fetch(userId).catch(() => null);
		if (!member) {
			await msg.reply("❌ User is not in this server.");
			return;
		}

		// Already verified to same user
		if (enrolledPlayer.verified && enrolledPlayer.discordId === userId) {
			await msg.reply(`ℹ️ ${member} is already verified as ${enrolledPlayer.name}. No changes needed.`);
			return;
		}

		// Update database
		enrolledPlayer.verified = true;
		enrolledPlayer.discordId = member.id;
		enrolledPlayer.discordUsername = member.user.username;
		await enrolledPlayer.save();

		logger.info(`Manually verified ${member.user.tag} as ${enrolledPlayer.name} (${email}) for tournament ${tournament.tournamentId}`);

		// Assign participant role
		const participantRoleAssigned = await assignParticipantRole(member, enrolledPlayer.tournament, logger, support.participantRole);
		if (!participantRoleAssigned) {
			await msg.reply(`⚠️ Verified ${enrolledPlayer.name}, but failed to assign participant role. Please create the role or use \`!set-participant-role\`.`);
			return;
		}

		// Add user to existing match threads if verification happened after thread creation
		await addUserToMatchThreads(msg.guild, enrolledPlayer, support.challonge);

		// Build success message
		const successMsg = `✅ Successfully verified ${member} as **${enrolledPlayer.name}** from team **${enrolledPlayer.team || "No team"}**!`;

		await msg.reply(successMsg);
	}
};

export default command;
