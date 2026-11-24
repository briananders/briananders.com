import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import importX from 'eslint-plugin-import-x';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    plugins: {
      '@stylistic': stylistic,
      'import-x': importX,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        ...globals.es2022,
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        after: 'readonly',
        afterEach: 'readonly',
        document: 'writable',
        window: 'writable',
        browser: 'writable',
        dataLayer: 'writable',
      },
    },
    rules: {
      'consistent-return': 'off',
      'func-names': 'off',
      'no-await-in-loop': 'off',
      'no-new': 'off',
      'no-param-reassign': 'off',
      'no-plusplus': 'off',
      'no-prototype-builtins': 'off',
      'no-underscore-dangle': 'off',
      'no-use-before-define': 'off',
      strict: 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'any', ignoreReadBeforeAssign: true }],
      'no-unused-vars': ['error', {
        vars: 'all',
        args: 'after-used',
        ignoreRestSiblings: true,
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-restricted-globals': ['error', {
        name: 'event',
        message: 'Use local parameter instead.',
      }],
      'prefer-destructuring': ['warn', {
        array: false,
        object: true,
      }, {
        enforceForRenamedProperties: false,
      }],
      '@stylistic/max-len': ['error', { code: 120 }],
      '@stylistic/no-multi-spaces': 'warn',
      '@stylistic/comma-dangle': ['error', {
        arrays: 'never',
        objects: 'always-multiline',
        imports: 'never',
        exports: 'never',
        functions: 'ignore',
      }],
      '@stylistic/no-confusing-arrow': ['warn', { allowParens: true }],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/indent': ['error', 2, {
        SwitchCase: 1,
        ignoredNodes: ['TemplateLiteral'],
      }],
      'import-x/no-unresolved': ['error', { commonjs: true }],
      'import-x/no-duplicates': 'error',
    },
  },
  {
    files: ['build/**/*.js', 'bin/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
      'import-x/no-unresolved': ['error', {
        commonjs: true,
        ignore: ['^svgo$'],
      }],
    },
  },
  {
    files: ['src/js/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  }
];
