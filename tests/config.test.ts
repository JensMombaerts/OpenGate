import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";

describe("parseConfig", () => {
  it("parses MVP config", () => {
    const config = parseConfig(`
version: 1
tools:
  git_status:
    command: ["git", "status", "--short"]
    decision: allow
audit:
  path: ".opengate/audit.jsonl"
`);

    expect(config.tools.git_status?.decision).toBe("allow");
    expect(config.audit.path).toBe(".opengate/audit.jsonl");
  });

  it("rejects unknown top-level fields", () => {
    expect(() => parseConfig(`
version: 1
tools: {}
audit:
  path: ".opengate/audit.jsonl"
callbacks: {}
`)).toThrow("unknown field config.callbacks");
  });

  it("rejects shell command strings", () => {
    expect(() => parseConfig(`
version: 1
tools:
  git_status:
    command: "git status --short"
    decision: allow
audit:
  path: ".opengate/audit.jsonl"
`)).toThrow("tool git_status.command must be a non-empty string array");
  });
});
