const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: true,
});

module.exports = {
  apps: [
    {
      name: "cristalwater",
      script: "src/server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      time: true,
      max_memory_restart: "600M",
      out_file: path.join(__dirname, "logs", "pm2-out.log"),
      error_file: path.join(__dirname, "logs", "pm2-error.log"),
      env: {
        NODE_ENV: "production",
        PORT: process.env.PORT || "3002",
        DATABASE_URL: process.env.DATABASE_URL,
        DIRECT_URL: process.env.DIRECT_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        ADMIN_EMAIL: process.env.ADMIN_EMAIL,
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
        ADMIN_NAME: process.env.ADMIN_NAME,
        AI_ADMIN_ENABLED: process.env.AI_ADMIN_ENABLED || "true",
        AI_ADMIN_REQUIRE_APPROVAL: process.env.AI_ADMIN_REQUIRE_APPROVAL || "true",
        ENABLE_ADMIN_AI_OPENAI: process.env.ENABLE_ADMIN_AI_OPENAI || "true",
        ENABLE_ADMIN_AI_WEB: process.env.ENABLE_ADMIN_AI_WEB || "true",
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      },
    },
  ],
};
