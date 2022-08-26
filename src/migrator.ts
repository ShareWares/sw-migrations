import {DBClient, Migration, MigrationRow, MigrationStepResult} from "./migration-types";
import fs from 'fs'
import path from 'path'

let MigrationsAsc : Migration[]

/**
 *
 */
const resultNoneToRun : MigrationStepResult[] = [{
	action: 'skip',
	name: 'n/a',
	message: 'No migrations found to run'
}]


export function registerMigrations (newMigrations: Migration[]) {
	MigrationsAsc = newMigrations
	sortMigrationsAsc()
}

function sortMigrationsAsc () {
	MigrationsAsc = MigrationsAsc.sort((a,b) => a.name < b.name ? -1 : 1)

}

function getLastRegisteredMigration () : Migration | undefined {
	return MigrationsAsc[MigrationsAsc.length - 1]
}


export async function createMigrationFile (dir: string, migrationName: string) : Promise<string> {
	const now = new Date()
	console.log('migrationName', migrationName)
	const filename = [
		now.getUTCFullYear(),
		(now.getUTCMonth()+1).toString().padStart(2, '0'),
		now.getUTCDate().toString().padStart(2, '0'),
		now.getUTCHours().toString().padStart(2, '0'),
		now.getUTCMinutes().toString().padStart(2, '0'),
		now.getUTCSeconds().toString().padStart(2, '0'),
		migrationName.trim().split(/\s+/).join('-').toLowerCase()
	].join('-') + '.ts'
	const pathToFile = path.join(dir, filename)
	console.log('Trying to create ' + pathToFile)
	if (fs.existsSync(pathToFile)) {
		throw new Error(`Migration file already exists: ${pathToFile}`)
	}
	fs.writeFileSync(pathToFile, `
import {DBClient, Migration, MigrationStepResult} from "../../../migrator/migration-types";

const migration : Migration = {
	up: async function (db: DBClient) : Promise<MigrationStepResult> {
		await db.query(\`\`)
		return {
			action: 'up',
			message: ''
		}
	},
	down: async function (db: DBClient) : Promise<MigrationStepResult> {
		await db.query(\`\`)
		return {
			action: 'down',
			message: ''
		}
	}
}

export const up = migration.up
export const down = migration.down
`)
	return pathToFile
}

export async function runSqlFile (db: DBClient, file: string) {
	const content = fs.readFileSync(file, 'utf-8')
	return await db.query(content)
}

export async function registerMigrationsFromDir (dir: string) {
	console.log('Loading migration files from: ' +dir)
	const files = fs.readdirSync(dir)
	const newMigrations : Migration[] = []
	for (let i = 0; i < files.length; i++) {
		const file = files[i]
		const parsed = path.parse(file)
		if (parsed.ext !== '.ts') {
			continue
		}
		//console.log('Loading migration from file: ' + file)
		const name = parsed.name
		//console.log('Migration name: ' + name)
		// @ts-ignore
		const mig = await import(path.join(dir, file))
		const {up, down} = mig

		if (!up) {
			throw new Error(`No "up" step found for migration '${name}'`)
		}
		if (!down) {
			throw new Error(`No "down" step found for migration '${name}'`)
		}

		newMigrations.push({
			name: name,
			up,
			down
		})
	}
	registerMigrations(newMigrations)
}

export function printMigrations () {
	console.log('---------------------------------')
	console.log('Registered Migration Files:')
	MigrationsAsc.forEach((mig, i) => {
		console.log(` #${i+1} ${mig.name}`)
	})
	console.log('---------------------------------')
}

export async function printMigrationHistory (db: DBClient) {
	console.log('=================================')
	console.log('Migration History:')
	const rows = await getMigrationHistory(db)
	if (!rows.length) {
		console.log('  No migration history items found in migrations table')
	}
	rows.forEach((mig, i) => {
		console.log(` #${i+1} ${mig.name} @ ${mig.date}`)
	})
	console.log('=================================')
}

