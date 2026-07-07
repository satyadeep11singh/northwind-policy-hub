const express = require('express');
const mongoose = require('mongoose');
const Policy = require('../models/Policy');
const Billing = require('../models/Billing');
const { requireAuth } = require('../middleware/auth');
const { trackEvent } = require('../services/appInsights');
const { calculatePremium } = require('../services/pricing');

const MANDATORY = new Set(['dcpd', 'uninsuredAutomobile']);
const COLLISION_DEDUCTIBLES = [500, 1000, 2500];
const COMPREHENSIVE_DEDUCTIBLES = [300, 500, 1000];

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

// PATCH /api/policies/:id/coverage  — bulk save all coverage changes + recalculate premium
// Body: { coverages: object }  — the full coverage section for this policy type
// Server validates, recalculates annualPremium, updates billing nextDueAmount.
router.patch('/:id/coverage', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid policy ID' });
    }

    const { coverages: incomingCoverages } = req.body;
    if (!incomingCoverages || typeof incomingCoverages !== 'object') {
      return res.status(400).json({ error: 'coverages object is required' });
    }

    const policy = await Policy.findOne({ _id: req.params.id, customerId: req.customer.id });
    if (!policy) return res.status(404).json({ error: 'Policy not found' });

    const section = policy.coverages[policy.type];

    // Validate each incoming key
    for (const [key, incoming] of Object.entries(incomingCoverages)) {
      if (!section[key]) {
        return res.status(400).json({ error: `Unknown coverage key: ${key}` });
      }
      // Guard mandatory coverages
      if (incoming.included === false && MANDATORY.has(key)) {
        return res.status(400).json({ error: `Coverage '${key}' is mandatory and cannot be removed` });
      }
      if (incoming.included === false && section[key].modifiable === false) {
        return res.status(400).json({ error: `Coverage '${key}' is mandatory and cannot be removed` });
      }
      // Validate deductibles
      if (key === 'collision' && incoming.deductible !== undefined) {
        if (!COLLISION_DEDUCTIBLES.includes(Number(incoming.deductible))) {
          return res.status(400).json({ error: `Invalid collision deductible. Allowed: ${COLLISION_DEDUCTIBLES.join(', ')}` });
        }
      }
      if (key === 'comprehensive' && incoming.deductible !== undefined) {
        if (!COMPREHENSIVE_DEDUCTIBLES.includes(Number(incoming.deductible))) {
          return res.status(400).json({ error: `Invalid comprehensive deductible. Allowed: ${COMPREHENSIVE_DEDUCTIBLES.join(', ')}` });
        }
      }
    }

    // Apply changes onto the existing coverage section
    for (const [key, incoming] of Object.entries(incomingCoverages)) {
      for (const [field, val] of Object.entries(incoming)) {
        section[key][field] = val;
      }
    }

    const oldPremium = policy.annualPremium;
    policy.markModified(`coverages.${policy.type}`);

    // Recalculate premium server-side — client preview is for UX only
    const newPremium = calculatePremium(policy.type, policy.coverages.toObject ? policy.coverages.toObject() : policy.coverages);
    policy.annualPremium = newPremium;

    await policy.save();

    // Propagate new monthly amount to billing
    const newMonthly = parseFloat((newPremium / 12).toFixed(2));
    await Billing.findOneAndUpdate(
      { policyId: policy._id },
      { $set: { nextDueAmount: newMonthly, annualTotal: newPremium } },
    );

    trackEvent('coverage.changed', {
      policyId:      policy._id.toString(),
      policyType:    policy.type,
      oldPremium:    String(oldPremium),
      newPremium:    String(newPremium),
      changedKeys:   Object.keys(incomingCoverages).join(','),
    });

    res.json({
      message:      'Coverage saved',
      oldPremium,
      newPremium,
      newMonthly,
      policy,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
