const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Customer = require('../models/Customer');
const { trackEvent } = require('../services/appInsights');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  // App Service proxy passes IP:port — strip port so rate-limit key is valid
  keyGenerator: (req) => req.ip.replace(/:\d+$/, ''),
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const customer = await Customer.findOne({ email }).select('+passwordHash');
    if (!customer || !(await customer.verifyPassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { sub: customer._id, email: customer.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
    );

    trackEvent('customer.login', { customerId: customer._id.toString(), email: customer.email });

    res.json({
      token,
      customer: {
        id:        customer._id,
        email:     customer.email,
        firstName: customer.firstName,
        lastName:  customer.lastName,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout  (client drops the token; server tracks the event)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

module.exports = router;
