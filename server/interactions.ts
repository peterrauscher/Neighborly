import type { Database, SQLQueryBindings } from "bun:sqlite";

import {
	DEFAULT_PAGE_LIMIT,
	type MemberProfile,
	type MemberUser,
	type MessageDto,
	type RequestParticipant,
	type ReviewDto,
	type SelfUser,
} from "../src/lib/contracts";
import { HttpError } from "./http";

type ListingType = "lend" | "borrow" | "trade";
type ListingCondition = "new" | "like_new" | "good" | "fair" | "poor";
type RequestStatus =
	| "pending"
	| "accepted"
	| "declined"
	| "cancelled"
	| "completed";
type RequestAction = "accept" | "decline" | "cancel" | "complete";
type Viewer = Pick<SelfUser, "id" | "neighborhood">;
type Cursor = { timestamp: number; id: string };

type RequestRow = {
	id: string;
	listingId: string;
	listingType: ListingType;
	listingTitle: string;
	listingNeighborhoodId: string;
	listingStatus: "active" | "reserved" | "completed" | "withdrawn";
	ownerId: string;
	ownerNeighborhoodId: string;
	requesterId: string;
	requesterNeighborhoodId: string;
	requestedStart: string | null;
	requestedEnd: string | null;
	offeredTitle: string | null;
	offeredDescription: string | null;
	offeredCondition: ListingCondition | null;
	openingMessage: string;
	status: RequestStatus;
	cancellationReason: string | null;
	createdAt: number;
	updatedAt: number;
};

type ListingRequestRow = {
	id: string;
	ownerId: string;
	neighborhoodId: string;
	ownerNeighborhoodId: string;
	type: ListingType;
	status: "active" | "reserved" | "completed" | "withdrawn";
};

type MessageRow = {
	id: string;
	requestId: string;
	senderId: string;
	body: string;
	createdAt: number;
	readAt: number | null;
};

type ReviewRow = {
	id: string;
	requestId: string;
	reviewerId: string;
	rating: number;
	body: string;
	createdAt: number;
};

