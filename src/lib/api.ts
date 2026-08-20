import { ZodError, type z } from "zod";

import {
	API_ROUTES,
	type CanonicalErrorCode,
	CanonicalErrorEnvelopeSchema,
	type RouteKey,
} from "./contracts";

const CSRF_HEADER = "X-CSRF-Token";
const REQUEST_ID_HEADER = "X-Request-Id";
const RETRY_AFTER_HEADER = "Retry-After";

let csrfToken: string | undefined;

type RouteSchemaPart = "params" | "query" | "body" | "response";
type SchemaInput<Schema> = Schema extends z.ZodTypeAny
	? z.input<Schema>
	: never;
type SchemaOutput<Schema> = Schema extends z.ZodTypeAny
	? z.output<Schema>
	: never;

type RouteInput<
	Key extends RouteKey,
	Part extends RouteSchemaPart,
> = SchemaInput<(typeof API_ROUTES)[Key][Part]>;
type RouteOutput<Key extends RouteKey> = SchemaOutput<
	(typeof API_ROUTES)[Key]["response"]
>;

/** Routes whose successful response intentionally has no JSON body. */
export type NoContentRouteKey =
	| "logout"
	| "listingDelete"
	| "listingDeleteImage"
	| "commentDelete"
	| "mePassword";

export type ApiRouteParams<Key extends RouteKey> = RouteInput<Key, "params">;
export type ApiRouteQuery<Key extends RouteKey> = RouteInput<Key, "query">;
export type ApiRequestBody<Key extends RouteKey> = RouteInput<Key, "body">;
export type ApiResponse<Key extends RouteKey> = Key extends NoContentRouteKey
	? undefined
	: RouteOutput<Key>;

export type FetchImplementation = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

export type ApiRequestOptions<Key extends RouteKey> = {
	params?: ApiRouteParams<Key>;
	query?: ApiRouteQuery<Key>;
	body?: ApiRequestBody<Key>;
	signal?: AbortSignal;
	/** Test-only injection point; production callers use the browser fetch. */
	fetch?: FetchImplementation;
};

export type ApiErrorCode =
	| CanonicalErrorCode
	| "NETWORK_ERROR"
	| "INVALID_RESPONSE";

export type ApiErrorDetails = {
	status: number;
	code: ApiErrorCode;
	message: string;
	fields?: Record<string, unknown>;
	requestId?: string;
	retryAfter?: number;
};

/** A normalized API failure suitable for stable UI error handling. */
export class ApiError extends Error {
	readonly status: number;
	readonly code: ApiErrorCode;
	readonly fields?: Record<string, unknown>;
	readonly requestId?: string;
	readonly retryAfter?: number;

	constructor({
		status,
		code,
		message,
		fields,
		requestId,
		retryAfter,
	}: ApiErrorDetails) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
		this.fields = fields;
		this.requestId = requestId;
		this.retryAfter = retryAfter;
	}
}

/** Abort failures are control flow and must never be rendered as API errors. */
export const isAbortError = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	"name" in error &&
	(error as { name?: unknown }).name === "AbortError";

/** Keeps the opaque CSRF proof in process memory only. */
export const setCsrfToken = (token: string | null | undefined) => {
	csrfToken = token?.trim() || undefined;
};

/** Clears the in-memory CSRF proof after logout or session revocation. */
export const clearCsrfToken = () => {
	csrfToken = undefined;
};

const SAFE_REDIRECT_BASE = "https://neighborly.invalid";

const hasUnsafeRedirectCharacter = (value: string) => {
	for (let index = 0; index < value.length; index += 1) {
		const code = value.charCodeAt(index);
		if (code <= 31 || code === 92 || code === 127) return true;
	}
	return false;
};

