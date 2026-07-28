# AGENTS.md

English version. For Chinese, see [`AGENTS-CN.md`](AGENTS-CN.md). Keep both files synchronized.

## Scope

This file guides AI coding agents, GitHub PR review agents, Codex, Copilot, Claude, Gemini CLI, and similar automation tools working in this repository. Unless an issue, pull request, task description, or user message says otherwise, agents must follow this file. Direct user instructions take precedence.

## Project Context

EchoMem Web Extension is a Chrome/Edge extension based on Manifest V3. It injects the EchoMem entry and overlay into supported AI chat pages and provides resource management, input association, cognitive feedback, Skill management, productivity statistics, and backend configuration. The currently supported platforms are HIGO Office and DeepSeek.

Before changing code, read `CLAUDE.md` and the directly relevant source, configuration, documentation, and existing implementation. Treat the current checkout as the source of truth; do not infer behavior from filenames or generic browser-extension experience alone.

## Repository Map

| Path | Responsibility |
|---|---|
| `manifest.json` | Manifest V3 declaration, permissions, Service Worker, and content-script entry |
| `src/entry/content.js` | Source entry for the content script |
| `dist/content.js` | Generated bundle loaded by Chrome; committed build artifact |
| `background.js` | Event-driven Service Worker, toolbar entry, storage initialization, and cross-origin request proxy |
| `src/core/` | Detection, lifecycle, injection, routing, state, panel host, and session recording |
| `src/panels/` | Feature panels and panel registry |
| `src/platforms/`, `src/config/` | Platform registration and declarative runtime configuration |
| `src/adapters/` | Shared adapter behavior and platform-specific overrides |
| `src/streaming/` | Streaming-completion detector strategies |
| `src/services/` | Chrome APIs, storage, messaging, and backend clients |
| `src/utils/` | Shared parsing and text utilities |
| `docs/decisions/` | Architecture decision records |
| `docs/flows/` | Current feature flows and call chains |
| `docs/reference/` | Current configuration and interface references |
| `docs/legacy/` | Superseded historical material; do not treat as the current contract |
| `scripts/` | Extension validation and release packaging |

## Working Rules

- Keep the change focused on the user-requested task. Do not refactor unrelated modules without a concrete need.
- Before editing, identify the real runtime entry, similar implementations, platform configuration, source-to-document anchors, and affected public behavior.
- Preserve unrelated local changes and do not overwrite user work.
- Do not commit diagnostic code, temporary scripts, local caches, logs, release output, or generated artifacts other than the required committed `dist/content.js`.
- Do not claim that a behavior, build, or test passed unless it was actually verified and the result was observed.
- Keep implementation, `manifest.json`, generated output, README/CLAUDE guidance, and current docs consistent.

## Architecture Boundaries

- Edit content-script runtime logic in `src/`; do not hand-edit `dist/content.js`. Root-level `background.js` is the directly loaded Background Service Worker and may be edited directly for toolbar entry, storage initialization, message handling, or cross-origin request proxy changes. After changing content-script source, run the build and commit the regenerated bundle with the source change.
- Chrome loads `dist/content.js` for the content script and loads root-level `background.js` directly for the Background Service Worker. A content-script source-only change is incomplete until the bundle is rebuilt.
- Prefer declarative platform differences in `src/config/platforms.json`. Override an adapter only when JSON cannot express the behavior. Do not place HIGO- or DeepSeek-specific literals in `src/adapters/base-adapter.js`.
- Keep platform adapters, streaming detectors, panels, and service clients behind their existing registries and boundaries. Add cross-panel behavior to the appropriate shared module instead of duplicating it in a panel.
- Keep cross-origin backend requests in the Background Service Worker proxy. Do not bypass the established message path from content scripts.
- Treat the Background Service Worker as event-driven and non-persistent. Do not rely on long-lived in-memory state.
- `manifest.json` currently matches all URLs, but platform detection gates UI injection. Changes to permissions, host permissions, injection timing, or supported platforms require explicit security and compatibility review.
- `popup.*` files are retained legacy files and are not the current toolbar entry. Do not restore `action.default_popup` unless the requested design explicitly changes this architecture.

## JavaScript And Browser Rules

- Follow the existing ES module style, naming, semicolon usage, and local error-handling patterns.
- Code under `src/` must work after esbuild bundles it as an IIFE targeting Chrome 88. Do not introduce Node-only APIs into browser runtime paths.
- Use defensive DOM queries. Invalid or stale selectors must not break the full content-script lifecycle.
- Keep lifecycle hooks and message listeners idempotent where they may run more than once because of DOM mutations or extension events.
- Escape or safely construct all HTML containing backend- or page-provided values. Do not insert untrusted strings into `innerHTML` without sanitization.
- Keep user-facing UI copy in Simplified Chinese unless the product requirement says otherwise.
- Avoid logging secrets, tokens, API keys, cookies, full sensitive payloads, or production connection details.
- Do not use emoji in code, comments, documentation, commit messages, or PR titles unless the user-facing product copy explicitly requires it.

