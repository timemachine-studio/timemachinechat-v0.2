# TM-00 baseline

Verified 2026-09-06, local macOS checkout, Node v22.19.0 / npm 10.9.3. TM-00 has no dependencies. Only documentation and evidence were added or updated; product code, dependency manifests, lockfile, types, and migrations were preserved.

TM-00 uses its step 3 credential-unavailable fallback. This baseline is complete as a local/source baseline; **no live schema, RLS, provider, billing, or deployment audit passed**. Those prerequisites remain open below. Completing this task does not close any production launch gate.

## Reproduce the checks

The checkout had no `.git`, `node_modules`, `.env`, `.env.local`, Supabase CLI project linkage, or configured Supabase/provider credentials. `git status --short` returned “not a git repository”; there is no branch or commit to report. `npm ci` installed 839 packages from the existing lockfile. No package upgrade or audit remediation was performed.

Run from the repository root:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

Without configuration, the last two commands fail while loading Vite because `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required. For **local fixture verification only**, use:

```sh
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=tm-00-public-placeholder npm test
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=tm-00-public-placeholder npm run build
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=tm-00-public-placeholder npm run dev -- --host 127.0.0.1
```

Nothing was listening as a Supabase database at that address. The placeholder is not a token; no authenticated success was simulated. These environment values were passed per command, not saved to `.env`. Do not deploy the resulting `dist` directory.

| Check | Exit / result | Evidence |
| --- | --- | --- |
| `npm ci` | 0; 839 packages installed; deprecation warnings | [install log](evidence/tm-00/npm-ci.log) |
| `npm run typecheck` | 0; no diagnostics, initially without a cached build-info file | [typecheck log](evidence/tm-00/typecheck.log) |
| `npm run lint` | 1; 136 errors, 5 warnings, 141 total; all errors are `no-explicit-any` | [lint log](evidence/tm-00/lint.log) |
| `npm test`, no env | 1; config prerequisite failure before tests execute | [unconfigured test](evidence/tm-00/test-unconfigured.log) |
| `npm test`, fixture env | 0; 24 tests, 3 files | [test log](evidence/tm-00/test.log) |
| `npm run build`, no env | 1; typecheck passes, Vite env validation fails | [unconfigured build](evidence/tm-00/build-unconfigured.log) |
| `npm run build`, fixture env | 0; CSS import-order and >500 kB chunk warnings | [build log](evidence/tm-00/build.log) |
| Local dev server | Initial sandbox bind failed `EPERM`; approved local bind then served app | [initial log](evidence/tm-00/dev.log), [browser server log](evidence/tm-00/dev-browser.log) |

The production bundle's main JS is 2,195.71 kB / 612.28 kB gzip; CSS is 157.76 kB / 28.02 kB gzip. The PDF worker is 1,262.39 kB. These are build sizes, not measured network performance or Lighthouse scores. Existing warnings belong to production-check 3.1 and 3.2. No fresh dependency-security audit was run; the August advisory counts remain historical.

Test scope: `renderInline.test.ts` has 10 sanitizer tests; `chatErrors.test.ts` has 11 error taxonomy tests using synthetic `Response` objects; `id.test.ts` has 3 UUID tests. None calls a provider or database. There are no existing integration tests for the agent loop, parser, rate limiter, MCP continuation, or storage isolation. No new product tests were added for this documentation-only task.

## Current architecture and changes since the plan's audit

The main architecture findings in superplan section 3 still hold. These additional details correct stale instructions or constrain the next tasks:

| Area | Verified source behavior | Consequence |
| --- | --- | --- |
| Routing | `src/App.tsx` eagerly imports routes; 1,229 lines. `/`, `/home`, `/notes`, `/healthcare`, `/settings`, `/history`, `/chat/:id`, `/groupchat/:id` exist. | Preserve the existing router and design. |
| Personal chat links | `ChatByIdPage` finds a session by loading all local/cloud sessions, then calls `navigate('/')` without passing the session. `/history` selection instead supplies navigation state through App. | `/chat/:id` is not a reliable exact-chat source link; TM-07 must implement and test targeting. |
| Chat state | `useChat.ts` is 1,611 lines, sets ChatService's user ID, has UUIDs, failure state, abort/retry handling. Error boundaries and a wildcard 404 route exist. | Older CLAUDE “missing feature” statements were stale; retain these behaviors. |
| Loop | `runAgentLoop` is shared by proxy and Trigger; sequential execution, five-turn default, tools hidden on final turn, received chunks independently split into JSON lines and parse errors skipped. | TM-08/09 remain necessary; existing tests do not cover fragmentation. |
| Tools | `ToolExecutionContext` has persona, image input and policy, but no trusted actor/run/grants. `executeTool` handles web, image, list/read skills and returns strings. Image success means markdown URL creation here. | Do not infer a saved artifact receipt or private-data capability. |
| MCP | Helpers cap enabled servers at 5 and discovered tools at 32; `listTools()` reads one page. Only `mcp-approval.ts` calls discovery/loading; approval uses a separate completion path. | Flight Controls UI is not proof of main-chat MCP execution. |
| Providers | `ai-proxy.ts` is 3,215 lines. `resolveRunProvider` selects dispatch; preserve six providers, persona/Flow State behavior, policy and fallback paths. | No provider extraction in TM-00. |
| Notes | `NotesPage.tsx` is 2,748 lines; local types, whole-array persistence, component state, draft handoff. No `noteId` URL consumer. | Extract through TM-06; retain all 16 block kinds and optional block/note fields. |
| Healthcare | `healthcareService.ts` queries `search_drugs`, `brands`, `generics`, with bounded fallback/category reads. A visible informational disclaimer already exists. | No personal medical record system was found. Exact record links and main-chat tools remain future work. |
| Settings | `/settings` contains appearance/themes. Flight Controls is an `AgentsModal` opened from the main-chat brand menu, not a Settings subroute. | Screenshot both surfaces; catalog settings are cloud-backed. |

## Storage data-flow map: current behavior

This table describes current code, not the desired privacy contract. “Source” means inspected implementation; “browser” means observed using synthetic local content.

| Data | Write path → store | Read / ownership / retention | Evidence level |
| --- | --- | --- | --- |
| Anonymous personal history | `useChat` → `ChatService.saveSession` → `saveLocalSession` → localStorage `chatSessions` | Whole archive JSON; same-origin shared store, no account workspace isolation; write exceptions only logged | Source + saved synthetic history visible after `/history` reload |
| Signed-in personal history | Same service → `saveSupabaseSession` → `chat_sessions` upsert, `chat_messages` delete then insert | Automatic for any signed-in user, no paid entitlement or sync opt-in. Lists eagerly fetch every session's messages. Deletes/inserts are not a transaction; inserted rows omit original message IDs. | Source only; live auth/RLS unverified |
| Legacy guest migration | `migrateLocalSessionsToSupabase` helper writes sessions, removes entire guest key after any success | No caller outside the service found. Partial-success cleanup is unsafe if later wired unchanged. | Source only; not evidence migration currently runs at login |
| Notes | Editor / Notes AI state → `saveNotes` effect → localStorage `tm-notes`; home draft → `tm-notes-draft` → mount import | Whole-array writes, no transactional receipts/version conflicts/account isolation. Read parse failures return empty list; writes can throw. | Source + synthetic title/body survive reload |
| Notes schema | Note ID/title/blocks/timestamps/star/emoji/theme; blocks ID/type/content/check/width/height | text, heading1/2/3, bullet-list, numbered-list, todo, quote, code, divider, callout, doodle, image, graph, table | Source; full block round-trip belongs to TM-06 |
| Active model processing | Browser messages/attachments → `/api/ai-proxy` or `/api/pro-generation` → selected external provider | Request processing leaves device regardless of history mode; actual processor retention unknown | Source only |
| Durable PRO content | `/api/pro-generation` sends prepared `apiMessages`, tools, identity/IP and images in Trigger payload → output stream → `completeProJob` writes `pro_generation_jobs.final_content` | API reads/polls job output; no verified content TTL. The “28 days” stream comment is not verified vendor configuration. | Source only |
| Memories | Proxy reads `ai_memories` using scoped access; memory-tag processing can write records | Separate cloud store from history; no verified deployed retention/deletion audit | Source only |
| Shared chats | Group chat services → Supabase group tables/realtime | Collaboration is cloud data, not personal device-only history; actual RLS unverified | Source only |
| Images/music | Client/server services → user media tables and storage buckets; public URL helper in `src/lib/supabase.ts` | Bucket privacy must be audited separately; music setup includes public SELECT | Source only |
| PDF chunks | SQL defines `pdf_chunks` and search RPC; no `pdf_chunks` reference found in current `src`/`api` | Do not mistake an unused SQL feature for an active deployed persistence flow | Source only |
| Flight Controls | Public catalog + per-user settings through `flightControlsService` → Supabase | Server MCP continuation rows can hold arguments/state; opportunistic expiry and 30-day row cleanup in helper | Source; browser shows unavailable catalog |
| Auth/themes | Supabase session and theme keys in browser localStorage; profile preferences can affect theme | Theme local keys include `themeMode`, `seasonTheme`, `defaultTheme`; cached auth is not trusted server identity | Source; theme screen observed |

Target, not yet implemented: free personal history on-device; paid personal history on-device by default, optionally synced only with verified entitlement and explicit consent. Air/PRO persona does not grant subscription rights. Preserve legacy cloud data until migration/export and optional paid adapter are settled. No blanket table drop is authorized. Temporary processing retention is separate (TM-02).

## Source schema fixture and missing live audit

[Static schema fixture](evidence/tm-00/schema-fixture.json) inventories handwritten table names, SQL creation statements, and literal `.from()` call sites (including storage bucket names). It is **not executable DDL, generated database types, or a database dump**. Counts were extracted from the checked-in files; dynamic SQL and actual deployed configuration are outside this fixture.

- 21 tables are declared in `src/types/database.ts`; the old “22 tables” note was incorrect. `search_drugs` is a function, not a table.
- Five files under `supabase/migrations` create five tables: `flight_control_catalog`, `user_flight_control_settings`, `mcp_tool_runs`, `pdf_chunks`, `pro_generation_jobs`.
- `rate_limits_rls.sql` alters an existing table; it does not create it. `healthcare_search.sql` depends on existing Healthcare tables. Therefore these files cannot reconstruct the current application database alone.
- Seventeen typed tables have no creation SQL in migrations (listed in the fixture). `user_music` has creation SQL only in `supabase/music_setup.sql` outside migrations. `pdf_chunks` is created in a migration but absent from types.
- `flight_controls.sql` enables RLS on its three tables; `pro_generation_jobs.sql` enables owner-read RLS. `rate_limits_rls.sql` enables/forces RLS and revokes public-role grants, but its deployment was not verified.
- `pdf_chunks.sql` contains no RLS enablement or owner policy. `music_setup.sql` includes a public `music-assets` SELECT policy. These are checked-in risks; exposure in a live environment is unknown.

No authorized staging/development project reference, database URL, credentials, or CLI linkage was available. No remote schema was pulled, no SQL was executed, and handwritten types were not overwritten with invented schema. Production-check 1.2's live generation follow-up, 2.2's fresh-database/RLS acceptance, and 2.6's staging checks remain open.

To finish that later audit in an explicitly identified development/staging environment: capture schema-only DDL; generate types to a temporary comparison file; compare tables, columns/nullability/defaults, keys/indexes, functions, grants, storage policies and RLS with this fixture; rebuild a disposable database; then test anonymous and two-user isolation through normal clients. Retain sanitized schema evidence and project/environment identification, never credentials or user rows. Do not run blanket migrations against production.

## Browser references and observations

Codex in-app browser against local Vite at `http://127.0.0.1:5173`; desktop 1440×900 and mobile 375×812 viewport emulation. Default app appearance was preserved (Settings showed Autumn Ember; Notes Purple). These are reference captures, not a complete theme/accessibility matrix or physical-device test. Images were visually inspected; early captures caught entrance/resize animations and were replaced with settled captures.

