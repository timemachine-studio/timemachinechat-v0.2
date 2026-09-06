# CLAUDE.md

Repository guidance for coding agents. Updated by TM-00 on 2026-09-06.

Read `codex.md`, `status.md`, and `docs/agent/baseline.md` for the current handoff. `superplan.md` governs the agent-runtime roadmap and supersedes the older blanket cloud-history prohibition below. Historical production-check reports are not evidence of current deployment state.

## What this is

**TimeMachine Chat** — a React + TypeScript AI chat application with multiple personas, a command palette, notes, group chat, healthcare RAG, image/music generation, and a PWA shell. Deployed on Vercel; Supabase for auth, database, and storage.

Currently pre-launch (soft launch in preparation). **Read `production-check.md` before making changes** — it is the authoritative list of known issues and the plan to fix them. If you're fixing something, check whether it's already a numbered task there and reference the task ID in your commit.

## Commands

```bash
npm ci               # install the locked dependency tree; Node 22.x
npm run dev          # Vite :5173 plus local API middleware
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm test             # vitest run
npm run build        # tsc --noEmit && vite build
npm run preview      # frontend build preview; not a Vercel API environment
```

TM-00 baseline: typecheck passes; lint has 136 errors (`no-explicit-any`) and 5 warnings; 24 tests pass in 3 files. Tests cover Notes inline sanitization, error mapping using synthetic Response objects, and UUID generation. They do not verify live providers, RLS, or the stream parser.

Vite requires both public Supabase variables even for tests/build. With no credentials, use the explicit local-only placeholder commands in `docs/agent/baseline.md`. Those runs are not integration verification. Build emits CSS import-order and bundle-size warnings. Do not copy old audit counts as current facts.

## Architecture

```
src/
  App.tsx                  1,229 lines at baseline. All routing; eager route imports.
  main.tsx                 Entry: BrowserRouter + HelmetProvider + App
  hooks/useChat.ts         1,611 lines at baseline. Core chat state machine.
  services/                Client-side API wrappers
    ai/aiProxyService.ts   Talks to /api/ai-proxy; contains the stream parser
  context/                 AuthContext (Supabase session), ThemeContext
  components/
    chat/                  Message rendering, input, code blocks, previews
    contour/               Command palette — 25 modules + 25 views
    notes/                 Block-based Notion-like editor
    <feature>/             One directory per feature area
  types/database.ts        Handwritten Supabase types: 21 tables, not a live schema dump
  config/constants.ts      Client config, persona display data, feature flags

api/                       Vercel serverless functions
  ai-proxy.ts              3,215 lines at baseline. Main endpoint. Personas, prompts,
                           provider routing, rate limiting, memory, tools.
  _lib/
    auth.ts                getAuthenticatedRequestUser — verifies Supabase JWT
    tools.ts               Tool definitions, selection, policy, execution
    agentLoop.ts           Agentic tool-calling loop
    mcpClient.ts           MCP server discovery and tool execution
    specialModePrompts.js  Special-mode system prompts (plain JS)
  pro-generation.ts        Trigger.dev-backed long-running PRO jobs
  pro-stream.ts            Streaming for PRO jobs

supabase/migrations/       INCOMPLETE — 5 SQL files create 5 tables; see baseline inventory
trigger/                   Trigger.dev task definitions
```

### Request flow for a chat message

```
ChatInput → useChat → aiProxyService → POST /api/ai-proxy
  → rate limit check (Supabase)
  → resolve persona + special mode → system prompt
  → fetch user memories → inject into prompt
  → select tools → provider fetch (NVIDIA / Groq / Cerebras / Pollinations / Eaon)
  → optional agent loop for tool calls
  → stream back over a custom wire protocol
  → createStreamChunkParser in aiProxyService decodes it
```

### The streaming wire protocol

`/api/ai-proxy` streams `text/plain`, not SSE. The stream mixes:
- plain text tokens
- `[STATUS:...]` and `[IMAGE_ANALYZING]` inline markers
- ``-prefixed JSON control frames terminated by `\n` (used for MCP approval requests)

