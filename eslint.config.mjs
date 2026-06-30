import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["node_modules/", "**/node_modules/"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.worker,
        ...globals.serviceworker,
      },
    },
    rules: {
      // Surfaced as warnings so they show in-editor without failing the build.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "prefer-const": "warn",
      "no-case-declarations": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-wrapper-object-types": "warn",
      "no-useless-escape": "warn",
      "no-control-regex": "warn",
      "no-empty": "warn",
      // Intentional stubs / harmless style in this codebase.
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-inferrable-types": "off",
    },
  },
);
