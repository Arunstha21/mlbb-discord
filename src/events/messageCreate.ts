import { Client, Message } from "discord.js";
import { helpMessage } from "../config";
import { Command, CommandDefinition, CommandSupport } from "../Command";
import { getLogger } from "../util/logger";

const logger = getLogger("messageCreate");

export function makeHandler(
	bot: Client,
	prefix: string,
	commands: Record<string, CommandDefinition>,
	support: CommandSupport
): (msg: Message) => Promise<void> {
	const handlers: Record<string, Command> = {};
	for (const name in commands) {
		const def = commands[name];
		// Register by definition.name to support hyphenated commands (e.g. verify-player)
		handlers[def.name] = new Command(def);
	}
	return async function messageCreate(msg: Message): Promise<void> {
		// Ignore messages from all bots and replies
		if (msg.author.bot || msg.reference) {
			return;
		}
		if (bot.user && msg.mentions.has(bot.user, { ignoreEveryone: true, ignoreRoles: true })) {
			await msg.reply(helpMessage).catch(logger.error);
			return;
		}
		if (msg.content.startsWith(prefix)) {
			const terms = msg.content.split(" ");
			const cmdName = terms[0].slice(prefix.length).toLowerCase();
			// Split by spaces, trim each argument
			const args = terms.slice(1).map(s => s.trim()).filter(s => s.length > 0);
			await handlers[cmdName]?.run(msg, args, support);
		}
	};
}
