# Audit And Storage

This document defines the MVP audit event, pending approval storage, and resolved request storage contract for OpenGate.

## Goals

- Correlate CLI responses, audit events, pending approval records, and resolved records with one `request_id`.
- Record enough metadata to understand gate decisions and executions.
- Avoid writing tool output bodies to audit logs or pending request records.
- Keep MVP pending storage simple and local.
- Avoid choosing SQLite or another database before the CLI MVP proves the flow.

## Request IDs

Every OpenGate request should get a unique `request_id` as early as possible.

The same `request_id` should appear in:

- The CLI JSON response.
- JSONL audit events.
- Pending approval records when a request requires approval.
- Resolved records after a human approval or denial.

The exact ID format is implementation-defined, but IDs should be stable, unique, and safe for filenames.

## Audit Log Path

The MVP audit path comes from `opengate.yaml`:

```yaml
audit:
  path: ".opengate/audit.jsonl"
```

OpenGate should create parent directories when needed.

## Audit Format

Audit logs are append-only JSONL. Each line is one JSON object.

Each event should include:

- `event`: audit event type.
- `request_id`: request identifier.
- `timestamp`: event timestamp in ISO 8601 format.
- `tool`: requested tool ID when available.
- `decision`: `allow`, `deny`, or `require_approval` when available.
- `status`: request or execution status.
- `reason`: decision reason when available.

Tool output bodies must not be written to audit events in the MVP.

## Audit Event Types

The MVP should support these event types:

- `validation_error`: OpenGate rejected the request before decision or execution.
- `denied`: OpenGate denied the request and did not execute the tool.
- `pending`: OpenGate stored the request for approval and did not execute the tool.
- `approval_denied`: A human denied a pending request.
- `approval_approved`: A human approved a pending request for execution.
- `executed`: OpenGate executed an allowed or approved tool.

See [cli-contract.md](cli-contract.md) for human approval commands.

## Validation Error Event

```json
{
  "event": "validation_error",
  "request_id": "req_01j02...",
  "timestamp": "2026-05-14T12:00:00Z",
  "status": "validation_error",
  "error": "missing required param: patch_file"
}
```

Validation errors should be audited when a request ID can be created safely.

## Denied Event

```json
{
  "event": "denied",
  "request_id": "req_01j00...",
  "timestamp": "2026-05-14T12:00:00Z",
  "tool": "recursive_delete",
  "decision": "deny",
  "status": "denied",
  "reason": "Recursive deletion is blocked in the MVP."
}
```

## Pending Event

```json
{
  "event": "pending",
  "request_id": "req_01j01...",
  "timestamp": "2026-05-14T12:00:00Z",
  "tool": "git_apply",
  "decision": "require_approval",
  "status": "pending",
  "reason": "Applying patches changes the workspace."
}
```

## Executed Event

```json
{
  "event": "executed",
  "request_id": "req_01hzy...",
  "timestamp": "2026-05-14T12:00:00Z",
  "tool": "git_status",
  "decision": "allow",
  "status": "executed",
  "exit_code": 0,
  "stdout_bytes": 14,
  "stderr_bytes": 0
}
```

Executed events should record output byte counts, not output bodies.

## Approval Denied Event

```json
{
  "event": "approval_denied",
  "request_id": "req_01j01...",
  "timestamp": "2026-05-14T12:10:00Z",
  "tool": "git_apply",
  "decision": "deny",
  "status": "denied",
  "reason": "Not safe for this session"
}
```

## Approval Approved Event

```json
{
  "event": "approval_approved",
  "request_id": "req_01j01...",
  "timestamp": "2026-05-14T12:10:00Z",
  "tool": "git_apply",
  "decision": "allow",
  "status": "approved"
}
```

## Pending Storage

The MVP pending approval store is file-based.

Pending requests should be stored under:

```text
.opengate/pending/<request_id>.json
```

OpenGate should create parent directories when needed.

This storage choice is intentionally minimal. SQLite or another backend can be introduced later if file-based storage becomes insufficient.

## Pending Record Shape

A pending record should include the request data needed to review and later execute the exact request that was deferred.

```json
{
  "request_id": "req_01j01...",
  "created_at": "2026-05-14T12:00:00Z",
  "tool": "git_apply",
  "decision": "require_approval",
  "status": "pending",
  "reason": "Applying patches changes the workspace.",
  "params": {
    "patch_file": "/tmp/opencode/generated.patch"
  },
  "planned_command": ["git", "apply", "/tmp/opencode/generated.patch"]
}
```

Approval should execute the stored `planned_command` so reviewers approve the exact argv array that was queued.

## Resolved Storage

Resolved requests should be stored under:

```text
.opengate/resolved/<request_id>.json
```

OpenGate should move a pending request to resolved storage after a human approval or denial is recorded.

## Resolved Denial Record

```json
{
  "request_id": "req_01j01...",
  "created_at": "2026-05-14T12:00:00Z",
  "resolved_at": "2026-05-14T12:10:00Z",
  "tool": "git_apply",
  "decision": "deny",
  "status": "denied",
  "reason": "Not safe for this session",
  "params": {
    "patch_file": "/tmp/opencode/generated.patch"
  },
  "planned_command": ["git", "apply", "/tmp/opencode/generated.patch"]
}
```

## Resolved Approval Record

```json
{
  "request_id": "req_01j01...",
  "created_at": "2026-05-14T12:00:00Z",
  "resolved_at": "2026-05-14T12:10:00Z",
  "tool": "git_apply",
  "decision": "allow",
  "status": "executed",
  "params": {
    "patch_file": "/tmp/opencode/generated.patch"
  },
  "planned_command": ["git", "apply", "/tmp/opencode/generated.patch"],
  "execution": {
    "exit_code": 0,
    "stdout_bytes": 0,
    "stderr_bytes": 0
  }
}
```

## Output Handling

The CLI response may include `stdout` and `stderr` bodies for executed tools.

Audit events, pending records, and resolved records must not include `stdout` or `stderr` bodies in the MVP. They may include byte counts and execution metadata.

## Failure Handling

If audit writing fails after a tool has executed, OpenGate should still return the tool result but include an implementation-visible warning or error path once the runtime exists.

If pending storage fails for a `require_approval` request, OpenGate must not report the request as pending. It should return a validation or storage error instead.

If resolved storage fails after a human approval or denial, OpenGate must not remove the pending record.

## Deferred Design

These topics are outside the MVP:

- SQLite-backed storage.
- Session-level bulk approval storage.
- Tamper-evident audit logs.
- Configurable audit redaction.
- Storage locking across concurrent OpenGate processes.
