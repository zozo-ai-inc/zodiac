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

const css = filesUnder(join(SRC, "styles"), [".css"])
	.map((path) => readFileSync(path, "utf8"))
	.join("\n");
const sources = filesUnder(SRC, [".ts", ".html"]).map((path) => readFileSync(path, "utf8"));

/** Innermost CSS rules as [selector list, declarations]. Nested and @media rules are visited on their own. */
const rules = Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g), (match) => [match[1].trim(), match[2]] as const);

function hasRuleFor(className: string): boolean {
	return new RegExp(`\\.${className}(?![\\w-])`).test(css);
}

/** Class lists written in markup or component templates. */
function classLists(): string[][] {
	const lists: string[][] = [];
	for (const source of sources) {
		for (const match of source.matchAll(/class(?:Name)?\s*=\s*["'`]([^"'`]*)["'`]/g)) {
			lists.push(match[1].split(/\s+/).filter((name) => /^[a-z][\w-]*$/.test(name)));
		}
		for (const match of source.matchAll(/classList\.add\(([^)]*)\)/g)) {
			lists.push(Array.from(match[1].matchAll(/["'`]([\w-]+)["'`]/g), (name) => name[1]));
		}
	}
	return lists;
}

describe("class usage", () => {
	it("never pairs .btn-textual with a class that paints its own background", () => {
		// .btn-textual sets `background: transparent !important`, so any plain background on a paired class is lost.
		// Generic base and state classes only meet backgrounds through other features' scoped rules.
		const generic = new Set(["btn-textual", "btn", "hidden", "material-symbols-outlined"]);
		const conflicts = new Set<string>();
		for (const list of classLists()) {
			if (!list.includes("btn-textual")) continue;
			for (const className of list) {
				if (generic.has(className)) continue;
				const subject = new RegExp(`\\.${className}(?![\\w-])[^\\s>+~]*$`);
				for (const [selectors, body] of rules) {
					const paintsBackground = /(^|[;\s])background(-color)?\s*:(?![^;]*!important)/.test(body);
					if (!paintsBackground) continue;
					if (selectors.split(",").some((selector) => subject.test(selector.trim()))) {
						conflicts.add(`${className} (${selectors.replace(/\s+/g, " ")})`);
					}
				}
			}
		}
		expect([...conflicts].sort()).toEqual([]);
	});

	it("styles every modifier class that markup or components apply", () => {
		const modifiers = new Set(
			classLists()
				.flat()
				.filter((name) => name.includes("--"))
		);
		expect([...modifiers].filter((name) => !hasRuleFor(name)).sort()).toEqual([]);
	});
});
