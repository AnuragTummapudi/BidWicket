import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';

export default [
  { ignores: ['.next/**', 'dist/**', 'node_modules/**', 'src/App.jsx'] },
  {
    files: ['**/*.{js,jsx,mjs}'],
    ...js.configs.recommended,
    plugins: { 'react-hooks': reactHooks, '@next/next': nextPlugin },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // player headshots are remote, per-player URLs; routing them through the image optimizer is a separate decision
      '@next/next/no-img-element': 'off',
      // core ESLint cannot see JSX usage, so capitalised component imports are ignored
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
    },
  },
];
