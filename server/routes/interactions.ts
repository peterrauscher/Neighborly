import {
	API_ROUTES,
	CreateRequestBodySchema,
	MessageCreateInputSchema,
	MessageQuerySchema,
	RequestLifecycleActionInputSchema,
	RequestQuerySchema,
	ReviewInputSchema,
} from "../../src/lib/contracts";
import type { AuthService } from "../auth";
import type { FetchRouter } from "../http";
import type { InteractionService } from "../interactions";

export function registerInteractionRoutes(
	router: FetchRouter,
	auth: AuthService,
	interactions: InteractionService,
) {
	router.add(API_ROUTES.requestsCreate, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const { id } = API_ROUTES.requestsCreate.params.parse(context.params);
		const input = CreateRequestBodySchema.parse(context.body);
		return { data: interactions.createRequest(session.user, id, input) };
	});

	router.add(API_ROUTES.requestsList, (context) => {
		const session = auth.requireSession(context.request);
		const input = RequestQuerySchema.parse(context.query);
		return { data: interactions.requests(session.user, input) };
	});

	router.add(API_ROUTES.requestTransition, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const { id } = API_ROUTES.requestTransition.params.parse(context.params);
		const input = RequestLifecycleActionInputSchema.parse(context.body);
		return {
			data: interactions.transition(
				session.user,
				id,
				input.action,
				input.reason,
			),
		};
	});

	router.add(API_ROUTES.requestMessagesGet, (context) => {
		const session = auth.requireSession(context.request);
		const { id } = API_ROUTES.requestMessagesGet.params.parse(context.params);
		const input = MessageQuerySchema.parse(context.query);
		return { data: interactions.messages(session.user, id, input) };
	});

	router.add(API_ROUTES.requestMessageCreate, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const { id } = API_ROUTES.requestMessageCreate.params.parse(context.params);
		const input = MessageCreateInputSchema.parse(context.body);
		return { data: interactions.createMessage(session.user, id, input.body) };
	});

	router.add(API_ROUTES.requestReviewCreate, (context) => {
		const session = auth.requireSession(context.request);
		auth.requireMutable(session);
		const { id } = API_ROUTES.requestReviewCreate.params.parse(context.params);
		const input = ReviewInputSchema.parse(context.body);
		return { data: interactions.createReview(session.user, id, input) };
	});

	router.add(API_ROUTES.usersGetById, (context) => {
		const session = auth.requireSession(context.request);
		const { id } = API_ROUTES.usersGetById.params.parse(context.params);
		return { data: interactions.memberProfile(session.user, id) };
	});

	router.add(API_ROUTES.userHistory, (context) => {
		const session = auth.requireSession(context.request);
		const { id } = API_ROUTES.userHistory.params.parse(context.params);
		const input = API_ROUTES.userHistory.query.parse(context.query);
		return { data: interactions.profileHistory(session.user, id, input) };
	});

	router.add(API_ROUTES.neighborsList, (context) => {
		const session = auth.requireSession(context.request);
		const input = API_ROUTES.neighborsList.query.parse(context.query);
		return { data: interactions.neighbors(session.user, input) };
	});
}