## Documentation Rules

Source files may contain a top-of-file `文档：...` anchor. When behavior changes, inspect and update that linked document. Use the smallest sufficient documentation update:

- bug fixes, style-only changes, and internal repairs usually need no new design document;
- user-visible features, entry points, or interaction changes require the corresponding `docs/flows/` update;
- platform detection, injection, runtime entry, data flow, permissions, or module-boundary changes require flow/reference updates and may require an ADR in `docs/decisions/`;
- platform configuration changes require `docs/reference/平台配置参考.md` updates;
- panel registry changes require `docs/reference/面板注册参考.md` updates;
- backend client or contract changes require the related flow and interface reference updates;
- superseded material belongs in `docs/legacy/`; do not silently rewrite history there;
- structure, build, debugging, supported-platform, or feature changes must also trigger a consistency check of `README.md` and `CLAUDE.md`;
- any instruction change must update `AGENTS.md` and `AGENTS-CN.md` together.

## Testing And Verification

Install dependencies from the lockfile and use the repository scripts:

```bash
npm ci
npm run check
```

`npm run check` rebuilds `dist/content.js`, checks JavaScript syntax, and validates the extension structure. Choose additional verification based on the change:

- content-script source: run `npm run check`, confirm the generated `dist/content.js` changed as expected, reload the unpacked extension, and test the affected supported platform;
- Background or messaging behavior: run `npm run check` and inspect the Service Worker console plus the content-page console;
- platform detection or adapter change: manually verify the affected platform, unsupported-page behavior, repeated DOM updates, message extraction, and streaming completion as applicable;
- manifest, assets, packaging, or release change: run `npm run package` and validate `release/EchoMem-Extension/`; do not commit `release/`;
- docs-only change: verify paths, commands, API names, and described behavior against the current checkout; a frontend build is not required unless generated or runtime files also changed.

There is currently no general automated unit-test suite in `package.json`. Do not describe `npm run check` as unit tests. If browser or backend verification cannot be performed because a platform, account, secret, or external service is unavailable, state exactly what was skipped and why.

## GitHub And Pull Requests

- Use the `gh` CLI for GitHub operations.
- Keep commits and PRs limited to the current task. Preserve and disclose unrelated worktree changes.
- Use PR titles in the form `type(scope): summary`.
- Allowed `type` values are `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `build`, and `chore`.
- Prefer scopes such as `extension`, `manifest`, `content`, `background`, `panel`, `adapter`, `docs`, or `release`.
- Use the PR body sections `背景 / 概述`, `变更内容及原因`, `测试`, and `结论`.
- In `测试`, list only commands, CI jobs, backend checks, and manual browser checks that were actually performed. Explain skipped checks.
- In `结论`, state whether the PR is ready for review or merge and list remaining risks or follow-up work.
- Do not include secrets, local artifacts, release output, temporary files, or unrelated refactors.

## Review Language And Quality

Write PR reviews, inline comments, CI/test/risk summaries, and merge-readiness conclusions in Chinese unless the user explicitly requests another language. If a bilingual review is requested, put Chinese first and English second.

Review findings must be specific, actionable, and tied to code or evidence. Explain the issue, risk, affected scenario, suggested fix, and required verification. Order multiple findings by severity. If no blocking issue is found, say:

```md
未发现阻塞合入的问题。
```

Mention any remaining test, CI, backend, or manual-verification gaps separately.

## Security And Local Artifacts

Never expose or commit API keys, tokens, cookies, credentials, `.env` contents, private endpoints, production connection strings, or sensitive user/session data. Refer to environment variables by name only. Treat page DOM content and backend responses as untrusted input.

Do not commit `node_modules/`, `release/`, logs, local databases, temporary debug scripts, caches, editor state, or large/binary artifacts unless the user explicitly requests them and the reason is documented. Required product assets and the tracked `dist/content.js` are exceptions.

## When Facts Cannot Be Confirmed

State uncertainty explicitly and do not invent evidence. Distinguish source inspection, automated checks, manual browser verification, backend integration checks, and assumptions. Recommended wording:

```text
I did not find an automated test covering this scenario in the current change, so I cannot confirm that this branch has been verified automatically.
```

```text
The current evidence only shows that the build and extension-structure checks passed; it does not prove that the complete interaction on the target platform was verified.
```
