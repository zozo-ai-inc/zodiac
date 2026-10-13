export type AppUpdate = { kind: "deploy"; buildId: string } | { kind: "release"; version: string; url: string };

const RELEASE_URL_PREFIX = "https://github.com/";

/**
 * Reads this origin's `version.json` and reports a deploy whose build differs from the running one.
 * A failed request or a non-manifest response (such as an HTML fallback page) reports nothing.
 */
export function getDeployUpdate(manifest: unknown, currentBuildId: string): AppUpdate | null {
	if (!manifest || typeof manifest !== "object") {
		return null;
	}

	const { buildId } = manifest as Record<string, unknown>;
	if (typeof buildId !== "string" || !buildId.trim() || buildId === currentBuildId) {
		return null;
	}

	return { kind: "deploy", buildId };
}

/**
 * Reads GitHub's latest-release payload and reports a release newer than the running version.
 */
export function getReleaseUpdate(release: unknown, currentVersion: string): AppUpdate | null {
	if (!release || typeof release !== "object") {
		return null;
	}

	const { tag_name: tagName, html_url: url } = release as Record<string, unknown>;
	if (typeof tagName !== "string" || typeof url !== "string" || !url.startsWith(RELEASE_URL_PREFIX)) {
		return null;
	}

	const version = tagName.trim().replace(/^v/i, "");
	if (!isNewerVersion(version, currentVersion)) {
		return null;
	}

	return { kind: "release", version, url };
}

export function isNewerVersion(candidate: string, current: string): boolean {
	const candidateParts = parseVersion(candidate);
	const currentParts = parseVersion(current);
	if (!candidateParts || !currentParts) {
		return false;
	}

	for (let index = 0; index < Math.max(candidateParts.length, currentParts.length); index++) {
		const difference = (candidateParts[index] ?? 0) - (currentParts[index] ?? 0);
		if (difference !== 0) {
			return difference > 0;
		}
	}

	return false;
}

function parseVersion(version: string): number[] | null {
	if (!/^\d+(\.\d+)*$/.test(version)) {
		return null;
	}

	return version.split(".").map(Number);
}
