# Agent Instructions

## Project Purpose

- OpenGate is a policy boundary for AI agents calling external tools.
- The MVP is CLI-only; MCP and HTTP integrations are deferred.
- Tool requests resolve to `allow`, `deny`, or `require_approval`.
- Decisions must be explicit, configurable, and auditable.

## Current State

- The project is in bootstrap/MVP phase.
- TypeScript on Node.js is the MVP runtime, with npm for package management.
- YAML is the MVP config format unless implementation feedback proves otherwise.

## Development Commands

- `npm run build`: compile TypeScript.
- `npm test`: run the test suite.
- `npm run check`: run build and tests.

## Architecture Constraints

- OpenGate executes approved tools inside the gate boundary.
- Keep the core model independent of any single agent, transport, runtime, or tool ecosystem.
- Prefer explicit configuration and strict validation over implicit behavior.
- Support deferred approvals as a first-class workflow.
- Keep the MVP small: CLI tools, per-tool decisions, JSONL audit, and minimal pending approval storage.

## Security And Audit Requirements

- Do not leak secrets through logs, callbacks, approval payloads, stored requests, or tool output handling.
- Keep commands and arguments structured; avoid shell interpolation where possible.
- Audit allow, deny, approval, and execution outcomes with enough metadata to reconstruct decisions.

## Documentation Rules

- Update docs when behavior, architecture, or project conventions change.
- Keep `README.md`, `AGENTS.md`, `docs/architecture.md`, and related design docs consistent.
- Put detailed architecture rationale in `docs/architecture.md`, not here.

## Workflow Notes

- Prefer small, focused changes.
- Keep commits atomic.
- Commit and push only after relevant checks or review.
- Avoid adding dependencies, infrastructure, or configuration files before there is a concrete need.
- Do not commit secrets, credentials, tokens, or local machine-specific configuration.
