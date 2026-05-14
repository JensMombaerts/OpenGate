# Configuration

This document defines the MVP configuration contract for OpenGate. It is intentionally small and focused on CLI tool execution.

## Purpose

`opengate.yaml` tells OpenGate which CLI tools exist and whether each tool should be allowed, denied, or deferred for approval.

The MVP config should be easy to read, strict to validate, and small enough to implement without building a full policy platform first.

## MVP Rules

- The default config file is `opengate.yaml` in the project root.
- YAML is the only MVP config format.
- `version: 1` is required.
- Only CLI tools are supported in the MVP.
- Every configured tool has exactly one `decision`.
- Supported decisions are `allow`, `deny`, and `require_approval`.
- Unknown tools default to `require_approval`.
- Commands are arrays, never shell strings.
- Tool params are named values substituted into command placeholders.
- Tool output bodies are not logged.
- Audit events are written as JSONL.

## Top-Level Shape

```yaml
version: 1

tools: {}

audit:
  path: ".opengate/audit.jsonl"
```

## Validation

MVP validation should be strict:

- Unknown top-level sections are errors.
- Unknown tool fields are errors.
- Missing required fields are errors.
- Invalid decisions are errors.
- Command values that are not arrays are errors.

## Tools

Tools are configured by stable IDs. Agents request tools by ID.

```yaml
tools:
  git_status:
    command: ["git", "status", "--short"]
    decision: allow
```

Each tool supports:

- `command`: required command array.
- `decision`: required decision.
- `params`: optional named params.
- `reason`: optional human-readable explanation for deny or approval decisions.

## Commands

Commands must be arrays so OpenGate can execute without shell interpolation.

Allowed:

```yaml
command: ["git", "status", "--short"]
```

Not allowed:

```yaml
command: "git status --short"
```

## Params

Params let agents provide named values to a tool request. Commands reference params with placeholders.

See [cli-contract.md](cli-contract.md) for how agents pass params to OpenGate.

```yaml
tools:
  show_file:
    command: ["sed", "-n", "1,120p", "{file}"]
    decision: require_approval
    params:
      file:
        required: true
```

MVP params support:

- `required`: whether the request must provide the param.
- `default`: optional default value when a param is not provided.

If a required param is missing and has no default, OpenGate should reject the request before execution.

The MVP should avoid complex validation. Allowlists, type schemas, secret annotations, and redaction rules can be added later if the simple contract proves useful.

## Decisions

### `allow`

OpenGate executes the tool immediately.

```yaml
tools:
  git_status:
    command: ["git", "status", "--short"]
    decision: allow
```

### `deny`

OpenGate rejects the request.

```yaml
tools:
  dangerous_delete:
    command: ["rm", "-rf", "{path}"]
    decision: deny
    reason: "Recursive deletion is not available through OpenGate."
    params:
      path:
        required: true
```

### `require_approval`

OpenGate stores the request as pending approval and returns a request ID.

```yaml
tools:
  git_apply:
    command: ["git", "apply", "{patch_file}"]
    decision: require_approval
    reason: "Applying patches changes the workspace."
    params:
      patch_file:
        required: true
```

## Unknown Tools

If an agent requests a tool that is not configured, OpenGate should return `require_approval` rather than executing anything.

Unknown tools must not execute automatically.

## Audit Logging

The MVP writes structured JSONL audit events to the configured path.

```yaml
audit:
  path: ".opengate/audit.jsonl"
```

Audit events should include request and decision metadata. They should not include tool output bodies.

See [audit-and-storage.md](audit-and-storage.md) for the MVP audit event and pending storage contract.

Useful MVP audit fields include:

- Request ID.
- Tool ID.
- Decision.
- Reason when available.
- Timestamp.
- Execution status when executed.
- Exit code when available.
- Output byte counts when available.

## Example Configuration

```yaml
version: 1

tools:
  git_status:
    command: ["git", "status", "--short"]
    decision: allow

  git_diff:
    command: ["git", "diff", "--", "{path}"]
    decision: allow
    params:
      path:
        default: "."

  git_apply:
    command: ["git", "apply", "{patch_file}"]
    decision: require_approval
    reason: "Applying patches changes the workspace."
    params:
      patch_file:
        required: true

  recursive_delete:
    command: ["rm", "-rf", "{path}"]
    decision: deny
    reason: "Recursive deletion is blocked in the MVP."
    params:
      path:
        required: true

audit:
  path: ".opengate/audit.jsonl"
```

## Deferred Design

These topics are intentionally deferred until after the CLI MVP works:

- MCP tools.
- HTTP tools.
- Agent, session, project, and environment scopes.
- Multiple policy rules per tool.
- Decision priority across multiple matching policies.
- Environment overrides.
- Callback actions.
- Configurable redaction.
- Secret param metadata.
- SQLite-backed approval storage.
- Bulk approval by agent session.
- Web and mobile approval APIs.

## Open Questions

- Should unknown tools default to `require_approval` forever, or should production configs use `deny`?
- Should MVP params support allowlists before the first release?
