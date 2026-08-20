import type { Database, SQLQueryBindings } from "bun:sqlite";

import {
	DEFAULT_PAGE_LIMIT,
	type ListingDetail,
	MAX_LISTING_IMAGE_COUNT,
	type MemberListingSummary,
	type PublicListingSummary,
	type SelfUser,
} from "../src/lib/contracts";
import { HttpError } from "./http";

type ListingStatus = "active" | "reserved" | "completed" | "withdrawn";
type ListingType = "lend" | "borrow" | "trade";
type ListingCondition = "new" | "like_new" | "good" | "fair" | "poor";

type ListingRow = {
	id: string;
	ownerId: string;
	neighborhoodId: string;
	type: ListingType;
	title: string;
	description: string;
	category: string;
	condition: ListingCondition;
	availableFrom: string;
	availableThrough: string;
	availabilityNotes: string | null;
	wantedItem: string | null;
	status: ListingStatus;
	deletedAt: number | null;
	deletedByUserId: string | null;
	createdAt: number;
	updatedAt: number;
	neighborhood: string;
	ownerName: string;
	ownerHandle: string;
	ownerAvatarPath: string;
	ownerBio: string;
	savesCount: number;
	reactionsCount: number;
	commentsCount: number;
	requestsCount: number;
	isSavedByViewer: number;
	hasViewerReaction: number;
	isRequestedByViewer: number;
};

type ImageRow = {
	id: string;
	listingId: string;
	mimeType: "image/jpeg" | "image/png" | "image/webp";
	width: number;
	height: number;
	altText: string;
	byteSize: number;
	sortOrder: number;
};

type CommentRow = {
	id: string;
	listingId: string;
	body: string;
	createdAt: number;
	updatedAt: number;
	authorId: string;
	authorName: string;
	authorHandle: string;
	authorAvatarPath: string;
	authorBio: string;
};
type CommentDto = {
	id: string;
	listingId: string;
	author: {
		id: string;
		name: string;
		handle: string;
		avatarPath: string;
		bio: string;
	};
	body: string;
	createdAt: number;
	updatedAt: number;
};

type FeedInput = {
	ownerId?: string;
	type?: ListingType;
	category?: string;
	q?: string;
	saved?: boolean;
	availableFrom?: string;
	availableThrough?: string;
	cursor?: string;
	limit?: number;
};

type CommentPageInput = {
	cursor?: string;
	limit?: number;
};

type CreateListingInput = {
	type: ListingType;
	title: string;
	description: string;
	category: string;
	condition: ListingCondition;
	availableFrom: string;
	availableThrough: string;
	availabilityNotes?: string;
	wantedItem?: string;
};

type PatchListingInput =
	| { action: "withdraw" }
	| {
			title?: string;
			description?: string;
			category?: string;
			condition?: ListingCondition;
			availableFrom?: string;
			availableThrough?: string;
			availabilityNotes?: string | null;
			wantedItem?: string;
	  };

type Viewer = Pick<SelfUser, "id" | "neighborhood">;

type Cursor = { createdAt: number; id: string };

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
			typeof (cursor as Cursor).createdAt !== "number" ||
			!Number.isSafeInteger((cursor as Cursor).createdAt) ||
			(cursor as Cursor).createdAt < 0 ||
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

