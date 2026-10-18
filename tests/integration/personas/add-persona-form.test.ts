import { beforeEach, describe, expect, it, vi } from "vitest";

import { bootstrapDom } from "../../helpers/dom";

// Saving only fails on the cloud-sync path (locked sync or a failed push), which a browser test cannot reach
// without a signed-in, unlocked sync account. These tests mount the real form component and stand the persona
// service in for the sync boundary, returning what it returns when the push fails.
const serviceState = vi.hoisted(() => ({
	add: vi.fn(),
	edit: vi.fn(),
	closeOverlay: vi.fn()
}));

vi.mock("../../../src/services/Personality.service", () => ({
	add: serviceState.add,
	edit: serviceState.edit
}));

vi.mock("../../../src/services/Overlay.service", () => ({
	closeOverlay: serviceState.closeOverlay
}));

vi.mock("../../../src/services/Toast.service", () => ({
	info: vi.fn(),
	warn: vi.fn(),
	danger: vi.fn()
}));

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((promiseResolve) => {
		resolve = promiseResolve;
	});
	return { promise, resolve };
}

async function flushPromises(): Promise<void> {
	for (let i = 0; i < 5; i++) await Promise.resolve();
}

async function mountForm(personaId = ""): Promise<HTMLFormElement> {
	vi.resetModules();
	bootstrapDom(`
		<form id="form-add-personality">
			<input name="id" value="${personaId}" />
			<input name="name" value="Ada" />
			<div class="step">
				<button id="btn-add-tone-example" type="button">Add</button>
			</div>
			<button class="btn-stepper-submit" type="submit">Submit</button>
		</form>
	`);
	await import("../../../src/components/static/AddPersonalityForm.component");
	return document.querySelector<HTMLFormElement>("#form-add-personality")!;
}

function submit(form: HTMLFormElement): void {
	form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
}

describe("add persona form", () => {
	beforeEach(() => {
		serviceState.add.mockReset();
		serviceState.edit.mockReset();
		serviceState.closeOverlay.mockReset();
	});

	it("stays open with its input when creating a persona fails to save", async () => {
		serviceState.add.mockResolvedValue(false);
		const form = await mountForm();

		submit(form);
		await flushPromises();

		expect(serviceState.add).toHaveBeenCalledTimes(1);
		expect(serviceState.closeOverlay, "a failed save should not close and wipe the form").not.toHaveBeenCalled();
		expect(form.querySelector<HTMLInputElement>('input[name="name"]')!.value).toBe("Ada");
	});

	it("stays open when editing a persona fails to save", async () => {
		serviceState.edit.mockResolvedValue(false);
		const form = await mountForm("persona-ada");

		submit(form);
		await flushPromises();

		expect(serviceState.edit).toHaveBeenCalledTimes(1);
		expect(serviceState.closeOverlay, "a failed save should not close and wipe the form").not.toHaveBeenCalled();
	});

	it("closes once a save succeeds", async () => {
		serviceState.add.mockResolvedValue(true);
		const form = await mountForm();

		submit(form);
		await flushPromises();

		expect(serviceState.closeOverlay).toHaveBeenCalledTimes(1);
	});

	it("saves only once when submitted again while the first save is still running", async () => {
		const pending = deferred<boolean>();
		serviceState.add.mockReturnValue(pending.promise);
		const form = await mountForm();

		submit(form);
		submit(form);
		pending.resolve(true);
		await flushPromises();

		expect(serviceState.add, "a double submit should not create the persona twice").toHaveBeenCalledTimes(1);
	});
});
