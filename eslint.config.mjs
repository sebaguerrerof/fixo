import nextPlugin from "@next/eslint-plugin-next";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

export default [
  { ignores: [".next/**", ".next-dev/**", "coverage/**", "node_modules/**"] },
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
    },
    plugins: { "@typescript-eslint": typescriptEslintPlugin },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  nextPlugin.flatConfig.coreWebVitals,
];
