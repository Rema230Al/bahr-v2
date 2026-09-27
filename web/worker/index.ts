/**
 * Cloudflare Worker in front of the static site. It proxies /api/* to the Fly.io API so the
 * session cookie is first-party (SameSite=Strict works) and forwards the visitor's real IP
 * for rate limiting, authenticated by a shared secret the API checks.
 */
interface Env {
  ASSETS: Fetcher;
  API_ORIGIN: string;
  PROXY_SECRET: string;
}

const STRIP = ["x-proxy-secret", "x-client-ip", "cookie2"];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    const target = new URL(url.pathname.replace(/^\/api/, "") + url.search, env.API_ORIGIN);
    const headers = new Headers(request.headers);
    for (const h of STRIP) headers.delete(h); // never trust client-supplied values
    headers.set("x-proxy-secret", env.PROXY_SECRET);
    headers.set("x-client-ip", request.headers.get("cf-connecting-ip") ?? "");

    return fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });
  },
} satisfies ExportedHandler<Env>;
