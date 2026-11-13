/**
 * Minimal Cloudflare API v4 client using the built-in fetch (Node >= 18).
 */

const BASE_URL = "https://api.cloudflare.com/client/v4";

export function getToken(explicit) {
  const token = explicit ?? process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    const err = new Error(
      "No API token. Set the CLOUDFLARE_API_TOKEN environment variable or pass --token <TOKEN>.\n" +
        "Create one at https://dash.cloudflare.com/profile/api-tokens"
    );
    err.exitCode = 2;
    throw err;
  }
  return token;
}

export async function cfFetch(path, { token, method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Network error: could not reach api.cloudflare.com");
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response; fall through
  }

  if (!res.ok || !data?.success) {
    const errs = data?.errors?.map((e) => e.message).join("; ");
    throw new Error(
      errs
        ? `Cloudflare API error: ${errs}`
        : `Cloudflare API error: HTTP ${res.status} ${res.statusText}`
    );
  }
  return data.result;
}

export function isProbablyId(str) {
  // Cloudflare ids are 32-char hex strings.
  return /^[0-9a-f]{32}$/i.test(str);
}
