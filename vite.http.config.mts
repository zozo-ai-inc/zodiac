import { defineConfig } from "vite";
import config from "./vite.config.mjs";

// Plain-HTTP dev server (e.g. for tooling that cannot trust the self-signed cert).
// localhost is a secure context, so clipboard and similar APIs still work.
// Honors PORT when a launcher assigns one; Vite ignores it by default.
export default defineConfig({
	...config,
	plugins: (config.plugins ?? []).filter(
		(plugin) => !(plugin && "name" in plugin && plugin.name === "vite:basic-ssl")
	),
	server: {
		...config.server,
		...(process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {})
	}
});
