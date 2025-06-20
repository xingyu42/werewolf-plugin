module.exports = {
  env: {
    es2021: true,
    node: true,
    jest: true
  },
  extends: ['standard'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  ignorePatterns: [
    'coverage/',
    'node_modules/',
    'dist/',
    '*.min.js'
  ],
  globals: {
    Bot: true,
    redis: true,
    logger: true,
    plugin: true,
    Renderer: true,
    segment: true
  },
  rules: {
    eqeqeq: ['off'],
    'prefer-const': ['off'],
    'arrow-body-style': 'off'
  },
  overrides: [
    {
      files: ['tests/**/*.js'],
      rules: {
        'no-unused-vars': 'warn',
        'no-new': 'warn'
      }
    }
  ]
}
