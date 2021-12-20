module.exports = /** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */({
  testMatch: ['**/*.test.ts'],
  watchPathIgnorePatterns: ['src/'],
  preset: 'ts-jest',
  transform: {
    '^.+(t|j)s?$': 'ts-jest'
  },
});
