import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, CheckCircle, Save, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import api from '../services/api';
import { calculatePremium } from '../services/pricing';

// ── Coverage metadata ─────────────────────────────────────────────────────────

const AUTO_COVERAGES = [
  { key: 'thirdPartyLiability',  label: 'Third-Party Liability',            desc: 'Covers injuries or damage you cause to others. Mandatory in Ontario.',       mandatory: true  },
  { key: 'accidentBenefits',     label: 'Accident Benefits (SABS)',          desc: 'Medical, rehab, and income replacement. Mandatory.',                          mandatory: true  },
  { key: 'dcpd',                 label: 'Direct Compensation (DCPD)',        desc: 'Covers damage to your vehicle caused by another insured driver. Mandatory.',  mandatory: true  },
  { key: 'uninsuredAutomobile',  label: 'Uninsured Automobile',              desc: 'Protection if the at-fault driver is uninsured. Mandatory.',                  mandatory: true  },
  { key: 'collision',            label: 'Collision',                         desc: 'Covers repair or replacement of your vehicle after a collision.',              mandatory: false, deductibleField: 'deductible', deductibleOptions: [500, 1000, 2500] },
  { key: 'comprehensive',        label: 'Comprehensive',                     desc: 'Covers theft, weather, fire, glass, and other non-collision losses.',         mandatory: false, deductibleField: 'deductible', deductibleOptions: [300, 500, 1000]  },
  { key: 'rentalReimbursement',  label: 'Rental Reimbursement (OPCF 20)',    desc: 'Pays for a rental vehicle while your car is being repaired.',                mandatory: false },
  { key: 'waiverOfDepreciation', label: 'Waiver of Depreciation (OPCF 43)', desc: 'Pays replacement cost on new vehicles without depreciation deduction.',      mandatory: false },
  { key: 'roadsideAssistance',   label: 'Roadside Assistance',               desc: 'Towing, battery boost, flat tire, and lockout service.',                      mandatory: false },
];

const HOME_COVERAGES = [
  { key: 'dwelling',                 label: 'Dwelling',                     desc: 'Replacement cost coverage for your home structure. Included.',             mandatory: true  },
  { key: 'detachedStructures',       label: 'Detached Structures',          desc: 'Garage, shed, and fence coverage (10% of dwelling). Included.',            mandatory: true  },
  { key: 'personalProperty',         label: 'Personal Property / Contents', desc: 'Covers furniture, electronics, clothing, and personal items.',              mandatory: true  },
  { key: 'additionalLivingExpenses', label: 'Additional Living Expenses',   desc: 'Covers hotel and meals if your home is uninhabitable. Included.',          mandatory: true  },
  { key: 'personalLiability',        label: 'Personal Liability',           desc: 'Covers legal costs if someone is injured on your property. Included.',     mandatory: true  },
  { key: 'sewerBackup',              label: 'Sewer Backup',                 desc: 'Covers damage from sewer or drain backup. Highly recommended in Ontario.',  mandatory: false },
  { key: 'overlandWater',            label: 'Overland Water (Flooding)',    desc: 'Covers damage from overland flooding — separate from sewer backup.',        mandatory: false },
  { key: 'homeBusiness',             label: 'Home-Based Business',          desc: 'Covers business equipment and liability for work-from-home operations.',    mandatory: false },
  { key: 'jewelleryFloater',         label: 'Jewellery / High-Value Items', desc: 'Extended coverage for jewellery, watches, and collectibles.',               mandatory: false },
  { key: 'identityTheft',            label: 'Identity Theft Protection',    desc: 'Covers costs to restore your identity if compromised.',                     mandatory: false },
];

// ── Price breakdown tooltip labels ────────────────────────────────────────────

const AUTO_PRICE_LABELS = {
  thirdPartyLiability:  (cov) => `TPL $${(cov.limit / 1000000).toFixed(0)}M`,
  accidentBenefits:     (cov) => cov.enhanced ? 'Enhanced AB' : null,
  collision:            (cov) => cov.included ? `Collision ($${cov.deductible} ded.)` : null,
  comprehensive:        (cov) => cov.included ? `Comprehensive ($${cov.deductible} ded.)` : null,
  rentalReimbursement:  (cov) => cov.included ? 'Rental Reimbursement' : null,
  waiverOfDepreciation: (cov) => cov.included ? 'Waiver of Depreciation' : null,
  roadsideAssistance:   (cov) => cov.included ? 'Roadside Assistance' : null,
};

const HOME_PRICE_LABELS = {
  dwelling:          (cov) => `Dwelling ($${(cov.replacementValue / 1000).toFixed(0)}K)`,
  personalLiability: (cov) => `Liability $${(cov.limit / 1000000).toFixed(0)}M`,
  sewerBackup:       (cov) => cov.included ? 'Sewer Backup' : null,
  overlandWater:     (cov) => cov.included ? 'Overland Water' : null,
  homeBusiness:      (cov) => cov.included ? 'Home Business' : null,
  jewelleryFloater:  (cov) => cov.included ? 'Jewellery Floater' : null,
  identityTheft:     (cov) => cov.included ? 'Identity Theft' : null,
};

