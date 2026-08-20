import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import { type AppHandler, createApp } from "./app";

const ORIGIN = "http://neighborly.test";
const PASSWORD = "CorrectHorseBatteryStaple!";

type TestApp = {
	db: Database;
	fetch: AppHandler;
	now: { value: number };
};

type Session = { cookie: string; csrf: string };

const ids = {
	owner: "usr_owner_001",
	member: "usr_member_002",
	memberTwo: "usr_member_003",
	outsider: "usr_outsider_004",
	demo: "usr_demo_005",
	firstNeighborhood: "nh_test_001",
	secondNeighborhood: "nh_test_002",
};

const request = (
	path: string,
	method: string,
	body?: unknown,
	session?: Session,
) => {
	const headers = new Headers({ Origin: ORIGIN });
	if (session) {
		headers.set("Cookie", session.cookie);
		headers.set("X-CSRF-Token", session.csrf);
	}
	if (body !== undefined) headers.set("Content-Type", "application/json");
	return new Request(`${ORIGIN}${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
};

const responseJson = async <T>(response: Response): Promise<T> =>
	response.json();

const sessionFrom = (response: Response): Session => {
	const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
	const csrf = response.headers.get("x-csrf-token");
	if (!cookie || !csrf) throw new Error("Expected an authenticated response.");
	return { cookie, csrf };
};

const login = async (app: TestApp, email: string) => {
	const response = await app.fetch(
		request("/api/auth/login", "POST", { email, password: PASSWORD }),
	);
	expect(response.status).toBe(200);
	return sessionFrom(response);
};

const createTestApp = async (): Promise<TestApp> => {
	const db = new Database(":memory:");
	const now = { value: Date.UTC(2026, 7, 19, 12) };
	const fetch = createApp({
		db,
		seed: false,
		allowedOrigins: [ORIGIN],
		now: () => now.value,
		csrfSecret: "interaction-test-csrf-secret",
		clientAddress: () => "127.0.0.1",
	});
	for (const [id, slug, name] of [
		[ids.firstNeighborhood, "test-heights", "Test Heights"],
		[ids.secondNeighborhood, "test-gardens", "Test Gardens"],
	]) {
		db.prepare(
			`INSERT INTO neighborhoods (
				id, slug, name, city, state, timezone, description, image_path, created_at, updated_at
			) VALUES (?, ?, ?, 'Testville', 'TS', 'America/New_York',
				'Test neighborhood used only for isolated interaction route tests.', '/assets/logo.svg', ?, ?)`,
		).run(id, slug, name, now.value, now.value);
	}
	const passwordHash = await Bun.password.hash(PASSWORD, {
		algorithm: "argon2id",
	});
	for (const [id, email, name, handle, neighborhoodId, isDemo] of [
		[
			ids.owner,
			"owner@neighborly.test",
			"Owner Neighbor",
			"owner_neighbor",
			ids.firstNeighborhood,
			0,
		],
		[
			ids.member,
			"member@neighborly.test",
			"Member Neighbor",
			"member_neighbor",
			ids.firstNeighborhood,
			0,
		],
		[
			ids.memberTwo,
			"member-two@neighborly.test",
			"Second Neighbor",
			"second_neighbor",
			ids.firstNeighborhood,
			0,
		],
		[
			ids.outsider,
			"outsider@neighborly.test",
			"Outside Neighbor",
			"outside_neighbor",
			ids.secondNeighborhood,
			0,
		],
		[
			ids.demo,
			"demo@neighborly.test",
			"Demo Neighbor",
			"demo_neighbor",
			ids.firstNeighborhood,
			1,
		],
	]) {
		db.prepare(
			`INSERT INTO users (
				id, email, password_hash, name, handle, avatar_path, bio, neighborhood_id,
				is_demo, created_at, updated_at, last_active_at
			) VALUES (?, ?, ?, ?, ?, '', '', ?, ?, ?, ?, ?)`,
		).run(
			id,
			email,
			passwordHash,
			name,
			handle,
			neighborhoodId,
			isDemo,
			now.value,
			now.value,
			now.value,
		);
	}
	return { db, fetch, now };
};

const insertListing = (
	app: TestApp,
	overrides: Partial<{
		id: string;
		ownerId: string;
		neighborhoodId: string;
		type: "lend" | "borrow" | "trade";
		status: "active" | "reserved" | "completed" | "withdrawn";
		title: string;
	}> = {},
) => {
	const row = {
		id: "list_lend_001",
		ownerId: ids.owner,
		neighborhoodId: ids.firstNeighborhood,
		type: "lend" as const,
		status: "active" as const,
		title: "Useful cordless drill",
		...overrides,
	};
	app.db
		.prepare(
			`INSERT INTO listings (
				id, owner_id, neighborhood_id, type, title, description, category,
				condition, available_from, available_through, availability_notes,
				wanted_item, status, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, 'A maintained cordless drill with bits for weekend repairs.', 'tools',
				'good', '2026-08-20', '2026-09-20', NULL, ?, ?, ?, ?)`,
		)
		.run(
			row.id,
			row.ownerId,
			row.neighborhoodId,
			row.type,
			row.title,
			row.type === "lend" ? null : "A useful exchange item",
			row.status,
			app.now.value,
			app.now.value,
		);
	return row;
};

const lendRequest = (
	openingMessage = "Could I borrow this for a Saturday repair project?",
) => ({
	listingType: "lend" as const,
	openingMessage,
	requestedStart: "2026-08-22",
	requestedEnd: "2026-08-23",
});

const createRequest = async (
	app: TestApp,
	listingId: string,
	session: Session,
	body = lendRequest(),
) => {
	const response = await app.fetch(
		request(`/api/listings/${listingId}/requests`, "POST", body, session),
	);
	return {
		response,
		data: await responseJson<{ data: { id: string } }>(response),
	};
};

const requestStatus = (app: TestApp, requestId: string) =>
	app.db.prepare("SELECT status FROM requests WHERE id = ?").get(requestId) as {
		status: string;
	};

describe("interaction boundaries", () => {
	test("guards type, membership, role, stale, and atomic request transitions", async () => {
		const app = await createTestApp();
		try {
			insertListing(app);
			insertListing(app, {
				id: "list_borrow_002",
				type: "borrow",
				title: "Looking for a ladder",
			});
			const owner = await login(app, "owner@neighborly.test");
			const member = await login(app, "member@neighborly.test");
			const memberTwo = await login(app, "member-two@neighborly.test");
			const outsider = await login(app, "outsider@neighborly.test");
			const demo = await login(app, "demo@neighborly.test");

			const self = await app.fetch(
				request(
					"/api/listings/list_lend_001/requests",
					"POST",
					lendRequest(),
					owner,
				),
			);
			expect(self.status).toBe(403);
			const crossNeighborhood = await app.fetch(
				request(
					"/api/listings/list_lend_001/requests",
					"POST",
					lendRequest(),
					outsider,
				),
			);
			expect(crossNeighborhood.status).toBe(403);
			const mismatch = await app.fetch(
				request(
					"/api/listings/list_borrow_002/requests",
					"POST",
					lendRequest(),
					member,
				),
			);
			expect(mismatch.status).toBe(422);
			const demoMutation = await app.fetch(
				request(
					"/api/listings/list_lend_001/requests",
					"POST",
					lendRequest(),
					demo,
				),
			);
			expect(
				(await responseJson<{ error: { code: string } }>(demoMutation)).error
					.code,
			).toBe("DEMO_READ_ONLY");

			const first = await createRequest(app, "list_lend_001", member);
			expect(first.response.status).toBe(201);
			const second = await createRequest(
				app,
				"list_lend_001",
				memberTwo,
				lendRequest("May I use the drill for a quick shelf installation?"),
			);
			expect(second.response.status).toBe(201);
			const ownerList = await app.fetch(
				request("/api/requests?role=owner", "GET", undefined, owner),
			);
			expect(
				(await responseJson<{ data: { items: unknown[] } }>(ownerList)).data
					.items,
			).toHaveLength(2);
			const requesterList = await app.fetch(
				request("/api/requests?role=requester", "GET", undefined, member),
			);
			expect(
				(await responseJson<{ data: { items: unknown[] } }>(requesterList)).data
					.items,
			).toHaveLength(1);
			const hiddenList = await app.fetch(
				request("/api/requests?role=all", "GET", undefined, outsider),
			);
			expect(
				(await responseJson<{ data: { items: unknown[] } }>(hiddenList)).data
					.items,
			).toHaveLength(0);

			const requesterAccept = await app.fetch(
				request(
					`/api/requests/${first.data.data.id}`,
					"PATCH",
					{ action: "accept" },
					member,
				),
			);
			expect(requesterAccept.status).toBe(403);
			app.db.exec(`CREATE TRIGGER reject_reservation BEFORE UPDATE OF status ON listings
				WHEN NEW.status = 'reserved' BEGIN SELECT RAISE(ABORT, 'injected reservation failure'); END;`);
			const rejectedAccept = await app.fetch(
				request(
					`/api/requests/${first.data.data.id}`,
					"PATCH",
					{ action: "accept" },
					owner,
				),
			);
			expect(rejectedAccept.status).toBe(500);
			expect(requestStatus(app, first.data.data.id).status).toBe("pending");
			expect(
				(
					app.db
						.prepare("SELECT status FROM listings WHERE id = ?")
						.get("list_lend_001") as { status: string }
				).status,
			).toBe("active");
			app.db.exec("DROP TRIGGER reject_reservation");

			const accepts = await Promise.all([
				app.fetch(
					request(
						`/api/requests/${first.data.data.id}`,
						"PATCH",
						{ action: "accept" },
						owner,
					),
				),
				app.fetch(
					request(
						`/api/requests/${second.data.data.id}`,
						"PATCH",
						{ action: "accept" },
						owner,
					),
				),
			]);
			expect(
				accepts.filter((response) => response.status === 200),
			).toHaveLength(1);
			expect(
				app.db
					.prepare(
						"SELECT count(*) AS count FROM requests WHERE listing_id = ? AND status = 'accepted'",
					)
					.get("list_lend_001"),
			).toEqual({ count: 1 });
			expect(
				app.db
					.prepare(
						"SELECT count(*) AS count FROM requests WHERE listing_id = ? AND status = 'declined'",
					)
					.get("list_lend_001"),
			).toEqual({ count: 1 });
			const acceptedId = [first.data.data.id, second.data.data.id].find(
				(id) => requestStatus(app, id).status === "accepted",
			);
			if (!acceptedId)
				throw new Error("Expected exactly one accepted request.");
			const staleDecline = await app.fetch(
				request(
					`/api/requests/${acceptedId}`,
					"PATCH",
					{ action: "decline" },
					owner,
				),
			);
			expect(
				(await responseJson<{ error: { code: string } }>(staleDecline)).error
					.code,
			).toBe("STALE_TRANSITION");
		} finally {
			app.db.close();
		}
	});

	test("keeps threads private and paginated, completes durably, and derives trust aggregates", async () => {
		const app = await createTestApp();
		try {
			insertListing(app);
			const owner = await login(app, "owner@neighborly.test");
			const member = await login(app, "member@neighborly.test");
			const outsider = await login(app, "outsider@neighborly.test");
			const created = await createRequest(app, "list_lend_001", member);
			const requestId = created.data.data.id;
			expect(
				(
					await app.fetch(
						request(
							`/api/requests/${requestId}/messages`,
							"POST",
							{ body: "I can pick this up after lunch." },
							member,
						),
					)
				).status,
			).toBe(201);
			app.now.value += 1;
			expect(
				(
					await app.fetch(
						request(
							`/api/requests/${requestId}/messages`,
							"POST",
							{ body: "That pickup time works for me." },
							owner,
						),
					)
				).status,
			).toBe(201);
			const privateThread = await app.fetch(
				request(
					`/api/requests/${requestId}/messages`,
					"GET",
					undefined,
					outsider,
				),
			);
			expect(privateThread.status).toBe(403);
			const firstPage = await app.fetch(
				request(
					`/api/requests/${requestId}/messages?limit=1`,
					"GET",
					undefined,
					member,
				),
			);
			const firstPageData = await responseJson<{
				data: { items: Array<{ body: string }>; nextCursor: string | null };
			}>(firstPage);
			expect(firstPageData.data.items[0]?.body).toBe(
				"I can pick this up after lunch.",
			);
			expect(firstPageData.data.nextCursor).toBeTruthy();
			const secondPage = await app.fetch(
				request(
					`/api/requests/${requestId}/messages?limit=1&cursor=${firstPageData.data.nextCursor}`,
					"GET",
					undefined,
					member,
				),
			);
			expect(
				(
					await responseJson<{ data: { items: Array<{ body: string }> } }>(
						secondPage,
					)
				).data.items[0]?.body,
			).toBe("That pickup time works for me.");

			expect(
				(
					await app.fetch(
						request(
							`/api/requests/${requestId}`,
							"PATCH",
							{ action: "accept" },
							owner,
						),
					)
				).status,
			).toBe(200);
			const requesterComplete = await app.fetch(
				request(
					`/api/requests/${requestId}`,
					"PATCH",
					{ action: "complete" },
					member,
				),
			);
			expect(requesterComplete.status).toBe(403);
			app.db.exec(`CREATE TRIGGER reject_completion BEFORE UPDATE OF status ON listings
				WHEN NEW.status = 'completed' BEGIN SELECT RAISE(ABORT, 'injected completion failure'); END;`);
			const failedComplete = await app.fetch(
				request(
					`/api/requests/${requestId}`,
					"PATCH",
					{ action: "complete" },
					owner,
				),
			);
			expect(failedComplete.status).toBe(500);
			expect(requestStatus(app, requestId).status).toBe("accepted");
			app.db.exec("DROP TRIGGER reject_completion");
			expect(
				(
					await app.fetch(
						request(
							`/api/requests/${requestId}`,
							"PATCH",
							{ action: "complete" },
							owner,
						),
					)
				).status,
			).toBe(200);

			const ownerReview = await app.fetch(
				request(
					`/api/requests/${requestId}/reviews`,
					"POST",
					{ rating: 5, body: "Reliable pickup and careful return." },
					owner,
				),
			);
			expect(ownerReview.status).toBe(201);
			const duplicateReview = await app.fetch(
				request(
					`/api/requests/${requestId}/reviews`,
					"POST",
					{ rating: 4, body: "A duplicate review should not persist." },
					owner,
				),
			);
			expect(
				(await responseJson<{ error: { code: string } }>(duplicateReview)).error
					.code,
			).toBe("CONFLICT");
			expect(
				(
					await app.fetch(
						request(
							`/api/requests/${requestId}/reviews`,
							"POST",
							{ rating: 4, body: "Clear handoff and a well kept tool." },
							member,
						),
					)
				).status,
			).toBe(201);
			const profile = await app.fetch(
				request(`/api/users/${ids.owner}`, "GET", undefined, member),
			);
			const profileData = await responseJson<{
				data: {
					completedExchangeCount: number;
					reviewCount: number;
					aggregateRating: number | null;
					responseHistory: {
						totalRequests: number;
						respondedRequests: number;
						responseRate: number | null;
					};
				};
			}>(profile);
			expect(profileData.data).toMatchObject({
				completedExchangeCount: 1,
				reviewCount: 1,
				aggregateRating: 4,
				responseHistory: {
					totalRequests: 1,
					respondedRequests: 1,
					responseRate: 1,
				},
			});
			const outsiderProfile = await app.fetch(
				request(`/api/users/${ids.owner}`, "GET", undefined, outsider),
			);
			expect(outsiderProfile.status).toBe(403);
			const neighbors = await app.fetch(
				request("/api/neighbors?limit=1", "GET", undefined, owner),
			);
			const neighborsData = await responseJson<{
				data: { items: Array<{ id: string }>; nextCursor: string | null };
			}>(neighbors);
			expect(neighborsData.data.items).toHaveLength(1);
			expect(neighborsData.data.items[0]?.id).not.toBe(ids.owner);
		} finally {
			app.db.close();
		}
	});

	test("excludes requester cancellations from response history while retaining accepted responses", async () => {
		const app = await createTestApp();
		try {
			insertListing(app);
			const owner = await login(app, "owner@neighborly.test");
			const member = await login(app, "member@neighborly.test");
			for (let index = 0; index < 3; index += 1) {
				const created = await createRequest(
					app,
					"list_lend_001",
					member,
					lendRequest(
						`Could I borrow this for repair task number ${index + 1}?`,
					),
				);
				expect(created.response.status).toBe(201);
				const cancelled = await app.fetch(
					request(
						`/api/requests/${created.data.data.id}`,
						"PATCH",
						{ action: "cancel", reason: "No longer needed." },
						member,
					),
				);
				expect(cancelled.status).toBe(200);
			}
			const unrespondedProfile = await app.fetch(
				request(`/api/users/${ids.owner}`, "GET", undefined, member),
			);
			expect(
				(
					await responseJson<{
						data: {
							responseHistory: {
								totalRequests: number;
								respondedRequests: number;
								responseRate: number | null;
							};
						};
					}>(unrespondedProfile)
				).data.responseHistory,
			).toEqual({ totalRequests: 0, respondedRequests: 0, responseRate: null });

			const accepted = await createRequest(
				app,
				"list_lend_001",
				member,
				lendRequest(
					"Could I borrow this for one confirmed repair appointment?",
				),
			);
			expect(
				(
					await app.fetch(
						request(
							`/api/requests/${accepted.data.data.id}`,
							"PATCH",
							{ action: "accept" },
							owner,
						),
					)
				).status,
			).toBe(200);
			const beforeCancellation = app.db
				.prepare(
					"SELECT owner_responded_at AS ownerRespondedAt FROM requests WHERE id = ?",
				)
				.get(accepted.data.data.id) as { ownerRespondedAt: number };
			expect(beforeCancellation.ownerRespondedAt).toBe(app.now.value);
			expect(
				(
					await app.fetch(
						request(
							`/api/requests/${accepted.data.data.id}`,
							"PATCH",
							{ action: "cancel", reason: "The plans changed." },
							member,
						),
					)
				).status,
			).toBe(200);
			const afterCancellation = app.db
				.prepare(
					"SELECT status, owner_responded_at AS ownerRespondedAt FROM requests WHERE id = ?",
				)
				.get(accepted.data.data.id) as {
				status: string;
				ownerRespondedAt: number;
			};
			expect(afterCancellation).toEqual({
				status: "cancelled",
				ownerRespondedAt: beforeCancellation.ownerRespondedAt,
			});
			const respondedProfile = await app.fetch(
				request(`/api/users/${ids.owner}`, "GET", undefined, member),
			);
			expect(
				(
					await responseJson<{
						data: {
							responseHistory: {
								totalRequests: number;
								respondedRequests: number;
								responseRate: number | null;
							};
						};
					}>(respondedProfile)
				).data.responseHistory,
			).toEqual({ totalRequests: 1, respondedRequests: 1, responseRate: 1 });
		} finally {
			app.db.close();
		}
	});
});
