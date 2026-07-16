import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/unit/**/*.test.ts"],
  setupFiles: ["dotenv/config", "<rootDir>/src/__tests__/setup.ts"],
  clearMocks: true,
  restoreMocks: true,
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
};

export default config;
