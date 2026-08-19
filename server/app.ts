import type { Database } from "bun:sqlite";

import { AuthService } from "./auth";
import { initializeDatabase, migrateDatabase } from "./db";
import { FetchRouter, HttpError } from "./http";
import { registerAuthRoutes } from "./routes/auth";
import { type SeedMode, seedDatabase } from "./seed";

const developmentOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

export type CreateAppOptions = {
	db?: Database;
	databasePath?: string;
	allowedOrigins?: readonly string[];
	seed?: boolean;
	now?: () => number;
	randomBytes?: (size: number) => Uint8Array;
	csrfSecret?: string;
	secureCookies?: boolean;
	clientAddress?: (request: Request) => string | null;
};

export type AppHandler = {
	(request: Request): Promise<Response>;
	(request: Request, clientAddress: string | null): Promise<Response>;
};

const configuredOrigins = (): string[] =>
	(process.env.NEIGHBORLY_ALLOWED_ORIGINS ?? "")
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);

export function createApp(options: CreateAppOptions = {}): AppHandler {
	const production = process.env.NODE_ENV === "production";
	if (
		production &&
		!options.db &&
		!options.databasePath &&
		!process.env.NEIGHBORLY_DB_PATH
	) {
		throw new Error("NEIGHBORLY_DB_PATH is required in production.");
	}
	const environmentOrigins = configuredOrigins();
	const allowedOrigins = options.allowedOrigins ?? environmentOrigins;
	if (production && allowedOrigins.length === 0) {
		throw new Error("NEIGHBORLY_ALLOWED_ORIGINS is required in production.");
	}
	const effectiveOrigins =
		allowedOrigins.length > 0 ? allowedOrigins : developmentOrigins;
	let database: Database;
	if (options.db) {
		migrateDatabase(options.db);
		database = options.db;
	} else if (options.databasePath) {
		database = initializeDatabase(options.databasePath);
	} else {
		database = initializeDatabase();
	}

	const auth = new AuthService({
		db: database,
		now: options.now,
		randomBytes: options.randomBytes,
		csrfSecret: options.csrfSecret,
		secureCookies: production || options.secureCookies === true,
	});
	let startupFailure = false;
	const shouldSeed = options.seed ?? true;
	const seedMode: SeedMode = production ? "public-demo" : "development";
	const initialized = shouldSeed
		? seedDatabase(database, { mode: seedMode }).catch(() => {
				startupFailure = true;
			})
		: Promise.resolve();
	const router = new FetchRouter({
		allowedOrigins: effectiveOrigins,
		validateCsrf: (request) => auth.isCsrfValid(request),
		beforeHandle: async () => {
			await initialized;
			if (startupFailure) throw new HttpError("SERVICE_UNAVAILABLE");
		},
	});

	registerAuthRoutes(router, auth);

	const handler: AppHandler = (request: Request, peerAddress?: unknown) => {
		const clientAddress =
			typeof peerAddress === "string"
				? peerAddress
				: (options.clientAddress?.(request) ?? null);
		return router.fetch(request, clientAddress);
	};
	return handler;
}

if (import.meta.main) {
	const port = Number(process.env.PORT ?? 3000);
	const app = createApp();
	Bun.serve({
		fetch(request, server) {
			return app(request, server.requestIP(request)?.address ?? null);
		},
		port: Number.isSafeInteger(port) && port > 0 ? port : 3000,
	});
}