const listingProjection = `
	l.id,
	l.owner_id AS ownerId,
	l.neighborhood_id AS neighborhoodId,
	l.type,
	l.title,
	l.description,
	l.category,
	l.condition,
	l.available_from AS availableFrom,
	l.available_through AS availableThrough,
	l.availability_notes AS availabilityNotes,
	l.wanted_item AS wantedItem,
	l.status,
	l.deleted_at AS deletedAt,
	l.deleted_by_user_id AS deletedByUserId,
	l.created_at AS createdAt,
	l.updated_at AS updatedAt,
	n.name AS neighborhood,
	u.name AS ownerName,
	u.handle AS ownerHandle,
	u.avatar_path AS ownerAvatarPath,
	u.bio AS ownerBio,
	(SELECT count(*) FROM listing_saves saves WHERE saves.listing_id = l.id) AS savesCount,
	(SELECT count(*) FROM listing_reactions reactions WHERE reactions.listing_id = l.id) AS reactionsCount,
	(SELECT count(*) FROM comments comments WHERE comments.listing_id = l.id) AS commentsCount,
	(SELECT count(*) FROM requests requests WHERE requests.listing_id = l.id) AS requestsCount,
	EXISTS(SELECT 1 FROM listing_saves viewer_saves WHERE viewer_saves.listing_id = l.id AND viewer_saves.user_id = ?) AS isSavedByViewer,
	EXISTS(SELECT 1 FROM listing_reactions viewer_reactions WHERE viewer_reactions.listing_id = l.id AND viewer_reactions.user_id = ?) AS hasViewerReaction,
	EXISTS(SELECT 1 FROM requests viewer_requests WHERE viewer_requests.listing_id = l.id AND viewer_requests.requester_id = ? AND viewer_requests.status IN ('pending', 'accepted')) AS isRequestedByViewer
`;

export type ListingServiceOptions = {
	db: Database;
	now?: () => number;
};

export class ListingService {
	readonly #db: Database;
	readonly #now: () => number;

	constructor(options: ListingServiceOptions) {
		this.#db = options.db;
		this.#now = options.now ?? Date.now;
	}

