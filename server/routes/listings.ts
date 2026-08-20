import {
	API_ROUTES,
	AddListingImagesInputSchema,
	CommentCreateInputSchema,
	CommentQuerySchema,
	CreateListingInputSchema,
	PatchListingInputSchema,
} from "../../src/lib/contracts";
import type { AuthService, AuthenticatedSession } from "../auth";
import type { FetchRouter } from "../http";
import type { ImageService } from "../images";
import type { ListingService } from "../listings";

export function registerListingRoutes(
	router: FetchRouter,
	auth: AuthService,
	listings: ListingService,
	images: ImageService,
) {
	router.add(API_ROUTES.preview, (context) => {
		const input = API_ROUTES.preview.query.parse(context.query);
		return { data: { items: listings.preview(input.limit) } };
	});

	router.add(API_ROUTES.feed, (context) => {
		const session = auth.requireSession(context.request);
		const input = API_ROUTES.feed.query.parse(context.query);
		return { data: listings.feed(session.user, input) };
	});

	router.add(API_ROUTES.listingGetById, (context) => {
		const session = auth.requireSession(context.request);
		const { id } = API_ROUTES.listingGetById.params.parse(context.params);
		return { data: listings.detail(session.user, id) };
	});

	router.add(API_ROUTES.listingCreate, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const input = CreateListingInputSchema.parse(context.body);
		return { data: listings.create(session.user, input) };
	});

	router.add(API_ROUTES.listingPatch, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const { id } = API_ROUTES.listingPatch.params.parse(context.params);
		const input = PatchListingInputSchema.parse(context.body);
		return { data: listings.patch(session.user, id, input) };
	});

	router.add(API_ROUTES.listingDelete, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const { id } = API_ROUTES.listingDelete.params.parse(context.params);
		listings.delete(session.user, id);
		return {};
	});

	router.add(
		API_ROUTES.listingAddImages,
		async (context) => {
			const session = context.preflight as AuthenticatedSession;
			const { id } = API_ROUTES.listingAddImages.params.parse(context.params);
			const input = AddListingImagesInputSchema.parse(context.body);
			const uploads = input.images.map((file, index) => {
				const metadata = input.metadata[index];
				if (!metadata) throw new Error("Validated image metadata is missing.");
				return { file, ...metadata };
			});
			return { data: await images.add(session.user, id, uploads) };
		},
		{
			beforeBody: (context) => {
				const session = auth.requireSession(context.request);
				auth.requireMutable(session);
				const { id } = API_ROUTES.listingAddImages.params.parse(context.params);
				images.preflight(session.user, id);
				return session;
			},
		},
	);

	router.add(API_ROUTES.listingImageGet, (context) => {
		const { imageId } = API_ROUTES.listingImageGet.params.parse(context.params);
		return images.publicResponse(
			imageId,
			auth.currentSession(context.request)?.user ?? null,
		);
	});

	router.add(API_ROUTES.listingDeleteImage, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const { id, imageId } = API_ROUTES.listingDeleteImage.params.parse(
			context.params,
		);
		images.delete(session.user, id, imageId);
		return {};
	});

	router.add(API_ROUTES.listingSave, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const { id } = API_ROUTES.listingSave.params.parse(context.params);
		return { data: listings.save(session.user, id, true) };
	});

	router.add(API_ROUTES.listingDeleteSave, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const { id } = API_ROUTES.listingDeleteSave.params.parse(context.params);
		return { data: listings.save(session.user, id, false) };
	});

	router.add(API_ROUTES.listingReaction, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const { id } = API_ROUTES.listingReaction.params.parse(context.params);
		return { data: listings.react(session.user, id, true) };
	});

	router.add(API_ROUTES.listingReactionDelete, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const { id } = API_ROUTES.listingReactionDelete.params.parse(
			context.params,
		);
		return { data: listings.react(session.user, id, false) };
	});

	router.add(API_ROUTES.listingCommentCreate, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const { id } = API_ROUTES.listingCommentCreate.params.parse(context.params);
		const input = CommentCreateInputSchema.parse(context.body);
		return { data: listings.createComment(session.user, id, input.body) };
	});

	router.add(API_ROUTES.listingCommentsGet, (context) => {
		const session = auth.requireSession(context.request);
		const { id } = API_ROUTES.listingCommentsGet.params.parse(context.params);
		const input = CommentQuerySchema.parse(context.query);
		return { data: listings.comments(session.user, id, input) };
	});

	router.add(API_ROUTES.commentDelete, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const { id } = API_ROUTES.commentDelete.params.parse(context.params);
		listings.deleteComment(session.user, id);
		return {};
	});
}
