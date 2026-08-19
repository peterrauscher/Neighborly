import { z } from "zod";

export const DEFAULT_PAGE_LIMIT = 12;
export const MAX_PAGE_LIMIT = 50;
export const PREVIEW_PAGE_LIMIT = 8;
export const MAX_SEARCH_QUERY_LENGTH = 80;
export const MAX_CONTACT_MESSAGE_LENGTH = 2000;
export const MAX_COMMENT_LENGTH = 1200;
export const MAX_MESSAGE_LENGTH = 1500;
export const MAX_REVIEW_LENGTH = 800;
export const MAX_LISTING_IMAGES = 3;
export const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_LISTING_IMAGE_PIXELS = 20_000_000;

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{2,62}[a-z0-9])?$/i;

export const IdSchema = z
	.string()
	.trim()
	.min(4)
	.max(64)
	.regex(ID_PATTERN, "Must be a stable lowercase/uppercase id token");

export const SlugSchema = z
	.string()
	.trim()
	.min(2)
	.max(64)
	.regex(/^[a-z0-9-]+$/, "Use lowercase kebab-slug form only");

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const DateOnlySchema = z
	.string()
	.trim()
	.regex(isoDatePattern, "Expected YYYY-MM-DD")
	.refine((value) => {
		if (value.length !== 10) return false;
		const date = new Date(`${value}T00:00:00.000Z`);
		return (
			Number.isFinite(date.getTime()) &&
			date.toISOString().slice(0, 10) === value
		);
	}, "Invalid date");

export const CursorSchema = z
	.string()
	.trim()
	.min(1)
	.max(256)
	.regex(/^[A-Za-z0-9_-]+={0,2}$/);

export const TimestampSchema = z.number().int().nonnegative();

export const ListingTypeSchema = z.enum(["lend", "borrow", "trade"]);
export type ListingType = z.infer<typeof ListingTypeSchema>;

export const ListingStatusSchema = z.enum([
	"active",
	"reserved",
	"completed",
	"withdrawn",
]);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const RequestStatusSchema = z.enum([
	"pending",
	"accepted",
	"declined",
	"cancelled",
	"completed",
]);
export type RequestStatus = z.infer<typeof RequestStatusSchema>;

export const ListingConditionSchema = z.enum([
	"new",
	"like_new",
	"good",
	"fair",
	"poor",
]);
export type ListingCondition = z.infer<typeof ListingConditionSchema>;

export const RequestActionSchema = z.enum([
	"accept",
	"decline",
	"cancel",
	"complete",
]);
export type RequestAction = z.infer<typeof RequestActionSchema>;

export const NeighborhoodRequestSchema = z.object({
	query: z
		.string()
		.trim()
		.max(MAX_SEARCH_QUERY_LENGTH)
		.transform((value) => value || undefined),
});

export const QueryLimitSchema = z.coerce
	.number()
	.int()
	.min(1)
	.max(MAX_PAGE_LIMIT)
	.default(DEFAULT_PAGE_LIMIT);

export const PreviewLimitSchema = z.coerce
	.number()
	.int()
	.min(1)
	.max(PREVIEW_PAGE_LIMIT)
	.default(PREVIEW_PAGE_LIMIT);

const parseBoolean = (value: unknown) => {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value === 1;
	if (typeof value !== "string") return undefined;

	const lower = value.toLowerCase();
	if (lower === "1" || lower === "true" || lower === "yes") return true;
	if (lower === "0" || lower === "false" || lower === "no") return false;
	return undefined;
};

export const CursorQuerySchema = z
	.object({
		cursor: CursorSchema.optional(),
		limit: QueryLimitSchema,
	})
	.strict();

export const SavedOnlyQuerySchema = z
	.object({
		saved: z.preprocess(parseBoolean, z.boolean()).optional(),
	})
	.strict();

const DateRangeFields = {
	availableFrom: DateOnlySchema.optional(),
	availableThrough: DateOnlySchema.optional(),
};

const validateAvailabilityDateRange = (
	values: {
		availableFrom?: string;
		availableThrough?: string;
	},
	context: z.RefinementCtx,
) => {
	if (values.availableFrom && !values.availableThrough) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message: "availableThrough required when availableFrom is set",
			path: ["availableThrough"],
		});
	}

	if (values.availableThrough && !values.availableFrom) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message: "availableFrom required when availableThrough is set",
			path: ["availableFrom"],
		});
	}

	if (
		values.availableFrom &&
		values.availableThrough &&
		values.availableThrough < values.availableFrom
	) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message: "availableThrough must be on or after availableFrom",
			path: ["availableThrough"],
		});
	}
};

export const DateRangeSchema = z
	.object(DateRangeFields)
	.strict()
	.superRefine(validateAvailabilityDateRange);