| Surface | Route/action | Desktop | Mobile |
| --- | --- | --- | --- |
| Main chat | `/` | [image](evidence/tm-00/chat-desktop.jpg) | [image](evidence/tm-00/chat-mobile.jpg) |
| Notes | `/notes`; synthetic saved note | [image](evidence/tm-00/notes-desktop.jpg) | [image](evidence/tm-00/notes-mobile.jpg) |
| Healthcare | `/healthcare`; initial catalog search screen | [image](evidence/tm-00/healthcare-desktop.jpg) | [image](evidence/tm-00/healthcare-mobile.jpg) |
| Settings | `/settings`; appearance | [image](evidence/tm-00/settings-desktop.jpg) | [image](evidence/tm-00/settings-mobile.jpg) |
| Flight Controls | `/` → brand heading → Flight Controls | [image](evidence/tm-00/flight-controls-desktop.jpg) | [image](evidence/tm-00/flight-controls-mobile.jpg) |

Real local UI verification:

1. Main chat shell and composer render with unreachable Supabase. Desktop shows “3 free messages left”; mobile hides it.
2. Typed “TM-00 baseline note” and “Synthetic local fixture for the baseline. No personal data.” through the Notes editor. Reload preserved both. Mobile title is clipped by its single-line input; body wraps. Two untitled notes were present on first Notes visit; cause was not established.
3. Healthcare initial page renders search modes and a disclaimer. No drug query against a real catalog passed.
4. Settings renders theme controls. No account, subscription, or cloud-sync controls were added or tested.
5. Flight Controls eventually shows its actual “could not be loaded” error with Retry and sign-in controls. No catalog rows or signed-in settings were mocked.
6. Sending “TM-00 synthetic baseline ping” produced an actual “Your session expired. Sign in again to continue.” failed-turn row. This is a missing-backend failure observation, not a successful generation or proof of provider error classification. [Failure image](evidence/tm-00/chat-failure-mobile.jpg).
7. `/history` displayed the synthetic title and “Local only” after reload; selecting it returned to `/` and displayed the user message. The failed-turn row was not visible after selection, which needs targeted recovery investigation in TM-05/07. [History image](evidence/tm-00/history-mobile.jpg). Export/import and successful AI message persistence were not exercised.

