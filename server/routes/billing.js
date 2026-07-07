const express = require('express');
const mongoose = require('mongoose');
const Billing = require('../models/Billing');
const Policy = require('../models/Policy');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

// GET /api/billing  — all billing records for authenticated customer
router.get('/', async (req, res, next) => {
  try {
    const records = await Billing.find({ customerId: req.customer.id })
      .populate('policyId', 'policyNumber type vehicle property')
      .lean();
    res.json(records);
  } catch (err) {
    next(err);
  }
});

// GET /api/billing/:policyId  — billing for a specific policy
router.get('/:policyId', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.policyId)) {
      return res.status(400).json({ error: 'Invalid policy ID' });
    }

    // Confirm ownership
    const policy = await Policy.findOne({ _id: req.params.policyId, customerId: req.customer.id }).lean();
    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    const billing = await Billing.findOne({ policyId: req.params.policyId }).lean();
    if (!billing) return res.status(404).json({ error: 'Billing record not found' });

    res.json(billing);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
