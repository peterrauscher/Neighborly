import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import sharp from "sharp";

import {
	API_ROUTES,
	FeedResponseSchema,
	MAX_LISTING_IMAGE_BYTES,
	MAX_LISTING_IMAGE_COUNT,
	MAX_MULTIPART_BODY_BYTES,
	PreviewSuccessSchema,
} from "../src/lib/contracts";
import { type AppHandler, createApp } from "./app";
import { ImageService } from "./images";

const ORIGIN = "http://neighborly.test";
const PASSWORD = "CorrectHorseBatteryStaple!";

type TestApp = {
	db: Database;
	fetch: AppHandler;
	now: { value: number };
};

type Session = {
	cookie: string;
	csrf: string;
};

const ids = {
	owner: "usr_owner_001",
	member: "usr_member_002",
	outsider: "usr_outsider_003",
	demo: "usr_demo_004",
	firstNeighborhood: "nh_test_001",
	secondNeighborhood: "nh_test_002",
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
	session?: Session,
) => {
	const headers = new Headers({ Origin: ORIGIN });
	if (session) {
		headers.set("Cookie", session.cookie);
		headers.set("X-CSRF-Token", session.csrf);
	}
	let payload: BodyInit | undefined;
	if (body instanceof FormData) {
		payload = body;
	} else if (body !== undefined) {
		headers.set("Content-Type", "application/json");
		payload = JSON.stringify(body);
	}
	return new Request(`${ORIGIN}${path}`, { method, headers, body: payload });
};

const login = async (app: TestApp, email: string): Promise<Session> => {
	const response = await app.fetch(
		request("/api/auth/login", "POST", { email, password: PASSWORD }),
	);
	expect(response.status).toBe(200);
	const csrf = response.headers.get("x-csrf-token");
	if (!csrf) throw new Error("Expected a CSRF token.");
	return { cookie: cookieFrom(response), csrf };
};

const insertListing = (
	app: TestApp,
	overrides: Partial<{
		id: string;
		ownerId: string;
		neighborhoodId: string;
		type: "lend" | "borrow" | "trade";
		title: string;
		description: string;
		category: string;
		status: "active" | "reserved" | "completed" | "withdrawn";
		createdAt: number;
		updatedAt: number;
		availableFrom: string;
		availableThrough: string;
		wantedItem: string | null;
	}> = {},
) => {
	const row = {
		id: "list_fixture_001",
		ownerId: ids.owner,
		neighborhoodId: ids.firstNeighborhood,
		type: "lend" as const,
		title: "Useful cordless drill",
		description: "A maintained cordless drill with bits for weekend repairs.",
		category: "tools",
		status: "active" as const,
		createdAt: app.now.value,
		updatedAt: app.now.value,
		availableFrom: "2026-08-20",
		availableThrough: "2026-09-20",
		wantedItem: null,
		...overrides,
	};
	app.db
		.prepare(
			`INSERT INTO listings (
				id, owner_id, neighborhood_id, type, title, description, category,
				condition, available_from, available_through, availability_notes,
				wanted_item, status, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, 'good', ?, ?, NULL, ?, ?, ?, ?)`,
		)
		.run(
			row.id,
			row.ownerId,
			row.neighborhoodId,
			row.type,
			row.title,
			row.description,
			row.category,
			row.availableFrom,
			row.availableThrough,
			row.wantedItem,
			row.status,
			row.createdAt,
			row.updatedAt,
		);
	return row;
};

