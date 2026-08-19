import type { z } from "zod";

import type {
	CanonicalErrorCode,
	RouteContractDef,
} from "../src/lib/contracts";

export const MAX_JSON_BODY_BYTES = 64 * 1024;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const ERROR_STATUS: Record<CanonicalErrorCode, number> = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	RATE_LIMITED: 429,
	VALIDATION_ERROR: 422,
	DEMO_READ_ONLY: 403,
	HAS_DEPENDENT_HISTORY: 409,
	STALE_TRANSITION: 409,
	NEIGHBORHOOD_CHANGE_BLOCKED: 409,
	SERVICE_UNAVAILABLE: 503,
	INTERNAL_ERROR: 500,
};

const ERROR_MESSAGES: Record<CanonicalErrorCode, string> = {
	BAD_REQUEST: "The request could not be processed.",
	UNAUTHORIZED: "Authentication is required.",
	FORBIDDEN: "You do not have permission to perform this action.",
	NOT_FOUND: "The requested resource was not found.",
	CONFLICT: "The request conflicts with the current state.",
	RATE_LIMITED: "Too many requests. Please try again later.",
	VALIDATION_ERROR: "One or more fields are invalid.",
	DEMO_READ_ONLY: "The demo account is read-only.",
	HAS_DEPENDENT_HISTORY: "This resource has dependent history.",
	STALE_TRANSITION: "This action is no longer available.",
	NEIGHBORHOOD_CHANGE_BLOCKED:
		"Finish or resolve active exchanges before changing neighborhoods.",
	SERVICE_UNAVAILABLE: "The service is temporarily unavailable.",
	INTERNAL_ERROR: "An unexpected error occurred.",
};

type ErrorFields = Record<string, unknown> | undefined;

export class HttpError extends Error {
	readonly status: number;
	readonly code: CanonicalErrorCode;
	readonly fields: ErrorFields;

	constructor(
		code: CanonicalErrorCode,
		message = ERROR_MESSAGES[code],
		fields?: ErrorFields,
		status = ERROR_STATUS[code],
	) {
		super(message);
		this.name = "HttpError";
		this.code = code;
		this.status = status;
		this.fields = fields;
	}
}

export type RouteContext = {
	request: Request;
	clientAddress: string | null;
	params: unknown;
	query: unknown;
	body: unknown;
	requestId: string;
};

type ExplicitHandlerResult = {
	body: unknown;
	headers?: HeadersInit;
};

export type HandlerResult = unknown | ExplicitHandlerResult;

const isExplicitHandlerResult = (
	value: HandlerResult,
): value is ExplicitHandlerResult =>
	typeof value === "object" &&
	value !== null &&
	"body" in value &&
	!Array.isArray(value);

export type RouteHandler = (
	context: RouteContext,
) => HandlerResult | Promise<HandlerResult>;

type RegisteredRoute = {
	contract: RouteContractDef<
		z.ZodTypeAny,
		z.ZodTypeAny,
		z.ZodTypeAny,
		z.ZodTypeAny
	>;
	handler: RouteHandler;
	csrfExempt: boolean;
	parts: string[];
};

export type RouterOptions = {
	allowedOrigins: readonly string[];
	validateCsrf?: (request: Request) => boolean | Promise<boolean>;
	beforeHandle?: () => void | Promise<void>;
};

const readBoundedJson = async (request: Request): Promise<unknown> => {
	const contentLength = request.headers.get("content-length");
	if (contentLength) {
		const length = Number(contentLength);
		if (!Number.isSafeInteger(length) || length < 0) {
			throw new HttpError("BAD_REQUEST");
		}
		if (length > MAX_JSON_BODY_BYTES) {
			throw new HttpError("BAD_REQUEST", "Request body exceeds 64 KiB.");
		}
	}

	if (!request.body) return {};

	const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
	if (!contentType.startsWith("application/json")) {
		throw new HttpError(
			"BAD_REQUEST",
			"Expected an application/json request body.",
		);
	}

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let length = 0;

	try {
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			length += chunk.value.byteLength;
			if (length > MAX_JSON_BODY_BYTES) {
				throw new HttpError("BAD_REQUEST", "Request body exceeds 64 KiB.");
			}
			chunks.push(chunk.value);
		}
	} finally {
		reader.releaseLock();
	}

	if (length === 0) return {};

	const body = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}

	try {
		return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
	} catch {
		throw new HttpError(
			"BAD_REQUEST",
			"The request body must contain valid JSON.",
		);
	}
};

const parsePathParams = (
	pattern: readonly string[],
	pathname: string,
): Record<string, unknown> | null => {
	const parts = pathname.split("/").filter(Boolean);
	if (parts.length !== pattern.length) return null;

	const params: Record<string, unknown> = {};
	for (let index = 0; index < pattern.length; index += 1) {
		const expected = pattern[index];
		const received = parts[index];
		if (!expected || !received) return null;

		if (expected.startsWith(":")) {
			try {
				params[expected.slice(1)] = decodeURIComponent(received);
			} catch {
				return null;
			}
		} else if (expected !== received) {
			return null;
		}
	}

	return params;
};

