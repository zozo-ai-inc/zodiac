import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { bootstrapAppDom } from "../../helpers/dom";

describe("Surface service", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.useFakeTimers();
		bootstrapAppDom();
		// Test-only surfaces, hosted on the real plane.
		document.querySelector("#surface-plane")!.insertAdjacentHTML(
			"beforeend",
			`
				<div id="adaptive-test-sheet" class="adaptive-sheet hidden">
					<button type="button">Close</button>
				</div>
				<div id="plain-test-surface" class="hidden">
					<button type="button">Close</button>
				</div>
			`
		);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("marks the surface plane as blurred while an adaptive sheet is visible", async () => {
		const surfaceService = await import("../../../src/services/Surface.service");
		const surfacePlane = document.querySelector<HTMLElement>("#surface-plane");

		surfaceService.show("adaptive-test-sheet");
		await vi.runOnlyPendingTimersAsync();

		expect(surfacePlane?.classList.contains("surface-plane--active")).toBe(true);
		expect(surfacePlane?.classList.contains("surface-plane--blurred")).toBe(true);

		surfaceService.close("adaptive-test-sheet");

		expect(surfacePlane?.classList.contains("surface-plane--active")).toBe(false);
		expect(surfacePlane?.classList.contains("surface-plane--blurred")).toBe(false);

		await vi.runOnlyPendingTimersAsync();

		expect(surfacePlane?.classList.contains("surface-plane--active")).toBe(false);
		expect(surfacePlane?.classList.contains("surface-plane--blurred")).toBe(false);
	});

	it("does not apply adaptive sheet blur for plain transient surfaces", async () => {
		const surfaceService = await import("../../../src/services/Surface.service");
		const surfacePlane = document.querySelector<HTMLElement>("#surface-plane");

		surfaceService.show("plain-test-surface");
		await vi.runOnlyPendingTimersAsync();

		expect(surfacePlane?.classList.contains("surface-plane--active")).toBe(true);
		expect(surfacePlane?.classList.contains("surface-plane--blurred")).toBe(false);
	});
});
