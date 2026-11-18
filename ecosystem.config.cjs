// pm2 konfiguratsiyasi: dashboard doimiy ishlashi uchun (avto-qayta ishga tushirish, xotira cheklovi).
//   npm run build
//   pm2 start ecosystem.config.cjs
//   pm2 save            (server qayta yoqilganda ham ishlashi uchun: pm2-installer / pm2-windows-service)
module.exports = {
  apps: [
    {
      name: "situation-dashboard",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: __dirname,
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 50,
      min_uptime: "20s",
      restart_delay: 3000,
      max_memory_restart: "700M",
      time: true,
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      merge_logs: true,
    },
  ],
};
