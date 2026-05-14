export type Decision = "allow" | "deny" | "require_approval";

export interface ParamConfig {
  required?: boolean;
  default?: string;
}

export interface ToolConfig {
  command: string[];
  decision: Decision;
  params?: Record<string, ParamConfig>;
  reason?: string;
}

export interface OpenGateConfig {
  version: 1;
  tools: Record<string, ToolConfig>;
  audit: {
    path: string;
  };
}

export interface CliResponse {
  request_id: string;
  tool?: string;
  decision?: Decision;
  status: string;
  reason?: string;
  error?: string;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
}

export interface CliResult {
  response: CliResponse;
  exitCode: number;
}

export interface AuditEvent {
  event: string;
  request_id: string;
  timestamp: string;
  tool?: string;
  decision?: Decision;
  status: string;
  reason?: string;
  error?: string;
  exit_code?: number;
  stdout_bytes?: number;
  stderr_bytes?: number;
}
