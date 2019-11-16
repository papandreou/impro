module.exports = {
  parserOptions: {
    ecmaVersion: 2018
  },
  extends: ['standard', 'prettier', 'prettier/standard'],
  plugins: ['mocha'],
  env: {
    mocha: true
  },
  rules: {
    'mocha/no-exclusive-tests': 'error',
    'mocha/no-nested-tests': 'error',
    'mocha/no-identical-title': 'error'
  }
};
