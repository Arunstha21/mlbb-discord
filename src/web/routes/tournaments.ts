import { Router, Request, Response } from "express";
import { ChallongeTournament } from "../../database/orm/ChallongeTournament";
import { EnrolledPlayer } from "../../database/orm/EnrolledPlayer";
import { MatchSchedule } from "../../database/orm/MatchSchedule";
import { addTournament, syncTournamentWithChallonge } from "../../util/tournament";
import { getLogger } from "../../util/logger";
import { getBotClient } from "../server";
import { getConfig } from "../../config";
import { WebsiteWrapperChallonge } from "../../website/challonge";

const router = Router();
const logger = getLogger("web:tournaments");

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


// Helper to safely get string from params
function getIdParam(params: any): string {
	const id = params.id;
	return Array.isArray(id) ? id[0] : id;
}

// API: Get all tournaments
router.get("/api/tournaments", async (req: Request, res: Response) => {
	try {
		const tournaments = await ChallongeTournament.find();

		// Get verification counts for each tournament
		const tournamentData = await Promise.all(
			tournaments.map(async (t: ChallongeTournament) => {
				const verifiedCount = await EnrolledPlayer.count({
					where: { tournamentId: t.tournamentId, verified: true }
				});
				const unverifiedCount = await EnrolledPlayer.count({
					where: { tournamentId: t.tournamentId, verified: false }
				});
				return {
					id: t.tournamentId,
					challongeId: t.challongeTournamentId,
					name: t.name,
					description: t.description,
					status: t.status,
					format: t.format,
					server: t.owningDiscordServer,
					hosts: t.hosts,
					participantCount: 0,
					verifiedCount,
					unverifiedCount,
				};
			})
		);

		res.json({
			success: true,
			data: tournamentData
		});
	} catch (error) {
		logger.error("Failed to fetch tournaments:", error);
		res.status(500).json({ success: false, error: "Failed to fetch tournaments" });
	}
});

// API: Get single tournament with details
router.get("/api/tournaments/:id", async (req: Request, res: Response) => {
	try {
		const id = getIdParam(req.params);
		const tournament = await ChallongeTournament.findOne({
			where: { tournamentId: id }
		});

		if (!tournament) {
			return res.status(404).json({ success: false, error: "Tournament not found" });
		}

		// Get enrolled players count
		const enrolledCount = await EnrolledPlayer.count({
			where: { tournamentId: id }
		});

		// Get verified players count
		const verifiedCount = await EnrolledPlayer.count({
			where: { tournamentId: id, verified: true }
		});

		// Get unverified players count
		const unverifiedCount = await EnrolledPlayer.count({
			where: { tournamentId: id, verified: false }
		});

		// Get scheduled matches count
		const scheduledCount = await MatchSchedule.count({
			where: { tournamentId: id }
		});

		res.json({
			success: true,
			data: {
				id: tournament.tournamentId,
				challongeId: tournament.challongeTournamentId,
				name: tournament.name,
				description: tournament.description,
				status: tournament.status,
				format: tournament.format,
				server: tournament.owningDiscordServer,
				hosts: tournament.hosts,
				participantRoleName: tournament.participantRoleName,
				participantLimit: tournament.participantLimit,
				enrolledCount,
				verifiedCount,
				unverifiedCount,
				scheduledCount,
			}
		});
	} catch (error) {
		logger.error("Failed to fetch tournament:", error);
		res.status(500).json({ success: false, error: "Failed to fetch tournament" });
	}
});

// API: Create tournament
router.post("/api/tournaments", async (req: Request, res: Response) => {
	try {
		const { url, name, server } = req.body;

		if (!url || !name || !server) {
			return res.status(400).json({
				success: false,
				error: "Missing required fields: url, name, server"
			});
		}

		const userId = "web-admin";

		const result = await addTournament(url, name, server, userId);

		if (!result.success) {
			return res.status(400).json({ success: false, error: result.error });
		}

		res.json({
			success: true,
			data: {
				id: result.customName,
				challongeId: result.challongeId,
				url: result.url,
			}
		});
	} catch (error) {
		logger.error("Failed to create tournament:", error);
		res.status(500).json({ success: false, error: "Failed to create tournament" });
	}
});