// ── Deep clone a plain object ────────────────────────────────────────────────
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ── Coverage row component ────────────────────────────────────────────────────

function CoverageRow({ meta, value, onChange, disabled }) {
  const included = value?.included ?? false;

  return (
    <div className="coverage-row">
      <div style={{ flex: 1 }}>
        <div className="coverage-name">
          {meta.label}
          {meta.mandatory && (
            <span style={{ marginLeft: 8, fontSize: 11, background: '#e8f0fe', color: '#1a3a5c', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
              MANDATORY
            </span>
          )}
        </div>
        <div className="coverage-desc">{meta.desc}</div>

        {/* Deductible selector — shown inline when coverage is active */}
        {meta.deductibleField && included && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--nw-text-muted)' }}>Deductible:</span>
            {meta.deductibleOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => !disabled && onChange(meta.key, meta.deductibleField, opt)}
                disabled={disabled}
                style={{
                  padding: '3px 10px',
                  borderRadius: 6,
                  border: '1px solid',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  background: value[meta.deductibleField] === opt ? 'var(--nw-navy)' : 'var(--nw-white)',
                  borderColor: value[meta.deductibleField] === opt ? 'var(--nw-navy)' : 'var(--nw-slate-dark)',
                  color: value[meta.deductibleField] === opt ? 'white' : 'var(--nw-text-muted)',
                  transition: 'all 0.15s',
                }}
              >
                ${opt.toLocaleString()}
              </button>
            ))}
          </div>
        )}
      </div>

      {meta.mandatory ? (
        <CheckCircle size={20} color="var(--nw-success)" style={{ flexShrink: 0 }} />
      ) : (
        <label className="toggle">
          <input
            type="checkbox"
            checked={included}
            onChange={(e) => !disabled && onChange(meta.key, 'included', e.target.checked)}
            disabled={disabled}
          />
          <span className="toggle-slider" />
        </label>
      )}
    </div>
  );
}

// ── Price summary panel ───────────────────────────────────────────────────────

