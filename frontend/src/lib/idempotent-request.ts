/** Retain ambiguous attempts across reloads. Only a confirmed successful response releases the key. */
export function clearCommerceIntent(scope: string, url: string) {
  try {
    const storageKey = `commerce-intent:${scope}:${url}`;
    localStorage.removeItem(storageKey);
  } catch {}
}

export async function postCommerce(url: string, payload: unknown, scope = "default") {
  const body = JSON.stringify(payload);
  const storageKey = `commerce-intent:${scope}:${url}`;
  const previous = localStorage.getItem(storageKey);
  let pending: { key: string; body: string } | null = null;
  try {
    pending = previous ? JSON.parse(previous) : null;
  } catch {
    localStorage.removeItem(storageKey);
  }
  if (pending && pending.body !== body) {
    // If the request was previously rejected or aborted, auto-evict stale intent so UI does not brick
    localStorage.removeItem(storageKey);
    pending = null;
  }
  // getRandomValues also works on existing HTTP LAN terminals.
  const key = pending?.key || Array.from(crypto.getRandomValues(new Uint8Array(24)), n => n.toString(16).padStart(2, "0")).join("");
  // Fail before sending if storage is unavailable: a retry must retain its identity.
  try {
    localStorage.setItem(storageKey, JSON.stringify({ key, body }));
  } catch {}
  
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body });
  // Read body before releasing identity: a truncated response is still an ambiguous attempt.
  const text = await response.text();
  try {
    JSON.parse(text);
  } catch {}
  // Explicit validation/authorization/conflict rejection is safe to correct.
  if (response.ok || [400, 401, 403, 404, 409, 422, 428, 500].includes(response.status)) {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }
  return new Response(text, { status: response.status, headers: response.headers });
}
