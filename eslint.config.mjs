import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Flat ESLint config for Next.js 15 / ESLint v10.
 *
 * Migrated from legacy `.eslintrc.json` on 2026-05-15 via
 * `npx @next/codemod@canary next-lint-to-eslint-cli .`.
 *
 * eslint-plugin-react 7.37.x bundled with eslint-config-next 16.2.5
 * has not been updated for ESLint v10's removal of legacy context
 * helpers (`contextOrFilename.getFilename`). The plugin tries to
 * resolve the React version via that helper and crashes during rule
 * load even before evaluating any code. We turn off the rules that
 * exercise that code path; the rest of the Next/TypeScript ruleset
 * stays intact. When the plugin ships a fix we can drop these overrides.
 */
export default defineConfig([
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    extends: [...nextCoreWebVitals, ...nextTypescript],
    settings: {
      // Force a static React version so the plugin's version-detection
      // helper (which uses the removed `getFilename` API) never runs.
      react: { version: "19.0.0" },
    },
    rules: {
      // Rules whose internal Components/usedPropTypes pipeline triggers
      // the version-detection helper and crashes on ESLint v10.
      "react/display-name": "off",
      "react/no-unknown-property": "off",
      "react/no-unescaped-entities": "off",
      "react/prop-types": "off",
      "react/jsx-key": "off",
      // Existing codebase liberally uses `any` and `// @ts-nocheck` —
      // the de facto policy. Demote these from error → warn so CI
      // surfaces them but doesn't halt on the 3000+-row backlog.
      // Going forward, new code should still avoid both.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
      // React 19 / new hooks rules — already triggered in existing
      // code patterns and would block CI on the entire backlog.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/exhaustive-deps": "warn",
      // Next.js Image / Script guidance — already widely violated;
      // surface as warnings rather than blocking CI.
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
  // One-off scripts and Playwright fixtures don't participate in the
  // Next build; relax the two rules that fire on legitimate helper
  // patterns there (CommonJS requires in admin scripts, Playwright's
  // `use` fixture API which collides with the React Hook name check).
  {
    files: ["scripts/**/*.js", "scripts/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);
