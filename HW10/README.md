# cfquick

A **zero-dependency** CLI for quick Cloudflare API tasks, written in pure Node.js (no npm packages required).

## Install

```bash
npm install -g cfquick
```

Requires Node.js >= 18 (uses the built-in `fetch`).

## Setup

Get an API token from [Cloudflare](https://dash.cloudflare.com/profile/api-tokens)
(suggested template: "Edit zone DNS" + "Zone Cache Purge", scoped to the zones you need), then:

```bash
export CLOUDFLARE_API_TOKEN=your_token_here
```

or pass it per command with `--token your_token_here`.

## Usage

```bash
# Check that your token works
cfquick whoami

# List the zones (domains) your token can see
cfquick zones

# List DNS records of a zone
cfquick dns example.com

# Purge the ENTIRE cache of a zone
cfquick purge example.com --all

# Purge only specific URLs
cfquick purge example.com --urls "https://example.com/,https://example.com/style.css"
```

## Why?

The official tools (`wrangler`, `cloudflare`) are great but heavy. `cfquick` does
three tiny things — token check, zone/DNS listing, cache purge — with **zero
dependencies**, so it installs instantly and is trivial to audit.

## License

MIT