function PricePanel({ policyType, savedPremium, previewPremium, coverages, hasChanges }) {
  const delta = previewPremium - savedPremium;
  const labels = policyType === 'auto' ? AUTO_PRICE_LABELS : HOME_PRICE_LABELS;
  const section = coverages?.[policyType];

  return (
    <div className="card" style={{ position: 'sticky', top: 80 }}>
      <div className="card-header">
        <span className="card-title">Premium Summary</span>
        {hasChanges && (
          <span style={{ fontSize: 11, background: '#fff3cd', color: '#856404', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
            UNSAVED CHANGES
          </span>
        )}
      </div>
      <div className="card-body">

        {/* Breakdown lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {section && Object.entries(labels).map(([key, labelFn]) => {
            const label = labelFn(section[key] ?? {});
            if (!label) return null;
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--nw-text-muted)' }}>{label}</span>
              </div>
            );
          })}
        </div>

        <hr className="divider" />

        {/* Annual */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--nw-text-muted)' }}>Annual premium</span>
          <div style={{ textAlign: 'right' }}>
            {hasChanges && savedPremium !== previewPremium && (
              <div style={{ fontSize: 12, textDecoration: 'line-through', color: 'var(--nw-text-muted)' }}>
                ${savedPremium.toLocaleString()}
              </div>
            )}
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--nw-navy)' }}>
              ${previewPremium.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Monthly */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--nw-text-muted)' }}>Monthly payment</span>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--nw-navy)' }}>
            ${(previewPremium / 12).toFixed(2)}/mo
          </span>
        </div>

        {/* Delta badge */}
        {hasChanges && delta !== 0 && (
          <div style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: delta > 0 ? '#fff3cd' : '#d4edda',
            color: delta > 0 ? '#856404' : 'var(--nw-success)',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {delta > 0 ? '▲' : '▼'} ${Math.abs(delta).toLocaleString()}/yr &nbsp;
            <span style={{ fontWeight: 400 }}>
              ({delta > 0 ? '+' : ''}${(delta / 12).toFixed(2)}/mo)
            </span>
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--nw-text-muted)', lineHeight: 1.5, marginBottom: 4 }}>
          Changes take effect on your next billing cycle. Save to confirm.
        </p>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PolicyDetailPage() {
  const { id } = useParams();
  const [policy, setPolicy]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [stagedCoverages, setStagedCoverages] = useState(null); // local edits
  const [saving, setSaving]         = useState(false);
  const [message, setMessage]       = useState(null);

  useEffect(() => {
    api.get(`/policies/${id}`)
      .then((r) => {
        setPolicy(r.data);
        setStagedCoverages(clone(r.data.coverages));
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Detect whether user has made any changes vs saved state
  const hasChanges = policy && stagedCoverages &&
    JSON.stringify(stagedCoverages) !== JSON.stringify(policy.coverages);

  // Live premium preview from staged coverages
  const savedPremium   = policy?.annualPremium ?? 0;
  const previewPremium = stagedCoverages ? calculatePremium(policy?.type, stagedCoverages) : savedPremium;

  // Called by CoverageRow on any toggle or deductible change
  const handleChange = useCallback((key, field, value) => {
    setStagedCoverages((prev) => {
      const next = clone(prev);
      next[policy.type][key][field] = value;
      return next;
    });
    setMessage(null);
  }, [policy]);

  function handleDiscard() {
    setStagedCoverages(clone(policy.coverages));
    setMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      // Send only the typed coverage section — server merges it
      const { data } = await api.patch(`/policies/${id}/coverage`, {
        coverages: stagedCoverages[policy.type],
      });
      // Update local policy to match confirmed server state
      setPolicy(data.policy);
      setStagedCoverages(clone(data.policy.coverages));
      setMessage({
        type: 'success',
        text: `Coverage saved. Premium updated: $${data.oldPremium.toLocaleString()} → $${data.newPremium.toLocaleString()}/yr ($${data.newMonthly.toFixed(2)}/mo). Billing updated.`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Save failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="spinner" />;
  if (!policy)  return <div className="alert alert-error">Policy not found.</div>;

  const isAuto       = policy.type === 'auto';
  const coverageMeta = isAuto ? AUTO_COVERAGES : HOME_COVERAGES;
  const headerLabel  = isAuto
    ? `${policy.vehicle?.year} ${policy.vehicle?.make} ${policy.vehicle?.model}`
    : policy.property?.address;
  const section = stagedCoverages?.[policy.type];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <Link to="/policies" className="btn btn-ghost btn-sm mb-4" style={{ display: 'inline-flex' }}>
          <ChevronLeft size={14} /> Back to Policies
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="page-title">{headerLabel}</h1>
          <span className="badge badge-active">Active</span>
        </div>
        <p className="page-sub">{policy.policyNumber} · {isAuto ? 'Automobile' : 'Home'} Insurance</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

        {/* Left: policy info + coverage editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Policy details card */}
          <div className="card">
            <div className="card-header"><span className="card-title">Policy Details</span></div>
            <div className="card-body">
              {isAuto ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: 14 }}>
                  <div><div className="text-xs text-muted">Year</div><div className="font-semibold">{policy.vehicle?.year}</div></div>
                  <div><div className="text-xs text-muted">Make / Model</div><div className="font-semibold">{policy.vehicle?.make} {policy.vehicle?.model}</div></div>
                  <div><div className="text-xs text-muted">Plate</div><div className="font-semibold">{policy.vehicle?.plate}</div></div>
                  <div><div className="text-xs text-muted">VIN</div><div className="font-semibold" style={{ fontSize: 12 }}>{policy.vehicle?.vin}</div></div>
                  <div><div className="text-xs text-muted">Effective</div><div className="font-semibold">{format(new Date(policy.effectiveDate), 'MMM d, yyyy')}</div></div>
                  <div><div className="text-xs text-muted">Expiry</div><div className="font-semibold">{format(new Date(policy.expiryDate), 'MMM d, yyyy')}</div></div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: 14 }}>
                  <div><div className="text-xs text-muted">Address</div><div className="font-semibold">{policy.property?.address}</div></div>
                  <div><div className="text-xs text-muted">City</div><div className="font-semibold">{policy.property?.city}</div></div>
                  <div><div className="text-xs text-muted">Type</div><div className="font-semibold" style={{ textTransform: 'capitalize' }}>{policy.property?.propertyType}</div></div>
                  <div><div className="text-xs text-muted">Year Built</div><div className="font-semibold">{policy.property?.yearBuilt}</div></div>
                  <div><div className="text-xs text-muted">Effective</div><div className="font-semibold">{format(new Date(policy.effectiveDate), 'MMM d, yyyy')}</div></div>
                  <div><div className="text-xs text-muted">Expiry</div><div className="font-semibold">{format(new Date(policy.expiryDate), 'MMM d, yyyy')}</div></div>
                </div>
              )}
            </div>
          </div>

          {/* Coverage editor card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Coverage Options</span>
              {hasChanges && (
                <button className="btn btn-ghost btn-sm" onClick={handleDiscard} disabled={saving}>
                  <RotateCcw size={13} /> Discard
                </button>
              )}
            </div>
            <div className="card-body">
              {coverageMeta.map((meta) => (
                <CoverageRow
                  key={meta.key}
                  meta={meta}
                  value={section?.[meta.key] ?? {}}
                  onChange={handleChange}
                  disabled={saving}
                />
              ))}

              {/* Save button — sticky at bottom of coverage card */}
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--nw-slate-dark)' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                >
                  <Save size={16} />
                  {saving ? 'Saving…' : hasChanges ? 'Save Coverage Changes' : 'No Changes to Save'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: sticky price panel */}
        <PricePanel
          policyType={policy.type}
          savedPremium={savedPremium}
          previewPremium={previewPremium}
          coverages={stagedCoverages}
          hasChanges={hasChanges}
        />
      </div>
    </div>
  );
}
