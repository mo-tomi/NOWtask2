module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    'vitest/globals': true,
  },
  extends: ['eslint:recommended', 'plugin:vitest/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['vitest'],
  rules: {
    // 変数未使用を警告レベルに（テストの引数などに _ を許可）
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
}; 