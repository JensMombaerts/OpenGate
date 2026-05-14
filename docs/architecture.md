# Architecture

This document captures the initial architecture direction for OpenGate. It is intentionally implementation-neutral until the core model and workflow are stable.

## Goal

OpenGate is a configurable gate layer between AI agents and external tools. Agents submit tool requests to OpenGate, and OpenGate evaluates those requests against explicit policy before executing, denying, or deferring them for approval.

OpenGate should make tool access auditable and controllable without coupling the core model to a specific agent, runtime, transport, or tool ecosystem.

## Principles

- Treat OpenGate as a policy boundary, not just a command wrapper.
- Keep tool access explicit and configurable.
- Make every allow, deny, and approval decision auditable.
- Support deferred approval flows as a first-class workflow.
- Avoid leaking secrets through logs, callbacks, approval payloads, or tool output handling.
- Keep commands and arguments structured to reduce command injection risk.
- Avoid committing to a runtime, package manager, or repository structure until there is a concrete implementation need.

## Initial Interface

The first interface should be CLI-first. Agents submit requests through a single command that identifies the requested tool and provides structured request data.

The exact CLI contract is still open, but the first version should optimize for agent usage rather than human convenience. Responses should be structured so agents can reliably interpret decisions, request IDs, reasons, and deferred status.

MCP remains an expected integration surface, but it does not need to be the first implemented interface.

## Execution Model

OpenGate should execute the configured tool after a request is allowed or approved. Agents should not receive permission and then execute the underlying tool themselves in the primary flow.

This keeps policy enforcement, execution, audit logging, and output handling inside the gate boundary.

## Policy Model

The initial decision model should include three outcomes:

- `allow`: OpenGate may execute the tool immediately.
- `deny`: OpenGate must reject the request and return a detailed reason.
- `require_approval`: OpenGate stores the request for later approval and returns a deferred response.

Policies should support these scopes from the beginning:

- Agent scope: rules can vary by caller or agent identity.
- Tool scope: rules can vary by configured tool.
- Project scope: rules can vary by repository or workspace.
- Environment scope: rules can vary by local, development, CI, production, or another named environment.

Policies should also support audit levels so sensitive or high-risk requests can receive stronger audit treatment than routine requests.

## Configuration

YAML is the preferred initial configuration format. It is readable for nested tool definitions, policy rules, scopes, approval settings, and callback definitions.

Configuration must be validated strictly once the schema exists. Unknown fields, missing required fields, and invalid types should be treated as errors rather than silently ignored.

See [configuration.md](configuration.md) for the initial human-readable configuration contract.

The configuration model should account for:

- Configured CLI tools.
- Configured MCP tools or servers.
- Configured HTTP endpoints.
- Policy rules and scopes.
- Approval behavior.
- Callback behavior.
- Audit and redaction settings.

## Tool Types

OpenGate should support these tool categories:

- CLI commands.
- MCP servers or tools.
- HTTP endpoints.

CLI commands are the preferred first implementation target. MCP and HTTP should remain part of the model so early decisions do not make them awkward to add later.

## Approval Lifecycle

When a request requires approval, OpenGate should store it and return a deferred response to the agent. The agent should be able to continue its session without waiting for a human decision.

The first approval interface should be a human-facing CLI. A reviewer should be able to approve or deny individual requests, or handle all open requests for a specific agent session.

Later, OpenGate should expose an API suitable for web and mobile approval interfaces.

When a deferred request is resolved, OpenGate should support callback behavior. The callback payload should be able to include the original request metadata and the execution output when the approved tool has run.

## Storage

SQLite is the preferred first storage backend for pending requests, sessions, approvals, and decision state.

The storage layer should be designed so it can become pluggable later. This keeps the first implementation practical while leaving room for other storage backends if OpenGate needs to support different deployment models.

## Audit Logging

OpenGate should produce structured audit logs in JSONL format. Audit events should be append-friendly and machine-readable.

Audit logs should capture enough information to reconstruct decisions, including request identity, timestamps, caller metadata, policy outcome, reasons, and approval status.

Tool output should not be logged by default. The baseline should log output metadata only, such as status, size, exit code, duration, and whether output was redacted or omitted.

Redaction should be configurable so sensitive request fields, callback payload fields, and logs can be filtered per tool or policy.

## Security Boundaries

The initial design should prioritize two security concerns:

- Secret leakage: secrets must not appear in logs, callbacks, approval payloads, or stored tool output unless explicitly allowed by configuration.
- Command injection: commands and arguments should remain structured, validated, and separated from shell interpolation whenever possible.

Future policy work may add path restrictions, network egress restrictions, and stronger integrity guarantees for audit logs.

## Open Questions

- Which runtime and language should implement OpenGate?
- What should the exact CLI request and response contract look like?
- How should agent sessions be identified and correlated with deferred approvals?
- What callback transports should be supported first?
- How should web and mobile approval APIs authenticate callers and reviewers?
- How should MCP and HTTP tools map into the same policy and audit model as CLI tools?
