const express = require('express');
const mongoose = require('mongoose');
const Claim = require('../models/Claim');
const Policy = require('../models/Policy');
const { requireAuth } = require('../middleware/auth');
const { trackEvent } = require('../services/appInsights');

const router = express.Router();

router.use(requireAuth);

// GET /api/claims  — all claims for authenticated customer
router.get('/', async (req, res, next) => {
  try {
    const claims = await Claim.find({ customerId: req.customer.id })
      .populate('policyId', 'policyNumber type vehicle property')
      .sort({ filedDate: -1 })
      .lean();
    res.json(claims);
  } catch (err) {
    next(err);
  }
});

// GET /api/claims/:id  — single claim detail
router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid claim ID' });
    }
    const claim = await Claim.findOne({ _id: req.params.id, customerId: req.customer.id })
      .populate('policyId', 'policyNumber type vehicle property')
      .lean();
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    res.json(claim);
  } catch (err) {
    next(err);
  }
});

// POST /api/claims  — open a new claim
router.post('/', async (req, res, next) => {
  try {
    const { policyId, incidentType, incidentDate, description, estimatedLoss } = req.body;

    if (!policyId || !incidentType || !incidentDate || !description) {
      return res.status(400).json({ error: 'policyId, incidentType, incidentDate, and description are required' });
    }

    if (!mongoose.isValidObjectId(policyId)) {
      return res.status(400).json({ error: 'Invalid policy ID' });
    }

    // Confirm ownership and get policy type
    const policy = await Policy.findOne({ _id: policyId, customerId: req.customer.id, status: 'active' });
    if (!policy) return res.status(404).json({ error: 'Active policy not found' });

    // Generate sequential claim number: NW-AUTO-2024-0001
    const year = new Date().getFullYear();
    const prefix = `NW-${policy.type.toUpperCase()}-${year}`;
    const count = await Claim.countDocuments({ policyType: policy.type });
    const claimNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    const claim = await Claim.create({
      claimNumber,
      policyId,
      customerId:   req.customer.id,
      policyType:   policy.type,
      incidentType,
      incidentDate: new Date(incidentDate),
      description,
      estimatedLoss,
    });

    trackEvent('claim.opened', {
      claimId:      claim._id.toString(),
      claimNumber:  claim.claimNumber,
      policyType:   policy.type,
      incidentType,
      customerId:   req.customer.id,
    });

    res.status(201).json(claim);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