// API: Update tournament
router.put("/api/tournaments/:id", async (req: Request, res: Response) => {
	try {
		const id = getIdParam(req.params);
		const { name, description, status, participantRoleName } = req.body;

		const tournament = await ChallongeTournament.findOne({
			where: { tournamentId: id }
		});

		if (!tournament) {
			return res.status(404).json({ success: false, error: "Tournament not found" });
		}

		if (name !== undefined) tournament.name = name;
		if (description !== undefined) tournament.description = description;
		if (status !== undefined) tournament.status = status;
		if (participantRoleName !== undefined) tournament.participantRoleName = participantRoleName;

		await tournament.save();

		res.json({ success: true, data: { id: tournament.tournamentId } });
	} catch (error) {
		logger.error("Failed to update tournament:", error);
		res.status(500).json({ success: false, error: "Failed to update tournament" });
	}
});

// API: Delete tournament
router.delete("/api/tournaments/:id", async (req: Request, res: Response) => {
	try {
		const id = getIdParam(req.params);

		const tournament = await ChallongeTournament.findOne({
			where: { tournamentId: id }
		});

		if (!tournament) {
			return res.status(404).json({ success: false, error: "Tournament not found" });
		}

		await tournament.remove();

		res.json({ success: true });
	} catch (error) {
		logger.error("Failed to delete tournament:", error);
		res.status(500).json({ success: false, error: "Failed to delete tournament" });
	}
});

// API: Sync tournament with Challonge
router.post("/api/tournaments/:id/sync", async (req: Request, res: Response) => {
	try {
		const id = getIdParam(req.params);

		const tournament = await ChallongeTournament.findOne({
			where: { tournamentId: id }
		});

		if (!tournament) {
			return res.status(404).json({ success: false, error: "Tournament not found" });
		}

		// Create challonge service instance
		const config = getConfig();
		const challonge = new WebsiteWrapperChallonge(config.challongeUsername, config.challongeToken);

		// Use shared sync utility
		const result = await syncTournamentWithChallonge(tournament, challonge);

		if (!result.success) {
			return res.status(500).json({ success: false, error: result.error });
		}

		logger.info(`Tournament "${result.name}" synced successfully via web API`);

		res.json({
			success: true,
			data: {
				id: tournament.tournamentId,
				name: result.name,
				status: result.status,
				format: result.format,
				participantLimit: result.participantLimit,
				matchedPlayers: result.matchedPlayers,
				addedSchedules: result.addedSchedules,
				skippedSchedules: result.skippedSchedules
			}
		});
	} catch (error) {
		logger.error("Failed to sync tournament:", error);
		res.status(500).json({ success: false, error: "Failed to sync tournament" });
	}
});

// API: Get list of servers (guilds) the bot is in
router.get("/api/servers", (req: Request, res: Response) => {
	try {
		const client = tryGetBotClient();
		if (!client) {
			return res.status(503).json({ 
				success: false, 
				error: "Bot client not ready. Please try again in a moment." 
			});
		}

		const guilds = client.guilds.cache.map(guild => ({
			id: guild.id,
			name: guild.name,
			memberCount: guild.memberCount,
			icon: guild.iconURL()
		}));

		res.json({
			success: true,
			data: guilds
		});
	} catch (error) {
		logger.error("Failed to fetch servers:", error);
		res.status(500).json({ success: false, error: "Failed to fetch servers" });
	}
});


// Page: Tournament list
router.get("/tournaments", (req: Request, res: Response) => {
	res.render("tournaments/list", {
		title: "Tournaments",
		path: "/tournaments",
	});
});

// Page: Tournament detail
router.get("/tournaments/:id", async (req: Request, res: Response) => {
	try {
		const id = getIdParam(req.params);
		const tournament = await ChallongeTournament.findOne({
			where: { tournamentId: id }
		});

		if (!tournament) {
			return res.status(404).render("error", {
				title: "Tournament Not Found",
				message: `The tournament "${id}" could not be found.`,
			});
		}

		res.render("tournaments/detail", {
			title: tournament.name,
			path: "/tournaments",
			tournamentId: tournament.tournamentId,
		});
	} catch (error) {
		logger.error("Failed to load tournament page:", error);
		res.status(500).render("error", {
			title: "Error",
			message: "Failed to load tournament page.",
		});
	}
});

export default router;