The local dev log also reports nested `<button>` markup in NotesSidebar; this pre-existing accessibility/DOM warning belongs to the later Notes/UI work.

No backend responses were intercepted or replaced. Unit synthetic responses and source schema fixtures are labeled separately. No personal user content, real credentials, or provider requests were used.

## Overlap with production-check

| Existing work | Superplan owner / boundary |
| --- | --- |
| 1.1 build/typecheck, 1.3/1.4 boundaries/routes, 1.5–1.14 reliability | Preserve implemented code; reverify specific behavior when touched. TM-00 measured only the checks above. |
| 1.2 types, 2.2 schema/RLS, 2.6 staging | TM-00 captures source inventory; authorized live capture and isolation remain prerequisites before new cloud schemas. |
| LS.1 privacy and processor claims | TM-02 inventories retention/copy; TM-28 reconciles shipped behavior. |
| LS.2/LS.3/LS.4/LS.6 device migration/export | TM-05 owns transactional personal history; TM-06 Notes; TM-07 retrieval; TM-15 eligible paid sync; TM-28 recovery. D1 overrides blanket no-sync/drop instructions. |
| LS.5 shared/multi-device behavior | TM-02 policy, TM-03 entitlements, TM-15 sync; shared group-chat semantics remain separate. |
| 2.3/2.4 CI and tests | TM-01 onward adds scoped deterministic coverage; TM-14/29 supplies real-provider evaluation. No CI launch gate is closed here. |
| 3.1/3.2 performance and CSS warnings | Existing baseline debt, untouched by TM-00. |
| 3.3/3.4 accessibility/mobile | TM-13 compares changes with these references; retain existing issues separately. |
| 3.5 provider extraction | TM-08 owns adapters, TM-09 the coordinator; avoid a duplicate broad proxy rewrite. |
| 4.2 Healthcare safety | Disclaimer already visible; legal/provider policy and broader safety gates are not verified by that observation. |
| 4.4/4.5 load/budget/runbook | TM-29/30, not a local baseline pass. |

