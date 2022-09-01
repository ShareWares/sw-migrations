import {
	clearHistory,
	createMigrationFile,
	ensureMigrationsTable,
	getLatestHistoryName,
	insertHistoryItem,
	migrateDownOne,
	migrateInstall,
	migrateReinstall,
	migrateUninstall,
	migrateUpOne,
	printMigrationHistory,
	printMigrations,
	registerMigrationsFromDir,
	removeHistoryItem
} from './migrator'
import {DBClient, MigrationStepResult} from "./migration-types";
import inquirer from 'inquirer'

function rightDots (str: string, len = 60) {
	return (str + '.'.repeat(150)).substr(0, len)
}

export const clrReset = "\x1b[0m"
export const clrRed = "\x1b[31m"
export const clrGreen = "\x1b[32m"
export const clrCyan = "\x1b[36m"
export const clrMagenta = "\x1b[35m"
export const bgWhite = "\x1b[47m"
export const clrBlack = "\x1b[30m"


export function red (str) {
	return clrRed + str + clrReset
}

export function green (str) {
	return clrGreen + str + clrReset
}

export function cyan (str) {
	return clrCyan + str + clrReset
}


export type MigraterOptions = {
	migrationsDir: string
	skipConfirmations: boolean
	confirmOrExit: (msg: string) => void,
	databaseName: string,
}

export default async function run (db: DBClient, {confirmOrExit, migrationsDir, skipConfirmations, databaseName}: MigraterOptions) : Promise<number> {
	await registerMigrationsFromDir(migrationsDir)
	await ensureMigrationsTable(db)

	const action = process.argv[2]
	printMigrations()
	await printMigrationHistory(db)

	console.log('.')
	console.log(' .')
	console.log('  .')
	console.log(' .')
	console.log('.')

	// These actions are dangerous, so we require you to enter the database name
	switch (action) {
		case 'down':
		case 'reinstall':
		case 'uninstall':
			if (!skipConfirmations) {
				const {dbname} = await inquirer.prompt({
					type: 'input',
					name: 'dbname',
					message: `Type the database name "${databaseName}" to continue:`
				})
				if (dbname !== databaseName) {
					console.log('Confirmation failed.')
					process.exit(1)
				}
			}
			break;
	}

		let results : MigrationStepResult[] = []
	switch (action) {
		case 'insert-history':
			console.log()
			const name = process.argv[3]
			console.log('Insert history item for ', name)
			await insertHistoryItem(db, name)
			return 0
			break;
		case 'delete-history':
			console.log()
			const name2 = process.argv[3]
			console.log('Removing history item for ', name2)
			await removeHistoryItem(db, name2)
			return 0
			break;
		case 'clear-history':
			console.log('Removing all history items.')
			await clearHistory(db)
			return 0
			break;
		case 'up':
			console.log('Go up by one')
			results = await migrateUpOne(db)
			break;
		case 'down':
			await confirmOrExit(`Go back one version of the database?`)
			console.log('Go down by one')
			results = await migrateDownOne(db)
			break;
		case 'uninstall':
			await confirmOrExit(`${clrRed}Destroy${clrReset} all data and tables?`)
			console.log('Run "down" for all migrations in history')
			results = await migrateUninstall(db)
			break
		case 'reinstall':
			await confirmOrExit(`${clrRed}Destroy${clrReset} all data and tables (then rebuild)?`)
			console.log('Run "down" for all migrations in history, then "up" for all registered migrations')
			results = await migrateReinstall(db)
			if (!results) {
				return 0
			}
			break
		case 'install':
			console.log('Go up to latest')
			results = await migrateInstall(db)
			break;
		case 'status':
			break
		case 'create':
			const nameParts = process.argv.slice(3)
			const migName = nameParts.join('-')
			const filename= await createMigrationFile(migrationsDir, migName)
			console.log('Created new migration file: ' + clrGreen+filename + clrReset)
			console.log('You need to edit its up and down functions')
			return 0
		default:
			console.log(`Unrecognized action "${action}"`)
			return 1
	}

	if (results && results.length) {
		console.log('__________________')
		console.log(results.length + ' result' + (results.length === 1 ? '' : 's') + ':')

		// Nicely print out all the things that we just did
		results.forEach((result : MigrationStepResult) => {
			let actionClrd = <string>result.action
			let action = clrMagenta + (actionClrd+'.....').substr(0, 4) + clrReset

			let duration = ''
			if (result.durationMS) {
				duration = rightDots(clrMagenta + ` ${result.durationMS}ms ` + clrReset, 10 + clrReset.length + clrMagenta.length)
			}

			let msg = rightDots(clrCyan + result.name.substr('2020-12-01-24-59-59'.length+1) + clrReset) + duration + action
			if (result.error) {
				msg += clrRed + ' ERROR!! ' + result.error + clrReset
			}
			if (result.message) {
				msg += ': ' + clrGreen + result.message + clrReset
			}
			console.log(msg)
		})
	}

	const latest = await getLatestHistoryName(db)
	console.log('Current version: ' + bgWhite + clrBlack + (latest || 'n/a') + clrReset)

	return 0
}

