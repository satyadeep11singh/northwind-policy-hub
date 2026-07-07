const mongoose = require('mongoose');
const logger = require('./logger');

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  logger.info(`MongoDB connected [provider: ${process.env.DB_PROVIDER || 'atlas'}]`);
}

module.exports = { connect };
