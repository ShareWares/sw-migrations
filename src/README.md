# Migrator

## The Goals
Migrations have the following goals:

 - Make deployment easier and less manual
 - Maintain the same schema across multiple dev environments
 - Allow easily switching between different database versions from different branches
 
## Overview
All **migrations** are stored in a file in the `src/db/migrations` folder. The **names of the files are important** because they are **sorted in ascending order**. The files in this folder are referred to as the **registered migrations**.

A database table is automatically created called **migrations**. It keeps track of which migrations that database has had run on it. The rows in this table make up the **migration history**.

When updating the schema, a CLI command is run. It tells the database to either run the **up** or **down** functions of registered migrations. 

## Creating a Migration
You can run the command `npm run migrate create {migration name}` and a template file will be created for you.

A migration's `up` command should make the updates to the database that you want. The `down` command should revert those changes. You should be able to run **up then down infinitely**.

## CLI Commands

`npm run migrate install`: Run the up commands for all registered migrations that are after the current version of the database

`npm run migrate uninstall`: Run the down command of all migrations in the history

`npm run migrate reinstall`: uninstall then install

`npm run migrate up`: Run the up command of the next migration. Only runs that one migration

`npm run migrate down`: Run the down command of the most recent history migration. Only runs that one migration

`npm run migrate inserty-history {migration-name}`: Inserts that record into the history. Useful for debugging or skipping migrations.

`npm run migrate delete-history`: Removes all history items.

`npm run migrate status`: Displays the history and registered migrations

## Seed Data and Store Procedures
You can use the `--seed` and `--procedures` flags to insert seed data after the migrations are run.

Example `npm run migrate reinstall -- --seed --procedures`. Note the `--` after the npm run command, it is needed.
