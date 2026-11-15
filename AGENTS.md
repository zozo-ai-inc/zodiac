# Zodiac AI Agent Instructions

A Vite + TypeScript frontend for Google Gemini and OpenRouter APIs with local-first IndexedDB storage (Dexie) and optional Supabase cloud sync.

Github repo: zozo-ai-inc/zodiac. Backend (migrations, edge functions): `../zozo-edge`, which has its own `AGENTS.md`.

Read before working on these areas:

- Releases, version bumps, changelogs, promotion to `production`: [docs/RELEASING.md](docs/RELEASING.md)
- Image models or LoRAs: [docs/LORA_SUPPORT.md](docs/LORA_SUPPORT.md)
- Styles: [src/styles/README.md](src/styles/README.md)

## Development

```bash
npm install
npm run dev            # Local dev server with SSL
npm run build          # Type-check + production build
npm test               # Type-check + Vitest
npm run test:e2e       # Playwright
npm run sync-db-types  # Regenerate src/types/database.types.ts after schema changes
```

- `src/main.ts` runs the domain migration, then [src/app.ts](src/app.ts) initializes services in dependency order and eager-loads `components/static/*`.
- `components/static/*.component.ts` are DOM-bound singletons that query elements at module load and throw if missing. `components/dynamic/*.ts` are template factories returning HTMLElements.
- Use `npm run create-worktree -- <branch> [worktree-path] [options]` (`create-worktree:win` on Windows) to create a sibling worktree; `--help` lists the flags.
- Branch prefixes: `feature/*`, `release/*`, `bugfix/*`, `chore/*`, `hotfix/*`, `codex/*`. Issue branches use `prefix/issue-number-semantic-name`. Prefer `bugfix/*` for defects and `chore/*` for changes with no user-facing effect.
- After every code or file change, end the final response with a short `Should we commit this?` section that considers the full current worktree and answers yes or no with a brief reason.

## Release And Merge Rules

These apply even outside release work. The full process is in [docs/RELEASING.md](docs/RELEASING.md).

- Never merge or close a pull request targeting `production`, or one from a `release/*` branch into `main`, and never enable auto-merge on them. Prepare it, monitor its checks, then stop and give the user its URL, exact changes, and check status.
- Never create or publish a tagged GitHub Release, create its tag manually, or publish a draft until the user has explicitly approved the exact final title, tag, target, notes, and every change. Approval of code, an earlier draft, or the plan does not count.
- Feature and fix pull requests merge into `main`. Do not commit feature work directly to `production`.
- Do not turn on "Require branches to be up to date before merging" for `production` or add history-sync pull requests. Promotion merges existing only on `production` are expected.
- Every pull request targeting `main` needs exactly one classification label, enforced by the merge gate. Use `feature`, `enhancement`, or `bug` for user-facing changes, and write those titles as release-note candidates. Use `code improvement`, `documentation`, or `skip-changelog` otherwise.
- `PRO_REQUEST_FUNCTION_NAME` in [src/services/Supabase.service.ts](src/services/Supabase.service.ts) selects the premium edge function slot. Change the committed value only as part of a release workflow, and never promote a release pointing at `handle-pro-request-test`.

## Conventions

- **Abstractions:** do not add getters or helpers around simple exported arrays, constants, or property access. Write `IMAGE_MODELS.find((model) => model.id === selectedModel)?.maxInputImages` at the call site. Add service getters only for real complexity such as async state, caching, persistence, authorization, or shared normalization.
- **Cross-component communication:** use `CustomEvent` on `window` or `document`, which also avoids circular imports. To open settings, dispatch `open-settings` (optionally with a `page`) instead of clicking its DOM controls.
- **Dexie migrations:** schema versions in `Db.service.ts` are additive. Use `.upgrade()` for data migrations.
- **Subscription entitlements:** when plan allowance amounts change, preserve allowances already granted for the current window and apply new amounts at the next period unless the user explicitly requests otherwise. New subscriptions get the current configuration immediately. Cancellation and tier switches follow the active subscription state.
- **Styling:** no Tailwind utility classes. Tailwind is imported for its reset only, and HTML uses semantic class names. Themes are CSS custom properties in `src/styles/themes/`.

### Overlays, Surfaces, And Dropdowns

- Use `Overlay.service.ts` for full-screen flows that intentionally blur the app and use the back button, such as auth, onboarding, changelog, and persona forms.
- Use `surfaceService.show()` / `close()` from `Surface.service.ts` for transient floating surfaces that should not inherit overlay blur or the back button. Adaptive sheets belong here, on `#surface-plane`, with the `adaptive-sheet` class.
- `#surface-plane` is always mounted. Do not hide it with `display: none`; it is click-through by default and hosted surfaces opt back into pointer handling.
- Keep feature state resets in the feature component, using the `surface-closed` event dispatched after the close animation.
- Prefer `openDropdownPortal(menu, anchor)` from `src/utils/dropdownPortal.ts` for `.dropdown-menu` elements inside the sidebar or other blurred surfaces. Nested `backdrop-filter`s blur the parent's flattened backdrop and look foggy. Keep open state in the owning component and reset it in the `onClose` callback.

## Bug Fixes And Tests

- Surface every bug through a failing test before fixing it, and confirm it fails because of the bug. A fix without a test that would have caught the bug is not complete.
- Before creating or materially expanding a test, get the user's approval on the behavior it protects, its layer, and why it is valuable.
- Reproduce bugs with tests, not by manipulating a live browser. The exception is a concrete reason to judge something visually, such as spacing or alignment. State that reason.

Test layers:

- **Type 1:** pure logic and unit tests. Mock freely, and make no UI behavior claims.
- **Type 2:** service and state integration tests in Vitest, for app-owned invariants such as message index correctness, regenerate pruning, persistence, and sync payload construction.
- **Type 3:** feature and user-story tests in Playwright, with the real component, DOM wiring, and user entrypoint. This is the default for feature tests, live behavior, and reported UI bugs, and is required when focus, selection, drag/drop, scrolling, async DOM timing, or reload behavior matters.
- JSDOM is for narrow render-contract checks only, such as `messageElement(message)` rendering an edit button. Do not present those as proof a live flow works, and switch to Playwright if the test needs a rebuilt app shell.

Writing tests:

- Do not mock the layer whose behavior is under test. Mock only for a concrete reason, and say what a test does not cover.
- Reproduce the actual user timeline rather than seeding an end state that resembles it.
- For stateful UI bugs, assert both backing state and visible DOM state so the test catches them diverging.
- Make the first failing assertion describe the user-visible symptom, and name tests after their primary failure reason.
- Assert persisted state, in-memory state, and coarse DOM outcomes. Put selector or subtree expectations in a dedicated rendering test rather than coupling CRUD tests to them.

Cloud sync:

- Feature behavior may depend on Supabase-backed state. When adding a test, assess whether the cloud-sync path differs enough to cover, and ask the user if that is unclear.
- Keep two questions separate. Cloud-sync-aware feature tests ask whether the app uses sync correctly, and should usually mock the sync boundary with contract-shaped fixtures. Sync-implementation tests ask whether `Sync.service.ts` does the correct remote work.
- A cloud-sync variant does not automatically mean a live backend test. Use live Supabase only when testing the sync implementation itself: remote persistence, encryption, RLS, migrations, queries, or real cross-device flow.
- When you add or revise a test, state in your final response whether a cloud-sync variant is worth adding and why.
