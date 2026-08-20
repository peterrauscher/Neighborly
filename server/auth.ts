import { createHash, randomBytes } from "node:crypto";

import type { Database, SQLQueryBindings } from "bun:sqlite";

import {
	HandleSchema,
	IdSchema,
	type NeighborhoodDto,
	type SelfUser,
} from "../src/lib/contracts";
import { HttpError } from "./http";

const SESSION_COOKIE_NAME = "neighborly_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const CONTACT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_RATE_LIMIT_ENTRIES = 10_000;
const MAX_ACTIVE_SESSIONS_PER_USER = 5;
export const MAX_DEMO_ACTIVE_SESSIONS = 64;
const MAX_DEMO_ISSUANCES_PER_WINDOW = 512;
const DUMMY_PASSWORD_HASH = Bun.password.hash(
	"neighborly-invalid-login-password",
	{ algorithm: "argon2id" },
);

const utf8Encoder = new TextEncoder();

const systemRandomBytes = (size: number): Uint8Array =>
	Uint8Array.from(randomBytes(size));

const constantTimeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
	let difference = left.byteLength ^ right.byteLength;
	const length = Math.max(left.byteLength, right.byteLength);
	for (let index = 0; index < length; index += 1) {
		difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
	}
	return difference === 0;
};

type RegisterInput = {
	name: string;
	email: string;
	password: string;
	neighborhoodId: string;
};

type LoginInput = {
	email: string;
	password: string;
};

type ProfileInput = {
	name?: string;
	bio?: string;
	avatarPath?: string;
	neighborhoodId?: string;
};

type PasswordInput = {
	currentPassword: string;
	nextPassword: string;
};

type ContactInput = {
	name: string;
	email: string;
	message: string;
	honeypot: string;
};

type NeighborhoodRow = {
	id: string;
	slug: string;
	name: string;
	city: string;
	state: string;
	timezone: string;
	description: string;
	imagePath: string;
};

type UserRow = {
	id: string;
	email: string;
	name: string;
	handle: string;
	avatarPath: string | null;
	bio: string;
	isDemo: number;
	joinedAt: number;
	neighborhoodId: string;
	neighborhoodSlug: string;
	neighborhoodName: string;
	neighborhoodCity: string;
	neighborhoodState: string;
	neighborhoodTimezone: string;
	neighborhoodDescription: string;
	neighborhoodImagePath: string;
};

type LoginRow = {
	id: string;
	passwordHash: string;
};

type SessionRow = {
	userId: string;
	expiresAt: number;
};

type RateLimitEntry = {
	count: number;
	resetAt: number;
};

export type AuthenticatedSession = {
	user: SelfUser;
	token: string;
};

export type IssuedSession = {
	user: SelfUser;
	cookie: string;
	csrfToken: string;
};

export type AuthServiceOptions = {
	db: Database;
	now?: () => number;
	randomBytes?: (size: number) => Uint8Array;
	csrfSecret?: string;
	secureCookies?: boolean;
};

const getOne = <Row>(
	db: Database,
	sql: string,
	values: SQLQueryBindings[],
): Row | null => db.query<Row, SQLQueryBindings[]>(sql).get(...values);

const getAll = <Row>(
	db: Database,
	sql: string,
	values: SQLQueryBindings[],
): Row[] => db.query<Row, SQLQueryBindings[]>(sql).all(...values);

const mapNeighborhood = (row: NeighborhoodRow): NeighborhoodDto => ({
	id: row.id,
	slug: row.slug,
	name: row.name,
	city: row.city,
	state: row.state,
	timezone: row.timezone,
	description: row.description,
	imagePath: row.imagePath,
});

const mapSelfUser = (row: UserRow): SelfUser => ({
	id: row.id,
	email: row.email,
	name: row.name,
	handle: row.handle,
	avatarPath: row.avatarPath ?? "",
	bio: row.bio,
	neighborhood: {
		id: row.neighborhoodId,
		slug: row.neighborhoodSlug,
		name: row.neighborhoodName,
		city: row.neighborhoodCity,
		state: row.neighborhoodState,
		timezone: row.neighborhoodTimezone,
		description: row.neighborhoodDescription,
		imagePath: row.neighborhoodImagePath,
	},
	joinedAt: row.joinedAt,
	isDemo: row.isDemo === 1,
});

