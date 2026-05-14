import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AuditEvent } from "./types.js";

export interface PendingRecord {
  request_id: string;
  created_at: string;
  tool: string;
  decision: "require_approval";
  status: "pending";
  reason?: string;
  params: Record<string, string>;
  planned_command?: string[];
}

export async function appendAudit(cwd: string, auditPath: string, event: AuditEvent): Promise<void> {
  const fullPath = join(cwd, auditPath);
  await mkdir(dirname(fullPath), { recursive: true });
  await appendFile(fullPath, `${JSON.stringify(event)}\n`, "utf8");
}

export async function writePending(cwd: string, record: PendingRecord): Promise<void> {
  const filePath = pendingPath(cwd, record.request_id);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

function pendingPath(cwd: string, requestId: string): string {
  return join(cwd, ".opengate", "pending", `${requestId}.json`);
}
