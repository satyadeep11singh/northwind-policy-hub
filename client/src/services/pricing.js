// Mirror of server/services/pricing.js — kept in sync manually.
// Used for instant client-side premium preview; server recalculates on save
// and is always the source of truth.

const AUTO_RATES = {
  thirdPartyLiability: { 1000000: 650, 2000000: 800 },
  accidentBenefitsEnhanced: 120,
  collision:     { 500: 480, 1000: 380, 2500: 280 },
  comprehensive: { 300: 220,  500: 180, 1000: 130 },
  rentalReimbursement:  80,
  waiverOfDepreciation: 150,
  roadsideAssistance:   60,
};

const HOME_RATES = {
  dwellingRatePerThousand: 2.0,
  personalLiability: { 1000000: 60, 2000000: 80 },
  sewerBackup:    120,
  overlandWater:  180,
  homeBusiness:   200,
  jewelleryFloater: 95,
  identityTheft:   65,
};

function calculateAutoPremium(auto) {
  if (!auto) return 0;
  let premium = 0;

  const tplLimit = auto.thirdPartyLiability?.limit ?? 2000000;
  premium += AUTO_RATES.thirdPartyLiability[tplLimit] ?? AUTO_RATES.thirdPartyLiability[2000000];

  if (auto.accidentBenefits?.enhanced) premium += AUTO_RATES.accidentBenefitsEnhanced;

  if (auto.collision?.included) {
    const ded = auto.collision.deductible ?? 1000;
    premium += AUTO_RATES.collision[ded] ?? AUTO_RATES.collision[1000];
  }
  if (auto.comprehensive?.included) {
    const ded = auto.comprehensive.deductible ?? 500;
    premium += AUTO_RATES.comprehensive[ded] ?? AUTO_RATES.comprehensive[500];
  }
  if (auto.rentalReimbursement?.included)  premium += AUTO_RATES.rentalReimbursement;
  if (auto.waiverOfDepreciation?.included) premium += AUTO_RATES.waiverOfDepreciation;
  if (auto.roadsideAssistance?.included)   premium += AUTO_RATES.roadsideAssistance;

  return Math.round(premium);
}

function calculateHomePremium(home) {
  if (!home) return 0;
  let premium = 0;

  const replacementValue = home.dwelling?.replacementValue ?? 0;
  premium += Math.round((replacementValue / 1000) * HOME_RATES.dwellingRatePerThousand);

  const liabilityLimit = home.personalLiability?.limit ?? 1000000;
  premium += HOME_RATES.personalLiability[liabilityLimit] ?? HOME_RATES.personalLiability[1000000];

  if (home.sewerBackup?.included)      premium += HOME_RATES.sewerBackup;
  if (home.overlandWater?.included)    premium += HOME_RATES.overlandWater;
  if (home.homeBusiness?.included)     premium += HOME_RATES.homeBusiness;
  if (home.jewelleryFloater?.included) premium += HOME_RATES.jewelleryFloater;
  if (home.identityTheft?.included)    premium += HOME_RATES.identityTheft;

  return Math.round(premium);
}

export function calculatePremium(policyType, coverages) {
  if (policyType === 'auto') return calculateAutoPremium(coverages?.auto);
  if (policyType === 'home') return calculateHomePremium(coverages?.home);
  return 0;
}