const getCookie = (request: Request, name: string): string | null => {
	const header = request.headers.get("cookie");
	if (!header) return null;

	for (const part of header.split(";")) {
		const separator = part.indexOf("=");
		if (separator < 1) continue;
		if (part.slice(0, separator).trim() !== name) continue;
		return part.slice(separator + 1).trim() || null;
	}

	return null;
};

export class RateLimiter {
	readonly #entries = new Map<string, RateLimitEntry>();
	readonly #now: () => number;

	constructor(now: () => number) {
		this.#now = now;
	}

	take(key: string, limit: number, windowMs = RATE_LIMIT_WINDOW_MS): boolean {
		const now = this.#now();
		const existing = this.#entries.get(key);
		if (!existing || existing.resetAt <= now) {
			this.#entries.set(key, { count: 1, resetAt: now + windowMs });
			this.trim();
			return true;
		}
		if (existing.count >= limit) return false;
		existing.count += 1;
		return true;
	}

	private trim() {
		if (this.#entries.size <= MAX_RATE_LIMIT_ENTRIES) return;
		const now = this.#now();
		for (const [key, entry] of this.#entries) {
			if (entry.resetAt <= now) this.#entries.delete(key);
		}
		while (this.#entries.size > MAX_RATE_LIMIT_ENTRIES) {
			const oldestKey = this.#entries.keys().next().value;
			if (!oldestKey) return;
			this.#entries.delete(oldestKey);
		}
	}
}

export class AuthService {
	readonly #db: Database;
	readonly #now: () => number;
	readonly #randomBytes: (size: number) => Uint8Array;
	readonly #csrfSecret: string;
	readonly #secureCookies: boolean;
	readonly #limiter: RateLimiter;

	constructor(options: AuthServiceOptions) {
		this.#db = options.db;
		this.#now = options.now ?? Date.now;
		const entropySource = options.randomBytes ?? systemRandomBytes;
		this.#randomBytes = (size) => Uint8Array.from(entropySource(size));
		this.#csrfSecret =
			options.csrfSecret ??
			Buffer.from(this.#randomBytes(32)).toString("base64url");
		this.#secureCookies =
			process.env.NODE_ENV === "production" || options.secureCookies === true;
		this.#limiter = new RateLimiter(this.#now);
	}

	private rateLimit(
		action: string,
		clientAddress: string | null,
		account: string,
		sourceLimit: number,
		accountLimit: number,
	): boolean {
		const source =
			clientAddress?.trim().toLowerCase().slice(0, 128) || "unattributed";
		const normalizedAccount = account.trim().toLowerCase();
		const sourceAllowed = this.#limiter.take(
			`${action}:source:${source}`,
			sourceLimit,
		);
		const accountAllowed = this.#limiter.take(
			`${action}:account:${normalizedAccount}`,
			accountLimit,
		);
		return sourceAllowed && accountAllowed;
	}

	private demoRateLimit(clientAddress: string | null): boolean {
		const source =
			clientAddress?.trim().toLowerCase().slice(0, 128) || "unattributed";
		if (!this.#limiter.take(`demo:source:${source}`, 6)) return false;
		return this.#limiter.take(
			"demo:global-issuance",
			MAX_DEMO_ISSUANCES_PER_WINDOW,
		);
	}

	isCsrfValid(request: Request): boolean {
		const token = getCookie(request, SESSION_COOKIE_NAME);
		if (!token) return true;
		const submitted = request.headers.get("x-csrf-token");
		if (!submitted) return false;
		const expected = this.csrfToken(token);
		return constantTimeEqual(
			utf8Encoder.encode(submitted),
			utf8Encoder.encode(expected),
		);
	}

