import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import {
	ProfileExchangeHistoryResponseSchema,
	RequestParticipantSchema,
	RequestsResponseSchema,
} from "../src/lib/contracts";

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
				'Test neighborhood used only for isolated interaction route tests.', '/images/logo-with-text.svg', ?, ?)`,
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
		data: {
			data: RequestParticipantSchema.parse(
				(await responseJson<{ data: unknown }>(response)).data,
			),
		},
	};
};

const requestStatus = (app: TestApp, requestId: string) =>
	app.db.prepare("SELECT status FROM requests WHERE id = ?").get(requestId) as {
		status: string;
	};

const insertCompletedExchange = (
	app: TestApp,
	options: {
		listingId: string;
		requestId: string;
		ownerId: string;
		requesterId: string;
		title: string;
		completedAt: number;
	},
) => {
	insertListing(app, {
		id: options.listingId,
		ownerId: options.ownerId,
		status: "completed",
		title: options.title,
	});
	app.db
		.prepare(
			`INSERT INTO requests (
				id, listing_id, requester_id, opening_message, status, created_at, updated_at
			) VALUES (?, ?, ?, 'A completed exchange with no private details in profile history.',
				'completed', ?, ?)`,
		)
		.run(
			options.requestId,
			options.listingId,
			options.requesterId,
			app.now.value,
			options.completedAt,
		);
};

const insertReview = (
	app: TestApp,
	options: {
		id: string;
		requestId: string;
		reviewerId: string;
		rating: number;
		body: string;
		createdAt: number;
	},
) => {
	app.db
		.prepare(
			`INSERT INTO reviews (id, request_id, reviewer_id, rating, body, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		)
		.run(
			options.id,
			options.requestId,
			options.reviewerId,
			options.rating,
			options.body,
			options.createdAt,
		);
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
			expect(first.data.data.hasViewerReview).toBe(false);
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
			const tiedAt = app.now.value + 1;
			app.db
				.prepare(
					`INSERT INTO messages (id, request_id, sender_id, body, created_at)
					 VALUES (?, ?, ?, ?, ?)`,
				)
				.run(
					"msg_tie_a_001",
					requestId,
					ids.member,
					"First same-time message.",
					tiedAt,
				);
			app.db
				.prepare(
					`INSERT INTO messages (id, request_id, sender_id, body, created_at)
					 VALUES (?, ?, ?, ?, ?)`,
				)
				.run(
					"msg_tie_b_002",
					requestId,
					ids.owner,
					"Second same-time message.",
					tiedAt,
				);
			const privateThread = await app.fetch(
				request(
					`/api/requests/${requestId}/messages`,
					"GET",
					undefined,
					outsider,
				),
			);
			expect(privateThread.status).toBe(403);
			const newestPage = await app.fetch(
				request(
					`/api/requests/${requestId}/messages?limit=1`,
					"GET",
					undefined,
					member,
				),
			);
			const newestPageData = await responseJson<{
				data: { items: Array<{ body: string }>; nextCursor: string | null };
			}>(newestPage);
			expect(newestPageData.data.items[0]?.body).toBe(
				"Second same-time message.",
			);
			expect(newestPageData.data.nextCursor).toBeTruthy();
			const olderTiePage = await app.fetch(
				request(
					`/api/requests/${requestId}/messages?limit=1&cursor=${newestPageData.data.nextCursor}`,
					"GET",
					undefined,
					member,
				),
			);
			expect(
				(
					await responseJson<{ data: { items: Array<{ body: string }> } }>(
						olderTiePage,
					)
				).data.items[0]?.body,
			).toBe("First same-time message.");
			const chronologicalPage = await app.fetch(
				request(
					`/api/requests/${requestId}/messages?limit=3`,
					"GET",
					undefined,
					member,
				),
			);
			expect(
				(
					await responseJson<{ data: { items: Array<{ body: string }> } }>(
						chronologicalPage,
					)
				).data.items.map((item) => item.body),
			).toEqual([
				"That pickup time works for me.",
				"First same-time message.",
				"Second same-time message.",
			]);
			app.now.value = tiedAt + 1;
			expect(
				(
					await app.fetch(
						request(
							`/api/requests/${requestId}/messages`,
							"POST",
							{ body: "A new current update is available." },
							owner,
						),
					)
				).status,
			).toBe(201);
			const freshNewestPage = await app.fetch(
				request(
					`/api/requests/${requestId}/messages?limit=1`,
					"GET",
					undefined,
					member,
				),
			);
			expect(
				(
					await responseJson<{ data: { items: Array<{ body: string }> } }>(
						freshNewestPage,
					)
				).data.items[0]?.body,
			).toBe("A new current update is available.");

			const accepted = await app.fetch(
				request(
					`/api/requests/${requestId}`,
					"PATCH",
					{ action: "accept" },
					owner,
				),
			);
			expect(accepted.status).toBe(200);
			expect(
				RequestParticipantSchema.parse(
					(await responseJson<{ data: unknown }>(accepted)).data,
				).hasViewerReview,
			).toBe(false);
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

	test("derives persisted review visibility per request participant", async () => {
		const app = await createTestApp();
		try {
			insertCompletedExchange(app, {
				listingId: "list_review_visibility_001",
				requestId: "req_review_visibility_001",
				ownerId: ids.owner,
				requesterId: ids.member,
				title: "Completed visibility test drill",
				completedAt: app.now.value,
			});
			insertReview(app, {
				id: "rev_review_visibility_owner",
				requestId: "req_review_visibility_001",
				reviewerId: ids.owner,
				rating: 5,
				body: "The owner review persisted before this request list refresh.",
				createdAt: app.now.value,
			});

			const owner = await login(app, "owner@neighborly.test");
			const member = await login(app, "member@neighborly.test");
			const ownerRefresh = await app.fetch(
				request("/api/requests?role=owner", "GET", undefined, owner),
			);
			expect(ownerRefresh.status).toBe(200);
			expect(
				RequestsResponseSchema.parse(await responseJson<unknown>(ownerRefresh))
					.data.items[0]?.hasViewerReview,
			).toBe(true);

			const memberRefresh = await app.fetch(
				request("/api/requests?role=requester", "GET", undefined, member),
			);
			expect(memberRefresh.status).toBe(200);
			expect(
				RequestsResponseSchema.parse(await responseJson<unknown>(memberRefresh))
					.data.items[0]?.hasViewerReview,
			).toBe(false);

			expect(
				(
					await app.fetch(
						request(
							"/api/requests/req_review_visibility_001/reviews",
							"POST",
							{
								rating: 4,
								body: "The other participant can still leave their review.",
							},
							member,
						),
					)
				).status,
			).toBe(201);

			const memberRefreshAfterReview = await app.fetch(
				request("/api/requests?role=requester", "GET", undefined, member),
			);
			expect(
				RequestsResponseSchema.parse(
					await responseJson<unknown>(memberRefreshAfterReview),
				).data.items[0]?.hasViewerReview,
			).toBe(true);
		} finally {
			app.db.close();
		}
	});

	test("lists only completed profile exchanges with safe opposite reviews and stable cursor pagination", async () => {
		const app = await createTestApp();
		try {
			const newestAt = app.now.value + 4;
			const tiedAt = app.now.value + 2;
			const oldestAt = app.now.value + 1;
			insertCompletedExchange(app, {
				listingId: "list_history_004",
				requestId: "req_history_004",
				ownerId: ids.owner,
				requesterId: ids.member,
				title: "Newest completed drill",
				completedAt: newestAt,
			});
			insertCompletedExchange(app, {
				listingId: "list_history_003",
				requestId: "req_history_003",
				ownerId: ids.owner,
				requesterId: ids.member,
				title: "Unreviewed completed saw",
				completedAt: tiedAt,
			});
			insertCompletedExchange(app, {
				listingId: "list_history_002",
				requestId: "req_history_002",
				ownerId: ids.owner,
				requesterId: ids.member,
				title: "Older completed lamp",
				completedAt: tiedAt,
			});
			insertCompletedExchange(app, {
				listingId: "list_history_001",
				requestId: "req_history_001",
				ownerId: ids.memberTwo,
				requesterId: ids.owner,
				title: "Requester role exchange",
				completedAt: oldestAt,
			});
			insertListing(app, {
				id: "list_history_pending",
				status: "active",
				title: "Pending exchange excluded from history",
			});
			app.db
				.prepare(
					`INSERT INTO requests (
						id, listing_id, requester_id, opening_message, status, created_at, updated_at
					) VALUES (?, ?, ?, 'A pending exchange must never appear in profile history.',
						'pending', ?, ?)`,
				)
				.run(
					"req_history_pending",
					"list_history_pending",
					ids.member,
					app.now.value,
					app.now.value,
				);
			insertReview(app, {
				id: "rev_history_opposite",
				requestId: "req_history_004",
				reviewerId: ids.member,
				rating: 5,
				body: "Careful with the drill and prompt at return.",
				createdAt: newestAt + 1,
			});
			insertReview(app, {
				id: "rev_history_self",
				requestId: "req_history_004",
				reviewerId: ids.owner,
				rating: 1,
				body: "The owner review must not appear on their own history.",
				createdAt: newestAt + 1,
			});
			insertReview(app, {
				id: "rev_history_requester",
				requestId: "req_history_001",
				reviewerId: ids.memberTwo,
				rating: 4,
				body: "Communicative requester and a smooth exchange.",
				createdAt: oldestAt + 1,
			});

			const member = await login(app, "member@neighborly.test");
			const firstResponse = await app.fetch(
				request(
					`/api/users/${ids.owner}/history?limit=2`,
					"GET",
					undefined,
					member,
				),
			);
			expect(firstResponse.status).toBe(200);
			const first = ProfileExchangeHistoryResponseSchema.parse(
				await responseJson<unknown>(firstResponse),
			);
			expect(first.data.items).toHaveLength(2);
			expect(first.data.items.map((item) => item.listingId)).toEqual([
				"list_history_004",
				"list_history_003",
			]);
			expect(first.data.items[0]).toEqual({
				listingId: "list_history_004",
				listingTitle: "Newest completed drill",
				listingType: "lend",
				role: "owner",
				completedAt: newestAt,
				review: {
					id: "rev_history_opposite",
					rating: 5,
					body: "Careful with the drill and prompt at return.",
					createdAt: newestAt + 1,
					reviewer: {
						id: ids.member,
						name: "Member Neighbor",
						handle: "member_neighbor",
						avatarPath: "",
						bio: "",
					},
				},
			});
			expect(first.data.items[1]?.review).toBeNull();
			expect(first.data.items[0]).not.toHaveProperty("requestId");
			expect(first.data.items[0]).not.toHaveProperty("openingMessage");
			expect(first.data.items[0]).not.toHaveProperty("cancellationReason");
			expect(first.data.items[0]?.review?.reviewer).not.toHaveProperty("email");
			expect(first.data.nextCursor).toBeTruthy();

			const secondResponse = await app.fetch(
				request(
					`/api/users/${ids.owner}/history?limit=2&cursor=${first.data.nextCursor}`,
					"GET",
					undefined,
					member,
				),
			);
			expect(secondResponse.status).toBe(200);
			const second = ProfileExchangeHistoryResponseSchema.parse(
				await responseJson<unknown>(secondResponse),
			);
			expect(second.data.items.map((item) => item.listingId)).toEqual([
				"list_history_002",
				"list_history_001",
			]);
			expect(second.data.items[0]?.review).toBeNull();
			expect(second.data.items[1]).toEqual({
				listingId: "list_history_001",
				listingTitle: "Requester role exchange",
				listingType: "lend",
				role: "requester",
				completedAt: oldestAt,
				review: {
					id: "rev_history_requester",
					rating: 4,
					body: "Communicative requester and a smooth exchange.",
					createdAt: oldestAt + 1,
					reviewer: {
						id: ids.memberTwo,
						name: "Second Neighbor",
						handle: "second_neighbor",
						avatarPath: "",
						bio: "",
					},
				},
			});
			expect(second.data.nextCursor).toBeNull();
		} finally {
			app.db.close();
		}
	});

	test("requires an authenticated same-neighborhood viewer for profile history", async () => {
		const app = await createTestApp();
		try {
			const anonymous = await app.fetch(
				request(`/api/users/${ids.owner}/history`, "GET"),
			);
			expect(anonymous.status).toBe(401);

			const outsider = await login(app, "outsider@neighborly.test");
			const denied = await app.fetch(
				request(`/api/users/${ids.owner}/history`, "GET", undefined, outsider),
			);
			expect(denied.status).toBe(403);
			expect(
				(await responseJson<{ error: { code: string } }>(denied)).error.code,
			).toBe("FORBIDDEN");
		} finally {
			app.db.close();
		}
	});
});
