import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { getLogger } from "../../util/logger";
import dotenv from "dotenv";

const router = Router();
const logger = getLogger("web:routes:config");

const envPath = path.resolve(process.cwd(), ".env");

// Helper to update .env file
function updateEnv(updates: Record<string, string>) {
	try {
        let envFileContent = "";
        if (fs.existsSync(envPath)) {
            envFileContent = fs.readFileSync(envPath, "utf-8");
        }
        
        const lines = envFileContent.split('\n');
        
        const updatedLines = [];
        const seenKeys = new Set<string>();

        // Update existing keys
        for (const line of lines) {
            const match = line.match(/^([^#=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                if (updates[key] !== undefined) {
                    updatedLines.push(`${key}=${updates[key]}`);
                    seenKeys.add(key);
                } else {
                    updatedLines.push(line);
                }
            } else {
                updatedLines.push(line);
            }
        }

        // Add new keys
        for (const [key, value] of Object.entries(updates)) {
            if (!seenKeys.has(key)) {
                updatedLines.push(`${key}=${value}`);
            }
        }

        fs.writeFileSync(envPath, updatedLines.join('\n'), "utf-8");
        
        // Reload dotenv to reflect changes in current process process.env if possible.
        // process.env won't automatically update for already destructured things, 
        // but it will update process.env itself.
        dotenv.config({ override: true });
        
        return true;
	} catch (error) {
		logger.error("Failed to update .env file:", error);
		return false;
	}
}

// Helper to get parsed .env
function getParsedEnv() {
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, "utf-8");
    return dotenv.parse(content);
}

// GET /config
router.get("/config", (req: Request, res: Response) => {
	try {
        const parsed = getParsedEnv();
        
        // Create an array or object to pass to view, EXCLUDING DISCORD_TOKEN
        const configData: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (key !== "DISCORD_TOKEN") {
                configData[key] = value;
            }
        }

		res.render("config/index", {
			title: "Configuration",
			path: "/config",
			configData,
			success: req.query.success === "true",
			error: req.query.error,
			botRestart: req.query.botRestart === "true",
			serverRestart: req.query.serverRestart === "true"
		});
	} catch (error) {
		logger.error("Error fetching config:", error);
		res.status(500).render("error", {
			title: "500 - Server Error",
			message: "Failed to load configuration.",
			path: "/config"
		});
	}
});

// POST /config
router.post("/config", (req: Request, res: Response) => {
	try {
        const body = req.body;
        
        // Exclude DISCORD_TOKEN just in case it was somehow submitted
        if (body.DISCORD_TOKEN) {
            delete body.DISCORD_TOKEN;
        }

        const oldEnv = getParsedEnv();

        let botRestart = false;
        let serverRestart = false;

        const success = updateEnv(body);

		if (success) {
            for (const [key, value] of Object.entries(body)) {
                if (oldEnv[key] !== value) {
                    if (key === "DOT_DEFAULT_PREFIX" || key === "DOT_DEFAULT_TO_ROLE") {
                        botRestart = true;
                    }
                    if (key === "SQLITE_DB") {
                        serverRestart = true;
                    }
                }
            }

            let redirectUrl = "/config?success=true";
            if (serverRestart) redirectUrl += "&serverRestart=true";
            else if (botRestart) redirectUrl += "&botRestart=true";

			res.redirect(redirectUrl);
		} else {
			res.redirect("/config?error=Failed to update configuration");
		}
	} catch (error) {
		logger.error("Error saving config:", error);
		res.redirect("/config?error=Server error while saving");
	}
});

export default router;
