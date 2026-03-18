import "reflect-metadata";
import { createConnection } from "typeorm";
import { getLogger } from "../../util/logger";
import { ChallongeTournament } from "./ChallongeTournament";
import { Countdown } from "./Countdown";
import { Participant } from "./Participant";
import { EnrolledPlayer } from "./EnrolledPlayer";
import { MatchSchedule } from "./MatchSchedule";
import * as fs from "fs";
import * as path from "path";

const logger = getLogger("typeorm");

export async function initializeConnection(postgresqlUrl: string): Promise<void> {
	if (process.env.SQLITE_DB) {
		const dbPath = process.env.SQLITE_DB;
		const dbDir = path.dirname(dbPath);

		// Ensure directory exists
		if (!fs.existsSync(dbDir)) {
			fs.mkdirSync(dbDir, { recursive: true });
		}

		// Create empty database file if it doesn't exist
		if (!fs.existsSync(dbPath)) {
			fs.writeFileSync(dbPath, Buffer.from([]));
			logger.info(`Created new database file at ${dbPath}`);
		}

		await createConnection({
			type: "sqljs",
			location: dbPath,
			autoSave: true,
			autoSaveCallback: (data: Uint8Array) => {
				fs.writeFileSync(dbPath, Buffer.from(data));
			},
			entities: [
				ChallongeTournament,
				Countdown,
				Participant,
				EnrolledPlayer,
				MatchSchedule
			],
			logging: "all",
			logger: "debug",
			synchronize: true
		});
		logger.info(`Connected to SQLite via sql.js TypeORM at ${dbPath}`);
	} else {
		await createConnection({
			type: "postgres",
			url: postgresqlUrl,
			entities: [
				ChallongeTournament,
				Countdown,
				Participant,
				EnrolledPlayer,
				MatchSchedule
			],
			logging: "all",
			logger: "debug",
			synchronize: process.env.NODE_ENV !== "production"
		});
		if (process.env.NODE_ENV === "production") {
			logger.warn("Production mode: synchronize is disabled. Ensure migrations are run manually to keep schema in sync.");
		}
		logger.info(`Connected to PostgreSQL via TypeORM`);
	}
}

export {
	ChallongeTournament,
	Countdown,
	Participant,
	EnrolledPlayer,
	MatchSchedule
};