export const HttpMethodSchema = z.enum([
	"GET",
	"POST",
	"PATCH",
	"DELETE",
	"PUT",
]);

export const CanonicalErrorCodeSchema = z.enum([
	"BAD_REQUEST",
	"UNAUTHORIZED",
	"FORBIDDEN",
	"NOT_FOUND",
	"CONFLICT",
	"RATE_LIMITED",
	"VALIDATION_ERROR",
	"DEMO_READ_ONLY",
	"HAS_DEPENDENT_HISTORY",
	"STALE_TRANSITION",
	"NEIGHBORHOOD_CHANGE_BLOCKED",
	"SERVICE_UNAVAILABLE",
	"INTERNAL_ERROR",
]);

export type CanonicalErrorCode = z.infer<typeof CanonicalErrorCodeSchema>;

export const CanonicalErrorFieldsSchema = z
	.record(z.string(), z.unknown())
	.optional();

export const CanonicalErrorEnvelopeSchema = z.object({
	error: z.object({
		code: CanonicalErrorCodeSchema,
		message: z.string().min(1).max(280),
		fields: CanonicalErrorFieldsSchema,
	}),
});

export const EnvelopeSchema = <T extends z.ZodTypeAny>(shape: T) =>
	z.object({ data: shape });

export const CursorEnvelopeSchema = <T extends z.ZodTypeAny>(shape: T) =>
	EnvelopeSchema(
		z.object({
			items: z.array(shape),
			nextCursor: CursorSchema.nullable(),
		}),
	);

const utf8Encoder = new TextEncoder();
const utf8ByteLength = (value: string) => utf8Encoder.encode(value).length;
export const NameSchema = (max = 80) => z.string().trim().min(1).max(max);
export const HandleSchema = z
	.string()
	.trim()
	.min(2)
	.max(28)
	.regex(/^[a-z0-9_]+$/i);
export const EmailSchema = z
	.string()
	.trim()
	.email()
	.max(254)
	.transform((value) => value.toLowerCase());
export const PasswordSchema = z.string().superRefine((value, context) => {
	const bytes = utf8ByteLength(value);

	if (bytes < 8) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message: "password must be at least 8 UTF-8 bytes",
			path: ["_value"],
		});
	}

	if (bytes > 128) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message: "password must be at most 128 UTF-8 bytes",
			path: ["_value"],
		});
	}
});

export const NeighborhoodImagePathSchema = z.string().trim().min(1).max(256);

export const NeighborhoodDtoSchema = z.object({
	id: IdSchema,
	slug: SlugSchema,
	name: NameSchema(100),
	city: z.string().trim().min(2).max(80),
	state: z.string().trim().min(2).max(40),
	timezone: z.string().trim().min(2).max(64),
	description: z.string().trim().min(10).max(1000),
	imagePath: NeighborhoodImagePathSchema,
});
export type NeighborhoodDto = z.infer<typeof NeighborhoodDtoSchema>;

export const PublicUserSummarySchema = z.object({
	id: IdSchema,
	name: NameSchema(80),
	handle: HandleSchema,
	avatarPath: NeighborhoodImagePathSchema.or(z.literal("")),
	bio: z.string().trim().max(500),
});

export const MemberUserSummarySchema = PublicUserSummarySchema.extend({
	neighborhood: NeighborhoodDtoSchema,
	joinedAt: TimestampSchema,
	isDemo: z.boolean(),
});

export const ResponseHistorySchema = z
	.object({
		totalRequests: z.number().int().min(0),
		respondedRequests: z.number().int().min(0),
		responseRate: z.number().min(0).max(1).nullable(),
	})
	.superRefine((value, context) => {
		if (value.respondedRequests > value.totalRequests) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "respondedRequests must not exceed totalRequests",
				path: ["respondedRequests"],
			});
		}

		if (value.totalRequests === 0 && value.responseRate !== null) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "responseRate must be null when totalRequests is zero",
				path: ["responseRate"],
			});
		}

		if (
			value.totalRequests > 0 &&
			value.responseRate !== value.respondedRequests / value.totalRequests
		) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message:
					"responseRate must equal respondedRequests divided by totalRequests",
				path: ["responseRate"],
			});
		}
	});

export const MemberProfileSchema = MemberUserSummarySchema.extend({
	completedExchangeCount: z.number().int().min(0),
	reviewCount: z.number().int().min(0),
	aggregateRating: z.number().min(1).max(5).nullable(),
	responseHistory: ResponseHistorySchema,
}).superRefine((value, context) => {
	if (value.reviewCount === 0 && value.aggregateRating !== null) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message: "aggregateRating must be null when reviewCount is zero",
			path: ["aggregateRating"],
		});
	}

	if (value.reviewCount > 0 && value.aggregateRating === null) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message: "aggregateRating is required when reviewCount is positive",
			path: ["aggregateRating"],
		});
	}
});

