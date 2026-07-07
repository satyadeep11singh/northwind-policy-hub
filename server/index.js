// Application Insights must be initialized before any other require
// so it can auto-instrument HTTP, MongoDB, and dependency calls
const appInsights = require('./services/appInsights');
appInsights.init();

require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const compression = require('compression');
const path       = require('path');

const { loadSecrets }    = require('./services/keyVault');
const { connect }        = require('./services/db');
const { errorHandler }   = require('./middleware/errorHandler');
const logger             = require('./services/logger');

const authRoutes    = require('./routes/auth');
const policyRoutes  = require('./routes/policies');
const billingRoutes = require('./routes/billing');
const claimRoutes   = require('./routes/claims');
const healthRoutes  = require('./routes/health');

const app = express();

// ── Security & utility middleware ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
    },
  },
}));
app.use(compression());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(express.json({ limit: '10kb' }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/health',      healthRoutes);
app.use('/api/auth',    authRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/billing',  billingRoutes);
app.use('/api/claims',   claimRoutes);

// ── Serve React build in production ──────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

// ── Boot sequence ─────────────────────────────────────────────────────────────
async function start() {
  try {
    await loadSecrets();      // pulls secrets from Key Vault (no-op in local dev)
    await connect();          // connects to MongoDB Atlas or Cosmos DB
    const port = process.env.PORT || 3001;
    app.listen(port, () => logger.info(`NorthWind Policy Hub listening on port ${port}`));
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();