`createStreamChunkParser` in `src/services/ai/aiProxyService.ts` is the client decoder. It is intricate and has no dedicated parser tests — **change it carefully** and add tests if you touch it.

### Providers

Six are wired: `nvidia` (default), `groq`, `cerebras`, `pollinations`, `eaon`, `secretstoai`. Each has its own near-duplicate `fetch` block in `ai-proxy.ts` — around six of them. Adding a provider currently means touching all the call sites. Collapsing these into one adapter is a known refactor (`production-check.md` 3.5).

Which provider a run uses is decided in exactly one place: `resolveRunProvider(persona, personaConfig, flowState)` in `ai-proxy.ts`. The spend-ceiling check and the actual dispatch both read from it — don't reintroduce a second derivation, or the ceiling will bill a provider the run never touched.

**There are three personas: `default` (TimeMachine Air), `girlie`, and `pro`.** The `chatgpt` / `gemini` / `claude` / `grok` / `deepseek` personas were removed in full — see `production-check.md` 0.9. They routed to Pollinations while presenting other companies' marks, and their system prompts told the model to claim it *was* that company's product. Do not add them back.

## Environment variables

Client (`VITE_`-prefixed — **these are compiled into the public bundle**):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — required; `vite.config.ts` throws without them
- `VITE_MAINTENANCE_MODE`, `VITE_ACCESS_TOKEN_REQUIRED`, `VITE_BETA_ACCESS_TOKEN`

Server (never `VITE_`-prefixed):
- `NVIDIA_API_KEY` (or `NIM_API_KEY`), `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `POLLINATIONS_API_KEY`, `EAON_API_KEY`, `SECRETSTOAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — **required.** `rate_limits` is RLS-locked to the service role and `checkRateLimit` fails closed, so without this key every request 503s. `ai-proxy.ts` logs a loud error at boot when it is missing.
- `ALLOWED_ORIGINS` — comma-separated CORS allowlist. Same-origin requests are allowed implicitly, so an unset value warns rather than breaking the app.
- `ANON_TRIAL_SECRET` — HMACs the anonymous-trial device cookie. Unset means IP-only trial counting.
- `ANON_DEFAULT_PERSONA_LIMIT` (default 3) and `PROVIDER_DAILY_CEILING` (0 disables the ceiling)

**Never add a secret behind a `VITE_` prefix.** `src/config/constants.ts:7-9` currently exports `VITE_GROQ_API_KEY` / `VITE_CEREBRAS_API_KEY` / `VITE_NVIDIA_API_KEY` — these are unused and slated for deletion. Do not start using them.

`.env` is gitignored. `.env.example` documents the full set.

## Conventions

- **TypeScript strict mode** is on. Don't add `any` to silence an error — the codebase already has too many.
- **Tailwind** for styling. Glass-morphism aesthetic; theme tokens live in `src/themes/`.
- **Framer Motion** for animation, GSAP for a few loading effects.
- Components are function components with hooks. No class components except the error boundary.
- Comments in this codebase explain *why*, not *what*. Match that — several existing comments document non-obvious decisions and are worth reading.
- Import with the `@/` alias where it's already used; relative paths elsewhere. Both are in play.

## Things that will bite you

