import { CommandDefinition } from "../Command";
import { getLogger } from "../util/logger";
import { isTournamentOrganizer, TICKET_CHANNEL_PREFIX } from "../util";

const logger = getLogger("command:close");

const command: CommandDefinition = {
	name: "close",
	requiredArgs: [],
	executor: async (msg) => {
		const isTO = isTournamentOrganizer(msg.member);
		const isAdmin = msg.member?.permissions.has("Administrator");

		if (!isTO && !isAdmin) {
			await msg.reply("You must be a Tournament Organizer to manually close tickets.");
			return;
		}

		if (!msg.channel.isTextBased() || !('name' in msg.channel) || !msg.channel.name) {
			await msg.reply("This command can only be used in text channels.");
			return;
		}

		if (!msg.channel.name.startsWith(TICKET_CHANNEL_PREFIX)) {
			await msg.reply("This command can only be used in ticket channels.");
			return;
		}

		await msg.reply("Closing ticket in 5 seconds...");
		setTimeout(async () => {
			try {
				await msg.channel.delete("Ticket closed by TO");
			} catch (e) {
				logger.error("Failed to delete ticket channel:", e);
			}
		}, 5000);
	}
};

export default command;
