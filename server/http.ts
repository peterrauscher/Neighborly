import { z } from "zod";

import { MAX_MULTIPART_BODY_BYTES } from "../src/lib/contracts";
import type {
	CanonicalErrorCode,
	RouteContractDef,
} from "../src/lib/contracts";

export const MAX_JSON_BODY_BYTES = 64 * 1024;
const MAX_MULTIPART_PARTS = 4;
const MAX_CONCURRENT_MULTIPART_REQUESTS = 2;
let activeMultipartRequests = 0;

const acquireMultipartAdmission = (request: Request) => {
	if (activeMultipartRequests >= MAX_CONCURRENT_MULTIPART_REQUESTS) {
		void request.body?.cancel().catch(() => undefined);
		throw new HttpError("SERVICE_UNAVAILABLE");
	}

	activeMultipartRequests += 1;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		activeMultipartRequests -= 1;
	};
};

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
	preflight: unknown;
	requestId: string;
};

export type BeforeBodyContext = {
	request: Request;
	clientAddress: string | null;
	params: unknown;
	query: unknown;
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

export type BeforeBodyHook = (
	context: BeforeBodyContext,
) => unknown | Promise<unknown>;

export type RouteOptions = {
	csrfExempt?: boolean;
	beforeBody?: BeforeBodyHook;
};

type RouterRouteContract = RouteContractDef<
	z.ZodTypeAny,
	z.ZodTypeAny,
	z.ZodTypeAny,
	z.ZodTypeAny
>;

type RegisteredRoute = {
	contract: RouterRouteContract;
	handler: RouteHandler;
	csrfExempt: boolean;
	beforeBody?: BeforeBodyHook;
	parts: string[];
};

export type RouterOptions = {
	allowedOrigins: readonly string[];
	validateCsrf?: (request: Request) => boolean | Promise<boolean>;
	beforeHandle?: () => void | Promise<void>;
};

const validateContentLength = (
	request: Request,
	maximumBytes: number,
	overflowMessage: string,
) => {
	const contentLength = request.headers.get("content-length");
	if (!contentLength) return;
	const length = Number(contentLength);
	if (!Number.isSafeInteger(length) || length < 0) {
		throw new HttpError("BAD_REQUEST");
	}
	if (length > maximumBytes) {
		throw new HttpError("BAD_REQUEST", overflowMessage);
	}
};

const boundaryFailureTable = (boundary: Uint8Array): Uint8Array => {
	const failure = new Uint8Array(boundary.byteLength);
	for (
		let index = 1, prefixLength = 0;
		index < boundary.byteLength;
		index += 1
	) {
		while (prefixLength > 0 && boundary[index] !== boundary[prefixLength]) {
			const fallback = failure[prefixLength - 1] ?? 0;
			prefixLength = fallback;
		}
		if (boundary[index] === boundary[prefixLength]) {
			prefixLength += 1;
		}
		failure[index] = prefixLength;
	}
	return failure;
};

const readBoundedBody = async (
	request: Request,
	maximumBytes: number,
	overflowMessage: string,
	multipartBoundary?: Uint8Array,
): Promise<ArrayBuffer> => {
	if (!request.body) return new ArrayBuffer(0);

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	const failure = multipartBoundary
		? boundaryFailureTable(multipartBoundary)
		: undefined;
	let length = 0;
	let boundaryCount = 0;
	let boundaryPrefixLength = 0;
	try {
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			length += chunk.value.byteLength;
			if (length > maximumBytes) {
				await reader.cancel();
				throw new HttpError("BAD_REQUEST", overflowMessage);
			}
			if (multipartBoundary && failure) {
				for (const byte of chunk.value) {
					while (
						boundaryPrefixLength > 0 &&
						byte !== multipartBoundary[boundaryPrefixLength]
					) {
						const fallback = failure[boundaryPrefixLength - 1] ?? 0;
						boundaryPrefixLength = fallback;
					}
					if (byte === multipartBoundary[boundaryPrefixLength]) {
						boundaryPrefixLength += 1;
					}
					if (boundaryPrefixLength !== multipartBoundary.byteLength) {
						continue;
					}
					boundaryCount += 1;
					if (boundaryCount > MAX_MULTIPART_PARTS + 1) {
						await reader.cancel();
						throw new HttpError(
							"BAD_REQUEST",
							"Multipart request contains too many parts.",
						);
					}
					const fallback = failure[boundaryPrefixLength - 1] ?? 0;
					boundaryPrefixLength = fallback;
				}
			}
			chunks.push(chunk.value);
		}
	} finally {
		reader.releaseLock();
	}

	const body = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return body.buffer;
};

const readBoundedJson = async (request: Request): Promise<unknown> => {
	validateContentLength(
		request,
		MAX_JSON_BODY_BYTES,
		"Request body exceeds 64 KiB.",
	);
	if (!request.body) return {};

	const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
	if (!contentType.startsWith("application/json")) {
		throw new HttpError(
			"BAD_REQUEST",
			"Expected an application/json request body.",
		);
	}
	const body = await readBoundedBody(
		request,
		MAX_JSON_BODY_BYTES,
		"Request body exceeds 64 KiB.",
	);
	if (body.byteLength === 0) return {};
	try {
		return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
	} catch {
		throw new HttpError(
			"BAD_REQUEST",
			"The request body must contain valid JSON.",
		);
	}
};