export const SelfUserSchema = MemberUserSummarySchema.extend({
	email: EmailSchema,
});

export const SessionSchema = z.object({
	user: SelfUserSchema.nullable(),
});

export const ListingImageMetaSchema = z.object({
	id: IdSchema,
	url: z.string().trim().min(1).max(420),
	altText: z.string().trim().min(1).max(140),
	mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
	width: z.number().int().min(1).max(5000),
	height: z.number().int().min(1).max(5000),
	sortOrder: z.number().int().min(0).max(MAX_LISTING_IMAGES),
	byteSize: z.number().int().min(1).max(MAX_LISTING_IMAGE_BYTES),
});

export const ListingBaseSchema = z.object({
	id: IdSchema,
	type: ListingTypeSchema,
	title: z.string().trim().min(4).max(120),
	description: z.string().trim().min(10).max(2500),
	category: z.string().trim().min(2).max(60),
	condition: ListingConditionSchema,
	availableFrom: DateOnlySchema,
	availableThrough: DateOnlySchema,
	availabilityNotes: z.string().trim().max(400).optional(),
	wantedItem: z.string().trim().max(140).optional().or(z.literal("")),
	status: ListingStatusSchema,
	createdAt: TimestampSchema,
	updatedAt: TimestampSchema,
	images: z.array(ListingImageMetaSchema).max(MAX_LISTING_IMAGES),
});

export const PublicListingSummarySchema = ListingBaseSchema.pick({
	id: true,
	type: true,
	title: true,
	description: true,
	category: true,
	condition: true,
	availableFrom: true,
	availableThrough: true,
	images: true,
	wantedItem: true,
	status: true,
}).extend({
	neighborhood: z.string().trim().min(1),
});

export const MemberListingSummarySchema = PublicListingSummarySchema.extend({
	owner: PublicUserSummarySchema,
	savesCount: z.number().int().min(0),
	reactionsCount: z.number().int().min(0),
	commentsCount: z.number().int().min(0),
	requestsCount: z.number().int().min(0),
	isSavedByViewer: z.boolean(),
	hasViewerReaction: z.boolean(),
	isRequestedByViewer: z.boolean(),
});

export const ListingDetailSchema = MemberListingSummarySchema.extend({
	availabilityNotes: z.string().trim().max(400).optional(),
	deletedAt: TimestampSchema.nullable(),
	deletedByUserId: IdSchema.nullable(),
});

export const OfferItemSchema = z.object({
	title: z.string().trim().min(2).max(140),
	description: z.string().trim().min(8).max(1000),
	condition: ListingConditionSchema,
});

const ListingTitleSchema = z.string().trim().min(4).max(120);
const ListingDescriptionSchema = z.string().trim().min(10).max(2500);
const ListingCategorySchema = z.string().trim().min(2).max(60);
const ListingConditionOptional = ListingConditionSchema.or(z.literal(""));

export const CreateListingCommonSchema = z.object({
	title: ListingTitleSchema,
	description: ListingDescriptionSchema,
	category: ListingCategorySchema,
	condition: ListingConditionSchema,
	availableFrom: DateOnlySchema,
	availableThrough: DateOnlySchema,
	availabilityNotes: z.string().trim().max(400).optional(),
});

export const CreateLendListingInputSchema = CreateListingCommonSchema.extend({
	type: z.literal("lend"),
	wantedItem: z.undefined().optional(),
});

export const CreateBorrowOrTradeListingInputSchema =
	CreateListingCommonSchema.extend({
		type: z.enum(["borrow", "trade"]),
		wantedItem: z.string().trim().min(2).max(140),
	});

export const CreateListingInputSchema = z.discriminatedUnion("type", [
	CreateLendListingInputSchema,
	CreateBorrowOrTradeListingInputSchema,
]);

export const ListingPatchFieldsSchema = z.object({
	title: ListingTitleSchema.optional(),
	description: ListingDescriptionSchema.optional(),
	category: ListingCategorySchema.optional(),
	condition: ListingConditionSchema.optional(),
	availableFrom: DateOnlySchema.optional(),
	availableThrough: DateOnlySchema.optional(),
	availabilityNotes: z.string().trim().max(400).nullable(),
	wantedItem: z.string().trim().min(2).max(140).optional(),
});

export const ListingWithdrawActionSchema = z.object({
	action: z.literal("withdraw"),
});

export const PatchListingInputSchema = z
	.union([ListingWithdrawActionSchema, ListingPatchFieldsSchema])
	.superRefine((values, context) => {
		if ("action" in values) {
			return;
		}

		const hasUpdate = Object.values(values).some(
			(value) => value !== undefined && value !== null,
		);
		if (!hasUpdate) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "At least one editable listing field is required",
				path: ["listing"],
			});
		}
	});

