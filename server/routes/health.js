const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

// GET /health  — Jenkins CD pipeline pings this after every deploy
router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : 'disconnected';

  const status = dbState === 1 ? 'ok' : 'degraded';

  res.status(200).json({
    status,
    version:   process.env.npm_package_version || '1.0.0',
    buildId:   process.env.BUILD_ID || 'local',
    timestamp: new Date().toISOString(),
    db:        dbStatus,
  });
});

module.exports = router;
