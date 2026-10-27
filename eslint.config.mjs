import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["server.js"]),
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  // Tests run under Node with CommonJS require
  {
    files: ["test/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
  },
  // Loaded via plain <script> tags; top-level functions are globals used by index.html
  {
    files: ["csv_loader.js", "data_processer.js"],
    languageOptions: { sourceType: "script" },
    rules: { "no-unused-vars": ["error", { vars: "local" }] },
  },
]);
