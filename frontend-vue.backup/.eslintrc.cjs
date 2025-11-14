module.exports = {
  root: true,
  env: { browser: true, es2021: true },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
    extraFileExtensions: ['.vue'],
  },
  extends: [
    'plugin:vue/vue3-recommended',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    'vue/multi-word-component-names': 'off',
    'no-undef': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/html-self-closing': 'off'
  },
};