type MemberRow = {
	id: string;
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

type ProfileAggregateRow = {
	completedExchangeCount: number;
	reviewCount: number;
	aggregateRating: number | null;
	totalRequests: number;
	respondedRequests: number;
};

type CreateRequestInput =
	| {
			listingType: "lend";
			openingMessage: string;
			requestedStart: string;
			requestedEnd: string;
			offeredItem?: undefined;
	  }
	| {
			listingType: "borrow" | "trade";
			openingMessage: string;
			requestedStart?: string;
			requestedEnd?: string;
			offeredItem: {
				title: string;
				description: string;
				condition: ListingCondition;
			};
	  };

type RequestListInput = {
	role?: "owner" | "requester" | "participant" | "all";
	status?: RequestStatus;
	cursor?: string;
	limit?: number;
};

type MessagePageInput = { cursor?: string; limit?: number };

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

const encodeCursor = (cursor: Cursor) =>
	btoa(JSON.stringify(cursor))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");

const decodeCursor = (value: string): Cursor => {
	try {
		const padding = "=".repeat((4 - (value.length % 4)) % 4);
		const decoded = atob(
			value.replaceAll("-", "+").replaceAll("_", "/") + padding,
		);
		const cursor: unknown = JSON.parse(decoded);
		if (
			typeof cursor !== "object" ||
			cursor === null ||
			Array.isArray(cursor) ||
			typeof (cursor as Cursor).timestamp !== "number" ||
			!Number.isSafeInteger((cursor as Cursor).timestamp) ||
			(cursor as Cursor).timestamp < 0 ||
			typeof (cursor as Cursor).id !== "string" ||
			!(cursor as Cursor).id
		) {
			throw new Error("Invalid cursor");
		}
		return cursor as Cursor;
	} catch {
		throw new HttpError("BAD_REQUEST", "The cursor is invalid.");
	}
};

const requestProjection = `
	r.id,
	r.listing_id AS listingId,
	l.type AS listingType,
	l.title AS listingTitle,
	l.neighborhood_id AS listingNeighborhoodId,
	l.status AS listingStatus,
	l.owner_id AS ownerId,
	owner.neighborhood_id AS ownerNeighborhoodId,
	r.requester_id AS requesterId,
	requester.neighborhood_id AS requesterNeighborhoodId,
	r.requested_start AS requestedStart,
	r.requested_end AS requestedEnd,
	r.offered_title AS offeredTitle,
	r.offered_description AS offeredDescription,
	r.offered_condition AS offeredCondition,
	r.opening_message AS openingMessage,
	r.status,
	r.cancellation_reason AS cancellationReason,
	r.created_at AS createdAt,
	r.updated_at AS updatedAt
`;

export type InteractionServiceOptions = {
	db: Database;
	now?: () => number;
};

export class InteractionService {
	readonly #db: Database;
	readonly #now: () => number;

	constructor(options: InteractionServiceOptions) {
		this.#db = options.db;
		this.#now = options.now ?? Date.now;
	}

	createRequest(
		viewer: Viewer,
		listingId: string,
		input: CreateRequestInput,
	): RequestParticipant {
		const id = crypto.randomUUID();
		const now = this.#now();
		this.#transaction(() => {
			const listing = this.#listingForRequest(listingId);
			if (listing.neighborhoodId !== viewer.neighborhood.id) {
				throw new HttpError("FORBIDDEN");
			}
			if (listing.ownerNeighborhoodId !== listing.neighborhoodId) {
				throw new HttpError("FORBIDDEN");
			}
			if (listing.ownerId === viewer.id) {
				throw new HttpError(
					"FORBIDDEN",
					"You cannot request your own listing.",
				);
			}
			if (listing.status !== "active") {
				throw new HttpError("STALE_TRANSITION");
			}
			if (listing.type !== input.listingType) {
				throw new HttpError("VALIDATION_ERROR", undefined, {
					listingType: ["The request type must match the listing."],
				});
			}
			const existing = getOne<{ id: string }>(
				this.#db,
				`SELECT id FROM requests
				 WHERE listing_id = ? AND requester_id = ?
				 AND status IN ('pending', 'accepted') LIMIT 1`,
				[listingId, viewer.id],
			);
			if (existing) {
				throw new HttpError(
					"CONFLICT",
					"You already have an active request for this listing.",
				);
			}
			this.#db
				.prepare(
					`INSERT INTO requests (
						id, listing_id, requester_id, requested_start, requested_end,
						offered_title, offered_description, offered_condition, opening_message,
						status, created_at, updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
				)
				.run(
					id,
					listingId,
					viewer.id,
					input.requestedStart ?? null,
					input.requestedEnd ?? null,
					input.offeredItem?.title ?? null,
					input.offeredItem?.description ?? null,
					input.offeredItem?.condition ?? null,
					input.openingMessage,
					now,
					now,
				);
		});
		return this.#mapRequest(this.#requestById(id));
	}

	requests(viewer: Viewer, input: RequestListInput) {
		const limit = input.limit ?? DEFAULT_PAGE_LIMIT;
		const role = input.role ?? "all";
		const values: SQLQueryBindings[] = [];
		let roleSql: string;
		switch (role) {
			case "owner":
				roleSql = "l.owner_id = ?";
				values.push(viewer.id);
				break;
			case "requester":
				roleSql = "r.requester_id = ?";
				values.push(viewer.id);
				break;
			case "participant":
			case "all":
				roleSql = "(l.owner_id = ? OR r.requester_id = ?)";
				values.push(viewer.id, viewer.id);
				break;
		}
		const where = [roleSql];
		if (input.status) {
			where.push("r.status = ?");
			values.push(input.status);
		}
		if (input.cursor) {
			const cursor = decodeCursor(input.cursor);
			where.push("(r.updated_at < ? OR (r.updated_at = ? AND r.id < ?))");
			values.push(cursor.timestamp, cursor.timestamp, cursor.id);
		}
		values.push(limit + 1);
		const rows = getAll<RequestRow>(
			this.#db,
			`SELECT ${requestProjection}
			 FROM requests r
			 JOIN listings l ON l.id = r.listing_id
			 JOIN users owner ON owner.id = l.owner_id
			 JOIN users requester ON requester.id = r.requester_id
			 WHERE ${where.join(" AND ")}
			 ORDER BY r.updated_at DESC, r.id DESC
			 LIMIT ?`,
			values,
		);
		const page = rows.slice(0, limit);
		return {
			items: page.map((row) => this.#mapRequest(row)),
			nextCursor:
				rows.length > limit
					? encodeCursor({
							timestamp: page.at(-1)?.updatedAt ?? 0,
							id: page.at(-1)?.id ?? "",
						})
					: null,
		};
	}

	transition(
		viewer: Viewer,
		requestId: string,
		action: RequestAction,
		reason?: string,
	): RequestParticipant {
		this.#transaction(() => {
			const request = this.#requestById(requestId);
			switch (action) {
				case "accept":
					this.#accept(viewer, request);
					break;
				case "decline":
					this.#decline(viewer, request);
					break;
				case "cancel":
					this.#cancel(viewer, request, reason ?? "");
					break;
				case "complete":
					this.#complete(viewer, request);
					break;
			}
		});
		return this.#mapRequest(this.#requestById(requestId));
	}

	messages(viewer: Viewer, requestId: string, input: MessagePageInput) {
		const request = this.#requestById(requestId);
		this.#assertParticipant(viewer, request);
		const limit = input.limit ?? DEFAULT_PAGE_LIMIT;
		const values: SQLQueryBindings[] = [requestId];
		let cursorSql = "";
		if (input.cursor) {
			const cursor = decodeCursor(input.cursor);
			cursorSql = "AND (created_at > ? OR (created_at = ? AND id > ?))";
			values.push(cursor.timestamp, cursor.timestamp, cursor.id);
		}
		values.push(limit + 1);
		const rows = getAll<MessageRow>(
			this.#db,
			`SELECT id, request_id AS requestId, sender_id AS senderId, body,
				created_at AS createdAt, read_at AS readAt
			 FROM messages
			 WHERE request_id = ? ${cursorSql}
			 ORDER BY created_at ASC, id ASC
			 LIMIT ?`,
			values,
		);
		const page = rows.slice(0, limit);
		return {
			items: page.map(this.#mapMessage),
			nextCursor:
				rows.length > limit
					? encodeCursor({
							timestamp: page.at(-1)?.createdAt ?? 0,
							id: page.at(-1)?.id ?? "",
						})
					: null,
		};
	}

	createMessage(viewer: Viewer, requestId: string, body: string): MessageDto {
		const request = this.#requestById(requestId);
		this.#assertParticipant(viewer, request);
		const id = crypto.randomUUID();
		const now = this.#now();
		this.#db
			.prepare(
				`INSERT INTO messages (id, request_id, sender_id, body, created_at)
				 VALUES (?, ?, ?, ?, ?)`,
			)
			.run(id, requestId, viewer.id, body, now);
		const message = getOne<MessageRow>(
			this.#db,
			`SELECT id, request_id AS requestId, sender_id AS senderId, body,
				created_at AS createdAt, read_at AS readAt
			 FROM messages WHERE id = ?`,
			[id],
		);
		if (!message) throw new HttpError("INTERNAL_ERROR");
		return this.#mapMessage(message);
	}

	createReview(
		viewer: Viewer,
		requestId: string,
		input: { rating: number; body: string },
	): ReviewDto {
		const id = crypto.randomUUID();
		const now = this.#now();
		this.#transaction(() => {
			const request = this.#requestById(requestId);
			this.#assertParticipant(viewer, request);
			if (request.status !== "completed") {
				throw new HttpError(
					"CONFLICT",
					"Only completed exchanges can be reviewed.",
				);
			}
			try {
				this.#db
					.prepare(
						`INSERT INTO reviews (id, request_id, reviewer_id, rating, body, created_at)
						 VALUES (?, ?, ?, ?, ?, ?)`,
					)
					.run(id, requestId, viewer.id, input.rating, input.body, now);
			} catch (error) {
				if (this.#isUniqueConstraint(error)) {
					throw new HttpError(
						"CONFLICT",
						"You have already reviewed this exchange.",
					);
				}
				throw error;
			}
		});
		const review = getOne<ReviewRow>(
			this.#db,
			`SELECT id, request_id AS requestId, reviewer_id AS reviewerId,
				rating, body, created_at AS createdAt FROM reviews WHERE id = ?`,
			[id],
		);
		if (!review) throw new HttpError("INTERNAL_ERROR");
		return this.#mapReview(review);
	}

	memberProfile(viewer: Viewer, userId: string): MemberProfile {
		const member = this.#memberById(userId);
		if (member.neighborhoodId !== viewer.neighborhood.id) {
			throw new HttpError("FORBIDDEN");
		}
		const aggregate = getOne<ProfileAggregateRow>(
			this.#db,
			`SELECT
				(SELECT count(*) FROM requests r
				 JOIN listings l ON l.id = r.listing_id
				 WHERE r.status = 'completed' AND (r.requester_id = u.id OR l.owner_id = u.id)
				) AS completedExchangeCount,
				(SELECT count(*) FROM reviews review
				 JOIN requests r ON r.id = review.request_id
				 JOIN listings l ON l.id = r.listing_id
				 WHERE r.status = 'completed' AND (
					(review.reviewer_id = r.requester_id AND l.owner_id = u.id) OR
					(review.reviewer_id = l.owner_id AND r.requester_id = u.id)
				 )) AS reviewCount,
				(SELECT avg(review.rating) FROM reviews review
				 JOIN requests r ON r.id = review.request_id
				 JOIN listings l ON l.id = r.listing_id
				 WHERE r.status = 'completed' AND (
					(review.reviewer_id = r.requester_id AND l.owner_id = u.id) OR
					(review.reviewer_id = l.owner_id AND r.requester_id = u.id)
				 )) AS aggregateRating,
				(SELECT count(*) FROM requests r JOIN listings l ON l.id = r.listing_id
				 WHERE l.owner_id = u.id
				 AND (r.status = 'pending' OR r.owner_responded_at IS NOT NULL)
				) AS totalRequests,
				(SELECT count(*) FROM requests r JOIN listings l ON l.id = r.listing_id
				 WHERE l.owner_id = u.id AND r.owner_responded_at IS NOT NULL
				) AS respondedRequests
			 FROM users u WHERE u.id = ?`,
			[userId],
		);
		if (!aggregate) throw new HttpError("NOT_FOUND");
		const totalRequests = aggregate.totalRequests;
		return {
			...this.#mapMember(member),
			completedExchangeCount: aggregate.completedExchangeCount,
			reviewCount: aggregate.reviewCount,
			aggregateRating: aggregate.aggregateRating,
			responseHistory: {
				totalRequests,
				respondedRequests: aggregate.respondedRequests,
				responseRate:
					totalRequests === 0
						? null
						: aggregate.respondedRequests / totalRequests,
			},
		};
	}

	neighbors(viewer: Viewer, input: { cursor?: string; limit?: number }) {
		const limit = input.limit ?? DEFAULT_PAGE_LIMIT;
		const values: SQLQueryBindings[] = [viewer.neighborhood.id, viewer.id];
		let cursorSql = "";
		if (input.cursor) {
			const cursor = decodeCursor(input.cursor);
			cursorSql = "AND (u.created_at < ? OR (u.created_at = ? AND u.id < ?))";
			values.push(cursor.timestamp, cursor.timestamp, cursor.id);
		}
		values.push(limit + 1);
		const rows = getAll<MemberRow>(
			this.#db,
			`SELECT u.id, u.name, u.handle, u.avatar_path AS avatarPath, u.bio,
				u.is_demo AS isDemo, u.created_at AS joinedAt,
				n.id AS neighborhoodId, n.slug AS neighborhoodSlug, n.name AS neighborhoodName,
				n.city AS neighborhoodCity, n.state AS neighborhoodState,
				n.timezone AS neighborhoodTimezone, n.description AS neighborhoodDescription,
				n.image_path AS neighborhoodImagePath
			 FROM users u JOIN neighborhoods n ON n.id = u.neighborhood_id
			 WHERE u.neighborhood_id = ? AND u.id <> ? ${cursorSql}
			 ORDER BY u.created_at DESC, u.id DESC
			 LIMIT ?`,
			values,
		);
		const page = rows.slice(0, limit);
		return {
			items: page.map((row) => this.#mapMember(row)),
			nextCursor:
				rows.length > limit
					? encodeCursor({
							timestamp: page.at(-1)?.joinedAt ?? 0,
							id: page.at(-1)?.id ?? "",
						})
					: null,
		};
	}

	#accept(viewer: Viewer, request: RequestRow) {
		this.#assertOwner(viewer, request);
		if (request.status !== "pending" || request.listingStatus !== "active") {
			throw new HttpError("STALE_TRANSITION");
		}
		this.#assertCurrentNeighborhoodMembership(viewer, request);
		const now = this.#now();
		const accepted = this.#db
			.prepare(
				`UPDATE requests
				 SET status = 'accepted', owner_responded_at = COALESCE(owner_responded_at, ?), updated_at = ?
				 WHERE id = ? AND status = 'pending'`,
			)
			.run(now, now, request.id);
		if (accepted.changes !== 1) throw new HttpError("STALE_TRANSITION");
		const reserved = this.#db
			.prepare(
				`UPDATE listings SET status = 'reserved', updated_at = ?
				 WHERE id = ? AND owner_id = ? AND status = 'active'`,
			)
			.run(now, request.listingId, viewer.id);
		if (reserved.changes !== 1) throw new HttpError("STALE_TRANSITION");
		this.#db
			.prepare(
				`UPDATE requests SET status = 'declined', updated_at = ?
				 WHERE listing_id = ? AND id <> ? AND status = 'pending'`,
			)
			.run(now, request.listingId, request.id);
	}

	#decline(viewer: Viewer, request: RequestRow) {
		this.#assertOwner(viewer, request);
		if (request.status !== "pending") throw new HttpError("STALE_TRANSITION");
		const now = this.#now();
		const changed = this.#db
			.prepare(
				`UPDATE requests
				 SET status = 'declined', owner_responded_at = COALESCE(owner_responded_at, ?), updated_at = ?
				 WHERE id = ? AND status = 'pending'`,
			)
			.run(now, now, request.id);
		if (changed.changes !== 1) throw new HttpError("STALE_TRANSITION");
	}

	#cancel(viewer: Viewer, request: RequestRow, reason: string) {
		if (request.requesterId !== viewer.id && request.ownerId !== viewer.id) {
			throw new HttpError("FORBIDDEN");
		}
		if (request.status === "pending" && request.requesterId !== viewer.id) {
			throw new HttpError("FORBIDDEN");
		}
		if (request.status !== "pending" && request.status !== "accepted") {
			throw new HttpError("STALE_TRANSITION");
		}
		const now = this.#now();
		const cancelled = this.#db
			.prepare(
				`UPDATE requests
				 SET status = 'cancelled', cancelled_by_user_id = ?, cancellation_reason = ?, updated_at = ?
				 WHERE id = ? AND status = ?`,
			)
			.run(viewer.id, reason, now, request.id, request.status);
		if (cancelled.changes !== 1) throw new HttpError("STALE_TRANSITION");
		if (request.status === "accepted") {
			const active = this.#db
				.prepare(
					`UPDATE listings SET status = 'active', updated_at = ?
					 WHERE id = ? AND status = 'reserved'`,
				)
				.run(now, request.listingId);
			if (active.changes !== 1) throw new HttpError("STALE_TRANSITION");
		}
	}

	#complete(viewer: Viewer, request: RequestRow) {
		this.#assertOwner(viewer, request);
		if (request.status !== "accepted" || request.listingStatus !== "reserved") {
			throw new HttpError("STALE_TRANSITION");
		}
		this.#assertCurrentNeighborhoodMembership(viewer, request);
		const now = this.#now();
		const completed = this.#db
			.prepare(
				"UPDATE requests SET status = 'completed', updated_at = ? WHERE id = ? AND status = 'accepted'",
			)
			.run(now, request.id);
		if (completed.changes !== 1) throw new HttpError("STALE_TRANSITION");
		const listing = this.#db
			.prepare(
				`UPDATE listings SET status = 'completed', updated_at = ?
				 WHERE id = ? AND owner_id = ? AND status = 'reserved'`,
			)
			.run(now, request.listingId, viewer.id);
		if (listing.changes !== 1) throw new HttpError("STALE_TRANSITION");
	}

	#listingForRequest(id: string): ListingRequestRow {
		const listing = getOne<ListingRequestRow>(
			this.#db,
			`SELECT l.id, l.owner_id AS ownerId, l.neighborhood_id AS neighborhoodId,
				owner.neighborhood_id AS ownerNeighborhoodId, l.type, l.status
			 FROM listings l JOIN users owner ON owner.id = l.owner_id WHERE l.id = ?`,
			[id],
		);
		if (!listing) throw new HttpError("NOT_FOUND");
		return listing;
	}

	#requestById(id: string): RequestRow {
		const request = getOne<RequestRow>(
			this.#db,
			`SELECT ${requestProjection}
			 FROM requests r
			 JOIN listings l ON l.id = r.listing_id
			 JOIN users owner ON owner.id = l.owner_id
			 JOIN users requester ON requester.id = r.requester_id
			 WHERE r.id = ?`,
			[id],
		);
		if (!request) throw new HttpError("NOT_FOUND");
		return request;
	}

	#memberById(id: string): MemberRow {
		const member = getOne<MemberRow>(
			this.#db,
			`SELECT u.id, u.name, u.handle, u.avatar_path AS avatarPath, u.bio,
				u.is_demo AS isDemo, u.created_at AS joinedAt,
				n.id AS neighborhoodId, n.slug AS neighborhoodSlug, n.name AS neighborhoodName,
				n.city AS neighborhoodCity, n.state AS neighborhoodState,
				n.timezone AS neighborhoodTimezone, n.description AS neighborhoodDescription,
				n.image_path AS neighborhoodImagePath
			 FROM users u JOIN neighborhoods n ON n.id = u.neighborhood_id
			 WHERE u.id = ?`,
			[id],
		);
		if (!member) throw new HttpError("NOT_FOUND");
		return member;
	}

	#assertOwner(viewer: Viewer, request: RequestRow) {
		if (
			request.ownerId !== viewer.id ||
			request.listingNeighborhoodId !== viewer.neighborhood.id
		) {
			throw new HttpError("FORBIDDEN");
		}
	}

	#assertParticipant(viewer: Viewer, request: RequestRow) {
		if (request.ownerId !== viewer.id && request.requesterId !== viewer.id) {
			throw new HttpError("FORBIDDEN");
		}
	}

	#assertCurrentNeighborhoodMembership(viewer: Viewer, request: RequestRow) {
		if (
			viewer.neighborhood.id !== request.listingNeighborhoodId ||
			request.ownerNeighborhoodId !== request.listingNeighborhoodId ||
			request.requesterNeighborhoodId !== request.listingNeighborhoodId
		) {
			throw new HttpError("NEIGHBORHOOD_CHANGE_BLOCKED");
		}
	}

	#mapRequest(row: RequestRow): RequestParticipant {
		return {
			id: row.id,
			listingId: row.listingId,
			listingType: row.listingType,
			listingTitle: row.listingTitle,
			status: row.status,
			requestedStart: row.requestedStart,
			requestedEnd: row.requestedEnd,
			offeredItem:
				row.offeredTitle === null ||
				row.offeredDescription === null ||
				row.offeredCondition === null
					? null
					: {
							title: row.offeredTitle,
							description: row.offeredDescription,
							condition: row.offeredCondition,
						},
			openingMessage: row.openingMessage,
			cancellationReason: row.cancellationReason,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			ownerId: row.ownerId,
			requesterId: row.requesterId,
		};
	}

	#mapMessage(row: MessageRow): MessageDto {
		return {
			id: row.id,
			requestId: row.requestId,
			senderId: row.senderId,
			body: row.body,
			createdAt: row.createdAt,
			readAt: row.readAt,
		};
	}

	#mapReview(row: ReviewRow): ReviewDto {
		return {
			id: row.id,
			requestId: row.requestId,
			reviewerId: row.reviewerId,
			rating: row.rating,
			body: row.body,
			createdAt: row.createdAt,
		};
	}

	#mapMember(row: MemberRow): MemberUser {
		return {
			id: row.id,
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
			isDemo: Boolean(row.isDemo),
		};
	}

	#transaction<T>(operation: () => T): T {
		this.#db.run("BEGIN IMMEDIATE");
		try {
			const result = operation();
			this.#db.run("COMMIT");
			return result;
		} catch (error) {
			this.#db.run("ROLLBACK");
			throw error;
		}
	}

	#isUniqueConstraint(error: unknown) {
		return error instanceof Error && /unique constraint/i.test(error.message);
	}
}
