const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./playwright",
  timeout: 60 * 1000,
  expect: {
    timeout: 5000,
  },
  reporter: "list",
});