	async register(
		input: RegisterInput,
		request: Request,
		clientAddress: string | null,
	): Promise<IssuedSession> {
		if (!this.rateLimit("register", clientAddress, input.email, 6, 3)) {
			throw new HttpError("RATE_LIMITED");
		}
		if (input.name.length < 2) {
			throw new HttpError("VALIDATION_ERROR", undefined, {
				name: ["Name must contain at least two characters."],
			});
		}
		if (!this.neighborhoodExists(input.neighborhoodId)) {
			throw new HttpError("VALIDATION_ERROR", undefined, {
				neighborhoodId: ["Select a valid neighborhood."],
			});
		}
		if (this.findUserByEmail(input.email)) {
			throw new HttpError(
				"CONFLICT",
				"An account already uses this email address.",
			);
		}

		const now = this.#now();
		const passwordHash = await Bun.password.hash(input.password, {
			algorithm: "argon2id",
		});
		const userId = this.newIdentifier("usr");
		const handle = this.newHandle(input.email);

		try {
			this.#db
				.prepare(
					`INSERT INTO users (
						id, email, password_hash, name, handle, avatar_path, bio,
						neighborhood_id, is_demo, created_at, updated_at, last_active_at
					) VALUES (?, ?, ?, ?, ?, '', '', ?, 0, ?, ?, ?)`,
				)
				.run(
					userId,
					input.email,
					passwordHash,
					input.name,
					handle,
					input.neighborhoodId,
					now,
					now,
					now,
				);
		} catch (error) {
			if (error instanceof Error && error.message.includes("UNIQUE")) {
				throw new HttpError(
					"CONFLICT",
					"An account already uses this email address.",
				);
			}
			throw error;
		}

		return this.issueSession(userId, this.sessionToken(request));
	}

	async login(
		input: LoginInput,
		request: Request,
		clientAddress: string | null,
	): Promise<IssuedSession> {
		if (!this.rateLimit("login", clientAddress, input.email, 6, 5)) {
			throw new HttpError("RATE_LIMITED");
		}

		const account = getOne<LoginRow>(
			this.#db,
			"SELECT id, password_hash AS passwordHash FROM users WHERE email = ?",
			[input.email],
		);
		const passwordHash = account?.passwordHash ?? (await DUMMY_PASSWORD_HASH);
		const passwordMatches = await Bun.password.verify(
			input.password,
			passwordHash,
		);
		if (!account || !passwordMatches) {
			throw new HttpError("UNAUTHORIZED", "Invalid email or password.");
		}

		return this.issueSession(
			account.id,
			this.sessionToken(request),
			account.passwordHash,
		);
	}

	async loginDemo(
		request: Request,
		clientAddress: string | null,
	): Promise<IssuedSession> {
		if (!this.demoRateLimit(clientAddress)) {
			throw new HttpError("RATE_LIMITED");
		}
		const demo = getOne<{ id: string }>(
			this.#db,
			"SELECT id FROM users WHERE is_demo = 1 ORDER BY id ASC LIMIT 1",
			[],
		);
		if (!demo) throw new HttpError("SERVICE_UNAVAILABLE");
		return this.issueSession(
			demo.id,
			this.sessionToken(request),
			undefined,
			MAX_DEMO_ACTIVE_SESSIONS,
		);
	}

	currentSession(request: Request): AuthenticatedSession | null {
		const token = this.sessionToken(request);
		if (!token) return null;
		const now = this.#now();
		const tokenHash = this.hashToken(token);
		const session = getOne<SessionRow>(
			this.#db,
			`SELECT user_id AS userId, expires_at AS expiresAt
			 FROM sessions
			 WHERE token_hash = ? AND revoked = 0 AND expires_at > ?`,
			[tokenHash, now],
		);
		if (!session) {
			this.#db
				.prepare(
					"DELETE FROM sessions WHERE token_hash = ? AND expires_at <= ?",
				)
				.run(tokenHash, now);
			return null;
		}
		const user = this.userById(session.userId);
		if (!user) return null;
		this.#db
			.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?")
			.run(now, tokenHash);
		this.#db
			.prepare("UPDATE users SET last_active_at = ? WHERE id = ?")
			.run(now, session.userId);
		return { user, token };
	}

