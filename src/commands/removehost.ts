import { CommandDefinition } from "../Command";
import { parseUserMention, isTournamentHost } from "../util/discord";
import { getLogger } from "../util/logger";
import { resolveTournamentId } from "../util/tournament";

const logger = getLogger("command:removehost");

const command: CommandDefinition = {
	name: "removehost",
	requiredArgs: ["who"],
	optionalArgs: ["id"],
	executor: async (msg, args, support) => {
		// Mirror of addhost
		// If both args provided: [providedId, who]
		// If only who provided: [who]
		let providedId: string | undefined;
		let who: string;

		if (args.length === 2) {
			[providedId, who] = args;
		} else {
			[who] = args;
		}

		const id = await resolveTournamentId(providedId, msg.guildId);
		const tournament = await support.database.authenticateHost(
			id,
			msg.author.id,
			msg.guildId,
			undefined,
			isTournamentHost(msg.member, id)
		);
		const newHost = parseUserMention(who) || who;
		logger.verbose(
			JSON.stringify({
				channel: msg.channelId,
				message: msg.id,
				user: msg.author.id,
				tournament: id,
				command: "removehost",
				mention: newHost,
				event: "attempt"
			})
		);
		await support.database.removeHost(id, newHost);

		// Remove tournament-specific admin role from the host
		await support.hostRole.ungrant(newHost, {
			id: id,
			server: msg.guildId!
		});

		logger.verbose(
			JSON.stringify({
				channel: msg.channelId,
				message: msg.id,
				user: msg.author.id,
				tournament: id,
				command: "removehost",
				mention: newHost,
				event: "success"
			})
		);
		await msg.reply(`<@${newHost}> removed as a host for **${tournament.name}**!`);
	}
};

export default command;
