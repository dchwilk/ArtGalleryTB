const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  use: { channel: process.env.PLAYWRIGHT_CHANNEL || 'chromium' },
  projects: [
    { name: 'tv-1080p', use: { viewport: { width: 1920, height: 1080 } } },
    { name: 'tv-720p', use: { viewport: { width: 1280, height: 720 } } }
  ]
});
