# Configuration

This document defines the initial OpenGate configuration direction. It is a human-readable contract, not a machine schema or implementation commitment.

## Purpose

OpenGate configuration describes which tools exist, how agents may request them, how policies are evaluated, how approvals are queued, and how audit and redaction behavior works.

The first configuration format is YAML. The default project-level file name is `opengate.yaml`.

## Design Goals

- Keep tool access explicit and reviewable.
- Prefer strict validation over permissive parsing.
- Keep commands and callback actions structured, not shell-interpolated strings.
- Make policy decisions auditable.
- Make redaction and secret handling configurable.
- Avoid choosing a runtime, package manager, or schema tooling in this document.

## Config File

The default config file is `opengate.yaml` in the project root.

Every config must include a version:

```yaml
version: 1
```

The first version should use YAML as the primary authoring format. TOML and JSON may be reconsidered later if implementation feedback shows they are a better fit.

## Validation Rules

Configuration validation should be strict once implemented:

- Unknown top-level sections are errors.
- Unknown fields inside known sections are errors.
- Missing required fields are errors.
- Invalid enum values are errors.
- Tool command arrays must remain structured arrays, not shell command strings.
- Callback command arrays must remain structured arrays, not shell command strings.
- Secret values must not be logged or sent in callbacks unless explicitly allowed and redacted.
- Policy decisions must be one of `allow`, `deny`, or `require_approval`.

Reasons are optional. OpenGate should still provide a useful fallback explanation when a policy does not define one.

## Top-Level Shape

The initial top-level shape should be:

```yaml
version: 1
environment: local

environments: {}
agents: {}
tools: {}
policies: []
approvals: {}
callbacks: {}
audit: {}
redaction: {}
```

Required sections and exact field requirements will be finalized when a machine-readable schema is introduced.

## Environments

OpenGate should support named environment blocks. A base config defines defaults, and named environments can override specific values.

```yaml
environment: local

environments:
  local:
    audit:
      level: standard
  ci:
    audit:
      level: high
```

Exact merge semantics are still open. The intended model is explicit overrides, not implicit behavior hidden from review.

## Tools

Tools are configured by stable IDs. Policies reference these IDs through `match.tool`.

```yaml
tools:
  git_status:
    type: cli
    command: ["git", "status", "--short", "{params.path}"]
```

The first concrete tool type is `cli`. MCP and HTTP should remain part of the config model, but their detailed shape can be defined later.

## CLI Tools

CLI tools use command arrays. OpenGate must not require shell interpolation to execute a configured CLI tool.

Agent-provided input should use named params. Command arrays can refer to params through placeholders such as `{params.path}`.

```yaml
tools:
  list_directory:
    type: cli
    command: ["ls", "-la", "{params.path}"]
    params:
      path:
        type: string
        default: "."
        allowlist:
          - "."
          - "docs"
```

CLI params should support allowlist validation first. More expressive validation may be added later only when there is a concrete need.

Params may be marked as secrets. Secret params must be redacted in logs, callbacks, approval payloads, and stored requests unless a future config explicitly permits a safer alternative.

```yaml
params:
  token:
    type: string
    secret: true
```

## MCP Tools

MCP is an expected integration surface, but the first configuration document only treats it conceptually.

Future MCP configuration should map MCP servers and tools into the same policy model as CLI tools. Policies should still use stable tool IDs and the same decision model.

```yaml
tools:
  example_mcp_tool:
    type: mcp
    # Detailed MCP configuration is intentionally deferred.
```

## HTTP Tools

HTTP endpoints are also expected tool integrations, but their detailed configuration is deferred.

Future HTTP configuration should support explicit host, method, request shape, response handling, audit, and redaction behavior. Network access should remain explicit and policy-controlled.

```yaml
tools:
  example_http_tool:
    type: http
    # Detailed HTTP configuration is intentionally deferred.
```

## Named Params

Agents should submit named params instead of raw shell strings. OpenGate maps those params into configured tool command arrays through placeholders.

Missing params may use configured defaults. If no value and no default exists, OpenGate should reject the request as a validation error before policy execution.

Params should be validated against allowlists in the first implementation. This keeps early behavior simple and safe.

## Policies

Policies use a `match` object to describe scope. Supported scopes are agent, session, tool, project workspace path, and environment.

```yaml
policies:
  - id: deny_sensitive_tool_in_ci
    match:
      tool: deploy_production
      environment: ci
    decision: deny
    reason: "Production deploys are not allowed from CI agents."

  - id: approve_git_apply
    match:
      tool: git_apply
      project:
        workspace_path: "/home/jens/Projects/OpenGate"
    decision: require_approval
    reason: "Patch application changes the workspace and requires review."
    audit_level: high

  - id: allow_git_status
    match:
      tool: git_status
    decision: allow
```

