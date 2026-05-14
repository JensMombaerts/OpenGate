#!/usr/bin/env node
import { runCli } from "./run.js";

const result = await runCli(process.argv.slice(2));
process.stdout.write(`${JSON.stringify(result.response)}\n`);
process.exitCode = result.exitCode;
