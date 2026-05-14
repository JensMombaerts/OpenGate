# Approval CLI

This document defines the MVP human approval CLI contract for pending OpenGate requests.

## Goals

- Let a human reviewer list and inspect pending requests.
- Let a human reviewer deny a pending request without executing it.
- Let a human reviewer approve and execute exactly the command that was queued.
- Audit human approval decisions.
- Move completed requests out of pending storage.

## Commands

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

The MVP should return JSON so humans can inspect output directly and scripts can parse it later.

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

The CLI response may include `stdout` and `stderr` bodies. Audit and resolved records must not store output bodies in the MVP.

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

The MVP should use these process exit codes for approval commands:

- `0`: approval command completed successfully.
- Tool exit code: approved command executed and returned a non-zero exit code.
- `2`: validation, missing request, malformed request, or storage error.

If `opengate approve` executes the tool, the tool exit code takes precedence because execution happened.

## Out Of Scope

These are not part of the MVP approval CLI contract:

- Bulk approval or denial.
- Session-level approval.
- Callback execution after approval.
- Human-readable table output.
- Interactive prompts.
- Reviewer identity and authentication.
