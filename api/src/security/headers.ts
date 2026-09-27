/** The API only ever returns JSON, so its CSP can deny everything. */
export const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-site",
  "cache-control": "no-store",
};
