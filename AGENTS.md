# Agent Rules — briananders.com

These rules apply to every AI agent working in this repo (Claude Code, Codex, Cursor, Copilot, Gemini).
Architecture and build internals: [CLAUDE.md](CLAUDE.md). Design system: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Directives

Follow all ten on every task, pull request and code change. The numbered sections after this one say how to meet them in this repo.

### Architecture and scope

1. **Architectural integrity.** Build every change to be maintainable, to scale and to extend cleanly. No isolated workarounds or hard-coded values. When a change adds complexity, abstract it cleanly.
2. **Design system first.** Use the existing tokens, themes and base components for all UI work. If a pattern or component is missing, extend the design system instead of building a one-off (§3).
3. **Minimal diff.** Change the fewest files and lines that complete the task. Leave adjacent code alone, even when it's outdated. A localized fix never grows into a modernization effort without Brian's explicit go-ahead.

### Quality and documentation

4. **Static analysis.** Follow every lint rule. Your change adds no new lint warnings or errors (§0).
5. **Documentation.** Comment the why behind complex logic, not just the what. When a change alters setup, architecture or core usage, update README.md and the affected docs (CLAUDE.md, AGENTS.md, DESIGN_SYSTEM.md) in the same change.
6. **Responsive layout.** Check every UI change for overflow, broken wrapping and squeezed components at 360, 600, 768, 960, 1024 and 1440 px. A change that breaks out of its container or degrades the experience at any of these widths is rejected (§1).

### Testing

7. **Green builds only.** Every test passes before a task is done, and your change breaks nothing downstream (§0).
8. **Coverage.** Every feature, modification and bug fix adds or updates tests that cover the new logic and its edge cases (§2).
9. **Test integrity.** Change an existing test only when the intended behavior changed, never to make it pass (§4).
10. **Preserve failures.** A failing test is a mandate to fix the code. Delete a test only when the feature it covers is removed (§4).

### When directives pull against each other

- **3 over 1.** Abstract to remove duplication or complexity inside your change. Don't add layers for needs that don't exist yet.
- **4 over a file's existing style, for lines you write.** Code you add or change lints clean even when the code around it doesn't. Per 3, don't reformat lines you didn't otherwise change.
- **3 over 6, for problems you didn't cause.** Fix every layout problem your change introduces. Report pre-existing ones; don't fix them uninvited.

## 0. Definition of done

Don't say "done", "fixed", "complete" or "should work" until every item below is true. Paste the evidence.

1. `npm run build` exits 0.
2. `npm test` exits 0. Run the full suite with no filters and paste the `# tests` / `# pass` / `# fail` lines.
3. `npm run lint` reports no more problems than it does on `staging`. A lint cleanup is pending; once it lands, the bar is zero.
4. The layout check passes and screenshots are shared (§1), or you state "No rendered output changed."
5. README.md and the affected docs reflect any change to setup, architecture or usage (Directive 5).

If a step can't run, name it and say why. Unverified is not done.

## 1. Screenshots and responsive layout

- Capture every page whose rendered output changed. If you changed shared SCSS, a partial or a layout, also capture `/` and `/posts/design-system/`.
- Run `npm run build`, then `npm run screenshot -- <path> [<path> ...]`. The script captures full pages at the six Directive 6 widths and writes three contact sheets per page in `screenshots/<page>/`: `sheet-dark-360-768.png` (4- and 8-column grids), `sheet-dark-960-1024.png` (narrowest 12-column) and `sheet-dark-1440.png`.
- Layout check: at each width the script flags visible content that crosses the viewport edge, and exits 2 if it finds any.
  - The site clips horizontal overflow, so these bugs never show a scrollbar. Content is just cut off.
  - Fix every flag your change caused. A flag on an element your change didn't touch is pre-existing: report it, don't fix it (Directive 3).
  - Nothing automated catches overflow inside the page, such as text spilling out of a card or a squeezed component. Look for it in the contact sheets at every width.
- Where screenshots go:
  - **Claude Code:** send each contact sheet into the chat thread with `SendUserFile` (`display: "render"`). Add a caption naming the page and what to look at.
  - **GitHub Actions:** leave them in `screenshots/`. The workflow uploads that folder as the `screenshots` artifact; link the run in your comment.
  - **Any other agent:** attach the contact sheets wherever your reply goes.
- The script lists load problems (HTTP errors, JS errors, failed requests). Mention any that change what a screenshot shows.
- Pages fed by S3 data (Last.fm, band news, movies, `/data`) render empty when staging is unreachable. Never present an empty state as the design.
- The site is dark-only. If you add light-scheme styles, also pass `--schemes=dark,light`.

## 2. Tests

- Every feature, modification and bug fix adds or updates tests in `test/*.test.mjs` (`node:test`, plus jsdom for DOM, as in `test/youtube-modal.test.mjs`). Cover the edge cases, not just the happy path.
- Bug fix: write the failing test first and show it fail. Then fix.
- Change an existing assertion only when the intended behavior changed, and explain why in the PR.
- Golden: when rendered output changes, regenerate with `npm run build:golden` and commit `golden/` alongside the change. Build-time values are pinned, so the diff shows only real changes. Explain each group of changed files in the PR.
- Images: every source image's AVIF is committed next to it in `src/images/`, and builds copy it rather than re-encoding.
  - When you add or change a source image, any build writes its `.avif` and updates `src/images/avif-manifest.json`. Commit both.
  - PR validation fails if a build changes anything in `src/images/`. `test/avif-sources.test.mjs` also flags missing, stale or orphaned AVIFs.

## 3. Design system (Directive 2)

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

- Delete a test, or mark it `.skip`, `.todo` or `.only`. The one exception: when a feature is removed, delete its tests in the same change (Directive 10).
- Run a subset (`--test-name-pattern`, single files) and report it as the suite.
- Loosen or rewrite an assertion when the intended behavior hasn't changed (Directive 9).
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
- Keep the diff minimal (Directive 3). Problems you notice outside the task go in your report, not your diff.
- Create pages with `npm run scaffold -- --path=/posts/<slug>` and fill in all front matter.

## 6. Report

End every task with:

- what changed
- the commands you ran and their results
- the docs you updated
- what you didn't verify, and any pre-existing problems you found but left alone
- the screenshots
