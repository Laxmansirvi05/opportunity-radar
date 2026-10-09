import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scratch/**",
    // One-off operational scripts run by hand with tsx. Not imported by the
    // app and not part of the build.
    "scripts/**",
    // Vendored Reactive Resume packages. Upstream code, linted by its own
    // config; local rules only produce noise we would not fix here.
    "packages/**",
  ]),
  {
    rules: {
      // 147 existing uses, most at the edges where untyped JSON arrives
      // (scraper payloads, test doubles). Kept visible as warnings so they can
      // be burned down, without failing every pull request until they are.
      "@typescript-eslint/no-explicit-any": "warn",
      // A leading underscore marks a binding as deliberately unused, and a
      // catch clause may ignore its error. Everything else still warns.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
    },
  },
]);

export default eslintConfig;
