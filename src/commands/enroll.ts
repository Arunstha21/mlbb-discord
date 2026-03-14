import { CommandDefinition } from "../Command";
import { EnrolledPlayer } from "../database/orm/EnrolledPlayer";
import { isTournamentHost } from "../util/discord";
import { getLogger } from "../util/logger";
import { ChallongeTournament } from "../database/orm/ChallongeTournament";
import { resolveTournamentId } from "../util/tournament";
import { downloadAndValidateCSV, parseCSVRow } from "../util";

const logger = getLogger("command:enroll");

const command: CommandDefinition = {
	name: "enroll",
	requiredArgs: [],
	optionalArgs: ["id", "register"],
	executor: async (msg, args, support) => {
		const [providedId, registerFlag] = args;
		const shouldRegisterToChallonge = registerFlag === "register";
		const id = await resolveTournamentId(providedId, msg.guildId);
		const tournament = await support.database.authenticateHost(id, msg.author.id, msg.guildId, undefined, isTournamentHost(msg.member, id));

		const attachment = msg.attachments.first();
		let csvText: string;
		try {
			csvText = await downloadAndValidateCSV(attachment);
		} catch (err) {
			if (err instanceof Error) {
				await msg.reply(err.message);
			} else {
				await msg.reply("Failed to process CSV file.");
			}
			return;
		}

		const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

		const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase());
		const emailIdx = headers.findIndex(h => h.includes("email"));
		const nameIdx = headers.findIndex(h => h.includes("name"));
		const teamIdx = headers.findIndex(h => h.includes("team"));
		const discordUsernameIdx = headers.findIndex(h => h.includes("discord"));

		if (emailIdx === -1 || nameIdx === -1 || teamIdx === -1) {
			await msg.reply("The CSV header must at least contain 'teamName', 'name' and 'email' columns.");
			return;
		}

		let addedCount = 0;
		let updatedCount = 0;
		let challongeRegisteredCount = 0;

		// For the purpose of this edit, we'll keep the original loop structure.
		let challongeTournament: ChallongeTournament;
		try {
			challongeTournament = await ChallongeTournament.findOneOrFail({ where: { tournamentId: id } });
		} catch (e) {
			await msg.reply("Could not find the tournament in the database.");
			return;
		}

		// First pass: Parse CSV and collect enrollment data
		type EnrollmentData = {
			email: string;
			name: string;
			team: string;
			discordUsername?: string;
			enrolledPlayer?: EnrolledPlayer;
			isNew: boolean;
		};

		const enrollments: EnrollmentData[] = [];
		const teamsToRegister = new Set<string>(); // Teams that need Challonge registration

		for (let i = 1; i < lines.length; i++) {
			const columns = parseCSVRow(lines[i]);
			const email = columns[emailIdx];
			if (!email) continue;
			const name = columns[nameIdx] || "";
			const team = columns[teamIdx] || "";
			const discordUsername = discordUsernameIdx !== -1 ? columns[discordUsernameIdx] : undefined;

			let enrolledPlayer = await EnrolledPlayer.findOne({
				where: { tournamentId: challongeTournament.tournamentId, email },
				relations: ["tournament"]
			});

			const isNew = !enrolledPlayer;
			if (!enrolledPlayer) {
				enrolledPlayer = new EnrolledPlayer();
				enrolledPlayer.tournament = challongeTournament;
				enrolledPlayer.tournamentId = challongeTournament.tournamentId;
				enrolledPlayer.email = email;
				addedCount++;
			} else {
				updatedCount++;
			}
			enrolledPlayer.name = name;
			enrolledPlayer.team = team;
			enrolledPlayer.discordUsername = discordUsername;

			// Track teams that need Challonge registration
			if (shouldRegisterToChallonge && !enrolledPlayer.challongeId && team) {
				teamsToRegister.add(team);
			}

			enrollments.push({ email, name, team, discordUsername, enrolledPlayer, isNew });
		}

		// Bulk register teams to Challonge in a single API call
		let challongeIdMap: Map<string, number> | null = null;
		if (shouldRegisterToChallonge && teamsToRegister.size > 0) {
			try {
				const teamsArray = Array.from(teamsToRegister);
				logger.verbose(`Bulk registering ${teamsArray.length} teams to Challonge...`);
				challongeIdMap = await support.challonge.bulkAddParticipants(challongeTournament.getChallongeIdForApi(), teamsArray);
				challongeRegisteredCount = challongeIdMap.size;
				logger.verbose(`Successfully registered ${challongeRegisteredCount} teams to Challonge`);
			} catch (err) {
				logger.warn(`Failed to bulk register teams to Challonge:`, err);
			}
		}

		// Second pass: Save enrollment data with Challonge IDs
		for (const enrollment of enrollments) {
			if (challongeIdMap && enrollment.team && !enrollment.enrolledPlayer!.challongeId) {
				const challongeId = challongeIdMap.get(enrollment.team);
				if (challongeId) {
					enrollment.enrolledPlayer!.challongeId = challongeId;
					logger.verbose(`Assigned Challonge ID ${challongeId} to team "${enrollment.team}"`);
				}
			}
			await enrollment.enrolledPlayer!.save();
		}

		let responseMsg = `Enrolled data uploaded successfully! Added ${addedCount} new player(s) and updated ${updatedCount} existing record(s) for tournament **${tournament.name}**.`;
		if (shouldRegisterToChallonge && challongeRegisteredCount > 0) {
			responseMsg += `\n\n📝 Registered ${challongeRegisteredCount} team(s) to Challonge.`;
		}
		await msg.reply(responseMsg);
	}
};

export default command;
