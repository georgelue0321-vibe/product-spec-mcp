# Changelog

## 0.3.28 - Mimo JSON response hardening

- Added `response_format: { type: "json_object" }` to Online Gate LLM calls.
- Strengthened the remote gate prompt with a compact JSON example and stricter JSON-only instructions.
- Made OpenAI-compatible response parsing tolerate content arrays, reasoning content, plain text choices, and fenced JSON.
- Verified the deployed Worker can call `mimo-v2.5` and return a valid `data_visualization_site` decision.

## 0.3.27 - Mimo online gate default

- Switched the Cloudflare Online Gate template default provider to Mimo's OpenAI-compatible endpoint.
- Defaulted the remote gate model to `mimo-v2.5` with `LLM_PROVIDER`, `LLM_BASE_URL`, and `LLM_MODEL` Worker vars.
- Kept DeepSeek as a later switchable provider through Worker vars and `DEEPSEEK_API_KEY`.

## 0.3.26 - PM intent gate

- Added a PM-style intent gate that classifies usage scope, maintenance mode, access topology, technical shape, and deployment direction before domain templates.
- Added gate-specific handling for multi-user collaboration, content marketing sites, and xlsx/csv data visualization sites, including safer defaults and boundary questions.
- Added an optional remote Online Gate client protocol with local-rule fallback, schema validation, prompt truncation, telemetry mode, and hard local corrections.
- Added a Cloudflare Workers P0 Online Gate template with KV prompt cache, IP daily limit, D1 redacted sample storage, and an OpenAI-compatible JSON classification provider.
- Carried `pmIntentDecision` through assist, compile, architecture, and acceptance structured outputs.
- Added regression coverage for household tools, roommate task collaboration, gym GEO content sites, xlsx chart sites, and negative local/static/backend routing cases.

## 0.3.25 - Local MVP spec quality

- Fed local tool signals into generic local-first spec generation so MVP drafts include concrete fields, data examples, and acceptance criteria.
- Defaulted recognizable household/local record tools to Draft Ready with localStorage scope instead of showing contradictory Not Ready wording.
- Kept the change horizontal: no new medicine domain pack, and backend/domain upgrades still require explicit signals.

## 0.3.24 - Beginner MVP draft output

- Changed generic local-first beginner requests to return an MVP spec draft from `product_spec_assist` instead of only an interrogation result.
- Included architecture, data, API, non-goals, and acceptance sections in local-first draft markdown while keeping backend upgrades gated by explicit signals.
- Added regression coverage so household medicine requests produce a lightweight localStorage MVP draft without registration/admin template pollution.

## 0.3.23 - Visual polish is not backend scope

- Clarified that "页面高级一点" affects UI direction and acceptance, not backend/login/database scope.
- Added local beginner-tool guidance that advanced visual polish remains compatible with `localStorage`.
- Added regression coverage to prevent agents from treating visual quality as a reason to override local-first architecture.

## 0.3.22 - Beginner default flow guidance

- Changed local beginner tool assist results to recommend `spec_compile` with defaults instead of blocking on all questions.
- Added agent guidance to avoid asking users to answer raw quickQuestions or compact choices like `B + a`.
- Kept quickQuestions available for structured consumers while encouraging one natural-language confirmation at most.

## 0.3.21 - Local tool signal extraction

- Added horizontal signal extraction for beginner local tools without adding new domain packs.
- Contextualized local-first quick questions with inferred record object, fields, reminders, inventory, and visual requirements.
- Improved generic local-tool specs and acceptance checks for short requests such as household medicine tracking.

## 0.3.20 - README cleanup

- Moved maintainer notes out of the main README flow.
- Replaced npm-rendered relative docs links with a GitHub maintainer link.
- Removed client-specific WorkBuddy wording from the public README introduction.

## 0.3.19 - Local-first Gate release candidate

- Added a shared `technicalProfile` across assist, interrogation, compile, architecture, and acceptance outputs.
- Changed product planning to classify technical complexity before business domain matching.
- Defaulted beginner/local tools to static pages, browser storage, JSON import/export, or `data.json` pages.
- Preserved backend/domain handling for registration, AI SaaS, digital commerce, and knowledge-base scenarios.
- Added beginner-friendly examples to clarification questions.
- Added black-box MCP regression coverage for local-first and reverse-domain scenarios.
- Fixed publish/test ordering so fresh clones build `dist/index.cjs` before black-box tests run.