	requireSession(request: Request): AuthenticatedSession {
		const session = this.currentSession(request);
		if (!session) throw new HttpError("UNAUTHORIZED");
		return session;
	}

	requireMutable(session: AuthenticatedSession) {
		if (session.user.isDemo) throw new HttpError("DEMO_READ_ONLY");
	}

	logout(session: AuthenticatedSession) {
		const now = this.#now();
		this.#db
			.prepare(
				"UPDATE sessions SET revoked = 1, revoked_at = ? WHERE token_hash = ? AND revoked = 0",
			)
			.run(now, this.hashToken(session.token));
	}

	async changePassword(
		session: AuthenticatedSession,
		input: PasswordInput,
	): Promise<void> {
		this.requireMutable(session);
		const account = getOne<LoginRow>(
			this.#db,
			"SELECT id, password_hash AS passwordHash FROM users WHERE id = ?",
			[session.user.id],
		);
		if (
			!account ||
			!(await Bun.password.verify(input.currentPassword, account.passwordHash))
		) {
			throw new HttpError("BAD_REQUEST", "The current password is incorrect.");
		}
		const now = this.#now();
		const hash = await Bun.password.hash(input.nextPassword, {
			algorithm: "argon2id",
		});
		this.#db.run("BEGIN IMMEDIATE");
		try {
			const changed = this.#db
				.prepare(
					`UPDATE users
					 SET password_hash = ?, updated_at = ?
					 WHERE id = ? AND password_hash = ?`,
				)
				.run(hash, now, session.user.id, account.passwordHash);
			if (changed.changes !== 1) {
				throw new HttpError(
					"BAD_REQUEST",
					"The current password is incorrect.",
				);
			}
			this.#db
				.prepare(
					"UPDATE sessions SET revoked = 1, revoked_at = ? WHERE user_id = ? AND revoked = 0",
				)
				.run(now, session.user.id);
			this.#db.run("COMMIT");
		} catch (error) {
			this.#db.run("ROLLBACK");
			throw error;
		}
	}

	updateProfile(session: AuthenticatedSession, input: ProfileInput): SelfUser {
		this.requireMutable(session);
		if (
			input.neighborhoodId &&
			input.neighborhoodId !== session.user.neighborhood.id
		) {
			if (!this.neighborhoodExists(input.neighborhoodId)) {
				throw new HttpError("VALIDATION_ERROR", undefined, {
					neighborhoodId: ["Select a valid neighborhood."],
				});
			}
			if (this.hasBlockingNeighborhoodActivity(session.user.id)) {
				throw new HttpError("NEIGHBORHOOD_CHANGE_BLOCKED");
			}
		}

		this.#db
			.prepare(
				`UPDATE users
				 SET name = COALESCE(?, name),
					 bio = COALESCE(?, bio),
					 avatar_path = COALESCE(?, avatar_path),
					 neighborhood_id = COALESCE(?, neighborhood_id),
					 updated_at = ?
				 WHERE id = ?`,
			)
			.run(
				input.name ?? null,
				input.bio ?? null,
				input.avatarPath ?? null,
				input.neighborhoodId ?? null,
				this.#now(),
				session.user.id,
			);
		const updated = this.userById(session.user.id);
		if (!updated) throw new HttpError("INTERNAL_ERROR");
		return updated;
	}

	listNeighborhoods(query?: string): NeighborhoodDto[] {
		const normalized = query?.trim();
		const rows = normalized
			? getAll<NeighborhoodRow>(
					this.#db,
					`SELECT id, slug, name, city, state, timezone, description,
					 image_path AS imagePath
					 FROM neighborhoods
					 WHERE name LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\' OR state LIKE ? ESCAPE '\\'
					 ORDER BY name ASC`,
					Array(3).fill(
						`%${normalized.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`,
					),
				)
			: getAll<NeighborhoodRow>(
					this.#db,
					`SELECT id, slug, name, city, state, timezone, description,
					 image_path AS imagePath FROM neighborhoods ORDER BY name ASC`,
					[],
				);
		return rows.map(mapNeighborhood);
	}

