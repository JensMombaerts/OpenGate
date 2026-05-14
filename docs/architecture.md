# Architecture

This document captures the current architecture direction for OpenGate. The project should start with a small CLI-only MVP and keep broader policy-gate capabilities as future direction.

## Goal

OpenGate is a configurable gate between AI agents and external tools. Agents submit tool requests to OpenGate, and OpenGate decides whether to execute, deny, or defer those requests for approval.

The MVP should prove the core gate flow before adding MCP, HTTP, complex policy scopes, callbacks, or storage abstractions.

## MVP Scope

The MVP is intentionally small:

- CLI tools only.
- YAML configuration in `opengate.yaml`.
- One decision per configured tool: `allow`, `deny`, or `require_approval`.
- OpenGate executes allowed or approved tools itself.
- Commands are structured arrays, not shell strings.
- Tool params are named values substituted into command placeholders.
- Unknown tools default to `require_approval`.
- Tool output bodies are not written to audit logs.
- Audit events are written as JSONL.
- Pending approvals use file-based local storage for the first implementation.

This MVP should answer one question: can an agent safely route CLI tool execution through OpenGate with clear decisions and useful audit records?

## Deferred Scope

These capabilities are important, but not part of the MVP:

- MCP tool execution.
- HTTP endpoint tools.
- Agent, project, session, or environment scoped policy rules.
- Policy priority across multiple matching rules.
- Environment-specific config overrides.
- Configurable callback payloads.
- Redaction frameworks with field paths and named patterns.
- SQLite as a required storage backend.
- Bulk approval by agent session.
- Web or mobile approval APIs.

Deferred work should not shape the MVP implementation unless it prevents an obvious dead end.

## Core Flow

```text
agent -> OpenGate CLI -> load config -> resolve tool -> decision

allow            -> execute tool -> audit result -> return result
deny             -> audit denial -> return denial
require_approval -> store pending request -> audit pending -> return request ID
human deny      -> audit denial -> move request to resolved
human approve   -> audit approval -> execute planned command -> audit result -> move request to resolved
```

See [cli-contract.md](cli-contract.md) for the MVP agent-facing and human approval CLI contract.

See [audit-and-storage.md](audit-and-storage.md) for the MVP audit event and pending storage contract.

## Configuration

YAML is the preferred initial configuration format. See [configuration.md](configuration.md) for the MVP configuration contract.

The MVP config should stay readable and strict:

- Unknown fields are validation errors.
- Missing required fields are validation errors.
- Tool decisions must be explicit for configured tools.
- Commands must be arrays.
- Shell command strings are not allowed.

## Execution Model

OpenGate executes tools inside the gate boundary. Agents should not receive permission and then execute the underlying command themselves.

This keeps decision-making, execution, and audit logging in one place.

## Decisions

The MVP supports three decisions:

- `allow`: execute the configured CLI tool immediately.
- `deny`: reject the request.
- `require_approval`: store the request for later human approval.

For the MVP, decisions are configured directly on each tool. A broader policy engine can be designed later after the CLI gate flow is proven.

## Audit Logging

Audit logs should be structured JSONL events.

Pending approval records should use local JSON files under `.opengate/pending/`. Resolved approval records should use local JSON files under `.opengate/resolved/`.

MVP audit records should include enough metadata to understand what happened:

- Request ID.
- Tool ID.
- Decision.
- Timestamp.
- Execution status when executed.
- Exit code when available.
- Output size metadata when available.

Tool output bodies should not be logged in the MVP.

## Security Boundaries

The MVP should prioritize two security concerns:

- Avoid command injection by using structured command arrays and named params.
- Avoid secret leakage by not logging tool output bodies and by keeping request data minimal.

## Implementation Runtime

The MVP implementation uses TypeScript on Node.js. This keeps iteration fast, fits the MCP and HTTP ecosystem, and allows the CLI and future API to remain in one codebase.
