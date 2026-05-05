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
    "^@ca/(.*)$": "<rootDir>/src/sources/jurica/$1",
    "^@cc/(.*)$": "<rootDir>/src/sources/jurinet/$1",
    "^@connectors/(.*)$": "<rootDir>/src/connectors/$1",
    "^@cph/(.*)$": "<rootDir>/src//sources/portalis/$1",
    "^@services/(.*)$": "<rootDir>/src/services/$1",
    "^@tcom/(.*)$": "<rootDir>/src/sources/juritcom/$1",
    "^@tj/(.*)$": "<rootDir>/src/sources/juritj/$1",
    "^@config/(.*)$": "<rootDir>/src/config/$1"
  }
};