	acknowledgeContact(input: ContactInput, clientAddress: string | null) {
		if (!this.rateLimit("contact", clientAddress, input.email, 6, 5)) {
			throw new HttpError("RATE_LIMITED");
		}
		const now = this.#now();
		this.purgeExpiredContactMessages(now);
		if (input.honeypot) return;
		this.#db
			.prepare(
				`INSERT INTO contact_messages (
				 id, name, email, message, created_at, expires_at, honeypot
				) VALUES (?, ?, ?, ?, ?, ?, '')`,
			)
			.run(
				this.newIdentifier("msg"),
				input.name,
				input.email,
				input.message,
				now,
				now + CONTACT_RETENTION_MS,
			);
	}

	health(): { migrationsApplied: number; writable: boolean } {
		try {
			const now = this.#now();
			this.#db.run("BEGIN IMMEDIATE");
			try {
				this.purgeExpiredContactMessages(now);
				const migrations = getOne<{ count: number }>(
					this.#db,
					"SELECT count(*) AS count FROM migrations",
					[],
				);
				this.#db.run("COMMIT");
				return { migrationsApplied: migrations?.count ?? 0, writable: true };
			} catch {
				this.#db.run("ROLLBACK");
				return { migrationsApplied: 0, writable: false };
			}
		} catch {
			return { migrationsApplied: 0, writable: false };
		}
	}

	clearCookie() {
		return this.cookie("", 0);
	}

