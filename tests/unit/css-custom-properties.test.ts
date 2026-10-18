import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../../src");

function filesUnder(dir: string, extensions: string[]): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return filesUnder(path, extensions);
		return extensions.some((extension) => path.endsWith(extension)) ? [path] : [];
	});
}

const styleSheets = filesUnder(join(SRC, "styles"), [".css"]).map((path) => readFileSync(path, "utf8"));
const scriptsAndMarkup = filesUnder(SRC, [".ts", ".html"]).map((path) => readFileSync(path, "utf8"));

/** Names declared in a stylesheet, set from script, or written inline in markup. */
const definedNames = new Set<string>();
for (const source of [...styleSheets, ...scriptsAndMarkup]) {
	// A declaration starts a line or follows `{`, `;` or whitespace; this skips BEM names like `.icon--danger:hover`.
	for (const match of source.matchAll(/(?:^|[\s{;])(--[\w-]+)\s*:/gm)) definedNames.add(match[1]);
	for (const match of source.matchAll(/setProperty\(\s*["'`](--[\w-]+)/g)) definedNames.add(match[1]);
}

describe("stylesheet custom properties", () => {
	it("defines every custom property a stylesheet reads without a fallback", () => {
		const undefinedNames = new Set<string>();
		for (const css of styleSheets) {
			// `var(--name)` with no comma has nothing to fall back on when the name is missing.
			for (const match of css.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
				if (!definedNames.has(match[1])) undefinedNames.add(match[1]);
			}
		}
		expect([...undefinedNames].sort()).toEqual([]);
	});
});
