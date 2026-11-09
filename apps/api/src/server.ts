import { connect } from './models.js';
import { createApp } from './app.js';
import { config } from './config.js';
await connect();
const server = createApp().listen(config.port, '0.0.0.0', () =>
  console.log(`API listening on ${config.port}; payments: ${config.provider}`),
);
process.on('SIGTERM', () => server.close(() => process.exit(0)));
