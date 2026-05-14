import { spawn } from "node:child_process";

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  stdoutBytes: number;
  stderrBytes: number;
}

export async function executeCommand(command: string[], cwd: string): Promise<ExecutionResult> {
  const [executable, ...args] = command;
  if (!executable) {
    throw new Error("command cannot be empty");
  }

  return new Promise((resolve) => {
    const child = spawn(executable, args, { cwd, shell: false });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      const stderrBuffer = Buffer.from(error.message, "utf8");
      resolve({
        exitCode: 127,
        stdout: "",
        stderr: stderrBuffer.toString("utf8"),
        stdoutBytes: 0,
        stderrBytes: stderrBuffer.byteLength
      });
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      const stdoutBuffer = Buffer.concat(stdout);
      const stderrBuffer = Buffer.concat(stderr);
      resolve({
        exitCode: code ?? 1,
        stdout: stdoutBuffer.toString("utf8"),
        stderr: stderrBuffer.toString("utf8"),
        stdoutBytes: stdoutBuffer.byteLength,
        stderrBytes: stderrBuffer.byteLength
      });
    });
  });
}
