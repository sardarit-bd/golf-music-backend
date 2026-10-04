module.exports = {
  apps: [
    {
      name: "golf-music-backend",
      script: "src/server.js",
      instances: "max", // Or specify a number like 2, depending on VPS CPU cores
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      env_development: {
        NODE_ENV: "development",
        PORT: 5000,
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      restart_delay: 4000,
      min_uptime: "10s",
      max_restarts: 10,
    },
  ],
};
