const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// Full CORS support for any origin (localhost, dev ports, network IP)
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json());

// Root health & status endpoint
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'PaintErp API is running', health: '/api/health' });
});

// Auto-prefix /api if requests come in without it (e.g. from misconfigured VITE_API_URL)
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    return next();
  }
  const knownPrefixes = [
    '/auth',
    '/parties',
    '/quotations',
    '/invoices',
    '/sites',
    '/services',
    '/settings',
    '/health',
  ];
  if (knownPrefixes.some((prefix) => req.url.startsWith(prefix))) {
    req.url = '/api' + req.url;
  }
  next();
});

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: 'Something went wrong' });
});

module.exports = app;
