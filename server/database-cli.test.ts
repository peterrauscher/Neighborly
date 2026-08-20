import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	linkSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { backupDatabase, checkDatabase, restoreDatabase } from "./database-cli";

const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { force: true, recursive: true });
	}
});

const createTemporaryDirectory = () => {
	const directory = mkdtempSync(join(tmpdir(), "neighborly-database-cli-"));
	temporaryDirectories.push(directory);
	return directory;
};

const createDatabase = (path: string, value: string) => {
	const db = new Database(path);
	try {
		db.run("PRAGMA journal_mode = WAL");
		db.run("CREATE TABLE entries (value TEXT NOT NULL)");
		db.query("INSERT INTO entries (value) VALUES (?)").run(value);
	} finally {
		db.close(true);
	}
};

const entryValues = (path: string) => {
	const db = new Database(path, { readonly: true });
	try {
		return db
			.query<{ value: string }, []>("SELECT value FROM entries ORDER BY rowid")
			.all()
			.map((row) => row.value);
	} finally {
		db.close(true);
	}
};

describe("database CLI operations", () => {
	test("backup captures committed WAL data", () => {
		const directory = createTemporaryDirectory();
		const source = join(directory, "source.sqlite");
		const destination = join(directory, "backup.sqlite");
		const db = new Database(source);

		try {
			db.run("PRAGMA journal_mode = WAL");
			db.run("CREATE TABLE entries (value TEXT NOT NULL)");
			db.query("INSERT INTO entries (value) VALUES (?)").run(
				"committed WAL row",
			);

			expect(existsSync(`${source}-wal`)).toBe(true);
			expect(backupDatabase(destination, source)).toBe(resolve(destination));
			expect(entryValues(destination)).toEqual(["committed WAL row"]);
		} finally {
			db.close(true);
		}
	});

	test("backup refuses an existing destination", () => {
		const directory = createTemporaryDirectory();
		const source = join(directory, "source.sqlite");
		const destination = join(directory, "backup.sqlite");
		createDatabase(source, "source row");
		writeFileSync(destination, "do not replace");

		expect(() => backupDatabase(destination, source)).toThrow(
			"already exists and will not be overwritten",
		);
		expect(readFileSync(destination, "utf8")).toBe("do not replace");
	});

	test("restore refuses a corrupt backup without changing the target", () => {
		const directory = createTemporaryDirectory();
		const backup = join(directory, "corrupt.sqlite");
		const target = join(directory, "target.sqlite");
		createDatabase(target, "current target row");
		writeFileSync(backup, "not a SQLite database");

		expect(() => restoreDatabase(backup, target)).toThrow();
		expect(entryValues(target)).toEqual(["current target row"]);
	});

	test("restore replaces later mutations with a verified backup", () => {
		const directory = createTemporaryDirectory();
		const backup = join(directory, "backup.sqlite");
		const target = join(directory, "target.sqlite");
		createDatabase(target, "restored row");
		backupDatabase(backup, target);

		const db = new Database(target);
		try {
			db.query("INSERT INTO entries (value) VALUES (?)").run("later row");
		} finally {
			db.close(true);
		}

		expect(entryValues(target)).toEqual(["restored row", "later row"]);
		expect(restoreDatabase(backup, target)).toBe(resolve(target));
		expect(entryValues(target)).toEqual(["restored row"]);
		expect(checkDatabase(target)).toBe(resolve(target));
	});

	test("restore snapshots WAL data and removes stale target sidecars", () => {
		const directory = createTemporaryDirectory();
		const backup = join(directory, "live-backup.sqlite");
		const target = join(directory, "target.sqlite");
		createDatabase(target, "outdated target row");
		writeFileSync(`${target}-wal`, "stale WAL");
		writeFileSync(`${target}-shm`, "stale SHM");

		const db = new Database(backup);
		try {
			db.run("PRAGMA journal_mode = WAL");
			db.run("CREATE TABLE entries (value TEXT NOT NULL)");
			db.query("INSERT INTO entries (value) VALUES (?)").run(
				"committed backup WAL row",
			);

			expect(existsSync(`${backup}-wal`)).toBe(true);
			expect(restoreDatabase(backup, target)).toBe(resolve(target));
			expect(entryValues(target)).toEqual(["committed backup WAL row"]);
			expect(existsSync(`${target}-wal`)).toBe(false);
			expect(existsSync(`${target}-shm`)).toBe(false);
		} finally {
			db.close(true);
		}
	});

	test("keeps committed target WAL data when offline checkpointing cannot finish", () => {
		const directory = createTemporaryDirectory();
		const source = join(directory, "source.sqlite");
		const backup = join(directory, "backup.sqlite");
		const target = join(directory, "target.sqlite");
		createDatabase(source, "restored row");
		backupDatabase(backup, source);

		const writer = new Database(target);
		const reader = new Database(target, { readonly: true });
		try {
			writer.run("PRAGMA journal_mode = WAL");
			writer.run("CREATE TABLE entries (value TEXT NOT NULL)");
			writer
				.query("INSERT INTO entries (value) VALUES (?)")
				.run("existing row");
			reader.run("BEGIN");
			reader.query("SELECT value FROM entries").all();
			writer
				.query("INSERT INTO entries (value) VALUES (?)")
				.run("committed WAL row");

			expect(() => restoreDatabase(backup, target)).toThrow(
				"Unable to fully checkpoint target WAL before restore",
			);
			expect(entryValues(target)).toEqual([
				"existing row",
				"committed WAL row",
			]);
		} finally {
			reader.run("ROLLBACK");
			reader.close(true);
			writer.close(true);
		}
	});

	test("rejects symlink and hardlink aliases", () => {
		const directory = createTemporaryDirectory();
		const database = join(directory, "database.sqlite");
		const hardlink = join(directory, "hardlink.sqlite");
		const symlink = join(directory, "symlink.sqlite");
		createDatabase(database, "shared row");
		linkSync(database, hardlink);
		symlinkSync(database, symlink);

		expect(() => backupDatabase(hardlink, database)).toThrow(
			"must be distinct",
		);
		expect(() => restoreDatabase(database, symlink)).toThrow(
			"must be distinct",
		);
	});

	test("requires configured persistent paths and rejects identical paths", () => {
		const directory = createTemporaryDirectory();
		const configuredPath = process.env.NEIGHBORLY_DB_PATH;
		const shared = join(directory, "shared.sqlite");
		createDatabase(shared, "shared row");

		try {
			Reflect.deleteProperty(process.env, "NEIGHBORLY_DB_PATH");
			expect(() => checkDatabase()).toThrow("NEIGHBORLY_DB_PATH is required");
			expect(() => backupDatabase(join(directory, "backup.sqlite"))).toThrow(
				"NEIGHBORLY_DB_PATH is required",
			);
			expect(() => restoreDatabase(join(directory, "backup.sqlite"))).toThrow(
				"NEIGHBORLY_DB_PATH is required",
			);

			process.env.NEIGHBORLY_DB_PATH = ":memory:";
			expect(() => checkDatabase()).toThrow("not :memory:");
			expect(() => backupDatabase(join(directory, "backup.sqlite"))).toThrow(
				"not :memory:",
			);
			expect(() => restoreDatabase(join(directory, "backup.sqlite"))).toThrow(
				"not :memory:",
			);

			expect(() =>
				backupDatabase(`${directory}/./shared.sqlite`, shared),
			).toThrow("must be distinct");
			expect(() =>
				restoreDatabase(shared, `${directory}/./shared.sqlite`),
			).toThrow("must be distinct");
		} finally {
			if (configuredPath === undefined) {
				Reflect.deleteProperty(process.env, "NEIGHBORLY_DB_PATH");
			} else {
				process.env.NEIGHBORLY_DB_PATH = configuredPath;
			}
		}
	});
});
