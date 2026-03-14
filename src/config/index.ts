import dotenv from "dotenv";
dotenv.config();

function assertEnv(envvar: string): string {
	const value = process.env[envvar];
	if (value === undefined) {
		throw new Error(`Missing environment variable ${envvar}`);
	}
	return value;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/explicit-function-return-type
export function getConfig() {
	return {
		challongeUsername: assertEnv("CHALLONGE_USERNAME"),
		challongeToken: assertEnv("CHALLONGE_TOKEN"),
		defaultPrefix: assertEnv("DOT_DEFAULT_PREFIX"),
		defaultTORole: assertEnv("DOT_DEFAULT_TO_ROLE"),
		participantRole: process.env.DOT_PARTICIPANT_ROLE || "Participant",
		discordToken: assertEnv("DISCORD_TOKEN"),
		postgresqlUrl: process.env.POSTGRESQL_URL || "",
		sqliteDb: process.env.SQLITE_DB || "",
		webPort: parseInt(process.env.WEB_PORT || "3000", 10)
	};
}

export const helpMessage = `🏆 **MLBB Tournament Bot** 🏆

Your friendly tournament management bot for Discord!

**📋 Tournament Commands:**
• \`dot!add <url> <name>\` - Add a tournament via Challonge URL (TO only)
• \`dot!info [id]\` - Show tournament details (id optional if only one tournament)
• \`dot!list\` - List all ongoing tournaments
• \`dot!status [id] [new_status]\` - View or change tournament status (id optional if only one tournament)
• \`dot!sync [id]\` - Sync tournament info with Challonge (id optional if only one tournament)
• \`dot!update [id] name description\` - Update tournament info (id optional if only one tournament)

**👥 Host Management:**
• \`dot!addhost [id] @user\` - Add a tournament host (id optional if only one tournament)
• \`dot!removehost [id] @user\` - Remove a tournament host (id optional if only one tournament)

**📝 Registration & Setup:**
• \`dot!check\` - Auto-verify yourself or open an onboarding ticket
• \`dot!email <email>\` - Request email verification
• \`dot!verify <code>\` - Verify your email address
• \`dot!enroll [id] <CSV>\` - Enroll players via CSV attachment (id optional if only one tournament)
• \`dot!verify-player [id] <@user> <email>\` - Manually verify a player by email (TO only)
• \`dot!set-participant-role <id> <@role>\` - Set participant role for a tournament (TO only)
• \`dot!drop-player <email> [id]\` - Drop an enrolled player by email (TO only, id optional if only one tournament)
• \`dot!update-player <email> <field:value> [id]\` - Update enrolled player info (TO only, id optional if only one tournament)

**🎮 Match Management:**
• \`dot!matches [id] [download]\` - List all matches with round numbers and match IDs, or download schedule as CSV (id/download optional)
• \`dot!round [id] channel round\` - Start a round with match threads (id optional if only one tournament)
• \`dot!schedule [id] <CSV>\` - Import match schedule via CSV attachment (TO only, id optional if only one tournament)
• \`dot!score [id] score\` - Report your match score (id optional if only one tournament)
• \`dot!forcescore [id] score @winner\` - Override score as TO (id optional if only one tournament)

**🔧 Utility:**
• \`dot!coin\` / \`dot!toss\` - Flip a coin
• \`dot!close\` - Close an onboarding ticket channel (TO only)

**💡 Tip:** The \`id\` parameter is optional when there's only one tournament in the server!

**Need help?** Contact a Tournament Organizer!`;
