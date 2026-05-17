// PM2 process file for the Dr Tea API server.
// Usage on the VPS:
//   pm2 start deploy/ecosystem.config.cjs --env production
//   pm2 save && pm2 startup    # auto-start on reboot
//   pm2 logs drtea-api
//   pm2 restart drtea-api      # zero-downtime restart
module.exports = {
  apps: [
    {
      name: "drtea-api",
      cwd: "/var/www/drtea-app",
      script: "artifacts/api-server/dist/index.mjs",
      interpreter: "node",
      node_args: "--enable-source-maps",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "600M",
      kill_timeout: 8000,
      wait_ready: false,
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: "production",
        PORT: "8080",
      },
      out_file: "/var/log/drtea/api-out.log",
      error_file: "/var/log/drtea/api-err.log",
      merge_logs: true,
      time: true,
    },
  ],
};
