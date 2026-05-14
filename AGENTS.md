# Agent Instructions

## Project Purpose

- OpenGate is a policy boundary for AI agents calling external tools through CLI, MCP, or HTTP integrations.
- Tool requests resolve to `allow`, `deny`, or `require_approval`.
- Decisions must be explicit, configurable, and auditable.

## Current State

- The project is in bootstrap/design phase.
- Do not introduce a runtime, package manager, framework, schema, or infrastructure choice without a concrete implementation need.
- YAML is the preferred initial config format unless implementation feedback proves otherwise.

## Development Commands

- No build, test, lint, or format commands are defined yet.
- When commands are introduced, add the exact focused checks here.

## Architecture Constraints

- OpenGate executes approved tools inside the gate boundary.
- Keep the core model independent of any single agent, transport, runtime, or tool ecosystem.
- Prefer explicit configuration and strict validation over implicit behavior.
- Support deferred approvals as a first-class workflow.

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
