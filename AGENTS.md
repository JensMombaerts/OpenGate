# Agent Instructions

These instructions apply to AI agents working in this repository.

## Project Intent

OpenGate is a configurable gate layer for AI agents that call external tools through MCP or CLI interfaces. The gate decides whether tool access is allowed, blocked, or deferred for external approval based on configuration.

Design and implementation choices should preserve this intent: explicit access control, auditable decisions, configurable tools, and safe deferred approval flows.

## Working Rules

- Read the existing project context before making changes.
- Prefer small, focused changes over broad rewrites.
- Keep commits atomic: one coherent change per commit.
- Commit and push only after the relevant checks or reviews have completed successfully.
- Do not force push unless the user explicitly requests it and understands the risk.
- Do not commit secrets, credentials, tokens, or local machine-specific configuration.
- Update documentation when behavior, architecture, or project conventions change.
- Avoid adding infrastructure, dependencies, or configuration files before there is a concrete need.

## Design Guidelines

- Treat OpenGate as a policy boundary, not just a command wrapper.
- Prefer explicit configuration over implicit behavior.
- Validate configuration strictly once a config format and schema are introduced.
- Keep approval, denial, and allow decisions auditable.
- Support deferred approvals as a first-class workflow.
- Avoid coupling the core model to a single agent, tool, or transport protocol.

## Current Defaults

- YAML is the preferred initial configuration format, pending implementation feedback.
- MCP and CLI are both expected integration surfaces.
- Runtime, language, package manager, and project structure are not chosen yet.
