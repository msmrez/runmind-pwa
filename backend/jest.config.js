// backend/jest.config.js
module.exports = {
  testEnvironment: "node", // Specifies that tests will run in a Node.js environment
  verbose: true, // Shows individual test results during execution
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  // Setup files to run before tests (optional, good for global setup)
  setupFilesAfterEnv: ["./tests/setup.js"],
  // Coverage reporting (optional but recommended)
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8", // or "babel"
};
