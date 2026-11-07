import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      // Hydrating UI state from localStorage in an effect is intentional
      // here (games resume after refresh); the default rule is too strict
      // for this pattern.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "next-env.d.ts",
    "tsconfig.tsbuildinfo",
    "test-results/**",
    "playwright-report/**",
    ".data/**",
    "data-src/**",
  ]),
]);
