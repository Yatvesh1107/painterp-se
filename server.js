const app = require('./app');
const connectDB = require('./config/db');
const { port } = require('./config/config');

const start = async () => {
  await connectDB();

  const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

start();