## Environment-only prerequisites

| Needed access/configuration | Verification still required |
| --- | --- |
| Named authorized development/staging Supabase project, read-only schema access or sanitized dump, CLI type-generation credentials | Actual schema/type comparison, grants/RLS, fresh database reconstruction, storage bucket exposure; 1.2/2.2/2.6 |
| Public Supabase config, server service-role credential, anonymous limiter schema/secret, two disposable test accounts | Real sign-in, signed-in history ownership, cross-account isolation, quotas and account switching |
| Configured AI provider key(s) with bounded test budget | Real Air/PRO model → tool → model behavior and successful stream/fallback checks |
| Authorized Trigger development environment and retention settings | Durable job reattachment, stream/payload deletion and processor retention; TM-02/16 |
| Controlled MCP server/catalog and disposable account settings | Actual discovery, invocation, continuation and revocation; TM-18 |
| Future billing/connector/sandbox test configuration | Not TM-00 dependencies; required only when their assigned tasks reach external verification |

Known code failures and missing environment verification are distinct. No product regression was introduced: the saved [product hash inventory](evidence/tm-00/product-sha256.json) covers source, assets, config, package files and SQL, and is checked again at handoff. `node_modules`, build output and TypeScript cache are generated local artifacts.

Final handoff: [verification summary](evidence/tm-00/verification-summary.json) confirms all 259 inventoried product files are unchanged, document links resolve, and only TM-00 is checked off. The temporary dev server was stopped and the browser viewport override reset.

Next eligible task: **TM-01**. Do not start it as part of TM-00.
