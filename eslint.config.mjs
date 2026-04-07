import { defineConfig } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([
  { ignores: ["scripts/**", "google-apps-script-sync.js"] },
  {
    extends: [...nextCoreWebVitals, ...nextTypescript],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);