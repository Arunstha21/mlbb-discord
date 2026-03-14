import { MigrationInterface, QueryRunner } from "typeorm";

export class AddParticipantRoleName1699999999999 implements MigrationInterface {
	name = "AddParticipantRoleName1699999999999";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE challonge_tournament ADD COLUMN participantRoleName varchar(100)`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE challonge_tournament DROP COLUMN participantRoleName`);
	}
}
