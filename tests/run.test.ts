import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runCli } from "../src/run.js";

describe("runCli", () => {
  it("executes allowed tools and audits metadata only", async () => {
    const cwd = await createWorkspace(`
version: 1
tools:
  node_echo:
    command: ["node", "-e", "console.log('ok')"]
    decision: allow
audit:
  path: ".opengate/audit.jsonl"
`);

    const result = await runCli(["run", "node_echo"], cwd, fixedNow);

    expect(result.exitCode).toBe(0);
    expect(result.response).toMatchObject({ decision: "allow", status: "executed", exit_code: 0, stdout: "ok\n" });

    const audit = await readJsonLines(join(cwd, ".opengate", "audit.jsonl"));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ event: "executed", decision: "allow", status: "executed", stdout_bytes: 3 });
    expect(audit[0]).not.toHaveProperty("stdout");
  });

  it("denies denied tools without execution", async () => {
    const cwd = await createWorkspace(`
version: 1
tools:
  blocked:
    command: ["node", "-e", "process.exit(9)"]
    decision: deny
    reason: "blocked"
audit:
  path: ".opengate/audit.jsonl"
`);

    const result = await runCli(["run", "blocked"], cwd, fixedNow);

    expect(result.exitCode).toBe(3);
    expect(result.response).toMatchObject({ decision: "deny", status: "denied", reason: "blocked" });
    const audit = await readJsonLines(join(cwd, ".opengate", "audit.jsonl"));
    expect(audit[0]).toMatchObject({ event: "denied", decision: "deny", status: "denied" });
  });

  it("stores pending records with planned commands", async () => {
    const cwd = await createWorkspace(`
version: 1
tools:
  apply_patch:
    command: ["git", "apply", "{patch_file}"]
    decision: require_approval
    reason: "changes workspace"
    params:
      patch_file:
        required: true
audit:
  path: ".opengate/audit.jsonl"
`);

    const result = await runCli(["run", "apply_patch", "--param", "patch_file=/tmp/change.patch"], cwd, fixedNow);

    expect(result.exitCode).toBe(4);
    expect(result.response).toMatchObject({ decision: "require_approval", status: "pending" });

    const pending = JSON.parse(await readFile(join(cwd, ".opengate", "pending", `${result.response.request_id}.json`), "utf8"));
    expect(pending).toMatchObject({
      request_id: result.response.request_id,
      tool: "apply_patch",
      planned_command: ["git", "apply", "/tmp/change.patch"]
    });
    expect(pending).not.toHaveProperty("stdout");
  });

  it("returns validation errors for missing params", async () => {
    const cwd = await createWorkspace(`
version: 1
tools:
  show_file:
    command: ["node", "{file}"]
    decision: allow
    params:
      file:
        required: true
audit:
  path: ".opengate/audit.jsonl"
`);

    const result = await runCli(["run", "show_file"], cwd, fixedNow);

    expect(result.exitCode).toBe(2);
    expect(result.response).toMatchObject({ decision: "deny", status: "validation_error", error: "missing required param: file" });
  });

  it("returns execution metadata when executable is missing", async () => {
    const cwd = await createWorkspace(`
version: 1
tools:
  missing:
    command: ["definitely-not-a-real-opengate-test-command"]
    decision: allow
audit:
  path: ".opengate/audit.jsonl"
`);

    const result = await runCli(["run", "missing"], cwd, fixedNow);

    expect(result.exitCode).toBe(127);
    expect(result.response).toMatchObject({ decision: "allow", status: "executed", exit_code: 127 });
    expect(result.response.stderr).toContain("definitely-not-a-real-opengate-test-command");
  });
});

async function createWorkspace(config: string): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "opengate-"));
  await writeFile(join(cwd, "opengate.yaml"), config, "utf8");
  return cwd;
}

async function readJsonLines(path: string): Promise<Record<string, unknown>[]> {
  const contents = await readFile(path, "utf8");
  return contents.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
}

function fixedNow(): Date {
  return new Date("2026-05-14T12:00:00Z");
}
