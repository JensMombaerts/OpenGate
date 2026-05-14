# CLI Contract

This document defines the MVP CLI contract for agents calling OpenGate. It is intentionally small and focused on routing configured CLI tools through the gate.

## Goals

- Give agents one predictable command for requesting tool execution.
- Return machine-readable JSON responses.
- Keep request input structured.
- Keep execution, decisions, pending approvals, and audit logging inside OpenGate.
- Avoid shell interpolation.

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

The MVP should return JSON on stdout for every completed OpenGate request, including denials and pending approvals.

## Config Discovery

The MVP default config path is `opengate.yaml` in the current working directory.

The CLI may later support an explicit config flag, but the MVP contract should not require it.

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

Tool output bodies may be returned in the CLI response because agents need command results. They must not be written to audit logs in the MVP.

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

The MVP does not define the human approval command yet. Approval execution is a follow-up contract.

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

## Process Exit Codes

The MVP should use stable process exit codes:

- `0`: tool executed and returned exit code `0`.
- Tool exit code: tool executed and returned a non-zero exit code.
- `2`: OpenGate validation or configuration error.
- `3`: request denied.
- `4`: request stored as pending approval.

If a tool exits with `2`, `3`, or `4`, the tool exit code still takes precedence because execution happened. OpenGate-specific codes only apply when OpenGate does not execute the tool.

## Audit Requirements

Every request should produce a JSONL audit event when possible.

The audit event should include request and decision metadata, but not tool output bodies. CLI response output and audit output are intentionally different.

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
- Human approval commands.
- Callback execution.
- Agent/session/project identity flags.
- Configurable response formats.
- Human-readable output mode.
- Streaming tool output.
