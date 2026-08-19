import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { MIGRATION_TABLE_NAME, migrations } from "./schema";

const DEFAULT_DB_PATH =
	process.env.NEIGHBORLY_DB_PATH || `${process.cwd()}/data/neighborly.sqlite`;

const ensureDatabasePathDirectory = (path: string) => {
	if (path === ":memory:") return;
	mkdirSync(dirname(resolve(path)), { recursive: true });
};

const configurePragmas = (db: Database) => {
	db.run("PRAGMA foreign_keys = ON;");
	db.run("PRAGMA busy_timeout = 5000;");
	db.run("PRAGMA journal_mode = WAL;");
	db.run("PRAGMA synchronous = NORMAL;");
	db.run("PRAGMA wal_autocheckpoint = 1000;");
	db.run("PRAGMA temp_store = MEMORY;");
};

export function openDatabase(path = DEFAULT_DB_PATH): Database {
	const dbPath = path ?? DEFAULT_DB_PATH;
	ensureDatabasePathDirectory(dbPath);
	const db = new Database(dbPath);

	configurePragmas(db);

	return db;
}

export function ensureMigrationTable(db: Database) {
	const existing = db
		.query(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`)
		.get(MIGRATION_TABLE_NAME);

	if (!existing) {
		db.exec(`
      CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE_NAME} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL
      );
    `);
	}
}

export function migrateDatabase(db: Database): number {
	db.run("BEGIN EXCLUSIVE");

	try {
		ensureMigrationTable(db);

		const rows = db
			.query("SELECT name FROM migrations ORDER BY id ASC")
			.all() as Array<{ name: string }>;

		const appliedNames = new Set(rows.map((row) => row.name));

		let appliedCount = 0;

		for (const migration of migrations) {
			if (appliedNames.has(migration.name)) {
				continue;
			}

			migration.up(db);
			db.prepare("INSERT INTO migrations (name, applied_at) VALUES (?, ?)").run(
				migration.name,
				Date.now(),
			);
			appliedCount += 1;
		}

		db.run("COMMIT");
		return appliedCount;
	} catch (error) {
		db.run("ROLLBACK");
		throw error;
	}
}

export function initializeDatabase(path = DEFAULT_DB_PATH): Database {
	const db = openDatabase(path);
	migrateDatabase(db);
	return db;
}
