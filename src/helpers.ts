import {DBClient, Migration, MigrationStepResult} from "./migration-types";

export type AlertTypeMigrationOpts = {
	typesToAdd: string[]
	typesBefore: string[]
	name: string
	upMsg: string
	downMsg: string
}
console.log('adding a thing')
/**
 * This function is used inside migration files
 * As we add more alert types, this helper function can be used to easily write
 * the up/down steps to add/remove types to that table
 */
export function createAlertTypeMigration (opts: AlertTypeMigrationOpts) : Migration {
// These alerts were for errors that we have removed
	const typesAfter = opts.typesBefore.concat(opts.typesToAdd)

	const migration : Migration = {
		up: async function (db: DBClient) : Promise<MigrationStepResult> {
			const types = typesAfter.map(t => "'" + t + "'")

			const theEnum = `enum(${types})`
			const sql = `
        ALTER TABLE alerts MODIFY COLUMN type ${theEnum}
			`
			await db.query(sql)
			return {
				action: 'up',
				message: opts.upMsg
			}
		},
		down: async function (db: DBClient) : Promise<MigrationStepResult> {
			const types = opts.typesBefore.map(t => "'" + t + "'")
			await db.query(`
		UPDATE alerts SET type = NULL WHERE type NOT IN (${types});
		ALTER TABLE alerts MODIFY COLUMN type enum(${types})
		`)
			return {
				action: 'down',
				message: opts.downMsg
			}
		}
	}

	return migration
}
console.log('hi')
