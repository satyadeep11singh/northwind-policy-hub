const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
  date:   { type: Date, required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['credit_card', 'bank_transfer', 'cheque'], default: 'credit_card' },
  status: { type: String, enum: ['paid', 'failed', 'refunded'], default: 'paid' },
  reference: String,
}, { _id: false });

const billingSchema = new mongoose.Schema({
  policyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

  paymentFrequency: { type: String, enum: ['monthly', 'quarterly', 'annual'], default: 'monthly' },
  paymentMethod:    { type: String, enum: ['credit_card', 'bank_transfer', 'cheque'], default: 'credit_card' },

  nextDueDate:   { type: Date, required: true },
  nextDueAmount: { type: Number, required: true },

  annualTotal:   { type: Number, required: true },
  paidYTD:       { type: Number, default: 0 },

  paymentHistory: [paymentHistorySchema],
}, { timestamps: true });

module.exports = mongoose.model('Billing', billingSchema);