const createTestApp = async (): Promise<TestApp> => {
	const db = new Database(":memory:");
	const now = { value: Date.UTC(2026, 7, 19, 12) };
	const fetch = createApp({
		db,
		seed: false,
		allowedOrigins: [ORIGIN],
		now: () => now.value,
		csrfSecret: "listing-test-csrf-secret",
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
				'Test neighborhood used only for isolated listing route tests.', '/images/logo-with-text.svg', ?, ?)`,
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

const imageUpload = async (
	files: readonly File[],
	metadata: readonly { altText: string; sortOrder: number }[],
) => {
	const form = new FormData();
	for (const file of files) form.append("images", file);
	form.set("metadata", JSON.stringify(metadata));
	return form;
};
const copyOwnedBytes = (bytes: ArrayBufferView): Uint8Array<ArrayBuffer> => {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
	return copy;
};

const validImageFile = async (name = "listing.png") => {
	const image = await sharp({
		create: { width: 2, height: 2, channels: 3, background: "#4c6fff" },
	})
		.png()
		.toBuffer();
	return new File([copyOwnedBytes(image)], name, { type: "image/png" });
};

type DeferredMultipartRequest = {
	request: Request;
	pulled: Promise<void>;
	release: () => void;
	readonly bodyWasPulled: boolean;
	readonly bodyWasCancelled: boolean;
};

const deferredMultipartRequest = (
	session: Session,
	body: Uint8Array,
): DeferredMultipartRequest => {
	let resolvePull: (() => void) | undefined;
	const pulled = new Promise<void>((resolve) => {
		resolvePull = resolve;
	});
	let resolveBody: (() => void) | undefined;
	const bodyReleased = new Promise<void>((resolve) => {
		resolveBody = resolve;
	});
	let bodyWasPulled = false;
	let bodyWasCancelled = false;
	const stream = new ReadableStream<Uint8Array>(
		{
			pull(controller) {
				bodyWasPulled = true;
				resolvePull?.();
				return bodyReleased.then(() => {
					controller.enqueue(body);
					controller.close();
				});
			},
			cancel() {
				bodyWasCancelled = true;
				resolveBody?.();
			},
		},
		{ highWaterMark: 0 },
	);
	const headers = new Headers({
		Origin: ORIGIN,
		"Content-Type": "multipart/form-data; boundary=neighborly-test-boundary",
		Cookie: session.cookie,
		"X-CSRF-Token": session.csrf,
	});
	return {
		request: new Request(`${ORIGIN}/api/listings/list_fixture_001/images`, {
			method: "POST",
			headers,
			body: stream,
		}),
		pulled,
		release: () => {
			if (!resolveBody)
				throw new Error("Multipart body release was not initialized.");
			resolveBody();
		},
		get bodyWasPulled() {
			return bodyWasPulled;
		},
		get bodyWasCancelled() {
			return bodyWasCancelled;
		},
	};
};

const serializedImageMultipart = async (file: File): Promise<Uint8Array> => {
	const boundary = "neighborly-test-boundary";
	const encoder = new TextEncoder();
	const fileBytes = new Uint8Array(await file.arrayBuffer());
	const chunks = [
		encoder.encode(
			`--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="${file.name}"\r\nContent-Type: image/png\r\n\r\n`,
		),
		fileBytes,
		encoder.encode(
			`\r\n--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n[{"altText":"Deferred image","sortOrder":0}]\r\n--${boundary}--\r\n`,
		),
	];
	const bytes = new Uint8Array(
		chunks.reduce((length, chunk) => length + chunk.byteLength, 0),
	);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
};

describe("listing boundary", () => {
	test("paginates a stable neighborhood feed, composes filters, and keeps preview private", async () => {
		const app = await createTestApp();
		try {
			insertListing(app, {
				id: "list_feed_001",
				title: "Garden drill",
				createdAt: 30,
			});
			insertListing(app, {
				id: "list_feed_002",
				title: "Garden rake",
				category: "garden",
				createdAt: 20,
			});
			insertListing(app, {
				id: "list_feed_003",
				title: "Garden planter",
				createdAt: 10,
				availableFrom: "2026-08-25",
				availableThrough: "2026-08-30",
			});
			insertListing(app, {
				id: "list_preview_001",
				ownerId: ids.outsider,
				neighborhoodId: ids.secondNeighborhood,
				title: "Curated neighborhood tool",
				createdAt: 40,
			});
			app.db
				.prepare("UPDATE listings SET is_public_preview = 1 WHERE id = ?")
				.run("list_preview_001");
			insertListing(app, {
				id: "list_other_001",
				ownerId: ids.outsider,
				neighborhoodId: ids.secondNeighborhood,
				title: "Ordinary cross-neighborhood tool",
				createdAt: 39,
			});

			const preview = await app.fetch(request("/api/preview?limit=8", "GET"));
			expect(preview.status).toBe(200);
			const previewBody = PreviewSuccessSchema.parse(await preview.json());
			expect(previewBody.data.items).toEqual([
				expect.objectContaining({
					id: "list_preview_001",
					neighborhood: "Test Gardens",
				}),
			]);
			expect(previewBody.data.items[0]).not.toHaveProperty("owner");
			expect(previewBody.data.items[0]).not.toHaveProperty("savesCount");
			expect(previewBody.data.items[0]).not.toHaveProperty("availabilityNotes");

			const member = await login(app, "member@neighborly.test");
			const first = await app.fetch(
				request("/api/feed?limit=2", "GET", undefined, member),
			);
			expect(first.status).toBe(200);
			const firstBody = FeedResponseSchema.parse(await first.json());
			expect(firstBody.data.items.map((item) => item.id)).toEqual([
				"list_feed_001",
				"list_feed_002",
			]);
			expect(firstBody.data.nextCursor).toEqual(expect.any(String));

			const second = await app.fetch(
				request(
					`/api/feed?limit=2&cursor=${encodeURIComponent(firstBody.data.nextCursor ?? "")}`,
					"GET",
					undefined,
					member,
				),
			);
			expect(second.status).toBe(200);
			const secondBody = FeedResponseSchema.parse(await second.json());
			expect(secondBody.data.items.map((item) => item.id)).toEqual([
				"list_feed_003",
			]);

			const saved = await app.fetch(
				request("/api/listings/list_feed_001/save", "POST", {}, member),
			);
			expect(saved.status).toBe(200);
			const filtered = await app.fetch(
				request(
					"/api/feed?saved=true&type=lend&category=tools&q=garden&availableFrom=2026-08-21&availableThrough=2026-08-22",
					"GET",
					undefined,
					member,
				),
			);
			expect(filtered.status).toBe(200);
			expect(
				FeedResponseSchema.parse(await filtered.json()).data.items,
			).toEqual([
				{
					id: "list_feed_001",
					type: "lend",
					title: "Garden drill",
					description:
						"A maintained cordless drill with bits for weekend repairs.",
					category: "tools",
					condition: "good",
					availableFrom: "2026-08-20",
					availableThrough: "2026-09-20",
					wantedItem: "",
					status: "active",
					images: [],
					neighborhood: "Test Heights",
					owner: {
						id: ids.owner,
						name: "Owner Neighbor",
						handle: "owner_neighbor",
						avatarPath: "",
						bio: "",
					},
					savesCount: 1,
					reactionsCount: 0,
					commentsCount: 0,
					requestsCount: 0,
					isSavedByViewer: true,
					hasViewerReaction: false,
					isRequestedByViewer: false,
				},
			]);
		} finally {
			app.db.close();
		}
	});

	test("projects only pending and accepted viewer requests while preserving the member listing DTO", async () => {
		const app = await createTestApp();
		try {
			const requestStates = [
				{
					id: "list_request_pending",
					requestId: "req_projection_pending",
					status: "pending",
					isRequestedByViewer: true,
				},
				{
					id: "list_request_accepted",
					requestId: "req_projection_accepted",
					status: "accepted",
					isRequestedByViewer: true,
				},
				{
					id: "list_request_declined",
					requestId: "req_projection_declined",
					status: "declined",
					isRequestedByViewer: false,
				},
				{
					id: "list_request_cancelled",
					requestId: "req_projection_cancelled",
					status: "cancelled",
					isRequestedByViewer: false,
				},
			] as const;
			for (const [index, requestState] of requestStates.entries()) {
				insertListing(app, {
					id: requestState.id,
					title: `Request projection ${requestState.status}`,
					createdAt: app.now.value - index,
				});
				app.db
					.prepare(
						`INSERT INTO requests (
							id, listing_id, requester_id, opening_message, status,
							cancelled_by_user_id, cancellation_reason, created_at, updated_at
						) VALUES (?, ?, ?, 'A request used only to test listing state projection.', ?, ?, ?, ?, ?)`,
					)
					.run(
						requestState.requestId,
						requestState.id,
						ids.member,
						requestState.status,
						requestState.status === "cancelled" ? ids.member : null,
						requestState.status === "cancelled" ? "No longer needed." : null,
						app.now.value,
						app.now.value,
					);
			}

			const member = await login(app, "member@neighborly.test");
			const response = await app.fetch(
				request("/api/feed?limit=8", "GET", undefined, member),
			);
			expect(response.status).toBe(200);
			const feed = FeedResponseSchema.parse(await response.json());
			expect(
				feed.data.items
					.filter((item) => item.id.startsWith("list_request_"))
					.map(({ id, isRequestedByViewer }) => ({ id, isRequestedByViewer }))
					.sort((left, right) => left.id.localeCompare(right.id)),
			).toEqual(
				requestStates
					.map(({ id, isRequestedByViewer }) => ({ id, isRequestedByViewer }))
					.sort((left, right) => left.id.localeCompare(right.id)),
			);

			const pending = feed.data.items.find(
				(item) => item.id === "list_request_pending",
			);
			expect(Object.keys(pending ?? {}).sort()).toEqual([
				"availableFrom",
				"availableThrough",
				"category",
				"commentsCount",
				"condition",
				"description",
				"hasViewerReaction",
				"id",
				"images",
				"isRequestedByViewer",
				"isSavedByViewer",
				"neighborhood",
				"owner",
				"reactionsCount",
				"requestsCount",
				"savesCount",
				"status",
				"title",
				"type",
				"wantedItem",
			]);
		} finally {
			app.db.close();
		}
	});

	test("filters the neighborhood feed by owner with composed filters and stable cursors", async () => {
		const app = await createTestApp();
		try {
			insertListing(app, {
				id: "list_owner_001",
				ownerId: ids.owner,
				title: "Owner newest tool",
				createdAt: 30,
			});
			insertListing(app, {
				id: "list_owner_002",
				ownerId: ids.owner,
				title: "Owner tied tool",
				createdAt: 20,
			});
			insertListing(app, {
				id: "list_owner_003",
				ownerId: ids.owner,
				category: "garden",
				title: "Owner tied garden tool",
				createdAt: 20,
			});
			insertListing(app, {
				id: "list_member_001",
				ownerId: ids.member,
				category: "garden",
				title: "Member garden tool",
				createdAt: 40,
			});
			insertListing(app, {
				id: "list_outside_001",
				ownerId: ids.outsider,
				neighborhoodId: ids.secondNeighborhood,
				title: "Outside neighborhood tool",
				createdAt: 50,
			});

			const member = await login(app, "member@neighborly.test");
			const first = await app.fetch(
				request(
					`/api/feed?ownerId=${encodeURIComponent(ids.owner)}&limit=2`,
					"GET",
					undefined,
					member,
				),
			);
			expect(first.status).toBe(200);
			const firstBody = FeedResponseSchema.parse(await first.json());
			expect(firstBody.data.items.map((item) => item.id)).toEqual([
				"list_owner_001",
				"list_owner_003",
			]);
			expect(
				firstBody.data.items.every((item) => item.owner.id === ids.owner),
			).toBe(true);
			expect(firstBody.data.nextCursor).toEqual(expect.any(String));

			const second = await app.fetch(
				request(
					`/api/feed?ownerId=${encodeURIComponent(ids.owner)}&limit=2&cursor=${encodeURIComponent(firstBody.data.nextCursor ?? "")}`,
					"GET",
					undefined,
					member,
				),
			);
			expect(second.status).toBe(200);
			const secondBody = FeedResponseSchema.parse(await second.json());
			expect(secondBody.data.items.map((item) => item.id)).toEqual([
				"list_owner_002",
			]);
			expect(secondBody.data.nextCursor).toBeNull();

			const composed = await app.fetch(
				request(
					`/api/feed?ownerId=${encodeURIComponent(ids.owner)}&category=garden`,
					"GET",
					undefined,
					member,
				),
			);
			expect(composed.status).toBe(200);
			expect(
				FeedResponseSchema.parse(await composed.json()).data.items.map(
					(item) => item.id,
				),
			).toEqual(["list_owner_003"]);

			const empty = await app.fetch(
				request(
					`/api/feed?ownerId=${encodeURIComponent(ids.demo)}`,
					"GET",
					undefined,
					member,
				),
			);
			expect(empty.status).toBe(200);
			expect(FeedResponseSchema.parse(await empty.json()).data).toEqual({
				items: [],
				nextCursor: null,
			});

			const crossNeighborhood = await app.fetch(
				request(
					`/api/feed?ownerId=${encodeURIComponent(ids.outsider)}`,
					"GET",
					undefined,
					member,
				),
			);
			expect(crossNeighborhood.status).toBe(200);
			expect(
				FeedResponseSchema.parse(await crossNeighborhood.json()).data,
			).toEqual({
				items: [],
				nextCursor: null,
			});
		} finally {
			app.db.close();
		}
	});

	test("enforces same-neighborhood ownership and rejects demo mutations", async () => {
		const app = await createTestApp();
		try {
			insertListing(app);
			const member = await login(app, "member@neighborly.test");
			const outsider = await login(app, "outsider@neighborly.test");
			const demo = await login(app, "demo@neighborly.test");

			expect(
				(
					await app.fetch(
						request(
							"/api/listings/list_fixture_001",
							"PATCH",
							{ title: "Nope", availabilityNotes: null },
							member,
						),
					)
				).status,
			).toBe(403);
			const crossNeighborhood = await app.fetch(
				request("/api/listings/list_fixture_001", "GET", undefined, outsider),
			);
			expect(crossNeighborhood.status).toBe(403);
			const deniedDemo = await app.fetch(
				request("/api/listings/list_fixture_001/reaction", "POST", {}, demo),
			);
			expect(deniedDemo.status).toBe(403);
			expect(await deniedDemo.json()).toMatchObject({
				error: { code: "DEMO_READ_ONLY" },
			});
		} finally {
			app.db.close();
		}
	});

	test("validates creation and atomically protects active lifecycle transitions", async () => {
		const app = await createTestApp();
		try {
			const owner = await login(app, "owner@neighborly.test");
			const invalid = await app.fetch(
				request(
					"/api/listings",
					"POST",
					{
						type: "borrow",
						title: "Need a garden cart",
						description: "I need a cart for a Saturday garden cleanup project.",
						category: "garden",
						condition: "good",
						wantedItem: "A sturdy garden cart",
						availableFrom: "2026-08-25",
						availableThrough: "2026-08-24",
					},
					owner,
				),
			);
			expect(invalid.status).toBe(422);

			const listing = insertListing(app, { id: "list_stale_001" });
			app.db
				.prepare(
					`INSERT INTO requests (
						id, listing_id, requester_id, opening_message, status, created_at, updated_at
					) VALUES ('req_pending_001', ?, ?, 'Please lend this for a weekend repair job.', 'pending', ?, ?)`,
				)
				.run(listing.id, ids.member, app.now.value, app.now.value);
			const [withdrawn, staleEdit] = await Promise.all([
				app.fetch(
					request(
						"/api/listings/list_stale_001",
						"PATCH",
						{ action: "withdraw" },
						owner,
					),
				),
				app.fetch(
					request(
						"/api/listings/list_stale_001",
						"PATCH",
						{
							title: "A stale concurrent edit",
							availabilityNotes: null,
						},
						owner,
					),
				),
			]);
			expect([withdrawn.status, staleEdit.status].sort()).toEqual([200, 409]);
			expect(
				app.db
					.query("SELECT status FROM listings WHERE id = 'list_stale_001'")
					.get(),
			).toEqual({ status: "withdrawn" });
			expect(
				app.db
					.query("SELECT status FROM requests WHERE id = 'req_pending_001'")
					.get(),
			).toEqual({ status: "declined" });
			const guardedDelete = await app.fetch(
				request("/api/listings/list_stale_001", "DELETE", undefined, owner),
			);
			expect(guardedDelete.status).toBe(409);
			expect(await guardedDelete.json()).toMatchObject({
				error: { code: "HAS_DEPENDENT_HISTORY" },
			});

			insertListing(app, { id: "list_reserved_001", status: "reserved" });
			expect(
				(
					await app.fetch(
						request(
							"/api/listings/list_reserved_001",
							"PATCH",
							{
								title: "Cannot mutate reserved resource",
								availabilityNotes: null,
							},
							owner,
						),
					)
				).status,
			).toBe(409);
		} finally {
			app.db.close();
		}
	});

	test("keeps saves and reactions idempotent and gates comment deletion by author or owner", async () => {
		const app = await createTestApp();
		try {
			insertListing(app);
			const owner = await login(app, "owner@neighborly.test");
			const member = await login(app, "member@neighborly.test");
			for (const path of ["save", "reaction"]) {
				for (let count = 0; count < 2; count += 1) {
					expect(
						(
							await app.fetch(
								request(
									`/api/listings/list_fixture_001/${path}`,
									"POST",
									{},
									member,
								),
							)
						).status,
					).toBe(200);
				}
			}
			const detailed = await app.fetch(
				request("/api/listings/list_fixture_001", "GET", undefined, member),
			);
			expect(await detailed.json()).toMatchObject({
				data: {
					savesCount: 1,
					reactionsCount: 1,
					isSavedByViewer: true,
					hasViewerReaction: true,
				},
			});

			const comment = await app.fetch(
				request(
					"/api/listings/list_fixture_001/comments",
					"POST",
					{ body: "This looks useful for the neighborhood repair day." },
					member,
				),
			);
			expect(comment.status).toBe(201);
			const commentId = API_ROUTES.listingCommentCreate.response.parse(
				await comment.json(),
			).data.id;
			const comments = await app.fetch(
				request(
					"/api/listings/list_fixture_001/comments?limit=1",
					"GET",
					undefined,
					owner,
				),
			);
			expect(comments.status).toBe(200);
			const commentsBody = API_ROUTES.listingCommentsGet.response.parse(
				await comments.json(),
			);
			expect(commentsBody.data.items[0]).toMatchObject({
				id: commentId,
				author: { id: ids.member },
			});
			expect(
				(
					await app.fetch(
						request(`/api/comments/${commentId}`, "DELETE", undefined, owner),
					)
				).status,
			).toBe(204);
			for (const path of ["save", "reaction"]) {
				expect(
					(
						await app.fetch(
							request(
								`/api/listings/list_fixture_001/${path}`,
								"DELETE",
								undefined,
								member,
							),
						)
					).status,
				).toBe(200);
			}
		} finally {
			app.db.close();
		}
	});

	test("preflights image uploads before body consumption and accepts only bounded normalized images", async () => {
		const app = await createTestApp();
		try {
			insertListing(app);
			const owner = await login(app, "owner@neighborly.test");
			const member = await login(app, "member@neighborly.test");

			const unauthenticatedRequest = request(
				"/api/listings/list_fixture_001/images",
				"POST",
				await imageUpload(
					[await validImageFile("unread.png")],
					[{ altText: "Unread image", sortOrder: 0 }],
				),
			);
			expect(unauthenticatedRequest.bodyUsed).toBe(false);
			const unauthenticated = await app.fetch(unauthenticatedRequest);
			expect(unauthenticated.status).toBe(401);
			expect(unauthenticatedRequest.bodyUsed).toBe(false);

			const nonOwnerRequest = request(
				"/api/listings/list_fixture_001/images",
				"POST",
				await imageUpload(
					[new File(["not an image"], "bad.txt", { type: "text/plain" })],
					[{ altText: "Bad image", sortOrder: 0 }],
				),
				member,
			);
			expect(nonOwnerRequest.bodyUsed).toBe(false);
			const nonOwner = await app.fetch(nonOwnerRequest);
			expect(nonOwner.status).toBe(403);
			expect(nonOwnerRequest.bodyUsed).toBe(false);
			expect(
				app.db.query("SELECT count(*) AS count FROM listing_images").get(),
			).toEqual({
				count: 0,
			});

			for (const file of [
				new File(["not an image"], "bad.txt", { type: "text/plain" }),
				new File(
					[new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
					"corrupt.png",
					{ type: "image/png" },
				),
				new File(
					[new Uint8Array(MAX_LISTING_IMAGE_BYTES + 1)],
					"oversized.png",
					{ type: "image/png" },
				),
			]) {
				const response = await app.fetch(
					request(
						"/api/listings/list_fixture_001/images",
						"POST",
						await imageUpload(
							[file],
							[{ altText: "Rejected image", sortOrder: 0 }],
						),
						owner,
					),
				);
				expect(response.status).toBe(422);
			}

			const fourFiles = await Promise.all(
				Array.from({ length: MAX_LISTING_IMAGE_COUNT + 1 }, (_, index) =>
					validImageFile(`too-many-${index}.png`),
				),
			);
			const tooMany = await app.fetch(
				request(
					"/api/listings/list_fixture_001/images",
					"POST",
					await imageUpload(
						fourFiles,
						fourFiles.map((_, sortOrder) => ({
							altText: `Too many ${sortOrder}`,
							sortOrder,
						})),
					),
					owner,
				),
			);
			expect(tooMany.status).toBe(400);

			const overMultipartLimit = await app.fetch(
				request(
					"/api/listings/list_fixture_001/images",
					"POST",
					await imageUpload(
						[
							new File(
								[new Uint8Array(MAX_MULTIPART_BODY_BYTES)],
								"multipart-limit.png",
								{ type: "image/png" },
							),
						],
						[{ altText: "Too large multipart body", sortOrder: 0 }],
					),
					owner,
				),
			);
			expect(overMultipartLimit.status).toBe(400);

			const pixelBomb = await sharp({
				create: {
					width: 5000,
					height: 4001,
					channels: 3,
					background: "#ffffff",
				},
			})
				.png({ compressionLevel: 9 })
				.toBuffer();
			const rejectedPixelBomb = await app.fetch(
				request(
					"/api/listings/list_fixture_001/images",
					"POST",
					await imageUpload(
						[
							new File([copyOwnedBytes(pixelBomb)], "pixel-bomb.png", {
								type: "image/png",
							}),
						],
						[{ altText: "Pixel bomb", sortOrder: 0 }],
					),
					owner,
				),
			);
			expect(rejectedPixelBomb.status).toBe(422);

			const sourceWithMetadata = await sharp({
				create: { width: 2, height: 2, channels: 3, background: "#4c6fff" },
			})
				.withMetadata({ orientation: 6 })
				.png()
				.toBuffer();
			const files = [
				new File([copyOwnedBytes(sourceWithMetadata)], "metadata.png", {
					type: "image/png",
				}),
				await validImageFile("listing-one.png"),
				await validImageFile("listing-two.png"),
			];
			const uploaded = await app.fetch(
				request(
					"/api/listings/list_fixture_001/images",
					"POST",
					await imageUpload(
						files,
						[2, 1, 0].map((sortOrder) => ({
							altText: `Listing image ${sortOrder}`,
							sortOrder,
						})),
					),
					owner,
				),
			);
			expect(uploaded.status).toBe(201);
			const images = API_ROUTES.listingAddImages.response.parse(
				await uploaded.json(),
			).data;
			expect(images).toHaveLength(MAX_LISTING_IMAGE_COUNT);
			expect(images.map((image) => image.sortOrder)).toEqual([0, 1, 2]);
			expect(images.every((image) => image.mimeType === "image/webp")).toBe(
				true,
			);

			const anonymousPrivate = await app.fetch(
				request(images[0]?.url ?? "", "GET"),
			);
			expect(anonymousPrivate.status).toBe(401);
			const sameNeighborhood = await app.fetch(
				request(images[0]?.url ?? "", "GET", undefined, member),
			);
			expect(sameNeighborhood.status).toBe(200);
			expect(sameNeighborhood.headers.get("cache-control")).toBe(
				"private, no-store",
			);
			const normalizedMetadata = await sharp(
				new Uint8Array(await sameNeighborhood.arrayBuffer()),
			).metadata();
			expect(normalizedMetadata.exif).toBeUndefined();
			expect(normalizedMetadata.orientation).toBeUndefined();

			const full = await app.fetch(
				request(
					"/api/listings/list_fixture_001/images",
					"POST",
					await imageUpload(
						[
							new File(
								["corrupt but should not be decoded"],
								"never-decoded.txt",
								{ type: "text/plain" },
							),
						],
						[{ altText: "Full listing", sortOrder: 0 }],
					),
					owner,
				),
			);
			expect(full.status).toBe(422);
			expect(await full.json()).toMatchObject({
				error: { fields: { images: [expect.stringContaining("at most")] } },
			});
		} finally {
			app.db.close();
		}
	});

	test("admits only two multipart bodies and releases capacity after errors and success", async () => {
		const app = await createTestApp();
		const responses: Promise<Response>[] = [];
		let first: DeferredMultipartRequest | undefined;
		let second: DeferredMultipartRequest | undefined;
		let replacement: DeferredMultipartRequest | undefined;
		let afterSuccess: DeferredMultipartRequest | undefined;
		try {
			insertListing(app);
			const owner = await login(app, "owner@neighborly.test");
			const validBody = await serializedImageMultipart(
				await validImageFile("deferred.png"),
			);
			const malformedBody = new TextEncoder().encode("not multipart");

			first = deferredMultipartRequest(owner, malformedBody);
			second = deferredMultipartRequest(owner, malformedBody);
			const firstResponse = app.fetch(first.request);
			const secondResponse = app.fetch(second.request);
			responses.push(firstResponse, secondResponse);
			await Promise.all([first.pulled, second.pulled]);

			const rejected = deferredMultipartRequest(owner, validBody);
			const rejectedResponse = await app.fetch(rejected.request);
			expect(rejectedResponse.status).toBe(503);
			expect((await rejectedResponse.json()).error.code).toBe(
				"SERVICE_UNAVAILABLE",
			);
			expect(rejected.bodyWasPulled).toBe(false);
			expect(rejected.bodyWasCancelled).toBe(true);

			first.release();
			expect((await firstResponse).status).toBe(400);

			replacement = deferredMultipartRequest(owner, validBody);
			const replacementResponse = app.fetch(replacement.request);
			responses.push(replacementResponse);
			await replacement.pulled;
			replacement.release();
			expect((await replacementResponse).status).toBe(201);

			afterSuccess = deferredMultipartRequest(owner, malformedBody);
			const afterSuccessResponse = app.fetch(afterSuccess.request);
			responses.push(afterSuccessResponse);
			await afterSuccess.pulled;
			afterSuccess.release();
			expect((await afterSuccessResponse).status).toBe(400);

			second.release();
			expect((await secondResponse).status).toBe(400);
		} finally {
			first?.release();
			second?.release();
			replacement?.release();
			afterSuccess?.release();
			await Promise.allSettled(responses);
			app.db.close();
		}
	});

	test("rejects an over-capacity image batch before decoding either file", async () => {
		const app = await createTestApp();
		try {
			const listing = insertListing(app);
			const images = new ImageService({
				db: app.db,
				now: () => app.now.value,
			});
			const viewer = {
				id: ids.owner,
				neighborhood: { id: ids.firstNeighborhood },
			} as Parameters<ImageService["add"]>[0];
			await images.add(viewer, listing.id, [
				{
					file: await validImageFile("existing-one.png"),
					altText: "Existing image one",
					sortOrder: 0,
				},
				{
					file: await validImageFile("existing-two.png"),
					altText: "Existing image two",
					sortOrder: 1,
				},
			]);

			let normalizationAttempted = false;
			const file = {
				size: 1,
				arrayBuffer: async () => {
					normalizationAttempted = true;
					throw new Error("Image decoding must not start.");
				},
			} as unknown as File;
			let capacityError: unknown;
			try {
				await images.add(viewer, listing.id, [
					{ file, altText: "Over capacity one", sortOrder: 0 },
					{ file, altText: "Over capacity two", sortOrder: 1 },
				]);
			} catch (error) {
				capacityError = error;
			}

			expect(capacityError).toMatchObject({
				code: "VALIDATION_ERROR",
				fields: {
					images: [expect.stringContaining("at most")],
				},
			});
			expect(normalizationAttempted).toBe(false);
			expect(
				app.db
					.query(
						"SELECT count(*) AS count FROM listing_images WHERE listing_id = ?",
					)
					.get(listing.id),
			).toEqual({ count: MAX_LISTING_IMAGE_COUNT - 1 });
		} finally {
			app.db.close();
		}
	});

	test("serves listing images only to their current audience and revokes withdrawn bytes", async () => {
		const app = await createTestApp();
		try {
			insertListing(app, { id: "list_read_001" });
			app.db
				.prepare("UPDATE listings SET is_public_preview = 1 WHERE id = ?")
				.run("list_read_001");
			const owner = await login(app, "owner@neighborly.test");
			const member = await login(app, "member@neighborly.test");
			const outsider = await login(app, "outsider@neighborly.test");
			const uploaded = await app.fetch(
				request(
					"/api/listings/list_read_001/images",
					"POST",
					await imageUpload(
						[await validImageFile("readable.png")],
						[{ altText: "Readable image", sortOrder: 0 }],
					),
					owner,
				),
			);
			const imageUrl = API_ROUTES.listingAddImages.response.parse(
				await uploaded.json(),
			).data[0]?.url;
			if (!imageUrl) throw new Error("Expected image URL.");

			const anonymousCurated = await app.fetch(request(imageUrl, "GET"));
			expect(anonymousCurated.status).toBe(200);
			expect(anonymousCurated.headers.get("cache-control")).toBe(
				"private, no-store",
			);
			expect(
				(await app.fetch(request(imageUrl, "GET", undefined, member))).status,
			).toBe(200);
			expect(
				(await app.fetch(request(imageUrl, "GET", undefined, outsider))).status,
			).toBe(200);
			app.db
				.prepare("UPDATE listings SET is_public_preview = 0 WHERE id = ?")
				.run("list_read_001");
			expect(
				(await app.fetch(request(imageUrl, "GET", undefined, outsider))).status,
			).toBe(403);

			app.db
				.prepare("UPDATE users SET neighborhood_id = ? WHERE id = ?")
				.run(ids.secondNeighborhood, ids.owner);
			expect(
				(await app.fetch(request(imageUrl, "GET", undefined, owner))).status,
			).toBe(200);

			app.db
				.prepare(
					`UPDATE listings
					 SET status = 'withdrawn', deleted_at = ?, deleted_by_user_id = ?
					 WHERE id = ?`,
				)
				.run(app.now.value, ids.owner, "list_read_001");
			expect(
				(await app.fetch(request(imageUrl, "GET", undefined, member))).status,
			).toBe(403);
			expect((await app.fetch(request(imageUrl, "GET"))).status).toBe(401);
			expect(
				(await app.fetch(request(imageUrl, "GET", undefined, owner))).status,
			).toBe(200);
		} finally {
			app.db.close();
		}
	});

	test("keeps concurrent image capacity below the listing maximum", async () => {
		const app = await createTestApp();
		try {
			insertListing(app, { id: "list_capacity_001" });
			const owner = await login(app, "owner@neighborly.test");
			const initial = await app.fetch(
				request(
					"/api/listings/list_capacity_001/images",
					"POST",
					await imageUpload(
						[await validImageFile("initial.png")],
						[{ altText: "Initial image", sortOrder: 0 }],
					),
					owner,
				),
			);
			expect(initial.status).toBe(201);
			const first = imageUpload(
				[
					await validImageFile("first-a.png"),
					await validImageFile("first-b.png"),
				],
				[
					{ altText: "First A", sortOrder: 0 },
					{ altText: "First B", sortOrder: 1 },
				],
			);
			const second = imageUpload(
				[
					await validImageFile("second-a.png"),
					await validImageFile("second-b.png"),
				],
				[
					{ altText: "Second A", sortOrder: 0 },
					{ altText: "Second B", sortOrder: 1 },
				],
			);
			const [one, two] = await Promise.all([
				app.fetch(
					request(
						"/api/listings/list_capacity_001/images",
						"POST",
						await first,
						owner,
					),
				),
				app.fetch(
					request(
						"/api/listings/list_capacity_001/images",
						"POST",
						await second,
						owner,
					),
				),
			]);
			expect([one.status, two.status].sort()).toEqual([201, 429]);
			expect(
				app.db
					.query(
						"SELECT count(*) AS count FROM listing_images WHERE listing_id = ?",
					)
					.get("list_capacity_001"),
			).toEqual({ count: MAX_LISTING_IMAGE_COUNT });
		} finally {
			app.db.close();
		}
	});
});
