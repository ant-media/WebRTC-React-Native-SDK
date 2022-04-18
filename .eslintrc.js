module.exports = {
  root: true,
  extends: ['@react-native-community', 'prettier'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import-helpers'],
  rules: {
    'import-helpers/order-imports': [
      'warn',
      {
        newlinesBetween: 'always', // new line between groups
        groups: [
          ['/^react/'],
          'module',
          '/^../hooks/',
          '/^../utils/',
          '/^../interfaces/',
          ['parent', 'sibling', 'index'],
        ],
        alphabetize: { order: 'asc', ignoreCase: true },
      },
    ],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['off'],
    'react-hooks/exhaustive-deps': 'off',
  },
};