const normalizedInternalPath = (value: string): string | undefined => {
	if (!value.startsWith("/") || value.startsWith("//")) return undefined;

	let decoded: string;
	try {
		decoded = decodeURIComponent(value);
	} catch {
		return undefined;
	}
	if (hasUnsafeRedirectCharacter(decoded)) return undefined;

	try {
		const url = new URL(value, SAFE_REDIRECT_BASE);
		if (url.origin !== SAFE_REDIRECT_BASE) return undefined;
		const normalized = `${url.pathname}${url.search}${url.hash}`;
		return normalized.startsWith("/") && !normalized.startsWith("//")
			? normalized
			: undefined;
	} catch {
		return undefined;
	}
};

/**
 * Reads a login redirect from URL search while allowing only normalized,
 * same-origin paths. Its fixed base avoids any dependency on browser globals.
 */
export const safeRedirectTarget = (search: string, fallback = "/") =>
	normalizedInternalPath(new URLSearchParams(search).get("redirect") ?? "") ??
	normalizedInternalPath(fallback) ??
	"/";

const validationFields = (error: ZodError): Record<string, string[]> => {
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

const parseRequest = <Schema extends z.ZodTypeAny>(
	schema: Schema,
	value: unknown,
): z.output<Schema> => {
	try {
		return schema.parse(value);
	} catch (error) {
		if (error instanceof ZodError) {
			throw new ApiError({
				status: 0,
				code: "VALIDATION_ERROR",
				message: "Request validation failed.",
				fields: validationFields(error),
			});
		}
		throw error;
	}
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const hasJsonBody = (value: unknown): boolean =>
	isRecord(value) && Object.keys(value).length > 0;

const toQueryValue = (value: unknown): string => {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (typeof value === "bigint") return value.toString();
	throw new ApiError({
		status: 0,
		code: "VALIDATION_ERROR",
		message: "Query values must be serializable primitives.",
	});
};

const encodeQuery = (query: unknown): string => {
	if (!isRecord(query)) return "";

	const params = new URLSearchParams();
	for (const [key, rawValue] of Object.entries(query)) {
		if (rawValue === undefined || rawValue === null) continue;
		if (Array.isArray(rawValue)) {
			for (const value of rawValue) params.append(key, toQueryValue(value));
			continue;
		}
		params.set(key, toQueryValue(rawValue));
	}
	return params.toString();
};

const interpolatePath = (path: string, params: unknown): string => {
	if (!isRecord(params)) return path;
	const interpolated = path.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
		const value = params[key];
		if (value === undefined || value === null) {
			throw new ApiError({
				status: 0,
				code: "VALIDATION_ERROR",
				message: `Missing path parameter: ${key}.`,
				fields: { [key]: ["Required."] },
			});
		}
		return encodeURIComponent(String(value));
	});

	if (/:([A-Za-z0-9_]+)/.test(interpolated)) {
		throw new ApiError({
			status: 0,
			code: "VALIDATION_ERROR",
			message: "Route contains an unresolved path parameter.",
		});
	}
	return interpolated;
};

const toMultipartBody = (body: unknown): FormData => {
	if (
		!isRecord(body) ||
		!Array.isArray(body.images) ||
		!Array.isArray(body.metadata)
	) {
		throw new ApiError({
			status: 0,
			code: "VALIDATION_ERROR",
			message: "Multipart request data is outside the API contract.",
		});
	}

	const form = new FormData();
	for (const image of body.images) {
		form.append("images", image as Blob);
	}
	form.append("metadata", JSON.stringify(body.metadata));
	return form;
};

const retryAfterSeconds = (value: string | null): number | undefined => {
	if (!value) return undefined;
	const seconds = Number(value);
	if (Number.isFinite(seconds) && seconds >= 0) return seconds;

	const timestamp = Date.parse(value);
	if (!Number.isFinite(timestamp)) return undefined;
	return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
};

const responseDetails = (response: Response) => ({
	requestId: response.headers.get(REQUEST_ID_HEADER) ?? undefined,
	retryAfter: retryAfterSeconds(response.headers.get(RETRY_AFTER_HEADER)),
});

