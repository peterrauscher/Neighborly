import { realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

const IMMUTABLE_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
const NO_CACHE_CONTROL = "no-store, no-cache, must-revalidate";

export type StaticHandler = (request: Request) => Promise<Response>;

export type CreateStaticHandlerOptions = {
	distPath?: string;
};

type StaticFile = {
	path: string;
	size: number;
};

const isWithin = (root: string, candidate: string) => {
	const pathFromRoot = relative(root, candidate);
	return (
		pathFromRoot === "" ||
		(!pathFromRoot.startsWith(`..${sep}`) &&
			pathFromRoot !== ".." &&
			!isAbsolute(pathFromRoot))
	);
};

const rawPathname = (requestUrl: string) => {
	const authorityStart = requestUrl.indexOf("://");
	if (authorityStart === -1) return null;

	const pathStart = requestUrl.indexOf("/", authorityStart + 3);
	if (pathStart === -1) return "/";

	const queryStart = requestUrl.indexOf("?", pathStart);
	const fragmentStart = requestUrl.indexOf("#", pathStart);
	const pathEnd = [queryStart, fragmentStart]
		.filter((position) => position !== -1)
		.reduce(
			(earliest, position) => Math.min(earliest, position),
			requestUrl.length,
		);
	return requestUrl.slice(pathStart, pathEnd) || "/";
};

const decodePathSegment = (segment: string) => {
	let decoded = segment;
	for (let depth = 0; depth < 8; depth += 1) {
		try {
			const next = decodeURIComponent(decoded);
			if (next === decoded) return decoded;
			decoded = next;
		} catch {
			return null;
		}
	}
	return null;
};

const requestPathSegments = (requestUrl: string) => {
	const pathname = rawPathname(requestUrl);
	if (!pathname || !pathname.startsWith("/")) return null;

	const segments: string[] = [];
	for (const segment of pathname.split("/")) {
		if (segment === "") continue;
		const decoded = decodePathSegment(segment);
		if (
			decoded === null ||
			decoded === "." ||
			decoded === ".." ||
			decoded.includes("/") ||
			decoded.includes("\\") ||
			decoded.includes("\0")
		) {
			return null;
		}
		segments.push(decoded);
	}
	return segments;
};

const isSpaRoute = (segments: readonly string[]) => {
	if (segments[0] === "assets") return false;
	const lastSegment = segments.at(-1) ?? "";
	return !lastSegment.includes(".");
};

const addSecurityHeaders = (headers: Headers, cacheControl: string) => {
	headers.set("Cache-Control", cacheControl);
	headers.set("Cross-Origin-Opener-Policy", "same-origin");
	headers.set("Cross-Origin-Resource-Policy", "same-origin");
	headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("X-Frame-Options", "DENY");
};

const staticError = (request: Request, status: number, message: string) => {
	const headers = new Headers({
		"Content-Type": "text/plain; charset=utf-8",
	});
	addSecurityHeaders(headers, NO_CACHE_CONTROL);
	if (status === 405) headers.set("Allow", "GET, HEAD");
	return new Response(request.method === "HEAD" ? null : message, {
		status,
		headers,
	});
};

const createFileLookup = (distPath: string) => {
	const resolvedDistPath = resolve(distPath);
	let canonicalDistPath: string | undefined;

	const getCanonicalDistPath = async () => {
		if (canonicalDistPath) return canonicalDistPath;
		canonicalDistPath = await realpath(resolvedDistPath);
		return canonicalDistPath;
	};

	return async (segments: readonly string[]): Promise<StaticFile | null> => {
		const candidate = resolve(resolvedDistPath, ...segments);
		if (!isWithin(resolvedDistPath, candidate)) return null;

		try {
			const metadata = await stat(candidate);
			if (!metadata.isFile()) return null;

			const [root, canonicalCandidate] = await Promise.all([
				getCanonicalDistPath(),
				realpath(candidate),
			]);
			if (!isWithin(root, canonicalCandidate)) return null;

			return { path: canonicalCandidate, size: metadata.size };
		} catch {
			return null;
		}
	};
};

export function createStaticHandler(
	options: CreateStaticHandlerOptions = {},
): StaticHandler {
	const findFile = createFileLookup(options.distPath ?? "dist");

	return async (request) => {
		if (request.method !== "GET" && request.method !== "HEAD") {
			return staticError(request, 405, "Method Not Allowed");
		}

		const segments = requestPathSegments(request.url);
		if (!segments) return staticError(request, 404, "Not Found");

		let file = await findFile(segments);
		const servingIndex = segments.length === 1 && segments[0] === "index.html";
		let isIndex = servingIndex;
		if (!file && isSpaRoute(segments)) {
			file = await findFile(["index.html"]);
			isIndex = true;
		}
		if (!file) return staticError(request, 404, "Not Found");

		const fileBody = Bun.file(file.path);
		const headers = new Headers(new Response(fileBody).headers);
		headers.set("Content-Length", String(file.size));
		addSecurityHeaders(
			headers,
			isIndex
				? NO_CACHE_CONTROL
				: segments[0] === "assets"
					? IMMUTABLE_ASSET_CACHE_CONTROL
					: NO_CACHE_CONTROL,
		);
		return new Response(request.method === "HEAD" ? null : fileBody, {
			status: 200,
			headers,
		});
	};
}
