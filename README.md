# OpenGate

OpenGate is a gate layer for AI agents that need to call external tools through MCP or CLI interfaces.

The goal is to make tool access explicit, configurable, and auditable. Agents can submit tool requests to OpenGate, and OpenGate decides whether each request is allowed immediately, blocked, or queued for external approval based on project configuration.

## Intent

AI agents often need access to powerful local or remote tools. Direct access is convenient, but it can also be unsafe or hard to review. OpenGate provides a configurable control point between agents and tools.

OpenGate should support workflows where agents continue their session without waiting for every approval decision. Requests that need approval can be queued and resolved later, potentially through callbacks or another completion mechanism.

## Core Concepts

- **Agent**: The caller that wants to use a tool, such as OpenCode or another AI agent.
- **Tool**: A configured MCP server, CLI command, or other callable integration.
- **Gate**: The OpenGate decision layer that evaluates requests.
- **Policy**: Configuration that determines whether a request is allowed, denied, or requires approval.
- **Approval queue**: A deferred review mechanism for requests that cannot be granted immediately.
- **Callback action**: A future mechanism for notifying agents or systems when deferred decisions are resolved.

## Request Flow

```text
agent -> OpenGate -> policy evaluation -> allow | deny | queue for approval
                                      -> optional callback/result handling
```

## Configuration Direction

The tool and policy layer should be fully configurable through files. YAML is the current preferred format because it is readable for nested tool definitions and policy rules, while still being suitable for schema validation.

This preference can change if implementation experience shows that TOML or JSON is a better fit.

## Project Status

OpenGate is in the bootstrap phase. The current focus is defining the project intent, collaboration rules, and initial architecture before choosing a runtime, language, package manager, or implementation structure.

See [docs/architecture.md](docs/architecture.md) for the current architecture direction.

## License

OpenGate is licensed under the MIT License. See [LICENSE](LICENSE).
