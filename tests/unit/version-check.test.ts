import { describe, expect, it } from "vitest";

import { getDeployUpdate, getReleaseUpdate, isNewerVersion } from "../../src/utils/versionCheck";

describe("deploy update check", () => {
	it("reports nothing when the deployed build is the running build", () => {
		expect(getDeployUpdate({ buildId: "abc123", version: "1.8.9" }, "abc123")).toBeNull();
	});

	it("reports a deploy when the deployed build differs from the running build", () => {
		expect(getDeployUpdate({ buildId: "def456", version: "1.8.9" }, "abc123")).toEqual({
			kind: "deploy",
			buildId: "def456"
		});
	});

	it("ignores a failed request", () => {
		expect(getDeployUpdate(null, "abc123")).toBeNull();
	});

	it.each([
		["a non-object body", "<!doctype html>"],
		["a manifest without a build id", { version: "1.9.0" }],
		["a non-string build id", { buildId: 42 }],
		["a blank build id", { buildId: "  " }]
	])("ignores %s", (_description, manifest) => {
		expect(getDeployUpdate(manifest, "abc123")).toBeNull();
	});
});

describe("release update check", () => {
	const release = { tag_name: "v1.9.0", html_url: "https://github.com/zozo-ai-inc/zodiac/releases/tag/v1.9.0" };

	it("reports a release newer than the running version", () => {
		expect(getReleaseUpdate(release, "1.8.9")).toEqual({
			kind: "release",
			version: "1.9.0",
			url: release.html_url
		});
	});

	it("reports nothing when the latest release is the running version", () => {
		expect(getReleaseUpdate(release, "1.9.0")).toBeNull();
	});

	it("reports nothing when the running version is ahead of the latest release", () => {
		expect(getReleaseUpdate(release, "1.10.0")).toBeNull();
	});

	it("ignores a failed request", () => {
		expect(getReleaseUpdate(null, "1.8.9")).toBeNull();
	});

	it.each([
		["a payload without a tag", { html_url: release.html_url }],
		["an unparseable tag", { ...release, tag_name: "nightly" }],
		["a link that does not point at GitHub", { ...release, html_url: "https://example.com/v1.9.0" }],
		["a rate-limit error body", { message: "API rate limit exceeded" }]
	])("ignores %s", (_description, payload) => {
		expect(getReleaseUpdate(payload, "1.8.9")).toBeNull();
	});
});

describe("version comparison", () => {
	it("compares segments numerically rather than as text", () => {
		expect(isNewerVersion("1.8.10", "1.8.9")).toBe(true);
		expect(isNewerVersion("1.8.9", "1.8.10")).toBe(false);
	});

	it("treats missing trailing segments as zero", () => {
		expect(isNewerVersion("1.9", "1.9.0")).toBe(false);
		expect(isNewerVersion("1.9.1", "1.9")).toBe(true);
	});
});
