export default /** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */({
  preset: 'ts-jest/presets/default-esm',
  testMatch: ['**/src/**/*.test.ts'],
  resolver: 'jest-ts-webcompat-resolver',
  globals: { 'ts-jest': { useESM: true } },
});