1. Build includes typechecking. `tsconfig.json` includes `src`, `api`, and `trigger`; add future `shared` contracts deliberately. For a fresh diagnostic run, use `npm run typecheck -- --incremental false`.
2. Database types are handwritten. `profiles.is_pro` does not establish a verified paid entitlement. See the source-only schema inventory and pending staging audit in the baseline.
3. The dev API middleware is a partial Vercel shim. It parses JSON into memory without the platform's body limits. Local success is not deployment verification.
4. `api/ai-proxy.ts` still contains provider dispatch, prompts, and duplicated paths. `resolveRunProvider` owns routing; preserve fallback, Flow State, special-mode, and persona behavior during extraction.
5. Auth is progressive; the shell renders before profile loading finishes. Cached client identity is not server authorization.
6. Error boundaries, a wildcard 404 route, UUID messages, typed failures, abort handling, and per-turn Retry exist. The 24 unit tests do not prove all end-to-end recovery cases. The shared loop still parses each received chunk independently and skips malformed JSON; fix this in TM-08.
7. The shared loop executes tools sequentially, defaults to five turns, and hides tools on the last turn. MCP discovery helpers are only wired into the approval endpoint; do not call main-chat MCP integration complete.
8. Two `ChatInput.tsx` files exist; `src/components/chat/ChatInput.tsx` is the main-chat input.
9. Notes types and persistence live inside `NotesPage.tsx`; every state change writes the whole `tm-notes` array. There is no shared transactional repository or stable `noteId` targeting yet.
10. History list views eagerly load message bodies. `/chat/:id` finds a session then redirects to `/` without passing it; do not assume it is a working source link. History-list selection uses a separate navigation-state path.
11. `saveLocalSession` catches and only logs write errors. Supabase saves delete and reinsert messages without a transaction; inserted rows omit original message IDs. These are existing storage risks, not work to fold into unrelated tasks.

## Storage direction

The owner decision in `superplan.md` D1 is authoritative: free personal history stays on-device; paid personal history also defaults to device storage, with cloud sync allowed only after a verified paid entitlement AND explicit opt-in. Air/PRO selection is separate from subscription authority. Notes stay local by default.

Today, signed-in personal chats still automatically use Supabase `chat_sessions` / `chat_messages`; anonymous chats use the `chatSessions` localStorage blob. The target IndexedDB store and paid opt-in gates are not implemented. A local-to-cloud migration helper exists, but no external caller was found in this checkout.

For new work:

- Route storage through the shared repository/ChatService. Do not add direct Supabase history consumers or build on the localStorage blob.
- Do not add automatic cloud history writes for free or opted-out users. Keep paid cloud sync disabled until TM-03 and TM-15 are verified.
- Preserve legacy cloud data until export/import and consent are verified. Gate LS does not authorize dropping history or memory tables.
- Account for provider processing, Trigger payloads/streams, PRO final output, memories, and group-chat storage separately. Actual service retention needs TM-02 verification.
- Never swallow storage errors; local data may have no backup.
- Do not claim that messages never leave the device or that TM retains no content. Current signup and privacy claims require reconciliation with actual behavior in TM-02/LS.1.

## Security rules for this codebase

Non-negotiable when writing code here:

- Identity comes from the verified JWT (`getAuthenticatedRequestUser`), **never** from the request body.
- The service-role Supabase client bypasses RLS. Use it only for genuinely system-level operations, never for reading user-scoped data.
- No new `dangerouslySetInnerHTML` without a reviewed sanitizer. `renderInline` (now `src/components/notes/renderInline.ts`) was the known XSS vector; it is fixed and covered by tests — read it before writing anything similar, and escape quotes, not just angle brackets, whenever output lands in an HTML attribute.
- Never combine `allow-scripts` with `allow-same-origin` in an iframe `sandbox` (0.6). All three iframes in the app now omit `allow-same-origin`; external sites still render fine without it.
- Any URL that reaches an iframe `src` must be an absolute `http(s)` URL — use `toSafeExternalUrl()`. A prefix test like `startsWith('http')` is not a scheme check: it also matches `httpfoo.com`, which resolves *relative to our own origin*.
- `rate_limits` is RLS-locked to the service role. Don't query it from the browser; use `GET /api/ai-proxy?quota=<persona>`.
- Validate and bound every API input with zod. `zod` is already a dependency.
- Don't log prompt content, tokens, or request bodies.

## Working agreement

- Prefer small, reviewable changes tied to a `production-check.md` task ID.
- If you fix an issue listed there, update its status in that file.
- Run `npx tsc --noEmit` and `npm run lint` before declaring a change done, and say honestly whether the counts went up or down.
- Don't commit or push unless asked.
