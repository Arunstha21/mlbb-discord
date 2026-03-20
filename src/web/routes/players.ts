import { Router, Request, Response } from "express";
import { EnrolledPlayer } from "../../database/orm/EnrolledPlayer";
import { ChallongeTournament } from "../../database/orm/ChallongeTournament";
import { Like } from "typeorm";
import { getLogger } from "../../util/logger";

const router = Router();
const logger = getLogger("web:players");

// API: Search players across all tournaments
router.get("/api/players/search", async (req: Request, res: Response) => {
	try {
		const { email, discordUsername, tournamentId } = req.query;

		// Build where conditions
		const whereConditions: any = {};

		if (email && typeof email === "string") {
			whereConditions.email = Like(`%${email}%`);
		}

		if (discordUsername && typeof discordUsername === "string") {
			whereConditions.discordUsername = Like(`%${discordUsername}%`);
		}

		if (tournamentId && typeof tournamentId === "string") {
			whereConditions.tournamentId = tournamentId;
		}

		// Fetch players with their tournaments
		const players = await EnrolledPlayer.find({
			where: whereConditions,
			relations: ["tournament"],
			order: {
				tournament: { name: "ASC" },
				team: "ASC",
			},
		});

		// Transform response
		const data = players.map((p) => ({
			id: p.id,
			email: p.email,
			name: p.name,
			team: p.team,
			discordUsername: p.discordUsername,
			discordId: p.discordId,
			verified: p.verified,
			challongeId: p.challongeId,
			tournament: {
				id: p.tournament.tournamentId,
				name: p.tournament.name,
			},
		}));

		res.json({
			success: true,
			data,
		});
	} catch (error) {
		logger.error("Failed to search players:", error);
		res.status(500).json({ success: false, error: "Failed to search players" });
	}
});

// Page: Player search
router.get("/players", (req: Request, res: Response) => {
	res.render("players/index", {
		title: "Player Search",
		path: "/players",
	});
});

export default router;