	csrfToken(token: string) {
		return createHash("sha256")
			.update(this.#csrfSecret)
			.update(":")
			.update(token)
			.digest("base64url");
	}

	private issueSession(
		userId: string,
		replacedToken: string | null,
		verifiedPasswordHash?: string,
		sessionCap = MAX_ACTIVE_SESSIONS_PER_USER,
	): IssuedSession {
		const now = this.#now();
		const token = this.token(32);
		const tokenHash = this.hashToken(token);
		this.#db.run("BEGIN IMMEDIATE");
		try {
			this.#db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
			if (verifiedPasswordHash) {
				const currentAccount = getOne<LoginRow>(
					this.#db,
					"SELECT id, password_hash AS passwordHash FROM users WHERE id = ?",
					[userId],
				);
				if (
					!currentAccount ||
					currentAccount.passwordHash !== verifiedPasswordHash
				) {
					throw new HttpError("UNAUTHORIZED", "Invalid email or password.");
				}
			}
			if (replacedToken) {
				this.#db
					.prepare(
						"UPDATE sessions SET revoked = 1, revoked_at = ? WHERE token_hash = ? AND revoked = 0",
					)
					.run(now, this.hashToken(replacedToken));
			}
			this.#db
				.prepare(
					`INSERT INTO sessions (
					 token_hash, user_id, created_at, expires_at, last_seen_at, revoked
				 ) VALUES (?, ?, ?, ?, ?, 0)`,
				)
				.run(tokenHash, userId, now, now + SESSION_DURATION_MS, now);
			this.#db
				.prepare(
					`UPDATE sessions
					 SET revoked = 1, revoked_at = ?
					 WHERE token_hash IN (
						SELECT token_hash FROM sessions
						WHERE user_id = ? AND revoked = 0 AND expires_at > ?
						ORDER BY created_at DESC, token_hash = ? DESC, token_hash DESC
						LIMIT -1 OFFSET ?
					 )`,
				)
				.run(now, userId, now, tokenHash, sessionCap);
			this.#db
				.prepare("UPDATE users SET last_active_at = ? WHERE id = ?")
				.run(now, userId);
			this.#db.run("COMMIT");
		} catch (error) {
			this.#db.run("ROLLBACK");
			throw error;
		}
		const user = this.userById(userId);
		if (!user) throw new HttpError("INTERNAL_ERROR");
		return {
			user,
			cookie: this.cookie(token, Math.floor(SESSION_DURATION_MS / 1000)),
			csrfToken: this.csrfToken(token),
		};
	}

	private purgeExpiredContactMessages(now: number) {
		this.#db
			.prepare("DELETE FROM contact_messages WHERE expires_at <= ?")
			.run(now);
	}

	private sessionToken(request: Request) {
		return getCookie(request, SESSION_COOKIE_NAME);
	}

	private hashToken(token: string) {
		return createHash("sha256").update(token).digest("hex");
	}

	private token(size: number) {
		return Buffer.from(this.#randomBytes(size)).toString("base64url");
	}

	private schemaSafeFragment(size: number) {
		return Buffer.from(this.#randomBytes(size)).toString("hex");
	}

	private newIdentifier(prefix: "usr" | "msg") {
		return IdSchema.parse(`${prefix}_${this.schemaSafeFragment(12)}`);
	}

	private cookie(value: string, maxAge: number) {
		const secure = this.#secureCookies ? "; Secure" : "";
		const expires =
			maxAge === 0 ? "; Expires=Thu, 01 Jan 1970 00:00:00 GMT" : "";
		return `${SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${expires}${secure}`;
	}

	private neighborhoodExists(id: string) {
		return Boolean(
			getOne<{ id: string }>(
				this.#db,
				"SELECT id FROM neighborhoods WHERE id = ?",
				[id],
			),
		);
	}

	private findUserByEmail(email: string) {
		return getOne<{ id: string }>(
			this.#db,
			"SELECT id FROM users WHERE email = ?",
			[email],
		);
	}

	private userById(id: string): SelfUser | null {
		const row = getOne<UserRow>(
			this.#db,
			`SELECT
				u.id, u.email, u.name, u.handle, u.avatar_path AS avatarPath, u.bio,
				u.is_demo AS isDemo, u.created_at AS joinedAt,
				n.id AS neighborhoodId, n.slug AS neighborhoodSlug,
				n.name AS neighborhoodName, n.city AS neighborhoodCity,
				n.state AS neighborhoodState, n.timezone AS neighborhoodTimezone,
				n.description AS neighborhoodDescription,
				n.image_path AS neighborhoodImagePath
			 FROM users u
			 JOIN neighborhoods n ON n.id = u.neighborhood_id
			 WHERE u.id = ?`,
			[id],
		);
		return row ? mapSelfUser(row) : null;
	}

	private hasBlockingNeighborhoodActivity(userId: string) {
		const ownedActiveListing = getOne<{ id: string }>(
			this.#db,
			`SELECT id FROM listings
			 WHERE owner_id = ? AND status IN ('active', 'reserved') LIMIT 1`,
			[userId],
		);
		if (ownedActiveListing) return true;
		return Boolean(
			getOne<{ id: string }>(
				this.#db,
				`SELECT r.id FROM requests r
				 JOIN listings l ON l.id = r.listing_id
				 WHERE (r.requester_id = ? OR l.owner_id = ?)
				 AND r.status IN ('pending', 'accepted')
				 LIMIT 1`,
				[userId, userId],
			),
		);
	}

	private newHandle(email: string) {
		const local = email
			.slice(0, email.indexOf("@"))
			.toLowerCase()
			.replace(/[^a-z0-9_]+/g, "_")
			.replace(/^_+|_+$/g, "")
			.slice(0, 20);
		const base = (local.length >= 3 ? local : "member").slice(0, 20);
		let candidate = HandleSchema.parse(base);
		while (
			getOne<{ id: string }>(
				this.#db,
				"SELECT id FROM users WHERE handle = ?",
				[candidate],
			)
		) {
			candidate = HandleSchema.parse(`${base}_${this.schemaSafeFragment(3)}`);
		}
		return candidate;
	}
}