export const ListingStateMutateInputSchema = z.object({});

export const AddListingImagesInputSchema = z.object({
	imageCount: z.number().int().min(1).max(MAX_LISTING_IMAGES),
	images: z
		.array(
			z.object({
				altText: z.string().trim().min(1).max(140),
				sortOrder: z.number().int().min(0).max(MAX_LISTING_IMAGES),
			}),
		)
		.max(MAX_LISTING_IMAGES)
		.min(1),
});

export const DeleteListingImageInputSchema = z.object({});

export const DeleteCommentInputSchema = z.object({});

export const CommentCreateInputSchema = z.object({
	body: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
});

export const CommentDtoSchema = z.object({
	id: IdSchema,
	listingId: IdSchema,
	author: PublicUserSummarySchema,
	body: z.string().trim().max(MAX_COMMENT_LENGTH),
	createdAt: TimestampSchema,
	updatedAt: TimestampSchema,
});

export const CommentQuerySchema = z.object({
	...CursorQuerySchema.shape,
});

export const CommentListResponseSchema = CursorEnvelopeSchema(CommentDtoSchema);

const validateRequestedDateRange = (
	value: {
		requestedStart?: string;
		requestedEnd?: string;
	},
	context: z.RefinementCtx,
) => {
	if (
		(value.requestedStart && !value.requestedEnd) ||
		(value.requestedEnd && !value.requestedStart)
	) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message:
				"requestedStart and requestedEnd must be both present or both omitted",
			path: ["requestedEnd"],
		});
	}

	if (
		value.requestedStart &&
		value.requestedEnd &&
		value.requestedEnd < value.requestedStart
	) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			message: "requestedEnd must be on or after requestedStart",
			path: ["requestedEnd"],
		});
	}
};
const CreateLendRequestBodyObjectSchema = z
	.object({
		listingType: z.literal("lend"),
		openingMessage: z.string().trim().min(8).max(1500),
		requestedStart: DateOnlySchema,
		requestedEnd: DateOnlySchema,
		offeredItem: z.undefined(),
	})
	.strict();

export const CreateLendRequestBodySchema =
	CreateLendRequestBodyObjectSchema.superRefine(validateRequestedDateRange);
const CreateBorrowOrTradeRequestBodyObjectSchema = z
	.object({
		openingMessage: z.string().trim().min(8).max(1500),
		requestedStart: DateOnlySchema.optional(),
		requestedEnd: DateOnlySchema.optional(),
		offeredItem: OfferItemSchema,
	})
	.strict();

export const CreateBorrowRequestBodySchema =
	CreateBorrowOrTradeRequestBodyObjectSchema.extend({
		listingType: z.literal("borrow"),
	}).superRefine(validateRequestedDateRange);

export const CreateTradeRequestBodySchema =
	CreateBorrowOrTradeRequestBodyObjectSchema.extend({
		listingType: z.literal("trade"),
	}).superRefine(validateRequestedDateRange);

export const CreateRequestBodySchema = z
	.discriminatedUnion("listingType", [
		CreateLendRequestBodyObjectSchema,
		CreateBorrowOrTradeRequestBodyObjectSchema.extend({
			listingType: z.literal("borrow"),
		}),
		CreateBorrowOrTradeRequestBodyObjectSchema.extend({
			listingType: z.literal("trade"),
		}),
	])
	.superRefine(validateRequestedDateRange);
export const RequestLifecycleActionInputSchema = z
	.object({
		action: RequestActionSchema,
		reason: z.string().trim().max(500).optional(),
	})
	.superRefine((value, context) => {
		if (value.action === "cancel" && !value.reason) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Cancellation requires reason",
				path: ["reason"],
			});
		}
	});

export const RequestQuerySchema = z.object({
	role: z.enum(["owner", "requester", "participant", "all"]).default("all"),
	status: RequestStatusSchema.optional(),
	...CursorQuerySchema.shape,
});

