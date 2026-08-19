import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, transformWithEsbuild } from "vite";

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [
		{
			name: "transform-legacy-jsx",
			enforce: "pre",
			async transform(code, id) {
				const normalizedId = id.split("?")[0];
				if (!/[\\/]src[\\/].*\.js$/.test(normalizedId)) {
					return null;
				}
				const transformed = await transformWithEsbuild(code, normalizedId, {
					loader: "jsx",
					jsx: "automatic",
				});
				return { code: transformed.code };
			},
		},
		react(),
	],
	optimizeDeps: {
		esbuildOptions: {
			loader: {
				".js": "jsx",
			},
		},
	},
	resolve: {
		alias: {
			components: resolve(projectRoot, "src/components"),
			contexts: resolve(projectRoot, "src/contexts"),
			pages: resolve(projectRoot, "src/pages"),
			realm: resolve(projectRoot, "src/realm"),
		},
	},
	server: {
		proxy: {
			"/api": {
				target: "http://127.0.0.1:3001",
				changeOrigin: true,
			},
		},
	},
});
