import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const STYLES = join(__dirname, "../../src/styles");
const THEMES = join(STYLES, "themes");

type Rgb = [number, number, number];

function declarations(css: string): Map<string, string> {
	return new Map(Array.from(css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g), (match) => [match[1], match[2].trim()]));
}

const palettes = readdirSync(THEMES)
	.filter((file) => file.endsWith(".css"))
	.map((file) => ({
		name: file.replace(/\.css$/, ""),
		tokens: declarations(readFileSync(join(THEMES, file), "utf8"))
	}));

function colorsIn(value: string): Rgb[] {
	const hex = Array.from(value.matchAll(/#([0-9a-f]{6})(?:[0-9a-f]{2})?\b/gi), (match) => {
		const digits = match[1];
		return [0, 2, 4].map((offset) => parseInt(digits.slice(offset, offset + 2), 16)) as Rgb;
	});
	const functional = Array.from(
		value.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g),
		(match) => [Number(match[1]), Number(match[2]), Number(match[3])] as Rgb
	);
	return [...hex, ...functional];
}

function hueOf([r, g, b]: Rgb): number {
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	if (max === min) return 0;
	const delta = max - min;
	const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
	return (hue * 60 + 360) % 360;
}

function luminance(rgb: Rgb): number {
	const [r, g, b] = rgb.map((channel) => {
		const value = channel / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}

describe("theme palettes", () => {
	it("keeps every chromatic colour in a palette near that palette's primary hue", () => {
		// Status colours (errors, warnings, plan tiers) are meant to read the same in every palette.
		const sharedMeaning = /error|danger|warning|success|tier|price/;
		const strays: string[] = [];
		for (const { name, tokens } of palettes) {
			if (name.startsWith("monochrome")) continue;
			const primaryHue = hueOf(colorsIn(tokens.get("--primary") ?? "")[0]);
			for (const [token, value] of tokens) {
				if (sharedMeaning.test(token)) continue;
				for (const color of colorsIn(value)) {
					// Near-greys carry no hue worth matching.
					if (Math.max(...color) - Math.min(...color) < 0.12 * 255) continue;
					const distance = Math.abs(((hueOf(color) - primaryHue + 540) % 360) - 180);
					if (distance > 60) strays.push(`${name} ${token}: ${value}`);
				}
			}
		}
		expect(strays).toEqual([]);
	});

	it("gives primary button text at least 4.5:1 contrast in every palette", () => {
		const pairs = [
			["--button-fg", "--primary"],
			["--onboarding-btn-primary-text", "--onboarding-btn-primary-bg"]
		];
		const unreadable: string[] = [];
		for (const { name, tokens } of palettes) {
			for (const [fg, bg] of pairs) {
				const ratio = contrast(colorsIn(tokens.get(fg) ?? "")[0], colorsIn(tokens.get(bg) ?? "")[0]);
				if (ratio < 4.5) unreadable.push(`${name} ${fg} on ${bg}: ${ratio.toFixed(2)}:1`);
			}
		}
		expect(unreadable).toEqual([]);
	});
});

function stylesheets(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return stylesheets(path);
		return path.endsWith(".css") ? [readFileSync(path, "utf8")] : [];
	});
}

describe("shorthand tokens", () => {
	it("consumes border and outline tokens that already hold a width and style as the whole value", () => {
		const css = stylesheets(STYLES);
		const shorthandTokens = new Set<string>();
		for (const sheet of css) {
			for (const [token, value] of declarations(sheet)) {
				if (/^\d[\w.]*\s+(solid|dashed|dotted|double)\b/.test(value)) shorthandTokens.add(token);
			}
		}
		// `1px solid var(--x)` with --x = `1px solid #abc` is invalid, so the border silently disappears.
		const doubled: string[] = [];
		for (const sheet of css) {
			for (const match of sheet.matchAll(
				/(?:border|outline)[\w-]*:\s*\S+\s+(?:solid|dashed|dotted)\s+var\((--[\w-]+)/g
			)) {
				if (shorthandTokens.has(match[1])) doubled.push(match[0]);
			}
		}
		expect(doubled).toEqual([]);
	});
});