If multiple policies match, decision priority is fixed:

```text
deny > require_approval > allow
```

Policy order does not override this priority. If multiple policies match at the same decision level, OpenGate should return the winning decision with one relevant reason. Detailed aggregation can be revisited later.

If no policy matches, the default decision is `require_approval`. Config authors should still define an explicit fallback policy for readability.

```yaml
policies:
  - id: fallback_review
    match: {}
    decision: require_approval
    reason: "No more specific policy matched this request."
```

## Approvals

Requests with `require_approval` are stored in an approval queue. The first approval interface should be human-facing CLI review.

Configuration should support reviewer hints on tools or policies:

```yaml
approvals:
  queue: required
  reviewer_hints:
    labels: ["filesystem", "workspace-write"]
    risk: medium
    message: "Review whether this request can modify project files."
```

OpenGate should support approval per request and bulk approval or denial for all open requests in an agent session.

## Callbacks

The first callback type is a CLI command array. Callback commands must be structured arrays and must not require shell interpolation.

```yaml
callbacks:
  notify_agent:
    type: cli
    command: ["opengate-agent-callback", "--request", "{request.id}"]
    payload:
      include_request: true
      include_decision: true
      include_execution_metadata: true
      include_output_body: false
```

Callback payload groups should be configurable. Output body may only be included when explicitly enabled and redaction is active for that payload.

## Audit Logging

Audit logging should use structured JSONL events.

```yaml
audit:
  path: ".opengate/audit.jsonl"
  level: standard
  output:
    body: omit
    metadata: true
```

Audit logs should include enough metadata to reconstruct decisions, approvals, denials, and executions. Tool output bodies should not be logged by default. Output metadata such as status, exit code, size, duration, and redaction state may be logged.

Policies may set `audit_level` for higher-risk requests.

## Redaction

Redaction should support both named patterns and explicit field paths.

```yaml
redaction:
  patterns:
    - secret
    - token
    - password
    - api_key
  fields:
    - "request.params.token"
    - "callbacks.payload.output.body"
```

Params marked with `secret: true` must also be treated as redaction targets.

## Example Configuration

```yaml
version: 1
environment: local

environments:
  local:
    audit:
      level: standard
  ci:
    audit:
      level: high

tools:
  git_status:
    type: cli
    command: ["git", "status", "--short", "{params.path}"]
    params:
      path:
        type: string
        default: "."
        allowlist: [".", "docs"]

  git_apply:
    type: cli
    command: ["git", "apply", "{params.patch_file}"]
    params:
      patch_file:
        type: string
        allowlist: ["/tmp/opencode/generated.patch"]

  example_mcp_tool:
    type: mcp

  example_http_tool:
    type: http

policies:
  - id: deny_ci_patch_apply
    match:
      tool: git_apply
      environment: ci
    decision: deny
    reason: "Applying patches from CI is not allowed."

  - id: review_workspace_writes
    match:
      tool: git_apply
      project:
        workspace_path: "/home/jens/Projects/OpenGate"
    decision: require_approval
    reason: "Patch application modifies the workspace."
    audit_level: high

  - id: allow_status_checks
    match:
      tool: git_status
    decision: allow

  - id: fallback_review
    match: {}
    decision: require_approval
    reason: "No more specific policy matched this request."

approvals:
  queue: required
  reviewer_hints:
    labels: ["workspace", "agent-request"]
    risk: medium
    message: "Review queued requests before allowing workspace changes."

callbacks:
  notify_agent:
    type: cli
    command: ["opengate-agent-callback", "--request", "{request.id}"]
    payload:
      include_request: true
      include_decision: true
      include_execution_metadata: true
      include_output_body: false

audit:
  path: ".opengate/audit.jsonl"
  level: standard
  output:
    body: omit
    metadata: true

redaction:
  patterns: ["secret", "token", "password", "api_key"]
  fields:
    - "request.params.token"
    - "callbacks.payload.output.body"
```

## Additional Snippets

A secret param:

```yaml
params:
  api_token:
    type: string
    secret: true
```

A high-risk approval policy:

```yaml
policies:
  - id: review_network_call
    match:
      tool: external_api_request
      agent:
        id: opencode
    decision: require_approval
    audit_level: high
```

A session-scoped approval policy:

```yaml
policies:
  - id: review_session_changes
    match:
      session:
        id: "agent-session-123"
    decision: require_approval
```

## Open Questions

- What are the exact environment override merge rules?
- What is the exact request format for named params?
- How should MCP servers and tools be configured in detail?
- How should HTTP hosts, methods, paths, headers, and bodies be configured in detail?
- How should callback payload redaction be proven before output body inclusion is allowed?
- Should fallback policies become required once the schema is implemented?
