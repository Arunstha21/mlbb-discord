import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { ChallongeTournament } from "./ChallongeTournament";

/**
 * A Discord user engaging with Dot. A user cannot "multiply-engage" with the
 * same tournament so a primary key is declared across the first two columns.
 */
@Entity()
export class Participant extends BaseEntity {
	/// Explicitly specify the foreign key for the below relation to avoid jank ORM naming.
	@PrimaryColumn()
	tournamentId!: string;

	/// Discord snowflake for the user. A uint64 is at most 20 digits in decimal.
	@PrimaryColumn({ length: 20 })
	discordId!: string;

	/// Whether this participant has a bye in the first round
	@Column({ default: false })
	hasBye!: boolean;

	/// The ORM relationship for the above foreign key. Must always exist or this entity is meaningless.
	@ManyToOne(() => ChallongeTournament, tournament => tournament.participants, {
		onDelete: "CASCADE"
	})
	@JoinColumn({ name: "tournamentId" })
	tournament!: ChallongeTournament;
}
