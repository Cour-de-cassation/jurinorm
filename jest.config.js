/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\.tsx?$": ["ts-jest",{}],
  },
  testMatch: [
    "<rootDir>/src/**/*.spec.ts",
  ],
  setupFiles: ['<rootDir>/src/.jest/setupEnvVars.ts'],
};