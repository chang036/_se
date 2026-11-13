import { cfFetch, getToken, isProbablyId } from "./api.js";

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function resolveZone(zoneArg, token) {
  if (isProbablyId(zoneArg)) {
    return { id: zoneArg, name: zoneArg };
  }
  const zones = await cfFetch(
    `/zones?name=${encodeURIComponent(zoneArg)}`,
    { token }
  );
  if (!zones || zones.length === 0) {
    const err = new Error(
      `Zone "${zoneArg}" not found (or the token has no access to it).`
    );
    err.exitCode = 1;
    throw err;
  }
  return { id: zones[0].id, name: zones[0].name };
}

async function whoami(args) {
  const token = getToken(args["--token"]);
  const user = await cfFetch("/user/tokens/verify", { token });
  console.log("✔ Token is valid.");
  printJson(user);
}

async function zones(args) {
  const token = getToken(args["--token"]);
  const list = await cfFetch("/zones?per_page=50", { token });
  if (!list || list.length === 0) {
    console.log("No zones found for this token.");
    return;
  }
  console.log(`${"ZONE NAME".padEnd(40)} ${"STATUS".padEnd(10)} ZONE ID`);
  for (const z of list) {
    console.log(`${z.name.padEnd(40)} ${z.status.padEnd(10)} ${z.id}`);
  }
  console.log(`\nTotal: ${list.length} zone(s)`);
}

async function dns(args) {
  const token = getToken(args["--token"]);
  const zoneName = args._[0];
  if (!zoneName) {
    const err = new Error("Usage: cfquick dns <zone-name-or-id>");
    err.exitCode = 2;
    throw err;
  }
  const zone = await resolveZone(zoneName, token);
  const records = await cfFetch(`/zones/${zone.id}/dns_records?per_page=100`, {
    token,
  });
  console.log(`${"TYPE".padEnd(8)} ${"NAME".padEnd(40)} CONTENT`);
  for (const r of records) {
    console.log(`${r.type.padEnd(8)} ${r.name.padEnd(40)} ${r.content}`);
  }
  console.log(`\nTotal: ${records.length} record(s) in ${zone.name}`);
}

async function purge(args) {
  const token = getToken(args["--token"]);
  const zoneName = args._[0];
  if (!zoneName) {
    const err = new Error(
      "Usage: cfquick purge <zone-name-or-id> [--all | --urls url1,url2,...]"
    );
    err.exitCode = 2;
    throw err;
  }
  const zone = await resolveZone(zoneName, token);

  let body;
  if (args["--all"]) {
    body = { purge_everything: true };
    console.log(`Purging EVERYTHING for zone ${zone.name}...`);
  } else if (args["--urls"]) {
    const files = args["--urls"].split(",").map((u) => u.trim()).filter(Boolean);
    if (files.length === 0) {
      const err = new Error("--urls was empty. Provide at least one URL.");
      err.exitCode = 2;
      throw err;
    }
    body = { files };
    console.log(`Purging ${files.length} URL(s) for zone ${zone.name}...`);
  } else {
    const err = new Error(
      'Specify either --all or --urls "https://example.com/path,..."'
    );
    err.exitCode = 2;
    throw err;
  }

  await cfFetch(`/zones/${zone.id}/purge_cache`, { token, method: "POST", body });
  console.log("✔ Purge successful.");
}

const HELP = `cfquick — quick Cloudflare API tasks from your terminal

Usage:
  cfquick whoami                        Verify the API token
  cfquick zones                         List zones (domains) on your account
  cfquick dns <zone>                    List DNS records of a zone
  cfquick purge <zone> --all            Purge the entire cache of a zone
  cfquick purge <zone> --urls u1,u2     Purge specific URLs
  cfquick help                          Show this help

Options:
  --token <TOKEN>   Cloudflare API token (default: $CLOUDFLARE_API_TOKEN)

Create a token at https://dash.cloudflare.com/profile/api-tokens
`;

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--token") {
      args["--token"] = argv[++i];
    } else if (a === "--all") {
      args["--all"] = true;
    } else if (a === "--urls") {
      args["--urls"] = argv[++i] ?? "";
    } else {
      args._.push(a);
    }
  }
  return args;
}

export async function run(argv) {
  const [cmd, ...rest] = argv;
  const args = parseArgs(rest);

  switch (cmd) {
    case "whoami":
      return whoami(args);
    case "zones":
      return zones(args);
    case "dns":
      return dns(args);
    case "purge":
      return purge(args);
    case "help":
    case "--help":
    case "-h":
    case undefined:
      console.log(HELP);
      return;
    default:
      console.log(HELP);
      const err = new Error(`Unknown command: ${cmd}`);
      err.exitCode = 2;
      throw err;
  }
}
