// pm2 ecosystem config for Huly-OS operator daemon
// Start: npx pm2 start ecosystem.config.cjs
// Stop:  npx pm2 stop huly-operator
// Logs:  npx pm2 logs huly-operator

module.exports = {
  apps: [
    {
      name: 'huly-operator',
      script: 'daemon/operator-cli.ts',
      args: '--interval 300',
      cwd: __dirname,
      interpreter: 'node',
      interpreter_args: '--import tsx',
      watch: false,
      // Restart on crash, max 5 restarts in 1 minute
      max_restarts: 5,
      min_uptime: '60s',
      // Log files
      out_file: './logs/operator-out.log',
      error_file: './logs/operator-error.log',
      merge_logs: true,
      // Env
      env: {
        NODE_ENV: 'production',
        OPERATOR_ENABLED: 'true',
      },
    },
  ],
};