export const MessageCreateInputSchema = z.object({
	body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

export const MessageDtoSchema = z.object({
	id: IdSchema,
	requestId: IdSchema,
	senderId: IdSchema,
	body: z.string().trim().max(MAX_MESSAGE_LENGTH),
	createdAt: TimestampSchema,
	readAt: TimestampSchema.nullable(),
});

export const MessageQuerySchema = z.object({
	...CursorQuerySchema.shape,
});

export const ReviewInputSchema = z.object({
	rating: z.number().int().min(1).max(5),
	body: z.string().trim().min(1).max(MAX_REVIEW_LENGTH),
});

export const ReviewDtoSchema = z.object({
	id: IdSchema,
	requestId: IdSchema,
	reviewerId: IdSchema,
	rating: z.number().int().min(1).max(5),
	body: z.string().trim().max(MAX_REVIEW_LENGTH),
	createdAt: TimestampSchema,
});

export const RequestParticipantSchema = z.object({
	id: IdSchema,
	listingId: IdSchema,
	listingType: ListingTypeSchema,
	listingTitle: z.string().trim().min(2).max(120),
	status: RequestStatusSchema,
	requestedStart: DateOnlySchema.nullable(),
	requestedEnd: DateOnlySchema.nullable(),
	offeredItem: OfferItemSchema.nullable(),
	openingMessage: z.string().trim().max(1500),
	cancellationReason: z.string().trim().max(500).nullable(),
	createdAt: TimestampSchema,
	updatedAt: TimestampSchema,
	ownerId: IdSchema,
	requesterId: IdSchema,
});

export const UserMePatchSchema = z
	.object({
		name: NameSchema(80).optional(),
		bio: z.string().trim().max(500).optional(),
		avatarPath: NeighborhoodImagePathSchema.optional(),
		neighborhoodId: IdSchema.optional(),
	})
	.superRefine((value, context) => {
		if (
			!value.name &&
			!value.bio &&
			!value.avatarPath &&
			!value.neighborhoodId
		) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				message: "At least one update field is required",
				path: ["name"],
			});
		}
	});

export const PasswordChangeSchema = z
	.object({
		currentPassword: PasswordSchema,
		nextPassword: PasswordSchema,
	})
	.refine((value) => value.nextPassword !== value.currentPassword, {
		message: "nextPassword must differ from currentPassword",
		path: ["nextPassword"],
	});

export const AuthRegisterInputSchema = z.object({
	name: NameSchema(80),
	email: EmailSchema,
	password: PasswordSchema,
	neighborhoodId: IdSchema,
});

export const AuthLoginInputSchema = z.object({
	email: EmailSchema,
	password: PasswordSchema,
});

export const DemoAuthInputSchema = z.object({});

export const AuthSessionResponseSchema = EnvelopeSchema(SelfUserSchema);

export const ContactInputSchema = z
	.object({
		name: NameSchema(100),
		email: EmailSchema,
		message: z.string().trim().min(10).max(MAX_CONTACT_MESSAGE_LENGTH),
		honeypot: z.string().max(0).default(""),
	})
	.strict();

export const ContactAcknowledgementSchema = EnvelopeSchema(
	z.object({
		acknowledged: z.literal(true),
	}),
);

export const PreviewQuerySchema = z.object({
	limit: PreviewLimitSchema,
});

export const HealthSuccessSchema = EnvelopeSchema(
	z.object({
		status: z.literal("ready"),
		database: z.object({
			migrationsApplied: z.number().int().min(0),
			writable: z.boolean(),
		}),
	}),
);

export const NeighborhoodsSuccessSchema = EnvelopeSchema(
	z.array(NeighborhoodDtoSchema),
);

export const PreviewSuccessSchema = EnvelopeSchema(
	z.object({
		items: z.array(PublicListingSummarySchema).max(PREVIEW_PAGE_LIMIT),
	}),
);

export const FeedResponseSchema = CursorEnvelopeSchema(
	MemberListingSummarySchema,
);
export const ListingByIdResponseSchema = EnvelopeSchema(ListingDetailSchema);
export const MessageListResponseSchema = CursorEnvelopeSchema(MessageDtoSchema);
export const RequestsResponseSchema = CursorEnvelopeSchema(
	RequestParticipantSchema,
);

export const SelfRouteResultSchema = EnvelopeSchema(SelfUserSchema);
export const MemberUsersResponseSchema = EnvelopeSchema(MemberProfileSchema);
export const NeighborsResponseSchema = CursorEnvelopeSchema(
	MemberUserSummarySchema,
);

export const PublicContractErrorSchema = CanonicalErrorEnvelopeSchema;
export const NoContentSchema = z.void();

export interface RouteContractDef<
	Params extends z.ZodTypeAny,
	Query extends z.ZodTypeAny,
	Body extends z.ZodTypeAny,
	Response extends z.ZodTypeAny,
> {
	method: z.infer<typeof HttpMethodSchema>;
	path: string;
	params: Params;
	query: Query;
	body: Body;
	response: Response;
	successStatus: number;
	errors: readonly CanonicalErrorCode[];
}

const route = <
	Params extends z.ZodTypeAny,
	Query extends z.ZodTypeAny,
	Body extends z.ZodTypeAny,
	Response extends z.ZodTypeAny,
>(
	contract: RouteContractDef<Params, Query, Body, Response>,
) => contract;

const NoInput = z.object({});

