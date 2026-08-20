import { afterEach, describe, expect, test } from "bun:test";

import {
	ApiError,
	apiRequest,
	clearCsrfToken,
	safeRedirectTarget,
	setCsrfToken,
	subscribeToAuthInvalidation,
} from "./api";

afterEach(clearCsrfToken);

describe("apiRequest", () => {
	test("encodes validated query parameters and uses same-origin credentials", async () => {
		let url = "";
		let init: RequestInit | undefined;

		await apiRequest("neighborhoods", {
			query: { q: "Café & Garden" },
			fetch: async (input, requestInit) => {
				url = String(input);
				init = requestInit;
				return Response.json({ data: [] });
			},
		});

		expect(url).toBe("/api/neighborhoods?q=Caf%C3%A9+%26+Garden");
		expect(init?.credentials).toBe("same-origin");
		expect(init?.method).toBe("GET");
	});

	test("validates JSON request bodies before calling fetch", async () => {
		let calls = 0;

		await expect(
			apiRequest("contact", {
				body: {
					name: "",
					email: "not-an-email",
					message: "short",
					honeypot: "",
				},
				fetch: async () => {
					calls += 1;
					return Response.json(
						{ data: { acknowledged: true } },
						{ status: 202 },
					);
				},
			}),
		).rejects.toMatchObject({
			code: "VALIDATION_ERROR",
			status: 0,
		});
		expect(calls).toBe(0);
	});

	test("serializes validated JSON request bodies", async () => {
		let init: RequestInit | undefined;

		const response = await apiRequest("contact", {
			body: {
				name: "Alex Neighbor",
				email: "alex@example.test",
				message: "Please tell me when the neighborhood opens.",
			},
			fetch: async (_input, requestInit) => {
				init = requestInit;
				return Response.json({ data: { acknowledged: true } }, { status: 202 });
			},
		});

		expect(response).toEqual({ data: { acknowledged: true } });
		expect(init?.headers).toBeInstanceOf(Headers);
		expect(new Headers(init?.headers).get("content-type")).toBe(
			"application/json",
		);
		expect(JSON.parse(String(init?.body))).toEqual({
			name: "Alex Neighbor",
			email: "alex@example.test",
			message: "Please tell me when the neighborhood opens.",
			honeypot: "",
		});
	});

	test("normalizes canonical error envelopes and transport metadata", async () => {
		const error = await apiRequest("neighborhoods", {
			fetch: async () =>
				Response.json(
					{
						error: {
							code: "RATE_LIMITED",
							message: "Try again later.",
							fields: { q: ["Too many searches."] },
						},
					},
					{
						status: 429,
						headers: {
							"Retry-After": "30",
							"X-Request-Id": "req_1234",
						},
					},
				),
		}).catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({
			status: 429,
			code: "RATE_LIMITED",
			fields: { q: ["Too many searches."] },
			requestId: "req_1234",
			retryAfter: 30,
		});
	});

	test("rejects successful responses that fail their shared schema", async () => {
		const error = await apiRequest("neighborhoods", {
			fetch: async () => Response.json({ data: [{ id: "too-short" }] }),
		}).catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ code: "INVALID_RESPONSE", status: 200 });
	});

	test("injects the in-memory CSRF token and returns undefined for 204", async () => {
		setCsrfToken("csrf-proof");
		let init: RequestInit | undefined;

		const result = await apiRequest("logout", {
			fetch: async (_input, requestInit) => {
				init = requestInit;
				return new Response(null, { status: 204 });
			},
		});

		expect(result).toBeUndefined();
		expect(new Headers(init?.headers).get("x-csrf-token")).toBe("csrf-proof");
	});

	test("sends listing image uploads as multipart without a manual content type", async () => {
		const image = new File(["image"], "tool.png", { type: "image/png" });
		const metadata = [{ altText: "Blue hand tool", sortOrder: 0 }];
		let init: RequestInit | undefined;

		await apiRequest("listingAddImages", {
			params: { id: "listing_1234" },
			body: { images: [image], metadata },
			fetch: async (_input, requestInit) => {
				init = requestInit;
				return Response.json({ data: [] }, { status: 201 });
			},
		});

		const form = init?.body as FormData;
		expect(form).toBeInstanceOf(FormData);
		expect(form.getAll("images")).toEqual([image]);
		expect(form.get("metadata")).toBe(JSON.stringify(metadata));
		expect(new Headers(init?.headers).get("content-type")).toBeNull();
	});

	test("returns binary responses without consuming them as JSON", async () => {
		const response = new Response("image bytes", { status: 200 });
		const result = await apiRequest("listingImageGet", {
			params: { imageId: "image_1234" },
			fetch: async () => response,
		});

		expect(result).toBe(response);
		expect(response.bodyUsed).toBeFalse();
	});

	test("preserves abort failures instead of normalizing them as user-facing errors", async () => {
		const controller = new AbortController();
		const aborted = new DOMException("Request cancelled.", "AbortError");
		controller.abort();

		await expect(
			apiRequest("neighborhoods", {
				signal: controller.signal,
				fetch: async (_input, init) => {
					expect(init?.signal).toBe(controller.signal);
					throw aborted;
				},
			}),
		).rejects.toBe(aborted);
	});

	test("invalidates browser auth on protected 401s and clears the CSRF proof", async () => {
		let invalidations = 0;
		const unsubscribe = subscribeToAuthInvalidation(() => {
			invalidations += 1;
		});

		try {
			setCsrfToken("csrf-proof");
			await expect(
				apiRequest("feed", {
					fetch: async () =>
						Response.json(
							{
								error: {
									code: "UNAUTHORIZED",
									message: "Your session has expired.",
								},
							},
							{ status: 401 },
						),
				}),
			).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
			expect(invalidations).toBe(1);

			let headers: Headers | undefined;
			await apiRequest("logout", {
				fetch: async (_input, init) => {
					headers = new Headers(init?.headers);
					return new Response(null, { status: 204 });
				},
			});
			expect(headers?.get("x-csrf-token")).toBeNull();

			unsubscribe();
			await expect(
				apiRequest("feed", {
					fetch: async () =>
						Response.json(
							{
								error: {
									code: "UNAUTHORIZED",
									message: "Your session has expired.",
								},
							},
							{ status: 401 },
						),
				}),
			).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
			expect(invalidations).toBe(1);
		} finally {
			unsubscribe();
		}
	});

	test("does not invalidate browser auth for failed login, registration, or session probes", async () => {
		let invalidations = 0;
		const unsubscribe = subscribeToAuthInvalidation(() => {
			invalidations += 1;
		});

		try {
			await expect(
				apiRequest("login", {
					body: { email: "alex@example.test", password: "valid-pass" },
					fetch: async () =>
						Response.json(
							{
								error: {
									code: "UNAUTHORIZED",
									message: "Invalid email or password.",
								},
							},
							{ status: 401 },
						),
				}),
			).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
			await expect(
				apiRequest("register", {
					body: {
						name: "Alex Neighbor",
						email: "alex@example.test",
						password: "valid-pass",
						neighborhoodId: "neighborhood_1234",
					},
					fetch: async () =>
						Response.json(
							{
								error: {
									code: "UNAUTHORIZED",
									message: "Registration is unavailable.",
								},
							},
							{ status: 401 },
						),
				}),
			).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
			await expect(
				apiRequest("session", {
					fetch: async () =>
						Response.json(
							{
								error: {
									code: "UNAUTHORIZED",
									message: "Your session has expired.",
								},
							},
							{ status: 401 },
						),
				}),
			).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
			expect(invalidations).toBe(0);
		} finally {
			unsubscribe();
		}
	});
});

test("safeRedirectTarget accepts decoded internal paths and rejects open redirects", () => {
	expect(safeRedirectTarget("?redirect=%2Ffeed%3Fq%3Dtools", "/")).toBe(
		"/feed?q=tools",
	);
	expect(safeRedirectTarget("?redirect=%2F%2Fattacker.test", "/feed")).toBe(
		"/feed",
	);
	expect(safeRedirectTarget("?redirect=%2F%5C%5Cattacker.test", "/feed")).toBe(
		"/feed",
	);
	expect(safeRedirectTarget("?redirect=%2Ffeed%0Aalert", "/feed")).toBe(
		"/feed",
	);
	expect(
		safeRedirectTarget("?redirect=https%3A%2F%2Fattacker.test", "/feed"),
	).toBe("/feed");
});
