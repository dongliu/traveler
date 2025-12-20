module.exports = {
  // The test reporter to use (e.g., 'spec', 'nyan', 'list')
  reporter: 'spec',

  // Timeout for tests in milliseconds or a string like '2s'
  timeout: '2000', // Equivalent to --timeout 2000

  // File extensions to look for (e.g., for TypeScript, add 'ts')
  extension: ['js', 'cjs', 'mjs'],

  // Glob patterns for test files
  spec: 'test-unit/**/*.test.js', // Runs files in 'test' directory ending with .spec.js

  // Watch files for changes and re-run tests
  // 'watch-files': ['lib/**/*.js', 'test/**/*.js'],

  // Ignore specific files or directories when watching
  // 'watch-ignore': ['lib/vendor'],

  // Enable or disable features (e.g., bail on first failure)
  bail: false,

  // Add custom requires before tests run (e.g., for chai, sinon)
  require: ['chai', 'sinon'],
};