export const API_ROUTES = {
	health: route({
		method: "GET",
		path: "/api/health",
		params: NoInput,
		query: NoInput,
		body: NoInput,
		response: HealthSuccessSchema,
		successStatus: 200,
		errors: ["SERVICE_UNAVAILABLE", "INTERNAL_ERROR"],
	}),
	preview: route({
		method: "GET",
		path: "/api/preview",
		params: NoInput,
		query: PreviewQuerySchema,
		body: NoInput,
		response: PreviewSuccessSchema,
		successStatus: 200,
		errors: ["SERVICE_UNAVAILABLE", "INTERNAL_ERROR"],
	}),
	neighborhoods: route({
		method: "GET",
		path: "/api/neighborhoods",
		params: NoInput,
		query: z.object({
			q: z.string().trim().max(MAX_SEARCH_QUERY_LENGTH).optional(),
		}),
		body: NoInput,
		response: NeighborhoodsSuccessSchema,
		successStatus: 200,
		errors: ["SERVICE_UNAVAILABLE", "INTERNAL_ERROR"],
	}),
	register: route({
		method: "POST",
		path: "/api/auth/register",
		params: NoInput,
		query: NoInput,
		body: AuthRegisterInputSchema,
		response: AuthSessionResponseSchema,
		successStatus: 201,
		errors: [
			"BAD_REQUEST",
			"CONFLICT",
			"VALIDATION_ERROR",
			"INTERNAL_ERROR",
			"RATE_LIMITED",
		],
	}),
	login: route({
		method: "POST",
		path: "/api/auth/login",
		params: NoInput,
		query: NoInput,
		body: AuthLoginInputSchema,
		response: AuthSessionResponseSchema,
		successStatus: 200,
		errors: [
			"BAD_REQUEST",
			"UNAUTHORIZED",
			"VALIDATION_ERROR",
			"RATE_LIMITED",
			"INTERNAL_ERROR",
		],
	}),
	demoAuth: route({
		method: "POST",
		path: "/api/auth/demo",
		params: NoInput,
		query: NoInput,
		body: DemoAuthInputSchema,
		response: AuthSessionResponseSchema,
		successStatus: 200,
		errors: ["BAD_REQUEST", "RATE_LIMITED", "INTERNAL_ERROR"],
	}),
	logout: route({
		method: "POST",
		path: "/api/auth/logout",
		params: NoInput,
		query: NoInput,
		body: NoInput,
		response: z.object({}),
		successStatus: 204,
		errors: ["UNAUTHORIZED", "INTERNAL_ERROR"],
	}),
	session: route({
		method: "GET",
		path: "/api/session",
		params: NoInput,
		query: NoInput,
		body: NoInput,
		response: EnvelopeSchema(SessionSchema),
		successStatus: 200,
		errors: ["INTERNAL_ERROR"],
	}),
	contact: route({
		method: "POST",
		path: "/api/contact",
		params: NoInput,
		query: NoInput,
		body: ContactInputSchema,
		response: ContactAcknowledgementSchema,
		successStatus: 202,
		errors: [
			"BAD_REQUEST",
			"VALIDATION_ERROR",
			"RATE_LIMITED",
			"INTERNAL_ERROR",
		],
	}),
	feed: route({
		method: "GET",
		path: "/api/feed",
		params: NoInput,
		query: z
			.object({
				type: ListingTypeSchema.optional(),
				category: z.string().trim().min(2).max(60).optional(),
				q: z.string().trim().max(MAX_SEARCH_QUERY_LENGTH).optional(),
				saved: SavedOnlyQuerySchema.shape.saved,
				...DateRangeFields,
				...CursorQuerySchema.shape,
			})
			.strict()
			.superRefine(validateAvailabilityDateRange),
		body: NoInput,
		response: FeedResponseSchema,
		successStatus: 200,
		errors: [
			"UNAUTHORIZED",
			"BAD_REQUEST",
			"SERVICE_UNAVAILABLE",
			"INTERNAL_ERROR",
		],
	}),
	listingGetById: route({
		method: "GET",
		path: "/api/listings/:id",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: NoInput,
		response: ListingByIdResponseSchema,
		successStatus: 200,
		errors: ["UNAUTHORIZED", "NOT_FOUND", "FORBIDDEN", "INTERNAL_ERROR"],
	}),
	listingCreate: route({
		method: "POST",
		path: "/api/listings",
		params: NoInput,
		query: NoInput,
		body: CreateListingInputSchema,
		response: EnvelopeSchema(ListingDetailSchema),
		successStatus: 201,
		errors: [
			"UNAUTHORIZED",
			"FORBIDDEN",
			"BAD_REQUEST",
			"VALIDATION_ERROR",
			"INTERNAL_ERROR",
		],
	}),
	listingPatch: route({
		method: "PATCH",
		path: "/api/listings/:id",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: PatchListingInputSchema,
		response: ListingByIdResponseSchema,
		successStatus: 200,
		errors: [
			"UNAUTHORIZED",
			"FORBIDDEN",
			"NOT_FOUND",
			"CONFLICT",
			"VALIDATION_ERROR",
			"INTERNAL_ERROR",
			"HAS_DEPENDENT_HISTORY",
		],
	}),
	listingDelete: route({
		method: "DELETE",
		path: "/api/listings/:id",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: NoInput,
		response: z.object({}),
		successStatus: 204,
		errors: [
			"UNAUTHORIZED",
			"FORBIDDEN",
			"NOT_FOUND",
			"HAS_DEPENDENT_HISTORY",
			"INTERNAL_ERROR",
		],
	}),
	listingAddImages: route({
		method: "POST",
		path: "/api/listings/:id/images",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: AddListingImagesInputSchema,
		response: EnvelopeSchema(z.array(ListingImageMetaSchema)),
		successStatus: 201,
		errors: [
			"UNAUTHORIZED",
			"FORBIDDEN",
			"NOT_FOUND",
			"BAD_REQUEST",
			"VALIDATION_ERROR",
			"INTERNAL_ERROR",
		],
	}),
	listingDeleteImage: route({
		method: "DELETE",
		path: "/api/listings/:id/images/:imageId",
		params: z.object({ id: IdSchema, imageId: IdSchema }),
		query: NoInput,
		body: DeleteListingImageInputSchema,
		response: z.object({}),
		successStatus: 204,
		errors: ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "INTERNAL_ERROR"],
	}),
	listingSave: route({
		method: "POST",
		path: "/api/listings/:id/save",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: ListingStateMutateInputSchema,
		response: EnvelopeSchema(MemberListingSummarySchema),
		successStatus: 200,
		errors: ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "INTERNAL_ERROR"],
	}),
	listingDeleteSave: route({
		method: "DELETE",
		path: "/api/listings/:id/save",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: ListingStateMutateInputSchema,
		response: EnvelopeSchema(MemberListingSummarySchema),
		successStatus: 200,
		errors: ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "INTERNAL_ERROR"],
	}),
	listingReaction: route({
		method: "POST",
		path: "/api/listings/:id/reaction",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: ListingStateMutateInputSchema,
		response: EnvelopeSchema(MemberListingSummarySchema),
		successStatus: 200,
		errors: ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "INTERNAL_ERROR"],
	}),
	listingReactionDelete: route({
		method: "DELETE",
		path: "/api/listings/:id/reaction",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: ListingStateMutateInputSchema,
		response: EnvelopeSchema(MemberListingSummarySchema),
		successStatus: 200,
		errors: ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "INTERNAL_ERROR"],
	}),
	listingCommentCreate: route({
		method: "POST",
		path: "/api/listings/:id/comments",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: CommentCreateInputSchema,
		response: EnvelopeSchema(CommentDtoSchema),
		successStatus: 201,
		errors: [
			"UNAUTHORIZED",
			"FORBIDDEN",
			"NOT_FOUND",
			"VALIDATION_ERROR",
			"INTERNAL_ERROR",
		],
	}),
	listingCommentsGet: route({
		method: "GET",
		path: "/api/listings/:id/comments",
		params: z.object({ id: IdSchema }),
		query: CommentQuerySchema,
		body: NoInput,
		response: CommentListResponseSchema,
		successStatus: 200,
		errors: ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "INTERNAL_ERROR"],
	}),
	commentDelete: route({
		method: "DELETE",
		path: "/api/comments/:id",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: DeleteCommentInputSchema,
		response: z.object({}),
		successStatus: 204,
		errors: ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "INTERNAL_ERROR"],
	}),
	requestsCreate: route({
		method: "POST",
		path: "/api/listings/:id/requests",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: CreateRequestBodySchema,
		response: EnvelopeSchema(RequestParticipantSchema),
		successStatus: 201,
		errors: [
			"UNAUTHORIZED",
			"FORBIDDEN",
			"NOT_FOUND",
			"VALIDATION_ERROR",
			"CONFLICT",
			"STALE_TRANSITION",
			"INTERNAL_ERROR",
		],
	}),
	requestsList: route({
		method: "GET",
		path: "/api/requests",
		params: NoInput,
		query: RequestQuerySchema,
		body: NoInput,
		response: RequestsResponseSchema,
		successStatus: 200,
		errors: ["UNAUTHORIZED", "FORBIDDEN", "INTERNAL_ERROR"],
	}),
	requestTransition: route({
		method: "PATCH",
		path: "/api/requests/:id",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: RequestLifecycleActionInputSchema,
		response: EnvelopeSchema(RequestParticipantSchema),
		successStatus: 200,
		errors: [
			"UNAUTHORIZED",
			"FORBIDDEN",
			"NOT_FOUND",
			"STALE_TRANSITION",
			"CONFLICT",
			"INTERNAL_ERROR",
			"NEIGHBORHOOD_CHANGE_BLOCKED",
		],
	}),
	requestMessagesGet: route({
		method: "GET",
		path: "/api/requests/:id/messages",
		params: z.object({ id: IdSchema }),
		query: MessageQuerySchema,
		body: NoInput,
		response: MessageListResponseSchema,
		successStatus: 200,
		errors: ["UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "INTERNAL_ERROR"],
	}),
	requestMessageCreate: route({
		method: "POST",
		path: "/api/requests/:id/messages",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: MessageCreateInputSchema,
		response: EnvelopeSchema(MessageDtoSchema),
		successStatus: 201,
		errors: [
			"UNAUTHORIZED",
			"FORBIDDEN",
			"NOT_FOUND",
			"VALIDATION_ERROR",
			"INTERNAL_ERROR",
		],
	}),
	requestReviewCreate: route({
		method: "POST",
		path: "/api/requests/:id/reviews",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: ReviewInputSchema,
		response: EnvelopeSchema(ReviewDtoSchema),
		successStatus: 201,
		errors: [
			"UNAUTHORIZED",
			"FORBIDDEN",
			"NOT_FOUND",
			"CONFLICT",
			"VALIDATION_ERROR",
			"INTERNAL_ERROR",
		],
	}),
	usersGetById: route({
		method: "GET",
		path: "/api/users/:id",
		params: z.object({ id: IdSchema }),
		query: NoInput,
		body: NoInput,
		response: MemberUsersResponseSchema,
		successStatus: 200,
		errors: ["UNAUTHORIZED", "NOT_FOUND", "FORBIDDEN", "INTERNAL_ERROR"],
	}),
	neighborsList: route({
		method: "GET",
		path: "/api/neighbors",
		params: NoInput,
		query: CursorQuerySchema,
		body: NoInput,
		response: NeighborsResponseSchema,
		successStatus: 200,
		errors: ["UNAUTHORIZED", "INTERNAL_ERROR"],
	}),
	mePatch: route({
		method: "PATCH",
		path: "/api/me",
		params: NoInput,
		query: NoInput,
		body: UserMePatchSchema,
		response: EnvelopeSchema(SelfUserSchema),
		successStatus: 200,
		errors: [
			"UNAUTHORIZED",
			"FORBIDDEN",
			"VALIDATION_ERROR",
			"INTERNAL_ERROR",
			"NEIGHBORHOOD_CHANGE_BLOCKED",
		],
	}),
	mePassword: route({
		method: "PATCH",
		path: "/api/me/password",
		params: NoInput,
		query: NoInput,
		body: PasswordChangeSchema,
		response: z.object({}),
		successStatus: 204,
		errors: [
			"UNAUTHORIZED",
			"FORBIDDEN",
			"BAD_REQUEST",
			"VALIDATION_ERROR",
			"INTERNAL_ERROR",
		],
	}),
} as const;