	preview(limit: number): PublicListingSummary[] {
		const rows = getAll<ListingRow>(
			this.#db,
			`SELECT ${listingProjection}
			 FROM listings l
			 JOIN users u ON u.id = l.owner_id
			 JOIN neighborhoods n ON n.id = l.neighborhood_id
			 WHERE l.is_public_preview = 1 AND l.status = 'active' AND l.deleted_at IS NULL
			 ORDER BY l.created_at DESC, l.id DESC
			 LIMIT ?`,
			["", "", "", limit],
		);
		const images = this.#imagesByListing(rows.map((row) => row.id));
		return rows.map((row) => this.#mapPublic(row, images.get(row.id) ?? []));
	}

	feed(viewer: Viewer, input: FeedInput) {
		const limit = input.limit ?? DEFAULT_PAGE_LIMIT;
		const values: SQLQueryBindings[] = [viewer.id, viewer.id, viewer.id];
		const where = [
			"l.neighborhood_id = ?",
			"l.status = 'active'",
			"l.deleted_at IS NULL",
		];
		values.push(viewer.neighborhood.id);
		if (input.ownerId) {
			where.push("l.owner_id = ?");
			values.push(input.ownerId);
		}

		if (input.type) {
			where.push("l.type = ?");
			values.push(input.type);
		}
		if (input.category) {
			where.push("l.category = ? COLLATE NOCASE");
			values.push(input.category);
		}
		if (input.q) {
			where.push(
				"(l.title LIKE ? ESCAPE '\\' COLLATE NOCASE OR l.description LIKE ? ESCAPE '\\' COLLATE NOCASE OR l.category LIKE ? ESCAPE '\\' COLLATE NOCASE OR COALESCE(l.wanted_item, '') LIKE ? ESCAPE '\\' COLLATE NOCASE)",
			);
			const query = `%${this.#escapeLike(input.q)}%`;
			values.push(query, query, query, query);
		}
		if (input.saved !== undefined) {
			where.push(
				input.saved
					? "EXISTS(SELECT 1 FROM listing_saves saved WHERE saved.listing_id = l.id AND saved.user_id = ?)"
					: "NOT EXISTS(SELECT 1 FROM listing_saves saved WHERE saved.listing_id = l.id AND saved.user_id = ?)",
			);
			values.push(viewer.id);
		}
		if (input.availableFrom && input.availableThrough) {
			where.push("l.available_from <= ? AND l.available_through >= ?");
			values.push(input.availableFrom, input.availableThrough);
		}
		if (input.cursor) {
			const cursor = decodeCursor(input.cursor);
			where.push("(l.created_at < ? OR (l.created_at = ? AND l.id < ?))");
			values.push(cursor.createdAt, cursor.createdAt, cursor.id);
		}
		values.push(limit + 1);

		const rows = getAll<ListingRow>(
			this.#db,
			`SELECT ${listingProjection}
			 FROM listings l
			 JOIN users u ON u.id = l.owner_id
			 JOIN neighborhoods n ON n.id = l.neighborhood_id
			 WHERE ${where.join(" AND ")}
			 ORDER BY l.created_at DESC, l.id DESC
			 LIMIT ?`,
			values,
		);
		const page = rows.slice(0, limit);
		const images = this.#imagesByListing(page.map((row) => row.id));
		return {
			items: page.map((row) => this.#mapSummary(row, images.get(row.id) ?? [])),
			nextCursor:
				rows.length > limit
					? encodeCursor({
							createdAt: page.at(-1)?.createdAt ?? 0,
							id: page.at(-1)?.id ?? "",
						})
					: null,
		};
	}

	detail(viewer: Viewer, id: string): ListingDetail {
		const row = this.#listingById(id, viewer.id);
		this.#assertReadable(row, viewer);
		return this.#mapDetail(row, this.#imagesByListing([id]).get(id) ?? []);
	}

	create(viewer: Viewer, input: CreateListingInput): ListingDetail {
		if (input.availableThrough < input.availableFrom) {
			throw new HttpError("VALIDATION_ERROR", undefined, {
				availableThrough: [
					"availableThrough must be on or after availableFrom",
				],
			});
		}
		const id = crypto.randomUUID();
		const now = this.#now();
		this.#db
			.prepare(
				`INSERT INTO listings (
					id, owner_id, neighborhood_id, type, title, description, category,
					condition, available_from, available_through, availability_notes,
					wanted_item, status, created_at, updated_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
			)
			.run(
				id,
				viewer.id,
				viewer.neighborhood.id,
				input.type,
				input.title,
				input.description,
				input.category,
				input.condition,
				input.availableFrom,
				input.availableThrough,
				input.availabilityNotes ?? null,
				input.type === "lend" ? null : (input.wantedItem ?? null),
				now,
				now,
			);
		return this.detail(viewer, id);
	}

	patch(viewer: Viewer, id: string, input: PatchListingInput): ListingDetail {
		if ("action" in input) return this.withdraw(viewer, id);

		this.#transaction(() => {
			const row = this.#listingById(id, viewer.id);
			this.#assertOwner(row, viewer);
			if (row.status !== "active") {
				throw new HttpError("CONFLICT", "Only active listings can be edited.");
			}

			const availableFrom = input.availableFrom ?? row.availableFrom;
			const availableThrough = input.availableThrough ?? row.availableThrough;
			if (availableThrough < availableFrom) {
				throw new HttpError("VALIDATION_ERROR", undefined, {
					availableThrough: [
						"availableThrough must be on or after availableFrom",
					],
				});
			}
			if (row.type === "lend" && input.wantedItem !== undefined) {
				throw new HttpError("VALIDATION_ERROR", undefined, {
					wantedItem: ["Lend listings cannot have a wanted item."],
				});
			}

			const updates: Array<[string, SQLQueryBindings]> = [];
			if (input.title !== undefined) updates.push(["title", input.title]);
			if (input.description !== undefined)
				updates.push(["description", input.description]);
			if (input.category !== undefined)
				updates.push(["category", input.category]);
			if (input.condition !== undefined)
				updates.push(["condition", input.condition]);
			if (input.availableFrom !== undefined)
				updates.push(["available_from", input.availableFrom]);
			if (input.availableThrough !== undefined)
				updates.push(["available_through", input.availableThrough]);
			if (input.availabilityNotes !== undefined)
				updates.push(["availability_notes", input.availabilityNotes]);
			if (input.wantedItem !== undefined)
				updates.push(["wanted_item", input.wantedItem]);
			if (updates.length === 0) {
				throw new HttpError("VALIDATION_ERROR", undefined, {
					listing: ["At least one editable listing field is required"],
				});
			}

			const result = this.#db
				.prepare(
					`UPDATE listings
					 SET ${updates.map(([column]) => `${column} = ?`).join(", ")}, updated_at = ?
					 WHERE id = ? AND owner_id = ? AND status = 'active'`,
				)
				.run(...updates.map(([, value]) => value), this.#now(), id, viewer.id);
			if (result.changes !== 1) {
				throw new HttpError("CONFLICT", "This listing is no longer active.");
			}
		});
		return this.detail(viewer, id);
	}

	withdraw(viewer: Viewer, id: string): ListingDetail {
		this.#transaction(() => {
			const row = this.#listingById(id, viewer.id);
			this.#assertOwner(row, viewer);
			if (row.status !== "active") {
				throw new HttpError(
					"CONFLICT",
					"Only active listings can be withdrawn.",
				);
			}
			const accepted = getOne<{ id: string }>(
				this.#db,
				"SELECT id FROM requests WHERE listing_id = ? AND status = 'accepted' LIMIT 1",
				[id],
			);
			if (accepted) {
				throw new HttpError(
					"CONFLICT",
					"Cancel the accepted request before withdrawing this listing.",
				);
			}
			const now = this.#now();
			this.#db
				.prepare(
					"UPDATE requests SET status = 'declined', updated_at = ? WHERE listing_id = ? AND status = 'pending'",
				)
				.run(now, id);
			const changed = this.#db
				.prepare(
					`UPDATE listings
					 SET status = 'withdrawn', deleted_at = ?, deleted_by_user_id = ?,
						 deleted_reason = 'Withdrawn by owner.', updated_at = ?
					 WHERE id = ? AND owner_id = ? AND status = 'active'`,
				)
				.run(now, viewer.id, now, id, viewer.id);
			if (changed.changes !== 1) {
				throw new HttpError("CONFLICT", "This listing is no longer active.");
			}
		});
		return this.detail(viewer, id);
	}

	delete(viewer: Viewer, id: string): void {
		this.#transaction(() => {
			const row = this.#listingById(id, viewer.id);
			this.#assertOwner(row, viewer);
			if (row.status !== "active" && row.status !== "withdrawn") {
				throw new HttpError("HAS_DEPENDENT_HISTORY");
			}
			const dependent = getOne<{ hasDependent: number }>(
				this.#db,
				`SELECT EXISTS(
					SELECT 1 FROM comments WHERE listing_id = ?
					UNION ALL SELECT 1 FROM listing_saves WHERE listing_id = ?
					UNION ALL SELECT 1 FROM listing_reactions WHERE listing_id = ?
					UNION ALL SELECT 1 FROM requests WHERE listing_id = ?
				) AS hasDependent`,
				[id, id, id, id],
			);
			if (dependent?.hasDependent) throw new HttpError("HAS_DEPENDENT_HISTORY");
			const result = this.#db
				.prepare("DELETE FROM listings WHERE id = ? AND owner_id = ?")
				.run(id, viewer.id);
			if (result.changes !== 1) throw new HttpError("NOT_FOUND");
		});
	}

	save(viewer: Viewer, id: string, saved: boolean): MemberListingSummary {
		const row = this.#listingById(id, viewer.id);
		this.#assertEngageable(row, viewer);
		if (saved) {
			this.#db
				.prepare(
					"INSERT OR IGNORE INTO listing_saves (listing_id, user_id, created_at) VALUES (?, ?, ?)",
				)
				.run(id, viewer.id, this.#now());
		} else {
			this.#db
				.prepare(
					"DELETE FROM listing_saves WHERE listing_id = ? AND user_id = ?",
				)
				.run(id, viewer.id);
		}
		return this.summary(viewer, id);
	}

	react(viewer: Viewer, id: string, reacted: boolean): MemberListingSummary {
		const row = this.#listingById(id, viewer.id);
		this.#assertEngageable(row, viewer);
		if (reacted) {
			this.#db
				.prepare(
					"INSERT OR IGNORE INTO listing_reactions (listing_id, user_id, created_at) VALUES (?, ?, ?)",
				)
				.run(id, viewer.id, this.#now());
		} else {
			this.#db
				.prepare(
					"DELETE FROM listing_reactions WHERE listing_id = ? AND user_id = ?",
				)
				.run(id, viewer.id);
		}
		return this.summary(viewer, id);
	}

	createComment(viewer: Viewer, listingId: string, body: string): CommentDto {
		const listing = this.#listingById(listingId, viewer.id);
		this.#assertEngageable(listing, viewer);
		const id = crypto.randomUUID();
		const now = this.#now();
		this.#db
			.prepare(
				`INSERT INTO comments (id, listing_id, author_id, body, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?)`,
			)
			.run(id, listingId, viewer.id, body, now, now);
		return this.#commentById(id);
	}

	comments(viewer: Viewer, listingId: string, input: CommentPageInput) {
		const listing = this.#listingById(listingId, viewer.id);
		this.#assertReadable(listing, viewer);
		const limit = input.limit ?? DEFAULT_PAGE_LIMIT;
		const values: SQLQueryBindings[] = [listingId];
		let cursorSql = "";
		if (input.cursor) {
			const cursor = decodeCursor(input.cursor);
			cursorSql = "AND (c.created_at < ? OR (c.created_at = ? AND c.id < ?))";
			values.push(cursor.createdAt, cursor.createdAt, cursor.id);
		}
		values.push(limit + 1);
		const rows = getAll<CommentRow>(
			this.#db,
			`SELECT c.id, c.listing_id AS listingId, c.body, c.created_at AS createdAt,
				c.updated_at AS updatedAt, u.id AS authorId, u.name AS authorName,
				u.handle AS authorHandle, u.avatar_path AS authorAvatarPath, u.bio AS authorBio
			 FROM comments c
			 JOIN users u ON u.id = c.author_id
			 WHERE c.listing_id = ? ${cursorSql}
			 ORDER BY c.created_at DESC, c.id DESC
			 LIMIT ?`,
			values,
		);
		const page = rows.slice(0, limit);
		return {
			items: page.map(this.#mapComment),
			nextCursor:
				rows.length > limit
					? encodeCursor({
							createdAt: page.at(-1)?.createdAt ?? 0,
							id: page.at(-1)?.id ?? "",
						})
					: null,
		};
	}

	deleteComment(viewer: Viewer, id: string): void {
		const row = getOne<{
			id: string;
			listingId: string;
			authorId: string;
			ownerId: string;
			neighborhoodId: string;
		}>(
			this.#db,
			`SELECT c.id, c.listing_id AS listingId, c.author_id AS authorId,
				l.owner_id AS ownerId, l.neighborhood_id AS neighborhoodId
			 FROM comments c JOIN listings l ON l.id = c.listing_id WHERE c.id = ?`,
			[id],
		);
		if (!row) throw new HttpError("NOT_FOUND");
		if (row.neighborhoodId !== viewer.neighborhood.id)
			throw new HttpError("FORBIDDEN");
		if (row.authorId !== viewer.id && row.ownerId !== viewer.id) {
			throw new HttpError("FORBIDDEN");
		}
		const deleted = this.#db
			.prepare("DELETE FROM comments WHERE id = ?")
			.run(id);
		if (deleted.changes !== 1) throw new HttpError("NOT_FOUND");
	}

	summary(viewer: Viewer, id: string): MemberListingSummary {
		const row = this.#listingById(id, viewer.id);
		this.#assertReadable(row, viewer);
		return this.#mapSummary(row, this.#imagesByListing([id]).get(id) ?? []);
	}

	#listingById(id: string, viewerId: string): ListingRow {
		const row = getOne<ListingRow>(
			this.#db,
			`SELECT ${listingProjection}
			 FROM listings l
			 JOIN users u ON u.id = l.owner_id
			 JOIN neighborhoods n ON n.id = l.neighborhood_id
			 WHERE l.id = ?`,
			[viewerId, viewerId, viewerId, id],
		);
		if (!row) throw new HttpError("NOT_FOUND");
		return row;
	}

	#assertReadable(row: ListingRow, viewer: Viewer) {
		if (row.neighborhoodId !== viewer.neighborhood.id)
			throw new HttpError("FORBIDDEN");
		if (row.status === "withdrawn" && row.ownerId !== viewer.id) {
			throw new HttpError("NOT_FOUND");
		}
	}

	#assertOwner(row: ListingRow, viewer: Viewer) {
		if (
			row.neighborhoodId !== viewer.neighborhood.id ||
			row.ownerId !== viewer.id
		) {
			throw new HttpError("FORBIDDEN");
		}
	}

	#assertEngageable(row: ListingRow, viewer: Viewer) {
		this.#assertReadable(row, viewer);
		if (row.status !== "active") {
			throw new HttpError("CONFLICT", "This listing is not active.");
		}
	}

	#imagesByListing(listingIds: readonly string[]) {
		const images = new Map<string, ImageRow[]>();
		if (listingIds.length === 0) return images;
		const placeholders = listingIds.map(() => "?").join(", ");
		const rows = getAll<ImageRow>(
			this.#db,
			`SELECT id, listing_id AS listingId, mime_type AS mimeType, width, height,
				alt_text AS altText, byte_size AS byteSize, sort_order AS sortOrder
			 FROM listing_images
			 WHERE listing_id IN (${placeholders})
			 ORDER BY listing_id, sort_order ASC, id ASC`,
			[...listingIds],
		);
		for (const image of rows) {
			const listingImages = images.get(image.listingId);
			if (listingImages) listingImages.push(image);
			else images.set(image.listingId, [image]);
		}
		return images;
	}

	#mapImages(listingId: string, images: readonly ImageRow[]) {
		if (images.length > MAX_LISTING_IMAGE_COUNT) {
			throw new HttpError("INTERNAL_ERROR");
		}
		return images.map((image) => ({
			id: image.id,
			url: `/api/listing-images/${image.id}`,
			altText: image.altText,
			mimeType: image.mimeType,
			width: image.width,
			height: image.height,
			sortOrder: image.sortOrder,
			byteSize: image.byteSize,
		}));
	}

	#mapPublic(
		row: ListingRow,
		images: readonly ImageRow[],
	): PublicListingSummary {
		return {
			id: row.id,
			type: row.type,
			title: row.title,
			description: row.description,
			category: row.category,
			condition: row.condition,
			availableFrom: row.availableFrom,
			availableThrough: row.availableThrough,
			wantedItem: row.wantedItem ?? "",
			status: row.status,
			images: this.#mapImages(row.id, images),
			neighborhood: row.neighborhood,
		};
	}

	#mapSummary(
		row: ListingRow,
		images: readonly ImageRow[],
	): MemberListingSummary {
		return {
			...this.#mapPublic(row, images),
			owner: {
				id: row.ownerId,
				name: row.ownerName,
				handle: row.ownerHandle,
				avatarPath: row.ownerAvatarPath,
				bio: row.ownerBio,
			},
			savesCount: row.savesCount,
			reactionsCount: row.reactionsCount,
			commentsCount: row.commentsCount,
			requestsCount: row.requestsCount,
			isSavedByViewer: row.isSavedByViewer === 1,
			hasViewerReaction: row.hasViewerReaction === 1,
			isRequestedByViewer: row.isRequestedByViewer === 1,
		};
	}

	#mapDetail(row: ListingRow, images: readonly ImageRow[]): ListingDetail {
		return {
			...this.#mapSummary(row, images),
			...(row.availabilityNotes
				? { availabilityNotes: row.availabilityNotes }
				: {}),
			deletedAt: row.deletedAt,
			deletedByUserId: row.deletedByUserId,
		};
	}

	#commentById(id: string): CommentDto {
		const row = getOne<CommentRow>(
			this.#db,
			`SELECT c.id, c.listing_id AS listingId, c.body, c.created_at AS createdAt,
				c.updated_at AS updatedAt, u.id AS authorId, u.name AS authorName,
				u.handle AS authorHandle, u.avatar_path AS authorAvatarPath, u.bio AS authorBio
			 FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?`,
			[id],
		);
		if (!row) throw new HttpError("INTERNAL_ERROR");
		return this.#mapComment(row);
	}

	#mapComment = (row: CommentRow): CommentDto => ({
		id: row.id,
		listingId: row.listingId,
		author: {
			id: row.authorId,
			name: row.authorName,
			handle: row.authorHandle,
			avatarPath: row.authorAvatarPath,
			bio: row.authorBio,
		},
		body: row.body,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	});

	#escapeLike(value: string) {
		return value
			.replaceAll("\\", "\\\\")
			.replaceAll("%", "\\%")
			.replaceAll("_", "\\_");
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
}
