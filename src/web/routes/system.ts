import { Router, Request, Response } from "express";
import os from "os";
import { ChallongeTournament } from "../../database/orm/ChallongeTournament";
import { EnrolledPlayer } from "../../database/orm/EnrolledPlayer";
import { MatchSchedule } from "../../database/orm/MatchSchedule";
import { getLogger, getRecentLogs } from "../../util/logger";
import { getBotClient } from "../server";

const router = Router();
const logger = getLogger("web:system");

/**
 * Helper to safely get the Discord client or null
 */
function tryGetBotClient() {
	try {
		return getBotClient();
	} catch (e) {
		return null;
	}
}


// API: Get system statistics
router.get("/api/system/stats", async (req: Request, res: Response) => {
	try {
		const tournamentCount = await ChallongeTournament.count();
		const playerCount = await EnrolledPlayer.count();
		const scheduleCount = await MatchSchedule.count();
		
		let discordGuilds = 0;
		const client = tryGetBotClient();
		if (client) {
			discordGuilds = client.guilds.cache.size;
		} else {
			logger.warn("Could not get Discord client for stats (bot not ready)");
		}


		// System info
		const system = {
			uptime: process.uptime(),
			memory: {
				free: os.freemem(),
				total: os.totalmem(),
				usage: process.memoryUsage().rss
			},
			platform: os.platform(),
			arch: os.arch(),
			cpus: os.cpus().length,
			nodeVersion: process.version
		};

		res.json({
			success: true,
			data: {
				tournaments: tournamentCount,
				players: playerCount,
				schedules: scheduleCount,
				discordGuilds,
				system
			}
		});
	} catch (error) {
		logger.error("Failed to fetch system stats:", error);
		res.status(500).json({ success: false, error: "Failed to fetch system stats" });
	}
});

// API: Get recent scrolls (logs)
router.get("/api/system/logs", (req: Request, res: Response) => {
	try {
		const logs = getRecentLogs();
		res.json({
			success: true,
			data: logs
		});
	} catch (error) {
		logger.error("Failed to fetch logs:", error);
		res.status(500).json({ success: false, error: "Failed to fetch logs" });
	}
});

// API: Get recent activity
router.get("/api/system/activity", async (req: Request, res: Response) => {
	try {
		const limit = parseInt(req.query.limit as string) || 10;

		// Get recent tournaments (ordered by primary key implicitly)
		const tournaments = await ChallongeTournament.find({
			take: limit,
		});

		const activities = tournaments.map(t => ({
			type: "tournament",
			message: `Tournament "${t.name}" (${t.status})`,
			timestamp: new Date().toISOString(), // Placeholder
		}));

		res.json({
			success: true,
			data: activities,
		});
	} catch (error) {
		logger.error("Failed to fetch system activity:", error);
		res.status(500).json({ success: false, error: "Failed to fetch system activity" });
	}
});

export default router;


