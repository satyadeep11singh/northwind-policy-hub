require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Policy   = require('../models/Policy');
const Billing  = require('../models/Billing');
const Claim    = require('../models/Claim');
const logger   = require('../services/logger');

// ── Helpers ──────────────────────────────────────────────────────────────────

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const today = new Date();

// ── Customer seed data ───────────────────────────────────────────────────────

const customers = [
  {
    email:     'sarah.chen@email.com',
    passwordHash: 'Demo@1234',   // hashed by pre-save hook
    firstName: 'Sarah',
    lastName:  'Chen',
    phone:     '416-555-0182',
    dateOfBirth: new Date('1988-04-12'),
    address: { street: '145 Bay Street', city: 'Toronto', province: 'ON', postal: 'M5J 2T3' },
  },
  {
    email:     'marco.rossi@email.com',
    passwordHash: 'Demo@1234',
    firstName: 'Marco',
    lastName:  'Rossi',
    phone:     '905-555-0247',
    dateOfBirth: new Date('1975-09-30'),
    address: { street: '88 Maple Ave', city: 'Mississauga', province: 'ON', postal: 'L5B 2C3' },
  },
  {
    email:     'priya.sharma@email.com',
    passwordHash: 'Demo@1234',
    firstName: 'Priya',
    lastName:  'Sharma',
    phone:     '613-555-0319',
    dateOfBirth: new Date('1993-02-18'),
    address: { street: '22 Rideau Street', city: 'Ottawa', province: 'ON', postal: 'K1N 8J9' },
  },
];

// ── Policy builders ──────────────────────────────────────────────────────────

function buildAutoPolicy(customerId, policyNumber, vehicle, premium, opts = {}) {
  return {
    policyNumber,
    customerId,
    type:    'auto',
    status:  'active',
    vehicle,
    effectiveDate: addMonths(today, -6),
    expiryDate:    addMonths(today, 6),
    annualPremium: premium,
    coverages: {
      auto: {
        thirdPartyLiability:  { included: true, limit: 2000000, modifiable: true },
        accidentBenefits:     { included: true, enhanced: opts.enhancedAB || false, modifiable: true },
        dcpd:                 { included: true, modifiable: false },
        uninsuredAutomobile:  { included: true, modifiable: false },
        collision:            { included: opts.collision   ?? true,  deductible: opts.collisionDed ?? 1000 },
        comprehensive:        { included: opts.comprehensive ?? true, deductible: opts.comprehensiveDed ?? 500 },
        rentalReimbursement:  { included: opts.rental ?? false, dailyLimit: 60 },
        waiverOfDepreciation: { included: opts.waiver ?? false },
        roadsideAssistance:   { included: opts.roadside ?? true },
      },
    },
  };
}

function buildHomePolicy(customerId, policyNumber, property, dwelling, premium, opts = {}) {
  return {
    policyNumber,
    customerId,
    type:     'home',
    status:   'active',
    property,
    effectiveDate: addMonths(today, -3),
    expiryDate:    addMonths(today, 9),
    annualPremium: premium,
    coverages: {
      home: {
        dwelling:                 { included: true, replacementValue: dwelling, modifiable: false },
        detachedStructures:       { included: true, modifiable: false },
        personalProperty:         { included: true, replacementValue: 85000, modifiable: true },
        additionalLivingExpenses: { included: true, modifiable: false },
        personalLiability:        { included: true, limit: 2000000, modifiable: true },
        sewerBackup:    { included: opts.sewer  ?? true },
        overlandWater:  { included: opts.overland ?? false },
        homeBusiness:   { included: opts.business ?? false },
        jewelleryFloater: { included: opts.jewellery ?? false, coveredAmount: opts.jewelleryAmt ?? 0 },
        identityTheft:  { included: opts.identity ?? false },
      },
    },
  };
}

// ── Billing builder ───────────────────────────────────────────────────────────

