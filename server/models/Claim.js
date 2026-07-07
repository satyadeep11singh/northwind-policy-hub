const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  author:  { type: String, required: true },
  content: { type: String, required: true },
  date:    { type: Date, default: Date.now },
}, { _id: false });

const claimSchema = new mongoose.Schema({
  claimNumber: { type: String, required: true, unique: true },
  policyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true },
  customerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  policyType:  { type: String, enum: ['auto', 'home'], required: true },

  status: {
    type: String,
    enum: ['submitted', 'under_review', 'approved', 'settled', 'denied', 'closed'],
    default: 'submitted',
  },

  incidentType: {
    type: String,
    enum: [
      // auto
      'collision', 'comprehensive', 'theft', 'vandalism', 'glass',
      // home
      'water_damage', 'fire', 'theft_home', 'liability', 'weather', 'sewer_backup', 'other',
    ],
    required: true,
  },

  incidentDate:  { type: Date, required: true },
  filedDate:     { type: Date, default: Date.now },
  settledDate:   { type: Date },

  description:   { type: String, required: true, maxlength: 2000 },
  estimatedLoss: { type: Number },
  settledAmount: { type: Number },

  adjusterName:  { type: String },
  notes:         [noteSchema],
}, { timestamps: true });

module.exports = mongoose.model('Claim', claimSchema);
