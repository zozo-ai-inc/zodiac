import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { optimize } from "@tailwindcss/node";
import { describe, expect, it } from "vitest";

const STYLES_DIR = join(__dirname, "../../src/styles");

const stylesheets = readdirSync(STYLES_DIR, { recursive: true, encoding: "utf8" })
	.filter((path) => path.endsWith(".css"))
	.map((path) => join(STYLES_DIR, path));

describe("production CSS build", () => {
	// Chromium only honors the unprefixed property, so a rule minified down to the -webkit- form loses its blur in prod.
	it.each(stylesheets.map((path) => [relative(STYLES_DIR, path), path]))(
		"keeps unprefixed backdrop-filter after minification in %s",
		(_name, path) => {
			const { code } = optimize(readFileSync(path, "utf8"), { minify: true });
			const rules = code.match(/[^{}]+\{[^{}]*\}/g) ?? [];
			const selectorsMissingBlur = rules
				.filter((rule) => /-webkit-backdrop-filter:/.test(rule) && !/[{;]backdrop-filter:/.test(rule))
				.map((rule) => rule.slice(0, rule.indexOf("{")).trim());

			expect(
				selectorsMissingBlur,
				"selectors without unprefixed backdrop-filter in the production build"
			).toEqual([]);
		}
	);
});
