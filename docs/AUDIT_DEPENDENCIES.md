# Opportunity Radar V1 - Dependency Vulnerability Audit

This report isolates and verifies the dependency vulnerabilities flagged by `npm audit` within the V1 package tree. No automated fixes (`npm audit fix`) have been executed to preserve application stability.

## 1. `undici` (High Severity)
* **Package Context:** `cheerio` → `undici`
* **Installed Version:** `7.27.2`
* **Fixed Version:** `>=7.28.0`
* **Severity:** High
* **Dependency Type:** Runtime Dependency (via `cheerio`).
* **Is the vulnerable code path actually used?** **No/Low Risk.** The vulnerabilities involve SOCKS5 Proxy Agent TLS bypasses, WebSocket denial of service, and Set-Cookie percent-decoding. Opportunity Radar uses Cheerio strictly for HTML parsing in background ingestion tasks/ATS analysis. It does not utilize SOCKS proxies or route untrusted WebSockets through `undici`.
* **Could upgrading introduce breaking changes?** **No.** A minor version bump from `7.27.2` to `7.28.x` is fully backwards compatible and can be resolved safely via `npm audit fix`.

## 2. `hono` (High Severity)
* **Package Context:** `shadcn` → `@modelcontextprotocol/sdk` → `@hono/node-server` → `hono`
* **Installed Version:** `4.12.23`
* **Fixed Version:** `>=4.12.25`
* **Severity:** High
* **Dependency Type:** Technically installed in runtime `dependencies` but functionally a Dev/CLI Utility.
* **Is the vulnerable code path actually used?** **No.** The `hono` vulnerabilities are specific to the AWS Lambda adapter (dropping Set-Cookie headers) and the `hono` CORS middleware. Opportunity Radar is a Next.js application executing on Vercel/Node infrastructure and does not execute the `hono` server or its adapters in production whatsoever.
* **Could upgrading introduce breaking changes?** **No.** Bumping to `4.12.25` is a patch upgrade and safe. Furthermore, moving `shadcn` to `devDependencies` where it belongs would neutralize this entirely from production scans.

## 3. `postcss` (Moderate Severity)
* **Package Context:** `next` → `postcss`
* **Installed Version:** `<8.5.10`
* **Fixed Version:** Maintained by the Next.js core team.
* **Severity:** Moderate
* **Dependency Type:** Build/Dev Dependency.
* **Is the vulnerable code path actually used?** **No.** The vulnerability involves XSS via unescaped `</style>` tags during CSS Stringify. This requires a vector where the application parses dynamically injected, untrusted CSS at runtime. Opportunity Radar compiles static Tailwind CSS at build-time. No untrusted CSS is processed.
* **Could upgrading introduce breaking changes?** **YES (Critical).** Running `npm audit fix --force` attempts to resolve the `postcss` tree by aggressively downgrading `next` from `16.2.7` to the deprecated `next@9.3.3`. Doing so completely shatters the App Router architecture and will destroy the application. **Do NOT run `npm audit fix --force`.**

---

### Verification Summary
The flagged vulnerabilities pose **virtually zero real-world risk** to the Opportunity Radar application due to how the specific code paths are isolated (build-time compiling and unutilized transitive adapters). The `undici` and `hono` packages can be safely patched, while the `postcss` warning should be ignored until Next.js natively bumps their internal dependency tree.
