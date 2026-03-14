import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { Client } from "discord.js";
import { getConfig } from "../config";
import { getLogger } from "../util/logger";
import tournamentRoutes from "./routes/tournaments";
import participantRoutes from "./routes/participants";
import scheduleRoutes from "./routes/schedules";
import roundRoutes from "./routes/rounds";
import systemRoutes from "./routes/system";
import configRoutes from "./routes/config";
import expressLayouts from "express-ejs-layouts";

const logger = getLogger("web:server");

// Global bot client reference
let botClient: Client | null = null;

export function setBotClient(bot: Client) {
	botClient = bot;
}

export function getBotClient(): Client {
	if (!botClient) {
		throw new Error("Bot client not initialized. Call setBotClient() first.");
	}
	return botClient;
}

// Create Express app
export function createWebServer() {
	const app = express();
	const config = getConfig();
	const port = config.webPort || 3000;

	// Middleware
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));
	app.use(express.static(path.join(__dirname, "public")));

	// Set EJS as view engine
	app.use(expressLayouts);
	app.set("view engine", "ejs");
	app.set("views", path.join(__dirname, "views"));
	app.set("layout", "layout");
	// Disable view cache in development for easier template editing
	app.set("view cache", false);

	// Make common variables available to all views
	app.use((req: Request, res: Response, next: NextFunction) => {
		res.locals.path = req.path;
		res.locals.title = "Dot Tournament Admin";
		next();
	});

	// Request logging middleware
	app.use((req: Request, res: Response, next: NextFunction) => {
		logger.verbose(`${req.method} ${req.path}`);
		next();
	});

	// Health check endpoint
	app.get("/api/health", (req: Request, res: Response) => {
		res.json({ status: "ok", timestamp: new Date().toISOString() });
	});

	// Tournament routes
	app.use(tournamentRoutes);

	// Participant routes
	app.use(participantRoutes);

	// Schedule routes
	app.use(scheduleRoutes);

	// Round routes
	app.use(roundRoutes);

	// System routes
	app.use(systemRoutes);

	// Config routes
	app.use(configRoutes);

	// Redirect root to tournaments
	app.get("/", (req: Request, res: Response) => {
		res.redirect("/tournaments");
	});

	// System status page
	app.get("/system", (req: Request, res: Response) => {
		res.render("system", {
			title: "System Status",
			path: "/system",
		});
	});

	// 404 handler
	app.use((req: Request, res: Response) => {
		res.status(404).render("error", {
			title: "404 - Page Not Found",
			message: "The page you're looking for doesn't exist.",
			path: req.path,
		});
	});

	// Error handler
	app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
		logger.error(`Error handling ${req.path}:`, err);
		res.status(500).render("error", {
			title: "500 - Server Error",
			message: "Something went wrong. Please try again later.",
			path: req.path,
		});
	});

	// Start server
	return new Promise<void>((resolve, reject) => {
		const server = app.listen(port, () => {
			logger.notify(`Web server listening on port ${port}`);
			logger.notify(`Tournament admin available at http://localhost:${port}/tournaments`);
			resolve();
		});

		server.on("error", (err: Error) => {
			logger.error("Failed to start web server:", err);
			reject(err);
		});
	});
}
