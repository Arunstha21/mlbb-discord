import { CommandDefinition } from "../Command";
import { firstMentionOrFail, isTournamentHost } from "../util/discord";
import { getLogger } from "../util/logger";
import { resolveTournamentId } from "../util/tournament";

const logger = getLogger("command:addhost");

const command: CommandDefinition = {
	name: "addhost",
	requiredArgs: ["who"],
	optionalArgs: ["id"],
	executor: async (msg, args, support) => {
		let providedId: string | undefined;

		if (args.length === 2) {
			[providedId] = args;
		}

		const id = await resolveTournamentId(providedId, msg.guildId);
		const tournament = await support.database.authenticateHost(
			id,
			msg.author.id,
			msg.guildId,
			undefined,
			isTournamentHost(msg.member, id)
		);
		const newHost = firstMentionOrFail(msg);
		logger.verbose(
			JSON.stringify({
				channel: msg.channelId,
				message: msg.id,
				user: msg.author.id,
				tournament: id,
				command: "addhost",
				mention: newHost,
				event: "attempt"
			})
		);
		await support.database.addHost(id, newHost.id);

		// Grant tournament-specific admin role to the new host
		await support.hostRole.grant(newHost.id, {
			id: id,
			server: msg.guildId!
		});

		logger.verbose(
			JSON.stringify({
				channel: msg.channelId,
				message: msg.id,
				user: msg.author.id,
				tournament: id,
				command: "addhost",
				mention: newHost,
				event: "success"
			})
		);
		await msg.reply(`${newHost} added as a host for **${tournament.name}**!`);
	}
};

export default command;
