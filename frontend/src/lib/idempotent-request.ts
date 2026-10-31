/** Retain ambiguous attempts across reloads. Only a confirmed successful response releases the key. */
export async function postCommerce(url: string, payload: unknown, scope: string) {
  const body = JSON.stringify(payload);
  const storageKey = `commerce-intent:${scope}:${url}`;
  const previous = localStorage.getItem(storageKey);
  const pending: { key: string; body: string } | null = previous ? JSON.parse(previous) : null;
  if (pending && pending.body !== body) throw new Error("Previous payment outcome is unresolved. Retry the original request before changing this operation.");
  // getRandomValues also works on existing HTTP LAN terminals.
  const key = pending?.key || Array.from(crypto.getRandomValues(new Uint8Array(24)), n => n.toString(16).padStart(2, "0")).join("");
  // Fail before sending if storage is unavailable: a retry must retain its identity.
  localStorage.setItem(storageKey, JSON.stringify({ key, body }));
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body });
  // Read body before releasing identity: a truncated response is still an ambiguous attempt.
  const text = await response.text();
  JSON.parse(text);
  // Explicit validation/authorization rejection is safe to correct. Conflicts and
  // server/network failures retain the original intent until its outcome is reconciled.
  if (response.ok || [400, 401, 403, 404, 422, 428].includes(response.status)) localStorage.removeItem(storageKey);
  return new Response(text, { status: response.status, headers: response.headers });
}
