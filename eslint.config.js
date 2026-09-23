import eslintConfigPrettier from 'eslint-config-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['.output/**', '.tanstack/**', 'src/routeTree.gen.ts'] },
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true },
    },
    extends: [
      reactHooks.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
  },
  eslintConfigPrettier,
)