const parseJson = async (response: Response): Promise<unknown> => {
	try {
		return await response.json();
	} catch (error) {
		if (isAbortError(error)) throw error;
		throw new ApiError({
			status: response.status,
			code: "INVALID_RESPONSE",
			message: "The server returned an invalid JSON response.",
			...responseDetails(response),
		});
	}
};

const invalidResponse = (response: Response, message: string) =>
	new ApiError({
		status: response.status,
		code: "INVALID_RESPONSE",
		message,
		...responseDetails(response),
	});

const captureCsrfToken = (response: Response) => {
	const nextToken = response.headers.get(CSRF_HEADER);
	if (nextToken !== null) setCsrfToken(nextToken);
};

/**
 * Executes a shared API contract with validated inputs and validated output.
 * Authentication stays cookie-based; no access token is exposed or persisted.
 */
export async function apiRequest<Key extends NoContentRouteKey>(
	key: Key,
	options?: ApiRequestOptions<Key>,
): Promise<undefined>;
export async function apiRequest<
	Key extends Exclude<RouteKey, NoContentRouteKey>,
>(key: Key, options?: ApiRequestOptions<Key>): Promise<ApiResponse<Key>>;
export async function apiRequest<Key extends RouteKey>(
	key: Key,
	options: ApiRequestOptions<Key> = {},
): Promise<ApiResponse<Key>> {
	const route = API_ROUTES[key];
	const params = parseRequest(route.params, options.params ?? {});
	const query = parseRequest(route.query, options.query ?? {});
	const body = parseRequest(route.body, options.body ?? {});
	const pathname = interpolatePath(route.path, params);
	const search = encodeQuery(query);
	const headers = new Headers({ Accept: "application/json" });
	const requestBody =
		route.requestEncoding === "multipart"
			? toMultipartBody(body)
			: hasJsonBody(body)
				? JSON.stringify(body)
				: undefined;

	if (route.requestEncoding === "json" && requestBody) {
		headers.set("Content-Type", "application/json");
	}
	if (csrfToken && route.method !== "GET") {
		headers.set(CSRF_HEADER, csrfToken);
	}

	let response: Response;
	try {
		response = await (options.fetch ?? globalThis.fetch)(
			search ? `${pathname}?${search}` : pathname,
			{
				method: route.method,
				headers,
				credentials: "same-origin",
				signal: options.signal,
				...(requestBody ? { body: requestBody } : {}),
			},
		);
	} catch (error) {
		if (isAbortError(error)) throw error;
		throw new ApiError({
			status: 0,
			code: "NETWORK_ERROR",
			message: "Unable to reach the server.",
		});
	}

	captureCsrfToken(response);
	if (!response.ok) {
		const json = await parseJson(response);
		const parsed = CanonicalErrorEnvelopeSchema.safeParse(json);
		if (!parsed.success) {
			throw invalidResponse(
				response,
				"The server returned an invalid error response.",
			);
		}
		throw new ApiError({
			status: response.status,
			code: parsed.data.error.code,
			message: parsed.data.error.message,
			fields: parsed.data.error.fields,
			...responseDetails(response),
		});
	}

	if (response.status !== route.successStatus) {
		throw invalidResponse(
			response,
			`Unexpected success status ${response.status}; expected ${route.successStatus}.`,
		);
	}
	if (response.status === 204) return undefined as ApiResponse<Key>;

	if (route.responseEncoding === "binary") {
		const parsed = route.response.safeParse(response);
		if (!parsed.success) {
			throw invalidResponse(
				response,
				"The server returned a response outside the API contract.",
			);
		}
		return response as ApiResponse<Key>;
	}

	const json = await parseJson(response);
	const parsed = route.response.safeParse(json);
	if (!parsed.success) {
		throw invalidResponse(
			response,
			"The server returned a response outside the API contract.",
		);
	}
	return parsed.data as ApiResponse<Key>;
}
