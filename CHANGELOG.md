# Changelog

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