function buildBilling(policyId, customerId, annualPremium, monthsIn = 6) {
  const monthly = parseFloat((annualPremium / 12).toFixed(2));
  const history = [];
  for (let i = monthsIn; i > 0; i--) {
    history.push({
      date:      addMonths(today, -i),
      amount:    monthly,
      method:    'credit_card',
      status:    'paid',
      reference: `PAY-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    });
  }
  return {
    policyId,
    customerId,
    paymentFrequency: 'monthly',
    paymentMethod:    'credit_card',
    nextDueDate:      addMonths(today, 1),
    nextDueAmount:    monthly,
    annualTotal:      annualPremium,
    paidYTD:          parseFloat((monthly * monthsIn).toFixed(2)),
    paymentHistory:   history,
  };
}

// ── Main seed function ────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  logger.info('Connected to MongoDB — seeding...');

  // Wipe existing data
  await Promise.all([
    Customer.deleteMany({}),
    Policy.deleteMany({}),
    Billing.deleteMany({}),
    Claim.deleteMany({}),
  ]);

  // ── Sarah Chen: auto + home ──────────────────────────────────────────────
  const sarah = await Customer.create(customers[0]);

  const sarahAuto = await Policy.create(buildAutoPolicy(
    sarah._id, 'NW-AUTO-2024-00001',
    { year: 2022, make: 'Honda', model: 'CR-V', vin: '2HKRW2H56NH601234', plate: 'BCDF 123' },
    1620,
    { collision: true, comprehensive: true, roadside: true, waiver: false, rental: true, enhancedAB: true },
  ));

  const sarahHome = await Policy.create(buildHomePolicy(
    sarah._id, 'NW-HOME-2024-00001',
    { address: '145 Bay Street', city: 'Toronto', postalCode: 'M5J 2T3', yearBuilt: 1998, squareFootage: 1100, propertyType: 'condo' },
    480000, 1320,
    { sewer: true, overland: false, identity: true, jewellery: true, jewelleryAmt: 8000 },
  ));

  sarah.policyIds = [sarahAuto._id, sarahHome._id];
  await sarah.save();

  await Billing.create(buildBilling(sarahAuto._id, sarah._id, 1620, 6));
  await Billing.create(buildBilling(sarahHome._id, sarah._id, 1320, 3));

  // Sarah's claims
  await Claim.create({
    claimNumber: 'NW-AUTO-2024-0001',
    policyId:    sarahAuto._id,
    customerId:  sarah._id,
    policyType:  'auto',
    status:      'settled',
    incidentType:'collision',
    incidentDate: addDays(today, -120),
    filedDate:    addDays(today, -118),
    settledDate:  addDays(today, -85),
    description: 'Rear-ended at a red light on King St W. Damage to rear bumper and trunk area.',
    estimatedLoss: 4800,
    settledAmount: 3800,  // after $1000 deductible
    adjusterName: 'David Park',
    notes: [
      { author: 'David Park', content: 'Claim received. Repair estimate obtained from approved shop.', date: addDays(today, -115) },
      { author: 'David Park', content: 'Repair authorized. Payment issued to Ontario Auto Repair Centre.', date: addDays(today, -85) },
    ],
  });

  await Claim.create({
    claimNumber: 'NW-HOME-2024-0001',
    policyId:    sarahHome._id,
    customerId:  sarah._id,
    policyType:  'home',
    status:      'under_review',
    incidentType:'water_damage',
    incidentDate: addDays(today, -14),
    filedDate:    addDays(today, -12),
    description: 'Water leak from unit above caused ceiling damage in living room and bedroom. Approx 20 sq ft of drywall and flooring affected.',
    estimatedLoss: 7200,
    adjusterName: 'Lisa Nguyen',
    notes: [
      { author: 'Lisa Nguyen', content: 'Claim received. Inspection scheduled for next week.', date: addDays(today, -10) },
    ],
  });

  // ── Marco Rossi: two auto policies ───────────────────────────────────────
  const marco = await Customer.create(customers[1]);

  const marcoAuto1 = await Policy.create(buildAutoPolicy(
    marco._id, 'NW-AUTO-2024-00002',
    { year: 2020, make: 'Toyota', model: 'RAV4', vin: '2T3BFREV0LW123456', plate: 'WXYZ 456' },
    1420,
    { collision: true, comprehensive: true, roadside: true, enhancedAB: false },
  ));

  const marcoAuto2 = await Policy.create(buildAutoPolicy(
    marco._id, 'NW-AUTO-2024-00003',
    { year: 2019, make: 'Ford', model: 'F-150', vin: '1FTEW1EP0KFA78901', plate: 'PQRS 789' },
    1420,
    { collision: true, comprehensive: true, roadside: true, enhancedAB: false, rental: false },
  ));

  marco.policyIds = [marcoAuto1._id, marcoAuto2._id];
  await marco.save();

  await Billing.create(buildBilling(marcoAuto1._id, marco._id, 1420, 6));
  await Billing.create(buildBilling(marcoAuto2._id, marco._id, 1420, 6));

  await Claim.create({
    claimNumber: 'NW-AUTO-2024-0002',
    policyId:    marcoAuto1._id,
    customerId:  marco._id,
    policyType:  'auto',
    status:      'submitted',
    incidentType:'comprehensive',
    incidentDate: addDays(today, -3),
    filedDate:    addDays(today, -1),
    description: 'Windshield cracked by road debris on Hwy 401. Full replacement required.',
    estimatedLoss: 950,
    notes: [],
  });

  // ── Priya Sharma: auto + home ─────────────────────────────────────────────
  const priya = await Customer.create(customers[2]);

  const priyaAuto = await Policy.create(buildAutoPolicy(
    priya._id, 'NW-AUTO-2024-00004',
    { year: 2023, make: 'Hyundai', model: 'Tucson', vin: '5NMJBCAE0PH012345', plate: 'LMNO 321' },
    1570,
    { collision: true, comprehensive: true, roadside: true, waiver: true, enhancedAB: false },
  ));

  const priyaHome = await Policy.create(buildHomePolicy(
    priya._id, 'NW-HOME-2024-00002',
    { address: '22 Rideau Street', city: 'Ottawa', postalCode: 'K1N 8J9', yearBuilt: 2005, squareFootage: 1850, propertyType: 'semi-detached' },
    625000, 1630,
    { sewer: true, overland: true, identity: false, jewellery: false },
  ));

  priya.policyIds = [priyaAuto._id, priyaHome._id];
  await priya.save();

  await Billing.create(buildBilling(priyaAuto._id, priya._id, 1570, 6));
  await Billing.create(buildBilling(priyaHome._id, priya._id, 1630, 3));

  // Priya has no active claims — clean record shown on dashboard

  logger.info('Seed complete.');
  logger.info('Demo accounts (password: Demo@1234):');
  logger.info('  sarah.chen@email.com  — auto + home, 2 claims (settled + under review)');
  logger.info('  marco.rossi@email.com — 2 auto policies, 1 new claim');
  logger.info('  priya.sharma@email.com — auto + home, no claims');

  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
