import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createApp, createServerHandler } from "./app";
import { createStaticHandler } from "./static";

const ORIGIN = "http://neighborly.test";
const ASSET_SOURCE = "export const neighborly = true;\n";

type StaticFixture = {
	distPath: string;
};
const withStaticFixture = async <T>(
	callback: (fixture: StaticFixture) => Promise<T>,
): Promise<T> => {
	const distPath = await mkdtemp(join(tmpdir(), "neighborly-static-"));
	await mkdir(join(distPath, "assets"), { recursive: true });
	await Promise.all([
		writeFile(join(distPath, "index.html"), "<main>Neighborly</main>"),
		writeFile(join(distPath, "assets", "app-abc12345.js"), ASSET_SOURCE),
	]);

	try {
		return await callback({ distPath });
	} finally {
		await rm(distPath, { recursive: true, force: true });
	}
};

const request = (path: string, method = "GET") =>
	new Request(`${ORIGIN}${path}`, { method });

const rawRequest = (path: string, method = "GET") =>
	({ method, url: `${ORIGIN}${path}` }) as Request;

describe("static SPA handler", () => {
	test("serves exact assets with immutable caching and security headers", async () => {
		await withStaticFixture(async ({ distPath }) => {
			const response = await createStaticHandler({ distPath })(
				request("/assets/app-abc12345.js"),
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toContain("javascript");
			expect(response.headers.get("cache-control")).toBe(
				"public, max-age=31536000, immutable",
			);
			expect(response.headers.get("x-content-type-options")).toBe("nosniff");
			expect(response.headers.get("x-frame-options")).toBe("DENY");
			expect(await response.text()).toBe(ASSET_SOURCE);
		});
	});

	test("falls back to the SPA index only for extensionless routes", async () => {
		await withStaticFixture(async ({ distPath }) => {
			const staticHandler = createStaticHandler({ distPath });
			const deepRoute = await staticHandler(request("/listings/ladder"));
			expect(deepRoute.status).toBe(200);
			expect(deepRoute.headers.get("cache-control")).toBe(
				"no-store, no-cache, must-revalidate",
			);
			expect(await deepRoute.text()).toBe("<main>Neighborly</main>");

			const missingAsset = await staticHandler(
				request("/assets/not-present.js"),
			);
			expect(missingAsset.status).toBe(404);
			expect(missingAsset.headers.get("cache-control")).toBe(
				"no-store, no-cache, must-revalidate",
			);
			expect(missingAsset.headers.get("x-content-type-options")).toBe(
				"nosniff",
			);
		});
	});

	test("returns GET-equivalent headers without a body for HEAD", async () => {
		await withStaticFixture(async ({ distPath }) => {
			const response = await createStaticHandler({ distPath })(
				request("/assets/app-abc12345.js", "HEAD"),
			);

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toContain("javascript");
			expect(response.headers.get("content-length")).toBe(
				String(ASSET_SOURCE.length),
			);
			expect(response.headers.get("cache-control")).toBe(
				"public, max-age=31536000, immutable",
			);
			expect(await response.text()).toBe("");
		});
	});

	test("rejects literal, encoded, and backslash traversal paths", async () => {
		await withStaticFixture(async ({ distPath }) => {
			const staticHandler = createStaticHandler({ distPath });
			for (const path of [
				"/assets/../index.html",
				"/assets/%2e%2e/index.html",
				"/assets/%252e%252e/index.html",
				"/assets%5c..%5cindex.html",
			]) {
				const response = await staticHandler(rawRequest(path));
				expect(response.status).toBe(404);
			}
		});
	});

	test("keeps API paths in the API handler, including API 404s", async () => {
		await withStaticFixture(async ({ distPath }) => {
			const database = new Database(":memory:");
			try {
				const handler = createServerHandler(
					createApp({
						db: database,
						seed: false,
						allowedOrigins: [ORIGIN],
					}),
					createStaticHandler({ distPath }),
				);

				const apiResponse = await handler(request("/api/not-a-route"));
				expect(apiResponse.status).toBe(404);
				expect(apiResponse.headers.get("content-type")).toContain(
					"application/json",
				);
				expect(await apiResponse.json()).toMatchObject({
					error: { code: "NOT_FOUND" },
				});

				const staticResponse = await handler(request("/not-a-route"));
				expect(staticResponse.status).toBe(200);
				expect(await staticResponse.text()).toBe("<main>Neighborly</main>");
			} finally {
				database.close();
			}
		});
	});
});
