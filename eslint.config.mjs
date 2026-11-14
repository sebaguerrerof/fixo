import nextPlugin from "@next/eslint-plugin-next";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

// Design system guard: styling comes from the semantic tokens (src/app/globals.css, tailwind.config.ts),
// never from literal palette classes, hex/rgb/hsl colours or a hand-written product name.
const PALETTE = "slate|gray|zinc|neutral|stone|red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink";
const literalColor = new RegExp("(?:^|[\\s\"'`:!])(?:bg|text|border|from|to|via|ring|fill|stroke|divide|shadow|outline|decoration|placeholder|accent|caret)-(?:(?:" + PALETTE + ")-[0-9]{2,3}|white|black)(?:[\\s/\"'`]|$)");
const hexColor = /#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}(?![0-9a-zA-Z])/;
const designSystemGuard = {
  files: ["src/**/*.tsx"],
  ignores: ["src/**/*.test.tsx", "src/app/opengraph-image.tsx"],
  rules: {
    "no-restricted-syntax": ["error",
      { selector: `Literal[value=${String(literalColor)}]`, message: "Usa los tokens semánticos (bg-card, text-muted-foreground, bg-success-soft…), no clases de paleta literales." },
      { selector: `TemplateElement[value.raw=${String(literalColor)}]`, message: "Usa los tokens semánticos, no clases de paleta literales." },
      { selector: `Literal[value=${String(hexColor)}]`, message: "Los colores viven en src/app/globals.css; no escribas hex en componentes." },
    ],
  },
};

export default [
  { ignores: [".next/**", ".next-dev/**", "coverage/**", "node_modules/**", ".audit-backups/**", "supabase/.temp/**"] },
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
  designSystemGuard,
];