export async function ensureMigrationsTable (db: DBClient) {
	await db.query(`CREATE TABLE IF NOT EXISTS migrations (
		name VARCHAR(255) NOT NULL UNIQUE,
		date TIMESTAMP NOT NULL DEFAULT NOW()
	);`)
}

export async function getLatestHistoryRow (db: DBClient) : Promise<MigrationRow> {
	const res = await db.query(`SELECT name, date FROM migrations ORDER BY name DESC LIMIT 1`)
	return res[0]
}

export async function getLatestHistoryName (db: DBClient) : Promise<string> {
	const row = await getLatestHistoryRow(db)
	return row ? row.name : ''
}

export async function getMigrationHistory (db: DBClient) : Promise<MigrationRow[]> {
	const res = await db.query(`SELECT name, date FROM migrations ORDER BY date ASC`)
	return res
}

export async function getStatus (db: DBClient) : Promise<string> {
	await ensureMigrationsTable(db)
	const history = await getMigrationHistory(db)
	if (!history.length) {
		return `No migrations have been run`
	}
	return `Statuses: ` + history.map(x => `${x.name} @ ${x.date}`).join('\n')
}

export async function migrateToLatest (db: DBClient) : Promise<MigrationStepResult[]> {
	const latest = await getLatestHistoryName(db)
	let nextMigration : Migration

	// If at least one migration is in our history, then find the next one after that
	if (latest) {
		nextMigration = getRegisteredMigrationAfter(latest)

		if (!nextMigration) {
			return resultNoneToRun
		}
	} else {
		// Otherwise just grab the first one
		nextMigration = MigrationsAsc[0]
	}
	return await runMigrationsUpFromTo(db, latest, nextMigration.name)
}

export function getRegisteredMigrationAfter (name: string) : Migration | undefined {
	for (let i = 0; i < MigrationsAsc.length; i++) {
		const mig = MigrationsAsc[i]
		if (mig.name > name) {
			return mig
		}
	}
	return undefined
}

export function getRegisteredMigrationBefore (name: string) : Migration | undefined {
	for (let i = 0; i < MigrationsAsc.length; i++) {
		const mig = MigrationsAsc[i]
		if (mig.name === name) {
			if (i == 0) {
				return undefined
			}
			return MigrationsAsc[i-1]
		}
	}
	return undefined
}

export async function insertHistoryItem (db: DBClient, name: string) {
	const migration = getRegisteredMigrationByName(name)
	if (!migration) {
		throw new Error(`Cannot find a registered migration with name '${name}'. Check the name, and check the migrator/migrations folder`)
	}

	await db.query(`INSERT INTO migrations (name) VALUES (?)`, [name])
}

export async function removeHistoryItem (db: DBClient, name: string) {
	await db.query(`DELETE FROM migrations WHERE name = ?`, [name])
}

export async function clearHistory (db: DBClient,) {
	await db.query(`DELETE FROM migrations WHERE name IS NOT NULL`)
}

export function getRegisteredMigrationByName (name: string) : Migration | undefined {
	for (let i = 0; i < MigrationsAsc.length; i++) {
		const mig = MigrationsAsc[i]
		if (mig.name === name) {
			return mig
		}
	}
	return undefined
}

export async function migrateUpOne (db: DBClient) : Promise<MigrationStepResult[]> {
	const mostRecentlyRun = await getLatestHistoryName(db)
	let nextMigration : Migration

	// If at least one migration is in our history, then find the next one after that
	if (mostRecentlyRun) {
		nextMigration = getRegisteredMigrationAfter(mostRecentlyRun)

		if (!nextMigration) {
			return resultNoneToRun
		}
	} else {
		// Otherwise just grab the first one
		nextMigration = MigrationsAsc[0]
	}
	return await runMigrationsUpFromTo(db, mostRecentlyRun, nextMigration.name)
}

export async function migrateDownOne (db: DBClient) : Promise<MigrationStepResult[]> {
	const mostRecentlyRun = await getLatestHistoryName(db)

	if (!mostRecentlyRun) {
		return resultNoneToRun
	}

	const prevMigrationName = getPrevMigrationName(mostRecentlyRun)
	return await runMigrationsDownFromTo(db, mostRecentlyRun, prevMigrationName)
}

