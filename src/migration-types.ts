export interface DBClient {
	query: (sql: string, args?: any[]) => Promise<any>
}

export type MigrationStepResult = {
	name?: string
	action?: 'up' | 'down' | 'skip'
	error?: string
	message?: string // Helpful messages of what has changed
	durationMS?: number
}

// A function that performs changes to the database
// The text
type MigrationStep = (db: DBClient) => Promise<MigrationStepResult>

// A workable object that performs database changes
export type Migration = {
	name?: string // This is derived from the filenames
	up: MigrationStep
	down: MigrationStep
}

// An entry in the `migrations` table
export type MigrationRow =  {
	name: string
	date: Date
}
