# Styles

`main.css` is the app's single stylesheet entry point. It imports the reset, shared styles, features, mode defaults, and color palettes. Vite resolves these imports and bundles them for production; this split does not load feature CSS on demand. The small inline background in `index.html` still paints the initial canvas before the stylesheet arrives.

## Where styles belong

| File or directory       | Owns                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens.css`            | Shared viewport variables, surface effects, and app stacking levels                                                                   |
| `base.css`              | Font declarations, typography, element defaults, and visibility helpers                                                               |
| `layout.css`            | App shell, sidebar, main content, and viewport/keyboard layout                                                                        |
| `components/`           | Reusable buttons, inputs, forms, cards, badges, navigation, search, dropdowns, surfaces, toasts, and loading feedback                 |
| `features/`             | Styles specific to chat, personas, group chat, image generation, subscriptions, onboarding, profile, settings, and other app features |
| `dark.css`, `light.css` | Mode defaults and mode-specific token values                                                                                          |
| `themes/`               | Color palette overrides for each mode                                                                                                 |
| `policy.css`            | Standalone privacy and terms pages; independent of the app entry point                                                                |

Keep a feature's states, responsive rules, and animations with that feature. Generic UI primitives belong in `components/` even when their first consumer is a particular feature. Related features can also reuse each other's styles: profile and onboarding reuse subscription cards from `features/subscriptions.css`, while their consumer-specific layout stays with the consumer.

## Cascade and themes

Import order is intentional: shared primitives precede features, and palette tokens override mode defaults. These files remain globally scoped, so use semantic component or feature class names. A new file alone does not isolate its selectors.

Component declarations consume variables in their owning files. Identical dark/light declarations are shared using `:is([data-mode="dark"], [data-mode="light"])` where needed to preserve the specificity of the previous mode rules. Keep real mode differences next to the relevant component; define the differing values in the mode files when they can be expressed as tokens. Toast tokens retain their local scope because moving them to the root changes their interaction with inherited palette colors.

Shared palette defaults use `:root[data-mode]`. Theme-choice buttons also carry `data-mode`; placing those defaults on every matching element would make the buttons override the active page theme.

Use existing tokens when they express the same design decision. Introduce a spacing or radius token when it represents a shared convention, rather than replacing unrelated values just because their numbers happen to match. App-level stacking values are named in `tokens.css`; local child stacking can still use small numeric indices.

## Editing safely

- Preserve selector specificity and order when moving rules, including rules inside media queries. The desktop and mobile sidebar queries both match at exactly 1032px; their order is intentional.
- Keep relative asset paths relative to their stylesheet: feature files use `../../assets/`, while `base.css` uses `../assets/`.
- Shared loading animations live in `components/feedback.css`. The single `fadeIn` definition preserves the animation previously shared by onboarding and the lightbox.
- Run `npm run build` and the relevant existing Playwright stories after a change that can affect layout or interaction. Check the affected surface in both modes and at its responsive boundaries. Follow `AGENTS.md` before adding new tests.