function getPrevMigrationName (name: string) {
	const prevMigration = getRegisteredMigrationBefore(name)
	return prevMigration ? prevMigration.name : ''
}

export async function migrateUninstall (db: DBClient) : Promise<MigrationStepResult[]> {
	const mostRecentName = await getLatestHistoryName(db)
	const destination = ''
	if (mostRecentName === destination) {
		return resultNoneToRun
	}
	return await runMigrationsDownFromTo(db, mostRecentName, destination)
}

export async function migrateReinstall (db: DBClient) : Promise<MigrationStepResult[]> {
	let results = await migrateUninstall(db)
	const found = results.filter(r => !!r.error)
	if (found.length > 0) {
		console.log('Found errors in the uninstall, skipping the install.')
		found.forEach((err, idx) => {
			console.log(' ERR [' + idx + ']: ', err)
		})
		return
	}
	const results2 = await migrateInstall(db)

	return results.concat(results2)
}

export async function migrateInstall (db: DBClient) : Promise<MigrationStepResult[]> {
	const mostRecentName = await getLatestHistoryName(db)
	const destination = getLastRegisteredMigration()
	if (!destination) {
		throw new Error(`Could not find the last registered migration`)
	}
	if (mostRecentName === destination.name) {
		return resultNoneToRun
	}
	return await runMigrationsUpFromTo(db, mostRecentName, destination.name)
}

export async function runMigrationsUpFromTo (db: DBClient, fromVersion: string, toVersion: string) : Promise<MigrationStepResult[]> {
	const results : MigrationStepResult[] = []
	for (let i = 0; i < MigrationsAsc.length; i++) {
		const mig = MigrationsAsc[i]

		if (mig.name <= fromVersion || mig.name > toVersion) {
			const result : MigrationStepResult = {
				name: mig.name,
				action: 'skip',
			}
			results.push(result)
			continue
		}
		try {
			const result = await runTimedMig(mig.name, mig.up, db)
			await insertHistoryItem(db, mig.name)
			result.name = mig.name
			results.push(result)
		} catch (ex) {
			// If we find an error from a specific step, we add it to our list of results and then stop looping our steps
			// and just return our current list of results
			const result : MigrationStepResult = {
				action: 'up',
				error: ex,
				name: mig.name
			}
			results.push(result)
			return results
		}
	}

	return results
}

async function runTimedMig (name: string, fn: (db: DBClient) => Promise<MigrationStepResult>, db: DBClient) {
	console.log('Running ' + name)
	const before = Date.now()
	const result = await fn(db)
	result.durationMS = Date.now() - before
	return result

}

export async function runMigrationsDownFromTo (db: DBClient, fromVersion: string, toVersion: string) : Promise<MigrationStepResult[]> {
	const results : MigrationStepResult[] = []
	for (let i = MigrationsAsc.length-1; i >= 0; i--) {
		const mig = MigrationsAsc[i]

		// If we reach a migration that is before our toVersion, we skill it
		// If you migrate from 13 to 8, we don't run down for 8,7,6,5,4,3,2 or 1
		if (mig.name <= toVersion) {
			const result : MigrationStepResult = {
				name: mig.name,
				action: 'skip'
			}
			results.push(result)
			continue
		}

		// If we have 13 registered migrations, and we are currently on version 7 and going down to 1
		// then we want to skip everything above our current version
		if (mig.name > fromVersion) {
			const result : MigrationStepResult = {
				name: mig.name,
				action: 'skip'
			}
			results.push(result)
			continue
		}

		try {
			const result = await runTimedMig(mig.name, mig.down, db)
			await removeHistoryItem(db, mig.name)
			result.name = mig.name
			results.push(result)
		} catch (ex) {
			// If we find an error from a specific step, we add it to our list of results and then stop looping our steps
			// and just return our current list of results
			const result : MigrationStepResult = {
				action: 'down',
				error: ex,
				name: mig.name,
			}
			results.push(result)
			return results
		}
	}

	return results
}
