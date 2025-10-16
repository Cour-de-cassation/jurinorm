/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  setupFiles: ["<rootDir>/src/.jest/setupEnvVars.ts"],
  testEnvironment: "node",
  transform: {
    "^.+\.tsx?$": ["ts-jest",{}],
  },
  testMatch: [
    "<rootDir>/src/**/*.spec.ts",
  ],
};