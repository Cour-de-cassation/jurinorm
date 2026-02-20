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
  moduleNameMapper: {
    "^@ca/(.*)$": "<rootDir>/src/ca/$1",
    "^@cc/(.*)$": "<rootDir>/src/cc/$1",
    "^@connectors/(.*)$": "<rootDir>/src/connectors/$1",
    "^@cph/(.*)$": "<rootDir>/src/cph/$1",
    "^@services/(.*)$": "<rootDir>/src/services/$1",
    "^@tcom/(.*)$": "<rootDir>/src/tcom/$1",
    "^@tj/(.*)$": "<rootDir>/src/tj/$1"
  }
};