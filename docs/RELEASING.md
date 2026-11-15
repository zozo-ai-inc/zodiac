# Release Cycle

The hard approval rules are also in `AGENTS.md`, which agents load every session.

## Release approval and merge authority

- Never create or publish a new tagged GitHub Release, create its version tag manually, or publish an existing draft until the user has reviewed and explicitly approved the exact final draft title, tag, target, full notes, and every proposed change. Approval of the code, an earlier draft, or the general release plan does not count as approval of the final release.
- Never merge or close a pull request targeting `production`. The agent may prepare or update the pull request and monitor its checks, but only the user may manually merge or close it.
- Never merge or close a pull request from a `release/*` branch into `main`. The agent may prepare or update the pull request and monitor its checks, but only the user may manually merge or close it.
- When either protected pull request is ready, stop and give the user its URL, exact copy or release changes, and check status. Do not enable auto-merge or use any other mechanism that would complete it without the user's manual action.

## Branching and deployment flow

- Cloudflare Pages production deployments are pinned to the permanent `production` branch.
- `main` is the ongoing development branch.
- Feature and fix pull requests merge into `main`; do not commit feature work directly to `production`.
- A temporary `release/vX.Y.Z` branch is created from `main` for the version bump and other release-only preparation. Build the in-app changelog from the current draft GitHub Release, polishing and combining its entries into user-facing copy.
- Open a pull request from the prepared release branch into `main` with the `skip-changelog` label, then stop for the user to review and manually merge or close it.
- After the user merges the release pull request, open a second pull request from `main` into `production`, then stop for the user to review and manually merge or close it.
- Cloudflare deploys after the user merges the pull request into `production`. No release backmerge is needed because release preparation entered `main` before promotion.
- Each promotion adds a merge commit that exists only on `production`, so `git rev-list main..production` normally lists the latest promotion merge. This is expected and carries no code difference.
- The `production` branch protection intentionally has "Require branches to be up to date before merging" turned off (the `verify` check and the pull request requirement stay on). With it on, the source branch `main` would have to contain every `production` merge commit, which forces an empty "synchronize production history" pull request into `main` before each promotion. Do not turn it back on or add such sync pull requests.

## Pull request release classification

- Every pull request targeting `main` must have exactly one release classification label. The merge gate enforces this rule. Promotion pull requests targeting `production` still run the full merge gate but do not need a release classification.
- Use `feature`, `enhancement`, or `bug` for user-facing changes. Write those pull request titles as concise release-note candidates because Release Drafter uses them directly.
- Use `code improvement` for internal refactors, `documentation` for documentation-only work, and `skip-changelog` for release preparation or other administrative changes targeting `main`. These labels are excluded from user-facing release notes.
- Release Drafter runs after merges into `main` and continuously maintains the next draft GitHub Release from included pull requests. While it is a draft, it targets `main` so unreleased PRs can populate the release-note candidates. After the user manually merges the production pull request and the deployment is verified, pin the draft target to the exact deployed production commit SHA; publishing remains blocked until the user explicitly approves the exact final draft.

## Pro request edge function slots

- The frontend targets the premium chat edge function through `PRO_REQUEST_FUNCTION_NAME` / `PRO_REQUEST_ENDPOINT` in [src/services/Supabase.service.ts](../src/services/Supabase.service.ts).
- Available Supabase function slots are `handle-pro-request`, `handle-pro-request-x`, and `handle-pro-request-test`.
- `handle-pro-request` and `handle-pro-request-x` are equivalent rotating production slots. The currently released frontend points at one slot, while the other slot is available for the next synced frontend/backend release.
- Only change the committed `PRO_REQUEST_FUNCTION_NAME` target as part of a new release workflow. Do not change the production target for ordinary feature work, fixes, local testing, or short-lived validation.
- When a frontend/backend sync release is required, deploy the backend update to the production slot that the currently released frontend is not using, update `PRO_REQUEST_FUNCTION_NAME` to point the new frontend bundle at that slot, then deploy the frontend. This keeps old loaded clients on the old function and new clients on the new function.
- Use `handle-pro-request-test` for quick backend iteration and local/manual validation. Point `PRO_REQUEST_FUNCTION_NAME` at the test slot only for local test builds or short-lived validation branches; do not promote a release to `production` while it points at the test slot.
- Before changing the production target, verify every premium caller uses `PRO_REQUEST_ENDPOINT` rather than hardcoding a function URL.

