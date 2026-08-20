import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import {
	type Stats,
	existsSync,
	linkSync,
	renameSync,
	statSync,
	unlinkSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";

type IntegrityCheckRow = {
	integrity_check: string;
};

type WalCheckpointRow = {
	busy: number;
	checkpointed: number;
	log: number;
};
const usage =
	"Usage: bun run db:check [path] | bun run db:backup <destination> [source] | bun run db:restore <backup> [target]";

const normalizeDatabasePath = (
	path: string | undefined,
	label: string,
): string => {
	if (!path || !path.trim()) {
		throw new Error(`${label} path is required.`);
	}

	if (path === ":memory:") {
		throw new Error(`${label} must be a persistent SQLite file, not :memory:.`);
	}

	return resolve(path);
};

const configuredDatabasePath = (
	path: string | undefined,
	label: string,
): string => {
	if (path !== undefined) return normalizeDatabasePath(path, label);

	const configuredPath = process.env.NEIGHBORLY_DB_PATH;
	if (!configuredPath || !configuredPath.trim()) {
		throw new Error(
			`NEIGHBORLY_DB_PATH is required when ${label.toLowerCase()} is omitted.`,
		);
	}

	return normalizeDatabasePath(configuredPath, label);
};

const requireExistingFile = (path: string, label: string) => {
	let stats: Stats;
	try {
		stats = statSync(path);
	} catch {
		throw new Error(`${label} does not exist: ${path}`);
	}

	if (!stats.isFile()) {
		throw new Error(`${label} must be a file: ${path}`);
	}
};

const requireParentDirectory = (path: string, label: string) => {
	const parent = dirname(path);
	let stats: Stats;
	try {
		stats = statSync(parent);
	} catch {
		throw new Error(`${label} parent directory does not exist: ${parent}`);
	}

	if (!stats.isDirectory()) {
		throw new Error(`${label} parent path is not a directory: ${parent}`);
	}
};

const requireAbsentPath = (path: string, label: string) => {
	if (existsSync(path)) {
		throw new Error(
			`${label} already exists and will not be overwritten: ${path}`,
		);
	}
};

const pathsReferToSameFile = (firstPath: string, secondPath: string) => {
	try {
		const first = statSync(firstPath);
		const second = statSync(secondPath);
		return first.dev === second.dev && first.ino === second.ino;
	} catch {
		return false;
	}
};

const requireDistinctPaths = (
	firstPath: string,
	firstLabel: string,
	secondPath: string,
	secondLabel: string,
) => {
	if (firstPath === secondPath || pathsReferToSameFile(firstPath, secondPath)) {
		throw new Error(`${firstLabel} and ${secondLabel} must be distinct.`);
	}
};

const withReadOnlyDatabase = <T>(
	path: string,
	operation: (db: Database) => T,
): T => {
	let db: Database | undefined;
	try {
		db = new Database(path, { readonly: true });
		return operation(db);
	} finally {
		db?.close(true);
	}
};

const assertIntegrity = (path: string) => {
	withReadOnlyDatabase(path, (db) => {
		const rows = db
			.query<IntegrityCheckRow, []>("PRAGMA integrity_check")
			.all();
		if (rows.length !== 1 || rows[0]?.integrity_check !== "ok") {
			throw new Error(`Database integrity check failed: ${path}`);
		}
	});
};

const checkpointTarget = (targetPath: string) => {
	if (!existsSync(targetPath)) return;

	let db: Database | undefined;
	try {
		db = new Database(targetPath, { create: false, readwrite: true });
		const checkpoint = db
			.query<WalCheckpointRow, []>("PRAGMA wal_checkpoint(TRUNCATE)")
			.get();
		if (
			!checkpoint ||
			checkpoint.busy !== 0 ||
			checkpoint.log !== 0 ||
			checkpoint.checkpointed !== 0
		) {
			throw new Error(
				`Unable to fully checkpoint target WAL before restore: ${targetPath}`,
			);
		}
	} finally {
		db?.close(true);
	}
};

const createStagingPath = (targetPath: string, operation: string): string => {
	const parent = dirname(targetPath);
	const targetName = basename(targetPath);

	for (let attempt = 0; attempt < 10; attempt += 1) {
		const candidate = resolve(
			parent,
			`.${targetName}.${operation}-${randomUUID()}.sqlite`,
		);
		if (!existsSync(candidate)) return candidate;
	}

	throw new Error(`Unable to create a unique ${operation} staging path.`);
};

const removeStagingFile = (path: string) => {
	try {
		unlinkSync(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
};

type StagedSidecar = {
	originalPath: string;
	stagedPath: string;
};

const stageTargetSidecars = (
	targetPath: string,
	stagedSidecars: StagedSidecar[],
) => {
	for (const suffix of ["-wal", "-shm"]) {
		const originalPath = `${targetPath}${suffix}`;
		if (!existsSync(originalPath)) continue;

		const stagedPath = createStagingPath(targetPath, "sidecar");
		renameSync(originalPath, stagedPath);
		stagedSidecars.push({ originalPath, stagedPath });
	}
};

const restoreTargetSidecars = (stagedSidecars: StagedSidecar[]) => {
	for (let index = stagedSidecars.length - 1; index >= 0; index -= 1) {
		const sidecar = stagedSidecars[index];
		if (sidecar && existsSync(sidecar.stagedPath)) {
			renameSync(sidecar.stagedPath, sidecar.originalPath);
		}
	}
};

const discardStagedSidecars = (stagedSidecars: StagedSidecar[]) => {
	for (const { stagedPath } of stagedSidecars) {
		removeStagingFile(stagedPath);
	}
};

/** Verifies that a persistent SQLite database passes SQLite's exact integrity check. */
export function checkDatabase(path?: string): string {
	const databasePath = configuredDatabasePath(path, "Database");
	requireExistingFile(databasePath, "Database");
	assertIntegrity(databasePath);
	return databasePath;
}

/** Creates a WAL-consistent SQLite snapshot without overwriting its destination. */
export function backupDatabase(
	destinationPath: string | undefined,
	sourcePath?: string,
): string {
	const source = configuredDatabasePath(sourcePath, "Backup source");
	const destination = normalizeDatabasePath(
		destinationPath,
		"Backup destination",
	);

	requireDistinctPaths(
		source,
		"Backup source",
		destination,
		"Backup destination",
	);
	requireExistingFile(source, "Backup source");
	requireParentDirectory(destination, "Backup destination");
	requireAbsentPath(destination, "Backup destination");

	const stagedBackup = createStagingPath(destination, "backup");
	let staged = true;
	try {
		withReadOnlyDatabase(source, (db) => {
			db.query("VACUUM INTO ?").run(stagedBackup);
		});
		assertIntegrity(stagedBackup);

		// link(2) creates the final name atomically and fails rather than overwriting it.
		linkSync(stagedBackup, destination);
		removeStagingFile(stagedBackup);
		staged = false;
		return destination;
	} finally {
		if (staged) removeStagingFile(stagedBackup);
	}
}

/** Restores a verified SQLite backup through a same-directory staged replacement. */
export function restoreDatabase(
	backupPath: string | undefined,
	targetPath?: string,
): string {
	const backup = normalizeDatabasePath(backupPath, "Backup");
	const target = configuredDatabasePath(targetPath, "Restore target");

	requireDistinctPaths(backup, "Backup", target, "Restore target");
	requireExistingFile(backup, "Backup");
	requireParentDirectory(target, "Restore target");
	assertIntegrity(backup);

	const stagedRestore = createStagingPath(target, "restore");
	const stagedSidecars: StagedSidecar[] = [];
	let staged = true;
	let replaced = false;
	try {
		withReadOnlyDatabase(backup, (db) => {
			db.query("VACUUM INTO ?").run(stagedRestore);
		});
		assertIntegrity(stagedRestore);
		checkpointTarget(target);
		stageTargetSidecars(target, stagedSidecars);

		// Both paths are in target's directory, so POSIX rename replaces atomically.
		renameSync(stagedRestore, target);
		staged = false;
		replaced = true;
		discardStagedSidecars(stagedSidecars);
		return target;
	} catch (error) {
		if (!replaced) restoreTargetSidecars(stagedSidecars);
		throw error;
	} finally {
		if (staged) removeStagingFile(stagedRestore);
	}
}

export function runDatabaseCli(args = process.argv.slice(2)): number {
	const [command, ...paths] = args;

	try {
		switch (command) {
			case "check": {
				if (paths.length > 1) throw new Error(usage);
				const databasePath = checkDatabase(paths[0]);
				console.log(`Integrity check passed: ${databasePath}`);
				return 0;
			}
			case "backup": {
				if (paths.length < 1 || paths.length > 2) throw new Error(usage);
				const destination = backupDatabase(paths[0], paths[1]);
				console.log(`Backup created: ${destination}`);
				return 0;
			}
			case "restore": {
				if (paths.length < 1 || paths.length > 2) throw new Error(usage);
				console.error(
					"Restore requires the Neighborly server to be stopped; continuing assumes offline operation.",
				);
				const target = restoreDatabase(paths[0], paths[1]);
				console.log(`Restore complete: ${target}`);
				return 0;
			}
			default:
				throw new Error(usage);
		}
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "Unknown database operation failure.";
		console.error(`Database command failed: ${message}`);
		return 1;
	}
}

if (import.meta.main) {
	process.exitCode = runDatabaseCli();
}
