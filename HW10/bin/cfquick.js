#!/usr/bin/env node
/**
 * cfquick — a zero-dependency CLI for quick Cloudflare API tasks.
 *
 * Usage:
 *   cfquick whoami
 *   cfquick zones
 *   cfquick dns <zone-name-or-id>
 *   cfquick purge <zone-name-or-id> [--all | --urls u1,u2,...]
 *   cfquick help
 */

import { run } from "../lib/cli.js";

run(process.argv.slice(2)).catch((err) => {
  console.error(`✖ ${err.message}`);
  process.exit(err.exitCode ?? 1);
});
