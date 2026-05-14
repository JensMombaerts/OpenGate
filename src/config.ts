import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isMap, parseDocument, type Document, type ParsedNode, type YAMLMap } from "yaml";
import type { Decision, OpenGateConfig, ParamConfig, ToolConfig } from "./types.js";

const topLevelFields = new Set(["version", "tools", "audit"]);
const toolFields = new Set(["command", "decision", "params", "reason"]);
const paramFields = new Set(["required", "default"]);
const auditFields = new Set(["path"]);
const decisions = new Set<Decision>(["allow", "deny", "require_approval"]);

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export async function loadConfig(cwd: string): Promise<OpenGateConfig> {
  const source = await readFile(join(cwd, "opengate.yaml"), "utf8");
  return parseConfig(source);
}

export function parseConfig(source: string): OpenGateConfig {
  const document = parseDocument(source, { prettyErrors: false });

  if (document.errors.length > 0) {
    throw new ConfigError(`invalid YAML: ${document.errors[0]?.message ?? "parse error"}`);
  }

  const root = document.contents;
  if (!isMap(root)) {
    throw new ConfigError("config root must be a map");
  }

  const data = document.toJSON() as Record<string, unknown>;

  assertKnownFields(root, topLevelFields, "config");

  const version = valueAt(data, ["version"]);
  if (version !== 1) {
    throw new ConfigError("version must be 1");
  }

  const toolsNode = nodeAt(document, ["tools"]);
  if (!isMap(toolsNode)) {
    throw new ConfigError("tools must be a map");
  }

  const auditNode = nodeAt(document, ["audit"]);
  if (!isMap(auditNode)) {
    throw new ConfigError("audit must be a map");
  }

  assertKnownFields(auditNode, auditFields, "audit");
  const auditPath = valueAt(data, ["audit", "path"]);
  if (typeof auditPath !== "string" || auditPath.length === 0) {
    throw new ConfigError("audit.path must be a non-empty string");
  }

  const tools: Record<string, ToolConfig> = {};
  for (const pair of toolsNode.items) {
    const toolId = keyToString(pair.key);
    if (!toolId) {
      throw new ConfigError("tool id must be non-empty");
    }
    if (!isMap(pair.value)) {
      throw new ConfigError(`tool ${toolId} must be a map`);
    }
    tools[toolId] = parseTool(data, document, toolId, pair.value);
  }

  return {
    version: 1,
    tools,
    audit: {
      path: auditPath
    }
  };
}

function parseTool(data: Record<string, unknown>, document: Document, toolId: string, node: YAMLMap): ToolConfig {
  assertKnownFields(node, toolFields, `tool ${toolId}`);

  const command = valueAt(data, ["tools", toolId, "command"]);
  if (!Array.isArray(command) || command.some((part) => typeof part !== "string" || part.length === 0)) {
    throw new ConfigError(`tool ${toolId}.command must be a non-empty string array`);
  }

  const decision = valueAt(data, ["tools", toolId, "decision"]);
  if (typeof decision !== "string" || !decisions.has(decision as Decision)) {
    throw new ConfigError(`tool ${toolId}.decision must be allow, deny, or require_approval`);
  }

  const reason = valueAt(data, ["tools", toolId, "reason"]);
  if (reason !== undefined && typeof reason !== "string") {
    throw new ConfigError(`tool ${toolId}.reason must be a string`);
  }

  const paramsNode = nodeAt(document, ["tools", toolId, "params"]);
  const params = paramsNode === undefined ? undefined : parseParams(data, document, toolId, paramsNode);

  return {
    command,
    decision: decision as Decision,
    ...(reason === undefined ? {} : { reason }),
    ...(params === undefined ? {} : { params })
  };
}

function parseParams(data: Record<string, unknown>, document: Document, toolId: string, node: ParsedNode): Record<string, ParamConfig> {
  if (!isMap(node)) {
    throw new ConfigError(`tool ${toolId}.params must be a map`);
  }

  const params: Record<string, ParamConfig> = {};
  for (const pair of node.items) {
    const paramName = keyToString(pair.key);
    if (!paramName) {
      throw new ConfigError(`tool ${toolId} param name must be non-empty`);
    }
    if (!isMap(pair.value)) {
      throw new ConfigError(`tool ${toolId}.params.${paramName} must be a map`);
    }

    assertKnownFields(pair.value, paramFields, `tool ${toolId}.params.${paramName}`);

    const required = valueAt(data, ["tools", toolId, "params", paramName, "required"]);
    const defaultValue = valueAt(data, ["tools", toolId, "params", paramName, "default"]);

    if (required !== undefined && typeof required !== "boolean") {
      throw new ConfigError(`tool ${toolId}.params.${paramName}.required must be a boolean`);
    }
    if (defaultValue !== undefined && typeof defaultValue !== "string") {
      throw new ConfigError(`tool ${toolId}.params.${paramName}.default must be a string`);
    }

    params[paramName] = {
      ...(required === undefined ? {} : { required }),
      ...(defaultValue === undefined ? {} : { default: defaultValue })
    };
  }

  return params;
}

function assertKnownFields(node: YAMLMap, knownFields: Set<string>, context: string): void {
  for (const pair of node.items) {
    const key = keyToString(pair.key);
    if (!knownFields.has(key)) {
      throw new ConfigError(`unknown field ${context}.${key}`);
    }
  }
}

function keyToString(key: unknown): string {
  if (typeof key === "object" && key !== null && "toJSON" in key && typeof key.toJSON === "function") {
    return String(key.toJSON());
  }
  return String(key ?? "");
}

function nodeAt(document: Document, path: string[]): ParsedNode | undefined {
  return document.getIn(path, true) as ParsedNode | undefined;
}

function valueAt(data: unknown, path: string[]): unknown {
  let current = data;
  for (const part of path) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
