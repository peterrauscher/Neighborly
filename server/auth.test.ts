import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import { HandleSchema, IdSchema } from "../src/lib/contracts";
import { type AppHandler, createApp, resolveClientAddress } from "./app";
import { AuthService, MAX_DEMO_ACTIVE_SESSIONS } from "./auth";
import { FetchRouter } from "./http";
import { LOCAL_FIXTURE_CREDENTIALS, seedDatabase } from "./seed";

const ORIGIN = "http://neighborly.test";
const PASSWORD = "CorrectHorseBatteryStaple!";

type TestApp = {
	db: Database;
	fetch: AppHandler;
	now: { value: number };
};

const cookieFrom = (response: Response) => {
	const setCookie = response.headers.get("set-cookie");
	if (!setCookie) throw new Error("Expected a session cookie.");
	return setCookie.split(";", 1)[0];
};

const request = (
	path: string,
	method: string,
	body?: unknown,
	options: {
		cookie?: string;
		csrf?: string;
		origin?: string;
		forwardedFor?: string;
	} = {},
) => {
	const headers = new Headers();
	if (options.origin !== "") headers.set("Origin", options.origin ?? ORIGIN);
	if (options.cookie) headers.set("Cookie", options.cookie);
	if (options.csrf) headers.set("X-CSRF-Token", options.csrf);
	if (options.forwardedFor)
		headers.set("X-Forwarded-For", options.forwardedFor);
	if (body !== undefined) headers.set("Content-Type", "application/json");
	return new Request(`${ORIGIN}${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
};

const createTestApp = async (
	options: {
		allowedOrigins?: readonly string[];
		randomBytes?: (size: number) => Uint8Array;
		trustProxy?: boolean;
	} = {},
): Promise<TestApp> => {
	const db = new Database(":memory:");
	const now = { value: Date.UTC(2026, 7, 19) };
	const fetch = createApp({
		db,
		seed: false,
		allowedOrigins: options.allowedOrigins ?? [ORIGIN],
		trustProxy: options.trustProxy,
		now: () => now.value,
		csrfSecret: "test-csrf-secret",
		clientAddress: () => "127.0.0.1",
		randomBytes: options.randomBytes,
	});

	for (const neighborhood of [
		["nh_test_001", "test-heights", "Test Heights"],
		["nh_test_002", "test-gardens", "Test Gardens"],
	]) {
		db.prepare(
			`INSERT INTO neighborhoods (
				id, slug, name, city, state, timezone, description, image_path,
				created_at, updated_at
			) VALUES (?, ?, ?, 'Testville', 'TS', 'America/New_York',
				'Test neighborhood used only for isolated identity tests.', '/images/logo-with-text.svg', ?, ?)`,
		).run(
			neighborhood[0],
			neighborhood[1],
			neighborhood[2],
			now.value,
			now.value,
		);
	}

	const hash = await Bun.password.hash(PASSWORD, { algorithm: "argon2id" });
	for (const user of [
		["usr_test_001", "member@neighborly.test", "Member User", "member_user", 0],
		[
			"usr_demo_001",
			"demo@neighborly.test",
			"Demo Resident",
			"demo_resident",
			1,
		],
	]) {
		db.prepare(
			`INSERT INTO users (
				id, email, password_hash, name, handle, avatar_path, bio,
				neighborhood_id, is_demo, created_at, updated_at, last_active_at
			) VALUES (?, ?, ?, ?, ?, '', '', 'nh_test_001', ?, ?, ?, ?)`,
		).run(
			user[0],
			user[1],
			hash,
			user[2],
			user[3],
			user[4],
			now.value,
			now.value,
			now.value,
		);
	}

	return { db, fetch, now };
};

const login = async (app: TestApp, email = "member@neighborly.test") => {
	const response = await app.fetch(
		request("/api/auth/login", "POST", { email, password: PASSWORD }),
	);
	expect(response.status).toBe(200);
	const cookie = cookieFrom(response);
	const csrf = response.headers.get("x-csrf-token");
	if (!csrf) throw new Error("Expected a CSRF token.");
	return { cookie, csrf };
};

describe("identity boundary", () => {
	test("reports ready after bounded database write and migration checks", async () => {
		const app = await createTestApp();
		try {
			const response = await app.fetch(request("/api/health", "GET"));
			expect(response.status).toBe(200);
			const body = (await response.json()) as {
				data: {
					status: string;
					database: { migrationsApplied: number; writable: boolean };
				};
			};
			expect(body.data.status).toBe("ready");
			expect(body.data.database.writable).toBe(true);
			expect(body.data.database.migrationsApplied).toBeGreaterThan(0);
		} finally {
			app.db.close();
		}
	});

	test("uses a bounded transaction rather than an integrity scan for readiness", () => {
		const statements: string[] = [];
		const db = {
			run(statement: string) {
				statements.push(statement);
			},
			prepare(statement: string) {
				statements.push(statement);
				return { run: () => ({ changes: 0 }) };
			},
			query(statement: string) {
				statements.push(statement);
				return { get: () => ({ count: 1 }) };
			},
		} as unknown as Database;

		expect(new AuthService({ db }).health()).toEqual({
			migrationsApplied: 1,
			writable: true,
		});
		expect(statements).toEqual([
			"BEGIN IMMEDIATE",
			"DELETE FROM contact_messages WHERE expires_at <= ?",
			"SELECT count(*) AS count FROM migrations",
			"COMMIT",
		]);
	});

	test("returns unavailable after rolling back failed readiness maintenance", async () => {
		const app = await createTestApp();
		try {
			app.db
				.prepare(
					`INSERT INTO contact_messages (
						id, name, email, message, created_at, expires_at, honeypot
					) VALUES (?, ?, ?, ?, ?, ?, '')`,
				)
				.run(
					"msg_failed_health_cleanup",
					"Expired Contact",
					"expired-health-cleanup@neighborly.test",
					"This expired contact message must remain after a failed health check.",
					app.now.value - 1_000,
					app.now.value,
				);
			app.db.exec(`
				CREATE TRIGGER fail_health_cleanup
				BEFORE DELETE ON contact_messages
				BEGIN
					SELECT RAISE(ABORT, 'health maintenance failure');
				END;
			`);

			const response = await app.fetch(request("/api/health", "GET"));

			expect(response.status).toBe(503);
			expect(app.db.query("SELECT id FROM contact_messages").all()).toEqual([
				{ id: "msg_failed_health_cleanup" },
			]);
		} finally {
			app.db.close();
		}
	});

	test("registers a user with an opaque hashed session and restores the session", async () => {
		const app = await createTestApp();
		try {
			const response = await app.fetch(
				request("/api/auth/register", "POST", {
					name: "New Neighbor",
					email: "new@neighborly.test",
					password: PASSWORD,
					neighborhoodId: "nh_test_001",
				}),
			);
			expect(response.status).toBe(201);
			expect(response.headers.get("set-cookie")).toContain("HttpOnly");
			expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
			expect(await response.json()).toMatchObject({
				data: { email: "new@neighborly.test", isDemo: false },
			});

			const cookie = cookieFrom(response);
			const session = await app.fetch(
				request("/api/session", "GET", undefined, { cookie }),
			);
			expect(session.status).toBe(200);
			expect(await session.json()).toMatchObject({
				data: { user: { email: "new@neighborly.test" } },
			});
			const stored = app.db.query("SELECT token_hash FROM sessions").all();
			expect(stored).toHaveLength(1);
			expect(JSON.stringify(stored)).not.toContain(cookie.split("=", 2)[1]);
		} finally {
			app.db.close();
		}
	});

	test("keeps generated IDs and collision handles schema-safe for trailing base64url symbols", async () => {
		const entropySizes: number[] = [];
		const bytes = Uint8Array.from({ length: 32 }, () => 0xff);
		expect(
			Buffer.from(bytes.slice(0, 12)).toString("base64url").endsWith("_"),
		).toBe(true);
		const app = await createTestApp({
			randomBytes(size) {
				entropySizes.push(size);
				return bytes.slice(0, size);
			},
		});
		try {
			app.db
				.prepare(
					`INSERT INTO users (
						id, email, password_hash, name, handle, avatar_path, bio,
						neighborhood_id, is_demo, created_at, updated_at, last_active_at
					) VALUES (?, ?, ?, ?, ?, '', '', 'nh_test_001', 0, ?, ?, ?)`,
				)
				.run(
					"usr_handle_001",
					"taken@neighborly.test",
					"unusable-password-hash",
					"Handle Holder",
					"collision",
					app.now.value,
					app.now.value,
					app.now.value,
				);

			const registration = await app.fetch(
				request("/api/auth/register", "POST", {
					name: "Collision Neighbor",
					email: "collision@neighborly.test",
					password: PASSWORD,
					neighborhoodId: "nh_test_001",
				}),
			);
			expect(registration.status).toBe(201);
			const body = (await registration.json()) as {
				data: { id: string; handle: string; email: string };
			};
			expect(IdSchema.safeParse(body.data.id).success).toBe(true);
			expect(HandleSchema.safeParse(body.data.handle).success).toBe(true);
			expect(body.data.handle).toBe("collision_ffffff");
			expect(
				app.db
					.query(
						"SELECT id, handle, email FROM users WHERE email = 'collision@neighborly.test'",
					)
					.get(),
			).toEqual({
				id: body.data.id,
				handle: body.data.handle,
				email: body.data.email,
			});

			const cookie = cookieFrom(registration);
			const token = cookie.split("=", 2)[1];
			expect(token).toBe(Buffer.from(bytes).toString("base64url"));
			const session = await app.fetch(
				request("/api/session", "GET", undefined, { cookie }),
			);
			expect(session.status).toBe(200);

			const contact = await app.fetch(
				request("/api/contact", "POST", {
					name: "Contact Neighbor",
					email: "contact@neighborly.test",
					message: "A message that is long enough to be accepted.",
				}),
			);
			expect(contact.status).toBe(202);
			const message = app.db
				.query("SELECT id FROM contact_messages WHERE email = ?")
				.get("contact@neighborly.test") as { id: string } | null;
			expect(message).not.toBeNull();
			expect(IdSchema.safeParse(message?.id).success).toBe(true);
			expect(entropySizes).toEqual([12, 3, 32, 12]);
		} finally {
			app.db.close();
		}
	});

	test("returns one generic response for failed sign-ins and applies an IP and email limit", async () => {
		const app = await createTestApp();
		try {
			const failed = await app.fetch(
				request("/api/auth/login", "POST", {
					email: "member@neighborly.test",
					password: "not-the-password",
				}),
			);
			const absent = await app.fetch(
				request("/api/auth/login", "POST", {
					email: "absent@neighborly.test",
					password: "not-the-password",
				}),
			);
			expect(failed.status).toBe(401);
			expect(absent.status).toBe(401);
			expect(await failed.json()).toEqual(await absent.json());

			for (let count = 0; count < 4; count += 1) {
				await app.fetch(
					request("/api/auth/login", "POST", {
						email: "member@neighborly.test",
						password: "not-the-password",
					}),
				);
			}
			const limited = await app.fetch(
				request("/api/auth/login", "POST", {
					email: "member@neighborly.test",
					password: "not-the-password",
				}),
			);
			expect(limited.status).toBe(429);
			expect(await limited.json()).toMatchObject({
				error: { code: "RATE_LIMITED" },
			});
		} finally {
			app.db.close();
		}
	});

	test("uses the injected peer address rather than untrusted forwarded headers", async () => {
		const app = await createTestApp();
		try {
			for (let count = 0; count < 6; count += 1) {
				const response = await app.fetch(
					request(
						"/api/auth/login",
						"POST",
						{
							email: `source-${count}@neighborly.test`,
							password: "not-the-password",
						},
						{ forwardedFor: `198.51.100.${count}` },
					),
					"127.0.0.1",
				);
				expect(response.status).toBe(401);
			}
			const limited = await app.fetch(
				request(
					"/api/auth/login",
					"POST",
					{
						email: "source-overflow@neighborly.test",
						password: "not-the-password",
					},
					{ forwardedFor: "203.0.113.99" },
				),
				"127.0.0.1",
			);
			expect(limited.status).toBe(429);
		} finally {
			app.db.close();
		}
	});

	test("uses the rightmost valid forwarded address only for trusted proxies", async () => {
		const app = await createTestApp({ trustProxy: true });
		try {
			for (let count = 0; count < 7; count += 1) {
				const response = await app.fetch(
					request(
						"/api/auth/login",
						"POST",
						{
							email: `trusted-source-${count}@neighborly.test`,
							password: "not-the-password",
						},
						{
							forwardedFor: `198.51.100.1, 203.0.113.${count + 1}`,
						},
					),
					"127.0.0.1",
				);
				expect(response.status).toBe(401);
			}
		} finally {
			app.db.close();
		}
	});

	test("falls back to the peer address for invalid forwarded addresses", () => {
		const peerAddress = "127.0.0.1";
		const forwarded = new Request(`${ORIGIN}/api/auth/login`, {
			headers: { "X-Forwarded-For": "198.51.100.1, not-an-ip" },
		});
		expect(resolveClientAddress(forwarded, peerAddress, true)).toBe(
			peerAddress,
		);
		expect(resolveClientAddress(forwarded, peerAddress, false)).toBe(
			peerAddress,
		);
	});

	test("accepts a configured public origin for proxy-rewritten requests", async () => {
		const publicOrigin = "https://neighborly.test";
		const app = await createTestApp({ allowedOrigins: [publicOrigin] });
		try {
			const response = await app.fetch(
				request(
					"/api/auth/login",
					"POST",
					{ email: "member@neighborly.test", password: PASSWORD },
					{ origin: publicOrigin },
				),
			);
			expect(response.status).toBe(200);
		} finally {
			app.db.close();
		}
	});

	test("does not reset login limits after a successful issuance", async () => {
		const app = await createTestApp();
		try {
			for (let count = 0; count < 4; count += 1) {
				await app.fetch(
					request("/api/auth/login", "POST", {
						email: "member@neighborly.test",
						password: "not-the-password",
					}),
				);
			}
			expect(
				(
					await app.fetch(
						request("/api/auth/login", "POST", {
							email: "member@neighborly.test",
							password: PASSWORD,
						}),
					)
				).status,
			).toBe(200);
			expect(
				(
					await app.fetch(
						request("/api/auth/login", "POST", {
							email: "member@neighborly.test",
							password: "not-the-password",
						}),
					)
				).status,
			).toBe(429);
		} finally {
			app.db.close();
		}
	});

	test("rejects untrusted origins and missing CSRF tokens before authenticated mutation", async () => {
		const app = await createTestApp();
		try {
			const { cookie, csrf } = await login(app);
			const badOrigin = await app.fetch(
				request(
					"/api/me",
					"PATCH",
					{ bio: "Updated safely." },
					{ cookie, csrf, origin: "https://attacker.test" },
				),
			);
			expect(badOrigin.status).toBe(403);
			expect(await badOrigin.json()).toMatchObject({
				error: { code: "FORBIDDEN" },
			});

			const missingCsrf = await app.fetch(
				request("/api/me", "PATCH", { bio: "Updated safely." }, { cookie }),
			);
			expect(missingCsrf.status).toBe(403);
			const updated = await app.fetch(
				request(
					"/api/me",
					"PATCH",
					{ bio: "Updated safely." },
					{ cookie, csrf },
				),
			);
			expect(updated.status).toBe(200);
			expect(await updated.json()).toMatchObject({
				data: { bio: "Updated safely." },
			});
		} finally {
			app.db.close();
		}
	});

	test("rejects external avatar URLs without persisting them", async () => {
		const app = await createTestApp();
		try {
			const session = await login(app);
			const response = await app.fetch(
				request(
					"/api/me",
					"PATCH",
					{ avatarPath: "https://tracker.example/pixel.png" },
					session,
				),
			);
			expect(response.status).toBe(422);
			expect(await response.json()).toMatchObject({
				error: { code: "VALIDATION_ERROR" },
			});
			expect(
				app.db
					.query("SELECT avatar_path FROM users WHERE id = 'usr_test_001'")
					.get(),
			).toEqual({ avatar_path: "" });
		} finally {
			app.db.close();
		}
	});

	test("enforces shared UTF-8 password bounds before hashing", async () => {
		const app = await createTestApp();
		try {
			for (const password of ["short", "😀".repeat(33)]) {
				const response = await app.fetch(
					request("/api/auth/register", "POST", {
						name: "Password Tester",
						email: `${password.length}@neighborly.test`,
						password,
						neighborhoodId: "nh_test_001",
					}),
				);
				expect(response.status).toBe(422);
				expect(await response.json()).toMatchObject({
					error: { code: "VALIDATION_ERROR" },
				});
			}
		} finally {
			app.db.close();
		}
	});

	test("revokes the current session and clears its cookie after a password change", async () => {
		const app = await createTestApp();
		try {
			const session = await login(app);
			const otherSession = await login(app);
			const changed = await app.fetch(
				request(
					"/api/me/password",
					"PATCH",
					{
						currentPassword: PASSWORD,
						nextPassword: "NewCorrectHorseBatteryStaple!",
					},
					session,
				),
			);
			expect(changed.status).toBe(204);
			expect(changed.headers.get("set-cookie")).toContain("Max-Age=0");

			const stolenSession = await app.fetch(
				request("/api/session", "GET", undefined, { cookie: session.cookie }),
			);
			expect(await stolenSession.json()).toEqual({ data: { user: null } });
			const otherStolenSession = await app.fetch(
				request("/api/session", "GET", undefined, {
					cookie: otherSession.cookie,
				}),
			);
			expect(await otherStolenSession.json()).toEqual({ data: { user: null } });
			expect(
				(
					await app.fetch(
						request("/api/auth/login", "POST", {
							email: "member@neighborly.test",
							password: PASSWORD,
						}),
					)
				).status,
			).toBe(401);
			expect(
				(
					await app.fetch(
						request("/api/auth/login", "POST", {
							email: "member@neighborly.test",
							password: "NewCorrectHorseBatteryStaple!",
						}),
					)
				).status,
			).toBe(200);
		} finally {
			app.db.close();
		}
	});

	test("purges expired sessions and caps durable active sessions per user", async () => {
		const app = await createTestApp();
		try {
			for (let count = 0; count < 5; count += 1) {
				app.db
					.prepare(
						`INSERT INTO sessions (
						token_hash, user_id, created_at, expires_at, last_seen_at, revoked
					) VALUES (?, 'usr_test_001', ?, ?, ?, 0)`,
					)
					.run(
						`active-session-${count}`,
						app.now.value - 10 - count,
						app.now.value + 30 * 24 * 60 * 60 * 1000,
						app.now.value - 10 - count,
					);
			}
			app.db
				.prepare(
					`INSERT INTO sessions (
					token_hash, user_id, created_at, expires_at, last_seen_at, revoked
				) VALUES ('expired-session', 'usr_test_001', ?, ?, ?, 0)`,
				)
				.run(app.now.value - 2_000, app.now.value - 1, app.now.value - 2_000);

			await login(app);
			expect(
				app.db
					.query("SELECT count(*) AS count FROM sessions WHERE revoked = 0")
					.get(),
			).toEqual({ count: 5 });
			expect(
				app.db
					.query(
						"SELECT token_hash FROM sessions WHERE token_hash = 'expired-session'",
					)
					.get(),
			).toBeNull();
		} finally {
			app.db.close();
		}
	});

	test("rotates old sessions after login and rejects expired sessions", async () => {
		const app = await createTestApp();
		try {
			const first = await login(app);
			const rotated = await app.fetch(
				request(
					"/api/auth/login",
					"POST",
					{ email: "member@neighborly.test", password: PASSWORD },
					{ cookie: first.cookie },
				),
			);
			expect(rotated.status).toBe(200);
			const secondCookie = cookieFrom(rotated);
			const oldSession = await app.fetch(
				request("/api/session", "GET", undefined, { cookie: first.cookie }),
			);
			expect(await oldSession.json()).toEqual({ data: { user: null } });

			app.now.value += 30 * 24 * 60 * 60 * 1000 + 1;
			const expiredSession = await app.fetch(
				request("/api/session", "GET", undefined, { cookie: secondCookie }),
			);
			expect(await expiredSession.json()).toEqual({ data: { user: null } });
		} finally {
			app.db.close();
		}
	});

	test("denies demo account mutations while permitting demo session creation", async () => {
		const app = await createTestApp();
		try {
			const demo = await app.fetch(request("/api/auth/demo", "POST", {}));
			expect(demo.status).toBe(200);
			const mutation = await app.fetch(
				request(
					"/api/me",
					"PATCH",
					{ bio: "This must not persist." },
					{
						cookie: cookieFrom(demo),
						csrf: demo.headers.get("x-csrf-token") ?? undefined,
					},
				),
			);
			expect(mutation.status).toBe(403);
			expect(await mutation.json()).toMatchObject({
				error: { code: "DEMO_READ_ONLY" },
			});
		} finally {
			app.db.close();
		}
	});

	test("keeps more than five concurrent demo sessions valid", async () => {
		const app = await createTestApp();
		try {
			const cookies: string[] = [];
			for (let count = 0; count < 6; count += 1) {
				const demo = await app.fetch(
					request("/api/auth/demo", "POST", {}),
					`198.51.100.${count + 1}`,
				);
				expect(demo.status).toBe(200);
				cookies.push(cookieFrom(demo));
			}
			for (const cookie of cookies) {
				const session = await app.fetch(
					request("/api/session", "GET", undefined, { cookie }),
				);
				expect(await session.json()).toMatchObject({
					data: { user: { isDemo: true } },
				});
			}
		} finally {
			app.db.close();
		}
	});

	test("limits a demo source without exhausting shared demo issuance capacity", async () => {
		const app = await createTestApp();
		try {
			for (let count = 0; count < 6; count += 1) {
				const demo = await app.fetch(
					request("/api/auth/demo", "POST", {}),
					"198.51.100.42",
				);
				expect(demo.status).toBe(200);
			}
			const limited = await app.fetch(
				request("/api/auth/demo", "POST", {}),
				"198.51.100.42",
			);
			expect(limited.status).toBe(429);
			const otherSource = await app.fetch(
				request("/api/auth/demo", "POST", {}),
				"198.51.100.43",
			);
			expect(otherSource.status).toBe(200);
		} finally {
			app.db.close();
		}
	});

	test("bounds durable demo-session storage separately from member sessions", async () => {
		const app = await createTestApp();
		try {
			for (let count = 0; count <= MAX_DEMO_ACTIVE_SESSIONS; count += 1) {
				const demo = await app.fetch(
					request("/api/auth/demo", "POST", {}),
					`2001:db8::${count}`,
				);
				expect(demo.status).toBe(200);
			}
			expect(
				app.db
					.query(
						`SELECT count(*) AS count FROM sessions
						 WHERE user_id = 'usr_demo_001' AND revoked = 0`,
					)
					.get(),
			).toEqual({ count: MAX_DEMO_ACTIVE_SESSIONS });
		} finally {
			app.db.close();
		}
	});

	test("blocks a neighborhood change while the member owns an active listing", async () => {
		const app = await createTestApp();
		try {
			app.db
				.prepare(
					`INSERT INTO listings (
					id, owner_id, neighborhood_id, type, title, description, category,
					condition, available_from, available_through, availability_notes,
					wanted_item, status, created_at, updated_at
				) VALUES (
					'listing_test_001', 'usr_test_001', 'nh_test_001', 'lend',
					'Test ladder', 'A sturdy test ladder for boundary coverage.', 'Tools',
					'good', '2026-08-20', '2026-08-25', NULL, NULL, 'active', ?, ?
				)`,
				)
				.run(app.now.value, app.now.value);
			const session = await login(app);
			const response = await app.fetch(
				request("/api/me", "PATCH", { neighborhoodId: "nh_test_002" }, session),
			);
			expect(response.status).toBe(409);
			expect(await response.json()).toMatchObject({
				error: { code: "NEIGHBORHOOD_CHANGE_BLOCKED" },
			});
		} finally {
			app.db.close();
		}
	});

	test("fails closed for production data, public-origin, and proxy settings", async () => {
		const originalNodeEnv = process.env.NODE_ENV;
		const originalDatabasePath = process.env.NEIGHBORLY_DB_PATH;
		const originalPublicOrigins = process.env.NEIGHBORLY_PUBLIC_ORIGINS;
		const originalTrustProxy = process.env.NEIGHBORLY_TRUST_PROXY;
		const originalAllowedOrigins = process.env.NEIGHBORLY_ALLOWED_ORIGINS;
		try {
			process.env.NODE_ENV = "production";
			Reflect.deleteProperty(process.env, "NEIGHBORLY_DB_PATH");
			Reflect.deleteProperty(process.env, "NEIGHBORLY_PUBLIC_ORIGINS");
			Reflect.deleteProperty(process.env, "NEIGHBORLY_TRUST_PROXY");
			process.env.NEIGHBORLY_ALLOWED_ORIGINS = ORIGIN;
			expect(() => createApp({ allowedOrigins: [ORIGIN] })).toThrow(
				"NEIGHBORLY_DB_PATH is required in production.",
			);

			const db = new Database(":memory:");
			expect(() => createApp({ db, seed: false })).toThrow(
				"NEIGHBORLY_PUBLIC_ORIGINS is required in production.",
			);
			process.env.NEIGHBORLY_PUBLIC_ORIGINS = "https://neighborly.test/";
			process.env.NEIGHBORLY_TRUST_PROXY = "1";
			expect(() => createApp({ db, seed: false })).toThrow(
				"NEIGHBORLY_PUBLIC_ORIGINS must contain canonical absolute HTTP(S) origins.",
			);
			process.env.NEIGHBORLY_PUBLIC_ORIGINS = `${ORIGIN},${ORIGIN}`;
			Reflect.deleteProperty(process.env, "NEIGHBORLY_TRUST_PROXY");
			expect(() => createApp({ db, seed: false })).toThrow(
				"NEIGHBORLY_TRUST_PROXY=1 is required in production.",
			);
			process.env.NEIGHBORLY_TRUST_PROXY = "1";

			process.env.NEIGHBORLY_DB_PATH = " :memory: ";
			expect(() =>
				createApp({
					allowedOrigins: [ORIGIN],
					trustProxy: true,
					seed: false,
				}),
			).toThrow("Production database path must not be :memory:.");
			expect(() =>
				createApp({
					databasePath: "\t:memory:\n",
					allowedOrigins: [ORIGIN],
					trustProxy: true,
					seed: false,
				}),
			).toThrow("Production database path must not be :memory:.");
			Reflect.deleteProperty(process.env, "NEIGHBORLY_DB_PATH");

			const databaseDirectory = await mkdtemp(
				join(tmpdir(), "neighborly-production-"),
			);
			let persistentApp: AppHandler | undefined;
			try {
				persistentApp = createApp({
					databasePath: join(databaseDirectory, "neighborly.sqlite"),
					seed: false,
				});
				const health = await persistentApp(request("/api/health", "GET"));
				expect(health.status).toBe(200);
			} finally {
				await persistentApp?.close?.();
				await rm(databaseDirectory, { force: true, recursive: true });
			}

			const fetch = createApp({ db, seed: true });
			const demo = await fetch(request("/api/auth/demo", "POST", {}));
			expect(demo.status).toBe(200);

			const seededImage = await fetch(
				request("/api/listing-images/img_001", "GET"),
			);
			expect(seededImage.status).toBe(200);
			expect(seededImage.headers.get("content-type")).toBe("image/png");
			expect((await seededImage.arrayBuffer()).byteLength).toBeGreaterThan(0);

			const mutableFixtureEmails = Object.keys(
				LOCAL_FIXTURE_CREDENTIALS,
			).filter(
				(identity) =>
					identity.endsWith("@neighborly.local") &&
					identity !== "demo@neighborly.local",
			);
			for (const [index, email] of mutableFixtureEmails.entries()) {
				const password = LOCAL_FIXTURE_CREDENTIALS[email];
				if (!password)
					throw new Error(`Missing fixture password for ${email}.`);
				const login = await fetch(
					request("/api/auth/login", "POST", { email, password }),
					`203.0.113.${index + 1}`,
				);
				expect(login.status).toBe(401);
			}
			db.close();
		} finally {
			if (originalNodeEnv === undefined) {
				Reflect.deleteProperty(process.env, "NODE_ENV");
			} else {
				process.env.NODE_ENV = originalNodeEnv;
			}
			if (originalDatabasePath === undefined) {
				Reflect.deleteProperty(process.env, "NEIGHBORLY_DB_PATH");
			} else {
				process.env.NEIGHBORLY_DB_PATH = originalDatabasePath;
			}
			if (originalPublicOrigins === undefined) {
				Reflect.deleteProperty(process.env, "NEIGHBORLY_PUBLIC_ORIGINS");
			} else {
				process.env.NEIGHBORLY_PUBLIC_ORIGINS = originalPublicOrigins;
			}
			if (originalTrustProxy === undefined) {
				Reflect.deleteProperty(process.env, "NEIGHBORLY_TRUST_PROXY");
			} else {
				process.env.NEIGHBORLY_TRUST_PROXY = originalTrustProxy;
			}
			if (originalAllowedOrigins === undefined) {
				Reflect.deleteProperty(process.env, "NEIGHBORLY_ALLOWED_ORIGINS");
			} else {
				process.env.NEIGHBORLY_ALLOWED_ORIGINS = originalAllowedOrigins;
			}
		}
	});

	test("upgrades development fixtures to public-demo without preserving credentials or sessions", async () => {
		const db = new Database(":memory:");
		const fetch = createApp({
			db,
			seed: false,
			allowedOrigins: [ORIGIN],
			clientAddress: () => "127.0.0.1",
		});
		try {
			await seedDatabase(db, { mode: "development" });
			const fixtureEmail = "alma@neighborly.local";
			const fixturePassword = LOCAL_FIXTURE_CREDENTIALS[fixtureEmail];
			if (!fixturePassword) {
				throw new Error(`Missing fixture password for ${fixtureEmail}.`);
			}
			const fixtureLogin = await fetch(
				request("/api/auth/login", "POST", {
					email: fixtureEmail,
					password: fixturePassword,
				}),
			);
			expect(fixtureLogin.status).toBe(200);
			const fixtureCookie = cookieFrom(fixtureLogin);

			const registeredPassword = "IndependentNeighborPassword!";
			const registered = await fetch(
				request("/api/auth/register", "POST", {
					name: "Independent Neighbor",
					email: "independent@neighborly.test",
					password: registeredPassword,
					neighborhoodId: "nh_oakridge_01",
				}),
			);
			expect(registered.status).toBe(201);

			await seedDatabase(db, { mode: "public-demo" });

			for (const [index, identity] of Object.keys(LOCAL_FIXTURE_CREDENTIALS)
				.filter((value) => value.endsWith("@neighborly.local"))
				.entries()) {
				const password = LOCAL_FIXTURE_CREDENTIALS[identity];
				if (!password)
					throw new Error(`Missing fixture password for ${identity}.`);
				const login = await fetch(
					request("/api/auth/login", "POST", { email: identity, password }),
					`198.51.100.${index + 1}`,
				);
				expect(login.status).toBe(401);
			}

			const staleFixtureSession = await fetch(
				request("/api/session", "GET", undefined, { cookie: fixtureCookie }),
			);
			expect(await staleFixtureSession.json()).toEqual({
				data: { user: null },
			});
			const demo = await fetch(
				request("/api/auth/demo", "POST", {}),
				"198.51.100.250",
			);
			expect(demo.status).toBe(200);
			const registeredLogin = await fetch(
				request("/api/auth/login", "POST", {
					email: "independent@neighborly.test",
					password: registeredPassword,
				}),
				"198.51.100.251",
			);
			expect(registeredLogin.status).toBe(200);
		} finally {
			db.close();
		}
	});

	test("accepts four adversarial-prefix multipart parts and rejects a fifth", async () => {
		const router = new FetchRouter({ allowedOrigins: [ORIGIN] });
		router.add(
			{
				method: "POST",
				path: "/multipart-adversarial",
				params: z.object({}),
				query: z.object({}),
				body: z.object({
					images: z.array(z.instanceof(File)).max(3),
					metadata: z.object({ intent: z.literal("upload") }),
				}),
				requestEncoding: "multipart",
				response: z.object({
					data: z.object({ accepted: z.literal(true) }),
				}),
				responseEncoding: "json",
				successStatus: 200,
				errors: ["BAD_REQUEST"],
			},
			() => ({ data: { accepted: true } }),
		);

		const boundary = `${"a".repeat(69)}b`;
		const repetitivePrefix = `--${"a".repeat(69)}x`.repeat(512);
		const multipartRequest = (
			partCount: number,
			requestBoundary = boundary,
		) => {
			const parts = [
				`--${requestBoundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n{"intent":"upload"}\r\n`,
			];
			for (let index = 1; index < partCount; index += 1) {
				parts.push(
					`--${requestBoundary}\r\nContent-Disposition: form-data; name="images"; filename="image-${index}.txt"\r\nContent-Type: text/plain\r\n\r\n${repetitivePrefix}${index}\r\n`,
				);
			}
			parts.push(`--${requestBoundary}--\r\n`);
			return new Request(`${ORIGIN}/multipart-adversarial`, {
				method: "POST",
				headers: {
					"Content-Type": `multipart/form-data; boundary=${requestBoundary}`,
					Origin: ORIGIN,
				},
				body: parts.join(""),
			});
		};

		const accepted = await router.fetch(multipartRequest(4));
		expect(accepted.status).toBe(200);
		expect(await accepted.json()).toEqual({ data: { accepted: true } });

		const rejected = await router.fetch(multipartRequest(5));
		expect(rejected.status).toBe(400);
		expect((await rejected.json()).error.code).toBe("BAD_REQUEST");

		const invalidBoundary = await router.fetch(
			multipartRequest(1, "a".repeat(71)),
		);
		expect(invalidBoundary.status).toBe(400);
		expect((await invalidBoundary.json()).error.code).toBe("BAD_REQUEST");

		const invalidSyntax = await router.fetch(
			multipartRequest(1, "invalid@boundary"),
		);
		expect(invalidSyntax.status).toBe(400);
		expect((await invalidSyntax.json()).error.code).toBe("BAD_REQUEST");
	});

	test("acknowledges filled contact honeypots without persisting them", async () => {
		const app = await createTestApp();
		try {
			const response = await app.fetch(
				request("/api/contact", "POST", {
					name: "Automation Trap",
					email: "automation@neighborly.test",
					message: "This bot-filled contact submission is discarded.",
					honeypot: "https://spam.invalid/landing",
				}),
			);

			expect(response.status).toBe(202);
			expect(await response.json()).toEqual({ data: { acknowledged: true } });
			expect(
				app.db.query("SELECT count(*) AS count FROM contact_messages").get(),
			).toEqual({ count: 0 });
		} finally {
			app.db.close();
		}
	});

	test("persists normal contacts and clears expired contacts during contact traffic", async () => {
		const app = await createTestApp();
		try {
			app.db
				.prepare(
					`INSERT INTO contact_messages (
						id, name, email, message, created_at, expires_at, honeypot
					) VALUES (?, ?, ?, ?, ?, ?, '')`,
				)
				.run(
					"msg_expired_before_contact",
					"Expired Contact",
					"expired-before-contact@neighborly.test",
					"This expired contact message must be deleted.",
					app.now.value - 1_000,
					app.now.value,
				);

			const response = await app.fetch(
				request("/api/contact", "POST", {
					name: "Normal Contact",
					email: "normal-contact@neighborly.test",
					message: "This normal contact submission is retained.",
				}),
			);

			expect(response.status).toBe(202);
			expect(
				app.db
					.query(
						`SELECT name, email, message, created_at AS createdAt,
						 expires_at AS expiresAt, honeypot
						 FROM contact_messages`,
					)
					.all(),
			).toEqual([
				{
					name: "Normal Contact",
					email: "normal-contact@neighborly.test",
					message: "This normal contact submission is retained.",
					createdAt: app.now.value,
					expiresAt: app.now.value + 30 * 24 * 60 * 60 * 1_000,
					honeypot: "",
				},
			]);
		} finally {
			app.db.close();
		}
	});

	test("purges only expired contact messages during health maintenance", async () => {
		const app = await createTestApp();
		try {
			app.db
				.prepare(
					`INSERT INTO contact_messages (
						id, name, email, message, created_at, expires_at, honeypot
					) VALUES (?, ?, ?, ?, ?, ?, '')`,
				)
				.run(
					"msg_expired_contact",
					"Expired Contact",
					"expired-contact@neighborly.test",
					"This expired contact message must be deleted.",
					app.now.value - 1_000,
					app.now.value,
				);
			app.db
				.prepare(
					`INSERT INTO contact_messages (
						id, name, email, message, created_at, expires_at, honeypot
					) VALUES (?, ?, ?, ?, ?, ?, '')`,
				)
				.run(
					"msg_active_contact",
					"Active Contact",
					"active-contact@neighborly.test",
					"This unexpired contact message must remain.",
					app.now.value - 1_000,
					app.now.value + 1_000,
				);

			const response = await app.fetch(request("/api/health", "GET"));

			expect(response.status).toBe(200);
			expect(
				app.db.query("SELECT id FROM contact_messages ORDER BY id").all(),
			).toEqual([{ id: "msg_active_contact" }]);
		} finally {
			app.db.close();
		}
	});
});