const queryObject = (url: URL): Record<string, unknown> => {
	const result: Record<string, unknown> = {};
	for (const [key, value] of url.searchParams) {
		const current = result[key];
		if (current === undefined) {
			result[key] = value;
		} else if (Array.isArray(current)) {
			current.push(value);
		} else {
			result[key] = [current, value];
		}
	}
	return result;
};

const validationFields = (error: z.ZodError): Record<string, string[]> => {
	const fields: Record<string, string[]> = {};
	for (const issue of error.issues) {
		const path = issue.path.length > 0 ? issue.path.join(".") : "_form";
		const messages = fields[path];
		if (messages) {
			messages.push(issue.message);
		} else {
			fields[path] = [issue.message];
		}
	}
	return fields;
};

const parseWithSchema = <T>(schema: z.ZodType<T>, input: unknown): T => {
	const parsed = schema.safeParse(input);
	if (!parsed.success) {
		throw new HttpError(
			"VALIDATION_ERROR",
			undefined,
			validationFields(parsed.error),
		);
	}
	return parsed.data;
};

const withSecurityHeaders = (headers: Headers, requestId: string) => {
	headers.set("X-Request-Id", requestId);
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	headers.set("X-Frame-Options", "DENY");
	headers.set("Cross-Origin-Opener-Policy", "same-origin");
	headers.set("Cross-Origin-Resource-Policy", "same-origin");
	headers.set("Cache-Control", "no-store");
};

const errorResponse = (error: HttpError, requestId: string): Response => {
	const headers = new Headers({
		"Content-Type": "application/json; charset=utf-8",
	});
	withSecurityHeaders(headers, requestId);
	return Response.json(
		{
			error: {
				code: error.code,
				message: error.message,
				...(error.fields ? { fields: error.fields } : {}),
			},
		},
		{ status: error.status, headers },
	);
};

const toHttpError = (error: unknown): HttpError => {
	if (error instanceof HttpError) return error;
	return new HttpError("INTERNAL_ERROR");
};

export class FetchRouter {
	readonly #allowedOrigins: Set<string>;
	readonly #validateCsrf?: RouterOptions["validateCsrf"];
	readonly #beforeHandle?: RouterOptions["beforeHandle"];
	readonly #routes: RegisteredRoute[] = [];

	constructor(options: RouterOptions) {
		this.#allowedOrigins = new Set(options.allowedOrigins);
		this.#validateCsrf = options.validateCsrf;
		this.#beforeHandle = options.beforeHandle;
	}

	add(
		contract: RegisteredRoute["contract"],
		handler: RouteHandler,
		options: { csrfExempt?: boolean } = {},
	): this {
		this.#routes.push({
			contract,
			handler,
			csrfExempt: options.csrfExempt ?? false,
			parts: contract.path.split("/").filter(Boolean),
		});
		return this;
	}

	readonly fetch = async (
		request: Request,
		clientAddress: string | null = null,
	): Promise<Response> => {
		const requestId = crypto.randomUUID();

		try {
			await this.#beforeHandle?.();

			const url = new URL(request.url);
			const route = this.#routes.find(
				(candidate) =>
					candidate.contract.method === request.method &&
					parsePathParams(candidate.parts, url.pathname) !== null,
			);

			if (!route) throw new HttpError("NOT_FOUND");

			if (!SAFE_METHODS.has(request.method)) {
				const origin = request.headers.get("origin");
				if (!origin || !this.#allowedOrigins.has(origin)) {
					throw new HttpError(
						"FORBIDDEN",
						"The request origin is not allowed.",
					);
				}

				if (!route.csrfExempt && this.#validateCsrf) {
					const csrfValid = await this.#validateCsrf(request);
					if (!csrfValid) {
						throw new HttpError(
							"FORBIDDEN",
							"The CSRF token is invalid or missing.",
						);
					}
				}
			}

			const params = parsePathParams(route.parts, url.pathname);
			if (!params) throw new HttpError("NOT_FOUND");

			const parsedParams = parseWithSchema(route.contract.params, params);
			const parsedQuery = parseWithSchema(
				route.contract.query,
				queryObject(url),
			);
			const parsedBody = SAFE_METHODS.has(request.method)
				? parseWithSchema(route.contract.body, {})
				: parseWithSchema(route.contract.body, await readBoundedJson(request));

			const result = await route.handler({
				request,
				clientAddress,
				params: parsedParams,
				query: parsedQuery,
				body: parsedBody,
				requestId,
			});
			const body = isExplicitHandlerResult(result) ? result.body : result;
			const headers = new Headers(
				isExplicitHandlerResult(result) ? result.headers : undefined,
			);
			withSecurityHeaders(headers, requestId);

			if (route.contract.successStatus === 204) {
				const validated = route.contract.response.safeParse(body ?? {});
				if (!validated.success) throw new HttpError("INTERNAL_ERROR");
				return new Response(null, { status: 204, headers });
			}

			const validated = route.contract.response.safeParse(body);
			if (!validated.success) throw new HttpError("INTERNAL_ERROR");
			headers.set("Content-Type", "application/json; charset=utf-8");
			return Response.json(validated.data, {
				status: route.contract.successStatus,
				headers,
			});
		} catch (error) {
			return errorResponse(toHttpError(error), requestId);
		}
	};
}