## Preparing a new release

- Open the continuously maintained draft GitHub Release before creating the release branch. Its categorized entries are the release-note candidates collected since the previous published release.
- Create `release/vX.Y.Z` from `main`, then use the draft entries as scope candidates for two distinct deliverables: concise user-facing in-app copy and more technical GitHub release notes.
- Update the user-facing changelog in [src/index.html](../src/index.html) under the `#whats-new` section.
- Update the version string in [src/constants/App.ts](../src/constants/App.ts) so the badge and changelog header display the new version.
- Open the `release/*` pull request into `main` with `skip-changelog`, present the exact in-app changelog and version changes to the user, and wait for the user to merge it manually.
- After the user merges it, wait for Release Drafter's final `main` update before replacing its generated PR titles with the prepared GitHub release notes.
- Open the `main` pull request into `production`, report its checks, and wait for the user to merge it manually. After that merge, verify the Cloudflare deployment, record the exact deployed production commit SHA, and pin the draft target to that SHA.
- Present the exact final GitHub Release title, tag, target, full notes, and all proposed edits to the user. Publish it only after the user explicitly approves that exact final draft.

## How to build the changelog well

- The in-app changelog is user-facing marketing/product copy, not a technical document.
- Summarize released value, not implementation details. Prefer feature outcomes and user benefits over commit-level mechanics.
- Do not mention developer-only infrastructure or internal workflow changes unless they directly affect Zodiac users.
- Favor broad, human phrasing such as `RPG group chat stability improvements` over overly granular engineering detail.
- When a shipped feature is genuinely user-visible, name it clearly (for example, `Message debug tools`) instead of hiding it behind vague wording.
- Include only features the user has explicitly approved as release-ready. Code being merged or deployed does not by itself authorize announcing the feature.
- Good entries should feel like release notes written for users: concise, readable, and slightly polished rather than deeply technical.

## Tagging guidance

- Release tags must point at the exact commit deployed from `production`.
- Do not create or publish the tag while either the release-preparation PR into `main` or the promotion PR into `production` is still open.
- Do not create or publish the tag until the user explicitly approves the exact final GitHub Release draft and every proposed change to it.
- After the user manually merges the production pull request, verify the Cloudflare production deployment, pin the draft to the exact deployed production commit SHA, and present the final draft for approval. Publishing the approved draft creates the `vX.Y.Z` tag at that pinned commit.

## Creating the GitHub Release

- Release Drafter creates and maintains the upcoming GitHub Release as a draft; do not create a second release manually.
- Publish the existing draft only after the user manually merges `main` into `production`, the Cloudflare deployment has been verified, and the user explicitly approves the exact final draft and all proposed edits.
- Pin the draft target from `main` to the exact verified deployed production commit SHA, then confirm that its version tag matches the version in [src/constants/App.ts](../src/constants/App.ts).
- Title the release to match that version tag (for example, `v1.8.5`).
- The GitHub Release notes and in-app changelog cover the same approved release scope but are separate deliverables and should not be assumed to use the same wording.
- GitHub Release notes may be more technical and specific. They can describe concrete changes such as old-to-new copy, layout changes, and affected systems, while the in-app changelog should summarize the user-facing outcome.
- Rewrite the generated PR titles as a Markdown list under a `## What's New` heading rather than publishing raw PR titles or commit messages:

    ```markdown
    ## What's New

    - **Model picker navigation:** Reorganized models by provider family and added faster search and favorite pinning.
    - **Composer layout:** Moved narrow-screen actions into the overflow menu so the primary controls remain accessible.
    ```

- Pin the prepared draft with `gh release edit <tag> --target <verified-production-commit-sha>` and verify that exact target commit. Show the user the exact final title, tag, target SHA, full notes, and proposed changes; only after explicit approval may it be published with `gh release edit <tag> --draft=false --latest`.
