import type { Database, SQLQueryBindings } from "bun:sqlite";
import sharp from "sharp";

import {
	MAX_LISTING_IMAGE_BYTES,
	MAX_LISTING_IMAGE_COUNT,
	MAX_LISTING_IMAGE_PIXELS,
	type SelfUser,
} from "../src/lib/contracts";
import { HttpError } from "./http";

type Viewer = Pick<SelfUser, "id" | "neighborhood">;

type ListingAccessRow = {
	id: string;
	ownerId: string;
	neighborhoodId: string;
	status: "active" | "reserved" | "completed" | "withdrawn";
	deletedAt: number | null;
};

type ExistingImageRow = {
	id: string;
	sortOrder: number;
};

type StoredImageRow = {
	id: string;
	listingId: string;
	mimeType: "image/webp";
	width: number;
	height: number;
	altText: string;
	byteSize: number;
	sortOrder: number;
	data: Uint8Array;
};
type ListingImageMeta = {
	id: string;
	url: string;
	altText: string;
	mimeType: "image/jpeg" | "image/png" | "image/webp";
	width: number;
	height: number;
	sortOrder: number;
	byteSize: number;
};

export type ListingImageUpload = {
	file: File;
	altText: string;
	sortOrder: number;
};

export type ListingImageOrder = {
	id: string;
	sortOrder: number;
};

type NormalizedImage = {
	id: string;
	altText: string;
	sortOrder: number;
	width: number;
	height: number;
	data: Uint8Array;
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

const imageMimeFromMagic = (
	bytes: Uint8Array,
): "image/jpeg" | "image/png" | "image/webp" | null => {
	if (
		bytes.length >= 3 &&
		bytes[0] === 0xff &&
		bytes[1] === 0xd8 &&
		bytes[2] === 0xff
	) {
		return "image/jpeg";
	}
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return "image/png";
	}
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return "image/webp";
	}
	return null;
};

const expectedSharpFormat = {
	"image/jpeg": "jpeg",
	"image/png": "png",
	"image/webp": "webp",
} as const;
const MAX_CONCURRENT_NORMALIZATIONS = 2;
const copyOwnedBytes = (bytes: ArrayBufferView): Uint8Array<ArrayBuffer> => {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
	return copy;
};

let concurrentNormalizations = 0;
const normalizingUserIds = new Set<string>();

export type ImageServiceOptions = {
	db: Database;
	now?: () => number;
};

export class ImageService {
	readonly #db: Database;
	readonly #now: () => number;

	constructor(options: ImageServiceOptions) {
		this.#db = options.db;
		this.#now = options.now ?? Date.now;
	}

	preflight(viewer: Viewer, listingId: string): void {
		const listing = this.#listingForMutation(viewer, listingId);
		this.#assertImageCapacity(listing.id, 1);
	}

