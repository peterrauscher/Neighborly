import {
	API_ROUTES,
	AuthLoginInputSchema,
	AuthRegisterInputSchema,
	ContactInputSchema,
	PasswordChangeSchema,
	UserMePatchSchema,
} from "../../src/lib/contracts";
import type { AuthService } from "../auth";
import { type FetchRouter, HttpError } from "../http";

export function registerAuthRoutes(router: FetchRouter, auth: AuthService) {
	router.add(API_ROUTES.health, () => {
		const database = auth.health();
		if (!database.writable) throw new HttpError("SERVICE_UNAVAILABLE");
		return { data: { status: "ready", database } };
	});

	router.add(API_ROUTES.neighborhoods, (context) => {
		const parsed = API_ROUTES.neighborhoods.query.parse(context.query);
		return { data: auth.listNeighborhoods(parsed.q) };
	});

	router.add(
		API_ROUTES.register,
		async (context) => {
			const input = AuthRegisterInputSchema.parse(context.body);
			const session = await auth.register(
				input,
				context.request,
				context.clientAddress,
			);
			return {
				body: { data: session.user },
				headers: {
					"Set-Cookie": session.cookie,
					"X-CSRF-Token": session.csrfToken,
				},
			};
		},
		{ csrfExempt: true },
	);

	router.add(
		API_ROUTES.login,
		async (context) => {
			const input = AuthLoginInputSchema.parse(context.body);
			const session = await auth.login(
				input,
				context.request,
				context.clientAddress,
			);
			return {
				body: { data: session.user },
				headers: {
					"Set-Cookie": session.cookie,
					"X-CSRF-Token": session.csrfToken,
				},
			};
		},
		{ csrfExempt: true },
	);

	router.add(
		API_ROUTES.demoAuth,
		async (context) => {
			const session = await auth.loginDemo(
				context.request,
				context.clientAddress,
			);
			return {
				body: { data: session.user },
				headers: {
					"Set-Cookie": session.cookie,
					"X-CSRF-Token": session.csrfToken,
				},
			};
		},
		{ csrfExempt: true },
	);

	router.add(API_ROUTES.logout, (context) => {
		const session = auth.requireSession(context.request);
		auth.logout(session);
		return { body: {}, headers: { "Set-Cookie": auth.clearCookie() } };
	});

	router.add(API_ROUTES.session, (context) => {
		const session = auth.currentSession(context.request);
		if (!session) return { data: { user: null } };
		return {
			body: { data: { user: session.user } },
			headers: { "X-CSRF-Token": auth.csrfToken(session.token) },
		};
	});

	router.add(
		API_ROUTES.contact,
		(context) => {
			const input = ContactInputSchema.parse(context.body);
			auth.acknowledgeContact(input, context.clientAddress);
			return { data: { acknowledged: true } };
		},
		{ csrfExempt: true },
	);

	router.add(API_ROUTES.mePatch, (context) => {
		const session = auth.requireSession(context.request);
		const input = UserMePatchSchema.parse(context.body);
		return { data: auth.updateProfile(session, input) };
	});

	router.add(API_ROUTES.mePassword, async (context) => {
		const session = auth.requireSession(context.request);
		const input = PasswordChangeSchema.parse(context.body);
		await auth.changePassword(session, input);
		return { body: {}, headers: { "Set-Cookie": auth.clearCookie() } };
	});
}
