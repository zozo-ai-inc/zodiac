import basicSsl from "@vitejs/plugin-basic-ssl";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { APP_VERSION } from "./src/constants/App";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Publishes the build's identity beside the bundle so a loaded client can detect a newer deploy.
function versionManifest(): Plugin {
	const buildId = process.env.CF_PAGES_COMMIT_SHA ?? Date.now().toString(36);

	return {
		name: "zodiac:version-manifest",
		apply: "build",
		config: () => ({ define: { __BUILD_ID__: JSON.stringify(buildId) } }),
		generateBundle() {
			this.emitFile({
				type: "asset",
				fileName: "version.json",
				source: JSON.stringify({ buildId, version: APP_VERSION })
			});
		}
	};
}

export default defineConfig({
	root: "src",
	plugins: [basicSsl(), tailwindcss(), versionManifest()],
	build: {
		target: "esnext",
		outDir: "../dist",
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: fromRoot("./src/index.html"),
				privacy: fromRoot("./src/privacy-policy.html"),
				terms: fromRoot("./src/terms-of-service.html")
			}
		}
	}
});