	async add(
		viewer: Viewer,
		listingId: string,
		uploads: readonly ListingImageUpload[],
	): Promise<ListingImageMeta[]> {
		if (uploads.length === 0 || uploads.length > MAX_LISTING_IMAGE_COUNT) {
			throw new HttpError("VALIDATION_ERROR", undefined, {
				images: [`Upload between 1 and ${MAX_LISTING_IMAGE_COUNT} images.`],
			});
		}
		const sortOrders = new Set<number>();
		for (const upload of uploads) {
			if (
				upload.sortOrder < 0 ||
				upload.sortOrder >= MAX_LISTING_IMAGE_COUNT ||
				!Number.isInteger(upload.sortOrder) ||
				sortOrders.has(upload.sortOrder)
			) {
				throw new HttpError("VALIDATION_ERROR", undefined, {
					metadata: ["Image sort orders must be unique valid positions."],
				});
			}
			sortOrders.add(upload.sortOrder);
		}

		const listing = this.#listingForMutation(viewer, listingId);
		this.#assertImageCapacity(listing.id, uploads.length);
		const releaseNormalization = this.#acquireNormalization(viewer.id);
		try {
			const normalized: NormalizedImage[] = [];
			for (const upload of uploads) {
				normalized.push(await this.#normalize(upload));
			}

			return this.#transaction(() => {
				const listing = this.#listingForMutation(viewer, listingId);
				this.#assertImageCapacity(listing.id, normalized.length);
				const existing = getAll<ExistingImageRow>(
					this.#db,
					`SELECT id, sort_order AS sortOrder FROM listing_images
					 WHERE listing_id = ? ORDER BY sort_order ASC, id ASC`,
					[listing.id],
				);
				if (
					existing.some(
						(image) =>
							image.sortOrder < 0 || image.sortOrder >= MAX_LISTING_IMAGE_COUNT,
					)
				) {
					throw new HttpError("INTERNAL_ERROR");
				}

				const ordered = [
					...existing.map((image) => ({ ...image, isNew: false as const })),
					...normalized.map((image) => ({ ...image, isNew: true as const })),
				].sort((left, right) => {
					if (left.sortOrder !== right.sortOrder) {
						return left.sortOrder - right.sortOrder;
					}
					return Number(right.isNew) - Number(left.isNew);
				});

				if (existing.length > 0) {
					this.#db
						.prepare(
							"UPDATE listing_images SET sort_order = sort_order + ? WHERE listing_id = ?",
						)
						.run(MAX_LISTING_IMAGE_COUNT + 1, listing.id);
				}
				const now = this.#now();
				for (const [sortOrder, image] of ordered.entries()) {
					if (image.isNew) {
						this.#db
							.prepare(
								`INSERT INTO listing_images (
									id, listing_id, mime_type, width, height, alt_text,
									image_data, byte_size, sort_order, created_at
								) VALUES (?, ?, 'image/webp', ?, ?, ?, ?, ?, ?, ?)`,
							)
							.run(
								image.id,
								listing.id,
								image.width,
								image.height,
								image.altText,
								image.data,
								image.data.byteLength,
								sortOrder,
								now,
							);
					} else {
						this.#db
							.prepare("UPDATE listing_images SET sort_order = ? WHERE id = ?")
							.run(sortOrder, image.id);
					}
				}

				return this.#imagesForListing(listing.id);
			});
		} finally {
			releaseNormalization();
		}
	}

	delete(viewer: Viewer, listingId: string, imageId: string): void {
		this.#transaction(() => {
			const listing = this.#listingForMutation(viewer, listingId);
			const result = this.#db
				.prepare("DELETE FROM listing_images WHERE id = ? AND listing_id = ?")
				.run(imageId, listing.id);
			if (result.changes !== 1) throw new HttpError("NOT_FOUND");
			const remaining = getAll<ExistingImageRow>(
				this.#db,
				`SELECT id, sort_order AS sortOrder FROM listing_images
				 WHERE listing_id = ? ORDER BY sort_order ASC, id ASC`,
				[listing.id],
			);
			this.#applyOrder(
				listing.id,
				remaining.map((image) => image.id),
			);
		});
	}

	reorder(
		viewer: Viewer,
		listingId: string,
		orders: readonly ListingImageOrder[],
	): ListingImageMeta[] {
		return this.#transaction(() => {
			const listing = this.#listingForMutation(viewer, listingId);
			const current = getAll<ExistingImageRow>(
				this.#db,
				`SELECT id, sort_order AS sortOrder FROM listing_images
				 WHERE listing_id = ? ORDER BY sort_order ASC, id ASC`,
				[listing.id],
			);
			if (
				orders.length !== current.length ||
				orders.length > MAX_LISTING_IMAGE_COUNT
			) {
				throw new HttpError("VALIDATION_ERROR", undefined, {
					images: [
						"Image order must include every listing image exactly once.",
					],
				});
			}
			const ids = new Set(current.map((image) => image.id));
			const positions = new Set<number>();
			for (const order of orders) {
				if (
					!ids.delete(order.id) ||
					!Number.isInteger(order.sortOrder) ||
					order.sortOrder < 0 ||
					order.sortOrder >= orders.length ||
					positions.has(order.sortOrder)
				) {
					throw new HttpError("VALIDATION_ERROR", undefined, {
						images: [
							"Image order must include every listing image exactly once.",
						],
					});
				}
				positions.add(order.sortOrder);
			}
			const sorted = [...orders].sort(
				(left, right) => left.sortOrder - right.sortOrder,
			);
			this.#applyOrder(
				listing.id,
				sorted.map((order) => order.id),
			);
			return this.#imagesForListing(listing.id);
		});
	}

	publicResponse(imageId: string, viewer: Viewer | null): Response {
		const row = getOne<{
			mimeType: string;
			imageData: Uint8Array;
			ownerId: string;
			neighborhoodId: string;
			status: ListingAccessRow["status"];
			deletedAt: number | null;
			isPublicPreview: number;
		}>(
			this.#db,
			`SELECT images.mime_type AS mimeType, images.image_data AS imageData,
				listings.owner_id AS ownerId, listings.neighborhood_id AS neighborhoodId,
				listings.status, listings.deleted_at AS deletedAt,
				listings.is_public_preview AS isPublicPreview
			 FROM listing_images images
			 JOIN listings listings ON listings.id = images.listing_id
			 WHERE images.id = ?`,
			[imageId],
		);
		if (!row) throw new HttpError("NOT_FOUND");
		const isPublicPreview =
			row.isPublicPreview === 1 &&
			row.status === "active" &&
			row.deletedAt === null;
		if (!isPublicPreview) {
			if (!viewer) throw new HttpError("UNAUTHORIZED");
			if (row.status === "withdrawn" || row.deletedAt !== null) {
				if (row.ownerId !== viewer.id) throw new HttpError("FORBIDDEN");
			} else if (
				row.ownerId !== viewer.id &&
				row.neighborhoodId !== viewer.neighborhood.id
			) {
				throw new HttpError("FORBIDDEN");
			}
		}
		const detectedMime = imageMimeFromMagic(row.imageData);
		if (!detectedMime || row.mimeType !== detectedMime) {
			throw new HttpError("INTERNAL_ERROR");
		}
		const imageBytes = copyOwnedBytes(row.imageData);
		return new Response(imageBytes, {
			status: 200,
			headers: {
				"Content-Type": detectedMime,
				"Content-Length": String(imageBytes.byteLength),
				"Cache-Control": "private, no-store",
			},
		});
	}

	async #normalize(upload: ListingImageUpload): Promise<NormalizedImage> {
		if (upload.file.size === 0 || upload.file.size > MAX_LISTING_IMAGE_BYTES) {
			throw new HttpError("VALIDATION_ERROR", undefined, {
				images: [`Images must not exceed ${MAX_LISTING_IMAGE_BYTES} bytes.`],
			});
		}
		const source = new Uint8Array(await upload.file.arrayBuffer());
		const mimeType = imageMimeFromMagic(source);
		if (!mimeType) {
			throw new HttpError("VALIDATION_ERROR", undefined, {
				images: ["Images must be JPEG, PNG, or WebP files."],
			});
		}

		try {
			const decoded = sharp(source, {
				limitInputPixels: MAX_LISTING_IMAGE_PIXELS,
				failOn: "error",
			});
			const metadata = await decoded.metadata();
			if (
				metadata.format !== expectedSharpFormat[mimeType] ||
				!metadata.width ||
				!metadata.height ||
				metadata.width * metadata.height > MAX_LISTING_IMAGE_PIXELS
			) {
				throw new Error("Invalid image metadata");
			}
			const output = await decoded
				.rotate()
				.resize({
					width: 5000,
					height: 5000,
					fit: "inside",
					withoutEnlargement: true,
				})
				.webp({ quality: 82 })
				.toBuffer({ resolveWithObject: true });
			if (
				!output.info.width ||
				!output.info.height ||
				output.info.width > 5000 ||
				output.info.height > 5000 ||
				output.data.byteLength > MAX_LISTING_IMAGE_BYTES
			) {
				throw new Error("Invalid normalized image");
			}
			return {
				id: crypto.randomUUID(),
				altText: upload.altText,
				sortOrder: upload.sortOrder,
				width: output.info.width,
				height: output.info.height,
				data: copyOwnedBytes(output.data),
			};
		} catch {
			throw new HttpError("VALIDATION_ERROR", undefined, {
				images: ["The image could not be decoded safely."],
			});
		}
	}

	#acquireNormalization(userId: string) {
		if (normalizingUserIds.has(userId)) {
			throw new HttpError(
				"RATE_LIMITED",
				"An image upload is already being processed for this account.",
			);
		}
		if (concurrentNormalizations >= MAX_CONCURRENT_NORMALIZATIONS) {
			throw new HttpError(
				"SERVICE_UNAVAILABLE",
				"Image processing capacity is temporarily unavailable.",
			);
		}
		normalizingUserIds.add(userId);
		concurrentNormalizations += 1;
		return () => {
			normalizingUserIds.delete(userId);
			concurrentNormalizations -= 1;
		};
	}

	#assertImageCapacity(listingId: string, incomingCount: number) {
		const count = getOne<{ count: number }>(
			this.#db,
			"SELECT count(*) AS count FROM listing_images WHERE listing_id = ?",
			[listingId],
		);
		if ((count?.count ?? 0) + incomingCount > MAX_LISTING_IMAGE_COUNT) {
			throw new HttpError("VALIDATION_ERROR", undefined, {
				images: [
					`A listing can have at most ${MAX_LISTING_IMAGE_COUNT} images.`,
				],
			});
		}
	}

	#listingForMutation(viewer: Viewer, listingId: string): ListingAccessRow {
		const listing = getOne<ListingAccessRow>(
			this.#db,
			`SELECT id, owner_id AS ownerId, neighborhood_id AS neighborhoodId, status,
				deleted_at AS deletedAt FROM listings WHERE id = ?`,
			[listingId],
		);
		if (!listing) throw new HttpError("NOT_FOUND");
		if (
			listing.ownerId !== viewer.id ||
			listing.neighborhoodId !== viewer.neighborhood.id
		) {
			throw new HttpError("FORBIDDEN");
		}
		if (listing.status !== "active" || listing.deletedAt !== null) {
			throw new HttpError(
				"CONFLICT",
				"Only active listings can have images changed.",
			);
		}
		return listing;
	}

	#imagesForListing(listingId: string): ListingImageMeta[] {
		const rows = getAll<Omit<StoredImageRow, "data">>(
			this.#db,
			`SELECT id, listing_id AS listingId, mime_type AS mimeType, width, height,
				alt_text AS altText, byte_size AS byteSize, sort_order AS sortOrder
			 FROM listing_images WHERE listing_id = ? ORDER BY sort_order ASC, id ASC`,
			[listingId],
		);
		return rows.map((row) => ({
			id: row.id,
			url: `/api/listing-images/${row.id}`,
			altText: row.altText,
			mimeType: row.mimeType,
			width: row.width,
			height: row.height,
			sortOrder: row.sortOrder,
			byteSize: row.byteSize,
		}));
	}

	#applyOrder(listingId: string, imageIds: readonly string[]) {
		if (imageIds.length === 0) return;
		this.#db
			.prepare(
				"UPDATE listing_images SET sort_order = sort_order + ? WHERE listing_id = ?",
			)
			.run(MAX_LISTING_IMAGE_COUNT + 1, listingId);
		for (const [sortOrder, imageId] of imageIds.entries()) {
			this.#db
				.prepare(
					"UPDATE listing_images SET sort_order = ? WHERE id = ? AND listing_id = ?",
				)
				.run(sortOrder, imageId, listingId);
		}
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
