import type { Database } from "bun:sqlite";
import { isIP } from "node:net";

import { AuthService } from "./auth";
import { initializeDatabase, migrateDatabase } from "./db";
import { FetchRouter, HttpError } from "./http";
import { ImageService } from "./images";
import { InteractionService } from "./interactions";
import { ListingService } from "./listings";
import { registerAuthRoutes } from "./routes/auth";
import { registerInteractionRoutes } from "./routes/interactions";
import { registerListingRoutes } from "./routes/listings";
import { type SeedMode, seedDatabase } from "./seed";
import { type StaticHandler, createStaticHandler } from "./static";

const developmentOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

export type CreateAppOptions = {
	db?: Database;
	databasePath?: string;
	allowedOrigins?: readonly string[];
	trustProxy?: boolean;
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
	close?: () => Promise<void>;
};

const configuredPublicOrigins = (): string[] => {
	const rawOrigins = process.env.NEIGHBORLY_PUBLIC_ORIGINS;
	if (!rawOrigins?.trim()) return [];
	const origins = new Set<string>();
	for (const configuredOrigin of rawOrigins.split(",")) {
		const origin = configuredOrigin.trim();
		if (!origin) {
			throw new Error(
				"NEIGHBORLY_PUBLIC_ORIGINS must contain canonical absolute HTTP(S) origins.",
			);
		}
		try {
			const url = new URL(origin);
			if (
				(url.protocol !== "http:" && url.protocol !== "https:") ||
				url.origin !== origin
			) {
				throw new Error();
			}
		} catch {
			throw new Error(
				"NEIGHBORLY_PUBLIC_ORIGINS must contain canonical absolute HTTP(S) origins.",
			);
		}
		origins.add(origin);
	}
	return [...origins];
};

export const resolveClientAddress = (
	request: Request,
	peerAddress: string | null,
	trustProxy: boolean,
): string | null => {
	if (!trustProxy) return peerAddress;
	const forwardedAddress = request.headers
		.get("x-forwarded-for")
		?.split(",")
		.at(-1)
		?.trim();
	return forwardedAddress && isIP(forwardedAddress)
		? forwardedAddress
		: peerAddress;
};

export function createServerHandler(
	app: AppHandler,
	staticHandler: StaticHandler,
): AppHandler {
	return async (request, clientAddress: string | null = null) => {
		const pathname = new URL(request.url).pathname;
		if (pathname === "/api" || pathname.startsWith("/api/")) {
			return app(request, clientAddress);
		}
		return staticHandler(request);
	};
}

export function createApp(options: CreateAppOptions = {}): AppHandler {
	const production = process.env.NODE_ENV === "production";
	const configuredDatabasePath =
		options.databasePath ?? process.env.NEIGHBORLY_DB_PATH;
	if (production && !options.db) {
		if (!configuredDatabasePath?.trim()) {
			throw new Error("NEIGHBORLY_DB_PATH is required in production.");
		}
		if (configuredDatabasePath.trim() === ":memory:") {
			throw new Error("Production database path must not be :memory:.");
		}
	}
	const allowedOrigins = options.allowedOrigins ?? configuredPublicOrigins();
	if (production && allowedOrigins.length === 0) {
		throw new Error("NEIGHBORLY_PUBLIC_ORIGINS is required in production.");
	}
	const trustProxy =
		options.trustProxy ?? process.env.NEIGHBORLY_TRUST_PROXY === "1";
	if (production && !trustProxy) {
		throw new Error("NEIGHBORLY_TRUST_PROXY=1 is required in production.");
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
	const listings = new ListingService({ db: database, now: options.now });
	const images = new ImageService({ db: database, now: options.now });
	const interactions = new InteractionService({
		db: database,
		now: options.now,
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
	registerListingRoutes(router, auth, listings, images);
	registerInteractionRoutes(router, auth, interactions);

	const handler: AppHandler = (request: Request, peerAddress?: unknown) => {
		const clientAddress =
			typeof peerAddress === "string"
				? peerAddress
				: (options.clientAddress?.(request) ?? null);
		return router.fetch(
			request,
			resolveClientAddress(request, clientAddress, trustProxy),
		);
	};
	handler.close = async () => {
		await initialized;
		if (options.db) return;
		try {
			database.run("PRAGMA wal_checkpoint(TRUNCATE)");
		} finally {
			database.close();
		}
	};
	return handler;
}

if (import.meta.main) {
	const port = Number(process.env.PORT ?? 3001);
	const app = createApp();
	const handler = createServerHandler(app, createStaticHandler());
	const server = Bun.serve({
		fetch(request, bunServer) {
			return handler(request, bunServer.requestIP(request)?.address ?? null);
		},
		port: Number.isSafeInteger(port) && port > 0 ? port : 3001,
	});
	let isShuttingDown = false;
	const shutdown = async () => {
		if (isShuttingDown) return;
		isShuttingDown = true;
		process.off("SIGINT", shutdown);
		process.off("SIGTERM", shutdown);
		try {
			await server.stop();
			await app.close?.();
		} catch (error) {
			console.error("Neighborly shutdown failed.", error);
			process.exitCode = 1;
		}
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}