const RFC_MULTIPART_BOUNDARY =
	/^[0-9A-Za-z'()+_,./:=?-](?:[0-9A-Za-z'()+_,./:=? -]{0,68}[0-9A-Za-z'()+_,./:=?-])?$/;

const multipartBoundary = (contentType: string): Uint8Array => {
	const match = /(?:^|;)\s*boundary=(?:\"([^\"]+)\"|([^;\s]+))/i.exec(
		contentType,
	);
	const boundary = match?.[1] ?? match?.[2];
	const encodedBoundary = boundary
		? new TextEncoder().encode(boundary)
		: undefined;
	if (
		!boundary ||
		!encodedBoundary ||
		encodedBoundary.byteLength > 70 ||
		!RFC_MULTIPART_BOUNDARY.test(boundary)
	) {
		throw new HttpError("BAD_REQUEST", "Multipart boundary is invalid.");
	}
	return new TextEncoder().encode(`--${boundary}`);
};

const readBoundedMultipart = async (
	request: Request,
): Promise<{ images: File[]; metadata: unknown }> => {
	const contentType = request.headers.get("content-type") ?? "";
	const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
	if (mediaType !== "multipart/form-data") {
		throw new HttpError(
			"BAD_REQUEST",
			"Expected a multipart/form-data request body.",
		);
	}
	validateContentLength(
		request,
		MAX_MULTIPART_BODY_BYTES,
		"Multipart request body exceeds the upload limit.",
	);
	const body = await readBoundedBody(
		request,
		MAX_MULTIPART_BODY_BYTES,
		"Multipart request body exceeds the upload limit.",
		multipartBoundary(contentType),
	);
	let form: FormData;
	try {
		form = await new Request(request.url, {
			method: request.method,
			headers: { "Content-Type": contentType },
			body,
		}).formData();
	} catch {
		throw new HttpError("BAD_REQUEST", "The multipart request is malformed.");
	}

	const images: File[] = [];
	let metadataText: string | undefined;
	for (const [name, value] of form.entries()) {
		if (name === "metadata") {
			if (metadataText !== undefined || typeof value !== "string") {
				throw new HttpError(
					"BAD_REQUEST",
					"Multipart metadata must occur once.",
				);
			}
			metadataText = value;
			continue;
		}
		if (name === "images") {
			if (typeof value === "string") {
				throw new HttpError("BAD_REQUEST", "Multipart images must be files.");
			}
			images.push(value);
			continue;
		}
		throw new HttpError(
			"BAD_REQUEST",
			"Multipart request contains an unsupported part.",
		);
	}

	if (metadataText === undefined) {
		return { images, metadata: undefined };
	}
	if (metadataText.includes("\uFFFD")) {
		throw new HttpError(
			"BAD_REQUEST",
			"Multipart metadata must be valid UTF-8.",
		);
	}
	try {
		return { images, metadata: JSON.parse(metadataText) };
	} catch {
		throw new HttpError(
			"BAD_REQUEST",
			"Multipart metadata must contain valid JSON.",
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
	if (!headers.has("Cache-Control")) headers.set("Cache-Control", "no-store");
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
		options: RouteOptions = {},
	): this {
		this.#routes.push({
			contract,
			handler,
			csrfExempt: options.csrfExempt ?? false,
			beforeBody: options.beforeBody,
			parts: contract.path.split("/").filter(Boolean),
		});
		return this;
	}

	readonly fetch = async (
		request: Request,
		clientAddress: string | null = null,
	): Promise<Response> => {
		const requestId = crypto.randomUUID();
		let releaseMultipartAdmission: (() => void) | undefined;

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
				if (
					!origin ||
					(origin !== url.origin && !this.#allowedOrigins.has(origin))
				) {
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
			const preflight =
				!SAFE_METHODS.has(request.method) && route.beforeBody
					? await route.beforeBody({
							request,
							clientAddress,
							params: parsedParams,
							query: parsedQuery,
							requestId,
						})
					: undefined;
			let requestBody: unknown;
			if (SAFE_METHODS.has(request.method)) {
				requestBody = {};
			} else if (route.contract.requestEncoding === "multipart") {
				releaseMultipartAdmission = acquireMultipartAdmission(request);
				requestBody = await readBoundedMultipart(request);
			} else {
				requestBody = await readBoundedJson(request);
			}
			const parsedBody = parseWithSchema(route.contract.body, requestBody);

			const result = await route.handler({
				request,
				clientAddress,
				params: parsedParams,
				query: parsedQuery,
				body: parsedBody,
				preflight,
				requestId,
			});
			if (route.contract.responseEncoding === "binary") {
				const binaryResponse = z.instanceof(Response).safeParse(result);
				if (!binaryResponse.success) throw new HttpError("INTERNAL_ERROR");
				if (binaryResponse.data.status !== route.contract.successStatus) {
					throw new HttpError("INTERNAL_ERROR");
				}
				const headers = new Headers(binaryResponse.data.headers);
				withSecurityHeaders(headers, requestId);
				return new Response(binaryResponse.data.body, {
					status: binaryResponse.data.status,
					headers,
				});
			}

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
		} finally {
			releaseMultipartAdmission?.();
		}
	};
}
