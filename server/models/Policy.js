const mongoose = require('mongoose');

// ── Coverage sub-schemas ────────────────────────────────────────────────────

const autoCoverageSchema = new mongoose.Schema({
  // Mandatory Ontario coverages (cannot be removed)
  thirdPartyLiability: {
    included:   { type: Boolean, default: true },
    limit:      { type: Number, default: 1000000 }, // $1M standard
    modifiable: { type: Boolean, default: true },   // limit can change
  },
  accidentBenefits: {
    included:   { type: Boolean, default: true },
    enhanced:   { type: Boolean, default: false },  // optional top-up
    modifiable: { type: Boolean, default: true },
  },
  dcpd: {
    included:   { type: Boolean, default: true },
    modifiable: { type: Boolean, default: false },
  },
  uninsuredAutomobile: {
    included:   { type: Boolean, default: true },
    modifiable: { type: Boolean, default: false },
  },
  // Optional coverages
  collision: {
    included:   { type: Boolean, default: false },
    deductible: { type: Number, default: 1000 },    // $500 | $1000 | $2500
  },
  comprehensive: {
    included:   { type: Boolean, default: false },
    deductible: { type: Number, default: 500 },     // $300 | $500 | $1000
  },
  rentalReimbursement: {   // OPCF 20
    included:   { type: Boolean, default: false },
    dailyLimit: { type: Number, default: 60 },
  },
  waiverOfDepreciation: {  // OPCF 43 — new vehicles only
    included:   { type: Boolean, default: false },
  },
  roadsideAssistance: {
    included:   { type: Boolean, default: false },
  },
}, { _id: false });

const homeCoverageSchema = new mongoose.Schema({
  // Core coverages (always included)
  dwelling: {
    included:          { type: Boolean, default: true },
    replacementValue:  { type: Number, required: true }, // e.g. 650000
    modifiable:        { type: Boolean, default: false },
  },
  detachedStructures: {
    included:   { type: Boolean, default: true },
    modifiable: { type: Boolean, default: false },
  },
  personalProperty: {
    included:          { type: Boolean, default: true },
    replacementValue:  { type: Number, default: 80000 },
    modifiable:        { type: Boolean, default: true },
  },
  additionalLivingExpenses: {
    included:   { type: Boolean, default: true },
    modifiable: { type: Boolean, default: false },
  },
  personalLiability: {
    included:   { type: Boolean, default: true },
    limit:      { type: Number, default: 1000000 },
    modifiable: { type: Boolean, default: true },
  },
  // Optional add-ons
  sewerBackup: {
    included: { type: Boolean, default: false },
  },
  overlandWater: {
    included: { type: Boolean, default: false },
  },
  homeBusiness: {
    included: { type: Boolean, default: false },
  },
  jewelleryFloater: {
    included:       { type: Boolean, default: false },
    coveredAmount:  { type: Number, default: 0 },
  },
  identityTheft: {
    included: { type: Boolean, default: false },
  },
}, { _id: false });

// ── Policy schema ────────────────────────────────────────────────────────────

const policySchema = new mongoose.Schema({
  policyNumber: { type: String, required: true, unique: true },
  customerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  type:         { type: String, enum: ['auto', 'home'], required: true },
  status:       { type: String, enum: ['active', 'cancelled', 'expired'], default: 'active' },

  // Vehicle details (auto only)
  vehicle: {
    year:  Number,
    make:  String,
    model: String,
    vin:   String,
    plate: String,
  },

  // Property details (home only)
  property: {
    address:      String,
    city:         String,
    postalCode:   String,
    yearBuilt:    Number,
    squareFootage: Number,
    propertyType: { type: String, enum: ['detached', 'semi-detached', 'condo', 'townhouse'] },
  },

  coverages: {
    auto: autoCoverageSchema,
    home: homeCoverageSchema,
  },

  effectiveDate:  { type: Date, required: true },
  expiryDate:     { type: Date, required: true },
  annualPremium:  { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Policy', policySchema);
