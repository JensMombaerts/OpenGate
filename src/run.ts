import { randomUUID } from "node:crypto";
import { loadConfig, ConfigError } from "./config.js";
import { appendAudit, writePending, type PendingRecord } from "./audit-storage.js";
import { executeCommand } from "./runner.js";
import type { CliResult, OpenGateConfig, ToolConfig } from "./types.js";

export async function runCli(args: string[], cwd = process.cwd(), now = () => new Date()): Promise<CliResult> {
  const requestId = createRequestId();
  const timestamp = () => now().toISOString();

  if (args[0] !== "run") {
    return validationError(requestId, `unsupported command: ${args[0] ?? ""}`);
  }

  const toolId = args[1];
  if (!toolId) {
    return validationError(requestId, "missing tool id");
  }

  let config: OpenGateConfig;
  try {
    config = await loadConfig(cwd);
  } catch (error) {
    if (error instanceof ConfigError || isNotFound(error)) {
      return validationError(requestId, error instanceof Error ? error.message : "failed to load config");
    }
    throw error;
  }

  const parsedParams = parseParamArgs(args.slice(2));
  if (typeof parsedParams === "string") {
    await appendAudit(cwd, config.audit.path, {
      event: "validation_error",
      request_id: requestId,
      timestamp: timestamp(),
      tool: toolId,
      status: "validation_error",
      error: parsedParams
    });
    return validationError(requestId, parsedParams);
  }

  const tool = config.tools[toolId];
  if (!tool) {
    const reason = "tool is not configured";
    await writePendingDecision(cwd, config.audit.path, {
      requestId,
      timestamp: timestamp(),
      toolId,
      reason,
      params: parsedParams
    });
    return {
      response: {
        request_id: requestId,
        tool: toolId,
        decision: "require_approval",
        status: "pending",
        reason
      },
      exitCode: 4
    };
  }

  const resolved = resolveCommand(toolId, tool, parsedParams);
  if (typeof resolved === "string") {
    await appendAudit(cwd, config.audit.path, {
      event: "validation_error",
      request_id: requestId,
      timestamp: timestamp(),
      tool: toolId,
      status: "validation_error",
      error: resolved
    });
    return validationError(requestId, resolved, toolId);
  }

  if (tool.decision === "deny") {
    await appendAudit(cwd, config.audit.path, {
      event: "denied",
      request_id: requestId,
      timestamp: timestamp(),
      tool: toolId,
      decision: "deny",
      status: "denied",
      ...(tool.reason === undefined ? {} : { reason: tool.reason })
    });
    return {
      response: {
        request_id: requestId,
        tool: toolId,
        decision: "deny",
        status: "denied",
        ...(tool.reason === undefined ? {} : { reason: tool.reason })
      },
      exitCode: 3
    };
  }

  if (tool.decision === "require_approval") {
    await writePendingDecision(cwd, config.audit.path, {
      requestId,
      timestamp: timestamp(),
      toolId,
      reason: tool.reason,
      params: resolved.params,
      plannedCommand: resolved.command
    });
    return {
      response: {
        request_id: requestId,
        tool: toolId,
        decision: "require_approval",
        status: "pending",
        ...(tool.reason === undefined ? {} : { reason: tool.reason })
      },
      exitCode: 4
    };
  }

  const execution = await executeCommand(resolved.command, cwd);
  await appendAudit(cwd, config.audit.path, {
    event: "executed",
    request_id: requestId,
    timestamp: timestamp(),
    tool: toolId,
    decision: "allow",
    status: "executed",
    exit_code: execution.exitCode,
    stdout_bytes: execution.stdoutBytes,
    stderr_bytes: execution.stderrBytes
  });

  return {
    response: {
      request_id: requestId,
      tool: toolId,
      decision: "allow",
      status: "executed",
      exit_code: execution.exitCode,
      stdout: execution.stdout,
      stderr: execution.stderr
    },
    exitCode: execution.exitCode
  };
}

function parseParamArgs(args: string[]): Record<string, string> | string {
  const params: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag !== "--param") {
      return `unknown argument: ${flag}`;
    }
    const value = args[index + 1];
    if (!value) {
      return "missing value for --param";
    }
    index += 1;
    const separator = value.indexOf("=");
    if (separator <= 0) {
      return `malformed param: ${value}`;
    }
    const key = value.slice(0, separator);
    const paramValue = value.slice(separator + 1);
    params[key] = paramValue;
  }
  return params;
}

function resolveCommand(
  toolId: string,
  tool: ToolConfig,
  providedParams: Record<string, string>
): { command: string[]; params: Record<string, string> } | string {
  const paramConfig = tool.params ?? {};
  for (const provided of Object.keys(providedParams)) {
    if (!(provided in paramConfig)) {
      return `unknown param for ${toolId}: ${provided}`;
    }
  }

  const params: Record<string, string> = {};
  for (const [name, config] of Object.entries(paramConfig)) {
    const value = providedParams[name] ?? config.default;
    if (value === undefined) {
      if (config.required) {
        return `missing required param: ${name}`;
      }
      continue;
    }
    params[name] = value;
  }

  const command: string[] = [];
  for (const part of tool.command) {
    const missing = [...part.matchAll(/\{([^}]+)\}/g)]
      .map((match) => match[1])
      .find((paramName) => paramName !== undefined && !(paramName in params));
    if (missing !== undefined) {
      return `missing param for placeholder: ${missing}`;
    }
    command.push(part.replaceAll(/\{([^}]+)\}/g, (_match, paramName: string) => params[paramName] ?? ""));
  }

  return { command, params };
}

async function writePendingDecision(
  cwd: string,
  auditPath: string,
  input: {
    requestId: string;
    timestamp: string;
    toolId: string;
    reason?: string;
    params: Record<string, string>;
    plannedCommand?: string[];
  }
): Promise<void> {
  const record: PendingRecord = {
    request_id: input.requestId,
    created_at: input.timestamp,
    tool: input.toolId,
    decision: "require_approval",
    status: "pending",
    params: input.params,
    ...(input.reason === undefined ? {} : { reason: input.reason }),
    ...(input.plannedCommand === undefined ? {} : { planned_command: input.plannedCommand })
  };
  await writePending(cwd, record);
  await appendAudit(cwd, auditPath, {
    event: "pending",
    request_id: input.requestId,
    timestamp: input.timestamp,
    tool: input.toolId,
    decision: "require_approval",
    status: "pending",
    ...(input.reason === undefined ? {} : { reason: input.reason })
  });
}

function validationError(requestId: string, error: string, tool?: string): CliResult {
  return {
    response: {
      request_id: requestId,
      ...(tool === undefined ? {} : { tool }),
      decision: "deny",
      status: "validation_error",
      error
    },
    exitCode: 2
  };
}

function createRequestId(): string {
  return `req_${randomUUID()}`;
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
