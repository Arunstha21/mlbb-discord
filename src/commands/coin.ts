import { Message } from "discord.js";
import { CommandDefinition } from "../Command";

const command: CommandDefinition = {
	name: "coin",
	requiredArgs: [],
	executor: async (msg: Message) => {
		const result = Math.random() < 0.5 ? "Heads" : "Tails";
		await msg.reply(`🪙 The coin flip says: ${result}!`);
	}
};

export default command;
