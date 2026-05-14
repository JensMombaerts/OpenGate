# CLI Contract

This document defines the MVP CLI contract for agents and human reviewers using OpenGate. It is intentionally small and focused on routing configured CLI tools through the gate.

## Goals

- Give agents one predictable command for requesting tool execution.
- Give human reviewers simple commands for pending approvals.
- Return machine-readable JSON responses.
- Keep request input structured.
- Keep execution, decisions, pending approvals, and audit logging inside OpenGate.
- Avoid shell interpolation.

## Common Rules

The MVP CLI should return JSON on stdout for completed OpenGate commands, including denials, pending approvals, and approval actions.

The default config path is `opengate.yaml` in the current working directory. The CLI may later support an explicit config flag, but the MVP contract should not require it.

Tool output bodies may be returned in CLI responses because agents and humans need command results. They must not be written to audit logs, pending records, or resolved records in the MVP.

## Agent Command

Agents request a configured tool with `opengate run`:

```bash
opengate run <tool-id> [--param key=value ...]
```

Examples:

```bash
opengate run git_status
opengate run git_diff --param path=docs
opengate run git_apply --param patch_file=/tmp/opencode/generated.patch
```

## Params

Params are named values supplied with repeated `--param key=value` flags.

```bash
opengate run show_file --param file=README.md
```

OpenGate maps params into configured command placeholders.

Given this config:

```yaml
tools:
  show_file:
    command: ["sed", "-n", "1,120p", "{file}"]
    decision: require_approval
    params:
      file:
        required: true
```

This request:

```bash
opengate run show_file --param file=README.md
```

resolves to this argv array if approved:

```text
["sed", "-n", "1,120p", "README.md"]
```

Params must not be interpolated through a shell command string.

## Decisions

The CLI returns one of three decisions:

- `allow`: OpenGate executed the configured tool.
- `deny`: OpenGate rejected the request.
- `require_approval`: OpenGate stored the request as pending approval.

Unknown tools return `require_approval` and must not execute.

## Successful Execution Response

When a tool is allowed and executes successfully, OpenGate returns JSON like:

```json
{
  "request_id": "req_01hzy...",
  "tool": "git_status",
  "decision": "allow",
  "status": "executed",
  "exit_code": 0,
  "stdout": " M README.md\n",
  "stderr": ""
}
```

## Failed Execution Response

If an allowed tool executes but exits with a non-zero code, OpenGate still returns `decision: allow` and `status: executed` because the gate allowed execution.

```json
{
  "request_id": "req_01hzz...",
  "tool": "git_status",
  "decision": "allow",
  "status": "executed",
  "exit_code": 128,
  "stdout": "",
  "stderr": "fatal: not a git repository\n"
}
```

The process exit code should match the tool exit code for executed tools.

## Deny Response

When a tool decision is `deny`, OpenGate does not execute the command.

```json
{
  "request_id": "req_01j00...",
  "tool": "recursive_delete",
  "decision": "deny",
  "status": "denied",
  "reason": "Recursive deletion is blocked in the MVP."
}
```

## Pending Approval Response

When a tool decision is `require_approval`, OpenGate stores the request and returns a request ID.

```json
{
  "request_id": "req_01j01...",
  "tool": "git_apply",
  "decision": "require_approval",
  "status": "pending",
  "reason": "Applying patches changes the workspace."
}
```

Pending request storage is defined in [audit-and-storage.md](audit-and-storage.md).

## Validation Error Response

Validation errors happen before execution. Examples include missing config, invalid config, unknown flags, malformed params, or missing required params.

```json
{
  "request_id": "req_01j02...",
  "decision": "deny",
  "status": "validation_error",
  "error": "missing required param: patch_file"
}
```

Validation errors should be audited when a request ID can be created safely.

## Human Approval Commands

The MVP approval CLI should support:

```bash
opengate pending list
opengate pending show <request_id>
opengate deny <request_id> --reason "Not safe for this session"
opengate approve <request_id>
```

Bulk approval and denial are deferred.

## Pending List

`opengate pending list` returns the currently pending requests.

```json
{
  "status": "ok",
  "pending": [
    {
      "request_id": "req_01j01...",
      "tool": "git_apply",
      "created_at": "2026-05-14T12:00:00Z",
      "reason": "Applying patches changes the workspace."
    }
  ]
}
```

## Pending Show

`opengate pending show <request_id>` returns the pending record for review.

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

The reviewer should approve or deny the exact `planned_command` shown in this record.

## Deny Flow

`opengate deny <request_id> --reason <reason>` records a human denial.

When a request is denied, OpenGate must:

- Read `.opengate/pending/<request_id>.json`.
- Not execute `planned_command`.
- Append an `approval_denied` audit event.
- Move the record to `.opengate/resolved/<request_id>.json`.
- Store denial metadata in the resolved record.
- Remove the pending record after the resolved record is written.
- Return JSON to the human CLI.

Example response:

```json
{
  "request_id": "req_01j01...",
  "tool": "git_apply",
  "decision": "deny",
  "status": "denied",
  "reason": "Not safe for this session"
}
```

Exit code should be `0` when the denial is recorded successfully.

## Approve Flow

`opengate approve <request_id>` approves and executes the stored `planned_command` immediately.

When a request is approved, OpenGate must:

- Read `.opengate/pending/<request_id>.json`.
- Append an `approval_approved` audit event.
- Execute the stored `planned_command` without shell interpolation.
- Append an `executed` audit event with output byte counts.
- Move the record to `.opengate/resolved/<request_id>.json`.
- Store approval and execution metadata in the resolved record.
- Remove the pending record after the resolved record is written.
- Return JSON to the human CLI.

Example response:

```json
{
  "request_id": "req_01j01...",
  "tool": "git_apply",
  "decision": "allow",
  "status": "executed",
  "exit_code": 0,
  "stdout": "",
  "stderr": ""
}
```

## Missing Or Resolved Requests

If the pending request does not exist, OpenGate should return a validation-style error:

```json
{
  "request_id": "req_missing",
  "status": "not_found",
  "error": "pending request not found"
}
```

If a request has already been resolved, OpenGate should not replay approval or denial. It should return an error instead of executing anything.

## Process Exit Codes

The MVP should use stable process exit codes:

- `0`: command completed successfully, or a tool executed and returned exit code `0`.
- Tool exit code: tool executed and returned a non-zero exit code.
- `2`: OpenGate validation, configuration, missing request, malformed request, or storage error.
- `3`: request denied.
- `4`: request stored as pending approval.

If a tool exits with `2`, `3`, or `4`, the tool exit code still takes precedence because execution happened. OpenGate-specific codes only apply when OpenGate does not execute the tool.

## Audit Requirements

Every request should produce a JSONL audit event when possible.

The audit event should include request and decision metadata, but not tool output bodies. CLI response output and audit output are intentionally different.

See [audit-and-storage.md](audit-and-storage.md) for the JSONL event and storage contracts.

Useful MVP audit fields include:

- Request ID.
- Tool ID.
- Decision.
- Status.
- Reason or validation error when available.
- Timestamp.
- Exit code when executed.
- Stdout and stderr byte counts when executed.

## Out Of Scope

These are not part of this MVP CLI contract:

- MCP tool requests.
- HTTP tool requests.
- Bulk approval or denial.
- Session-level approval.
- Callback execution.
- Agent/session/project identity flags.
- Configurable response formats.
- Human-readable output mode.
- Interactive prompts.
- Reviewer identity and authentication.
- Streaming tool output.
