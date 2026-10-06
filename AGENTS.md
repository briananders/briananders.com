# Agent Rules — briananders.com

These rules apply to every AI agent working in this repo (Claude Code, Codex, Cursor, Copilot, Gemini).
Architecture and build internals: [CLAUDE.md](CLAUDE.md). Design system: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## 0. Definition of done

Don't say "done", "fixed", "complete" or "should work" until every item below is true. Paste the evidence.

1. `npm run build` exits 0.
2. `npm test` exits 0. Run the full suite with no filters and paste the `# tests` / `# pass` / `# fail` lines.
3. `npm run lint` reports no more problems than it does on `staging`. A lint cleanup is pending; once it lands, the bar is zero.
4. Screenshots are shared (§1), or you state "No rendered output changed."

If a step can't run, name it and say why. Unverified is not done.

## 1. Screenshots

- Capture every page whose rendered output changed. If you changed shared SCSS, a partial or a layout, also capture `/` and `/posts/design-system/`.
- Run `npm run build`, then `npm run screenshot -- <path> [<path> ...]`. The script captures full pages at 375, 768 and 1280 px (the 4-, 8- and 12-column grids). For each page it writes one contact sheet: `screenshots/<page>/sheet-dark.png`.
- Where screenshots go:
  - **Claude Code:** send each contact sheet into the chat thread with `SendUserFile` (`display: "render"`). Add a caption naming the page and what to look at.
  - **GitHub Actions:** leave them in `screenshots/`. The workflow uploads that folder as the `screenshots` artifact; link the run in your comment.
  - **Any other agent:** attach the contact sheets wherever your reply goes.
- The script lists load problems (HTTP errors, JS errors, failed requests). Mention any that change what a screenshot shows.
- Pages fed by S3 data (Last.fm, band news, movies, `/data`) render empty when staging is unreachable. Never present an empty state as the design.
- The site is dark-only. If you add light-scheme styles, also pass `--schemes=dark,light`.

## 2. Tests

- New behavior gets a new `test/*.test.mjs` (`node:test`, plus jsdom for DOM, as in `test/youtube-modal.test.mjs`).
- Bug fix: write the failing test first and show it fail. Then fix.
- If you change an existing assertion, explain why in the PR.
- Golden: when rendered output changes, regenerate with `npm run build:golden` and commit `golden/` alongside the change. Build-time values are pinned, so the diff shows only real changes. Explain each group of changed files in the PR.
- Images: every source image's AVIF is committed next to it in `src/images/`, and builds copy it rather than re-encoding.
  - When you add or change a source image, any build writes its `.avif` and updates `src/images/avif-manifest.json`. Commit both.
  - PR validation fails if a build changes anything in `src/images/`. `test/avif-sources.test.mjs` also flags missing, stale or orphaned AVIFs.

## 3. Design system

- Read DESIGN_SYSTEM.md §1 (TL;DR) and §12 (authoring guide) before writing markup or SCSS.
- Order of preference: existing class → mixin → token (`var(--…)`) → new system component → raw CSS.
- No new hard-coded colors (hex, `rgb()`, `hsl()`) or raw `px` values outside `src/styles/system/`.
  - `test/design-tokens.test.mjs` enforces a per-file ratchet.
  - When you remove one, lower that file's count in `test/design-tokens-baseline.json`.
- Missing a primitive? Add it to `src/styles/system/` and document it in all three references: DESIGN_SYSTEM.md, design-system.html and `/posts/design-system/`.
- Never rename or remove a public SCSS name (`space()`, `palette--*`, `type--*`). Add new names alongside.
- Every animation honors `prefers-reduced-motion`.
- Images go through `img()` or `lazyImage()` with real alt text.
- Build-time template code uses `buildDateTime` and `buildRandom()`, never `new Date()` or `Math.random()`. This keeps golden reproducible.

## 4. Integrity

Never do any of these to make a check pass:

- Delete a test, or mark it `.skip`, `.todo` or `.only`.
- Run a subset (`--test-name-pattern`, single files) and report it as the suite.
- Loosen an assertion.
- Regenerate `golden/` to absorb a diff you can't explain.
- Raise a ratchet baseline.
- Add `eslint-disable` to silence a finding.
- Edit a CI workflow to drop or soften a step.
- Swallow errors in `build/` so the build exits 0.
- Use `--no-verify` or force-push.

If you're stuck, stop and report the failure word for word. An honest red beats a fake green.

## 5. Branches and blast radius

- Branch from `staging`: `git fetch origin staging && git checkout -b <branch> origin/staging`.
- PRs target `staging`. Changes reach `main` only when `staging` is promoted to `main`. That promotion is Brian's call; open that PR only when asked.
- Never commit or push to `main` or `staging`. Pushes there deploy to production and to the staging site.
- Never run `npm run deploy` or `npm run stage`.
- Never hand-edit `package/` or `golden/`. They're build output.
- No new dependencies or major-version upgrades without asking.
  - ESLint stays on v8, because airbnb requires it.
  - Playwright stays pinned to match the Chromium build in cloud containers (see CLAUDE.md).
- No drive-by refactors. Make the smallest change that solves the task.
- Create pages with `npm run scaffold -- --path=/posts/<slug>` and fill in all front matter.

## 6. Report

End every task with:

- what changed
- the commands you ran and their results
- what you didn't verify
- the screenshots