export type RouteKey = keyof typeof API_ROUTES;

export const PUBLIC_PREVIEW_FIELDS = z.object({
	name: z.literal("PublicPreview"),
	data: z.array(PublicListingSummarySchema),
});

export const MEMBER_FIELDS = z.object({
	name: z.literal("Member"),
	data: MemberListingSummarySchema,
});

export const SELF_FIELDS = z.object({
	name: z.literal("Self"),
	data: SelfUserSchema,
});

export const PARTICIPANT_FIELDS = z.object({
	name: z.literal("Participant"),
	data: RequestParticipantSchema,
});

export const SERVER_ONLY_FIELDS = z.object({
	name: z.literal("ServerOnly"),
	data: z.object({
		userPasswordHash: z.string().min(1),
		sessionTokenHash: z.string().min(1),
		contactMessage: ContactInputSchema,
	}),
});

export type PublicListingSummary = z.infer<typeof PublicListingSummarySchema>;
export type MemberListingSummary = z.infer<typeof MemberListingSummarySchema>;
export type ListingDetail = z.infer<typeof ListingDetailSchema>;
export type SelfUser = z.infer<typeof SelfUserSchema>;
export type MemberUser = z.infer<typeof MemberUserSummarySchema>;
export type MemberProfile = z.infer<typeof MemberProfileSchema>;
export type RequestParticipant = z.infer<typeof RequestParticipantSchema>;
export type MessageDto = z.infer<typeof MessageDtoSchema>;
export type ReviewDto = z.infer<typeof ReviewDtoSchema>;
