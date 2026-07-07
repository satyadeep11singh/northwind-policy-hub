const express = require('express');
const mongoose = require('mongoose');
const Policy = require('../models/Policy');
const { requireAuth } = require('../middleware/auth');
const { trackEvent } = require('../services/appInsights');

const router = express.Router();

// All policy routes require authentication
router.use(requireAuth);

// GET /api/policies  — all policies for the authenticated customer
router.get('/', async (req, res, next) => {
  try {
    const policies = await Policy.find({ customerId: req.customer.id, status: { $ne: 'cancelled' } })
      .select('-__v')
      .lean();
    res.json(policies);
  } catch (err) {
    next(err);
  }
});

// GET /api/policies/:id  — single policy detail
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid policy ID' });
    }
    const policy = await Policy.findOne({ _id: req.params.id, customerId: req.customer.id }).lean();
    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    trackEvent('policy.viewed', { policyId: policy._id.toString(), type: policy.type });
    res.json(policy);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/policies/:id/coverage  — update a specific coverage option
// Body: { coverageKey: string, field: string, value: any }
// Example: { coverageKey: "collision", field: "deductible", value: 500 }
// Example: { coverageKey: "sewerBackup", field: "included", value: true }
router.patch('/:id/coverage', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid policy ID' });
    }

    const { coverageKey, field, value } = req.body;
    if (!coverageKey || !field || value === undefined) {
      return res.status(400).json({ error: 'coverageKey, field, and value are required' });
    }

    const policy = await Policy.findOne({ _id: req.params.id, customerId: req.customer.id });
    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    const coverageSection = policy.coverages[policy.type]; // auto or home
    if (!coverageSection || !coverageSection[coverageKey]) {
      return res.status(400).json({ error: `Coverage '${coverageKey}' not found on this policy` });
    }

    // Guard: prevent modification of non-modifiable mandatory coverages
    if (field === 'included' && coverageSection[coverageKey].modifiable === false) {
      return res.status(400).json({ error: `Coverage '${coverageKey}' is mandatory and cannot be removed` });
    }

    // Validate deductible values
    if (field === 'deductible') {
      const allowed = coverageKey === 'collision' ? [500, 1000, 2500] : [300, 500, 1000];
      if (!allowed.includes(Number(value))) {
        return res.status(400).json({ error: `Invalid deductible. Allowed: ${allowed.join(', ')}` });
      }
    }

    coverageSection[coverageKey][field] = value;
    policy.markModified(`coverages.${policy.type}`);
    await policy.save();

    trackEvent('coverage.changed', {
      policyId:    policy._id.toString(),
      policyType:  policy.type,
      coverageKey,
      field,
      newValue:    String(value),
    });

    res.json({ message: 'Coverage updated', policy });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
