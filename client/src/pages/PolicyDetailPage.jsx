import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, CheckCircle, XCircle } from 'lucide-react';
import api from '../services/api';

// Coverage metadata — labels and descriptions for each coverage key
const AUTO_COVERAGES = [
  { key: 'thirdPartyLiability',  label: 'Third-Party Liability',       desc: 'Covers injuries or damage you cause to others. Mandatory in Ontario.', toggleField: null, deductibleField: null },
  { key: 'accidentBenefits',     label: 'Accident Benefits (SABS)',    desc: 'Medical, rehabilitation, and income replacement. Mandatory.', toggleField: null, deductibleField: null },
  { key: 'dcpd',                 label: 'Direct Compensation (DCPD)',  desc: 'Covers damage to your vehicle caused by another insured driver. Mandatory.', toggleField: null, deductibleField: null },
  { key: 'uninsuredAutomobile',  label: 'Uninsured Automobile',        desc: 'Protection if the at-fault driver is uninsured. Mandatory.', toggleField: null, deductibleField: null },
  { key: 'collision',            label: 'Collision',                   desc: 'Covers repair or replacement of your vehicle after a collision.', toggleField: 'included', deductibleField: 'deductible', deductibleOptions: [500, 1000, 2500] },
  { key: 'comprehensive',        label: 'Comprehensive',               desc: 'Covers theft, weather, fire, glass damage, and other non-collision losses.', toggleField: 'included', deductibleField: 'deductible', deductibleOptions: [300, 500, 1000] },
  { key: 'rentalReimbursement',  label: 'Rental Reimbursement (OPCF 20)', desc: 'Pays for a rental vehicle while your car is being repaired.', toggleField: 'included', deductibleField: null },
  { key: 'waiverOfDepreciation', label: 'Waiver of Depreciation (OPCF 43)', desc: 'Pays replacement cost on new vehicles without depreciation deduction.', toggleField: 'included', deductibleField: null },
  { key: 'roadsideAssistance',   label: 'Roadside Assistance',         desc: 'Towing, battery boost, flat tire, and lockout service.', toggleField: 'included', deductibleField: null },
];

const HOME_COVERAGES = [
  { key: 'dwelling',                 label: 'Dwelling',                    desc: 'Replacement cost coverage for your home structure. Included.', toggleField: null, deductibleField: null },
  { key: 'detachedStructures',       label: 'Detached Structures',         desc: 'Garage, shed, and fence coverage (10% of dwelling). Included.', toggleField: null, deductibleField: null },
  { key: 'personalProperty',         label: 'Personal Property / Contents', desc: 'Covers furniture, electronics, clothing, and personal items.', toggleField: null, deductibleField: null },
  { key: 'additionalLivingExpenses', label: 'Additional Living Expenses',  desc: 'Covers hotel and meals if your home is uninhabitable. Included.', toggleField: null, deductibleField: null },
  { key: 'personalLiability',        label: 'Personal Liability',          desc: 'Covers legal costs if someone is injured on your property. Included.', toggleField: null, deductibleField: null },
  { key: 'sewerBackup',              label: 'Sewer Backup',                desc: 'Covers damage from sewer or drain backup. Highly recommended in Ontario.', toggleField: 'included', deductibleField: null },
  { key: 'overlandWater',            label: 'Overland Water (Flooding)',    desc: 'Covers damage from overland flooding — separate from sewer backup.', toggleField: 'included', deductibleField: null },
  { key: 'homeBusiness',             label: 'Home-Based Business',         desc: 'Covers business equipment and liability for work-from-home operations.', toggleField: 'included', deductibleField: null },
  { key: 'jewelleryFloater',         label: 'Jewellery / High-Value Items', desc: 'Extended coverage for jewellery, watches, and collectibles beyond standard limits.', toggleField: 'included', deductibleField: null },
  { key: 'identityTheft',            label: 'Identity Theft Protection',   desc: 'Covers costs to restore your identity if compromised.', toggleField: 'included', deductibleField: null },
];

function CoverageRow({ coverageKey, meta, coverageData, onToggle, onDeductibleChange, saving }) {
  const val     = coverageData?.[coverageKey];
  const included = val?.included ?? false;
  const isMandatory = !meta.toggleField;

  return (
    <div className="coverage-row">
      <div style={{ flex: 1 }}>
        <div className="coverage-name">
          {meta.label}
          {isMandatory && (
            <span style={{ marginLeft: 8, fontSize: 11, background: '#e8f0fe', color: '#1a3a5c', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
              MANDATORY
            </span>
          )}
        </div>
        <div className="coverage-desc">{meta.desc}</div>
        {meta.deductibleField && included && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--nw-text-muted)' }}>Deductible:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '4px 8px', fontSize: 13 }}
              value={val?.[meta.deductibleField] ?? meta.deductibleOptions[1]}
              onChange={(e) => onDeductibleChange(coverageKey, meta.deductibleField, Number(e.target.value))}
              disabled={saving}
            >
              {meta.deductibleOptions.map((opt) => (
                <option key={opt} value={opt}>${opt.toLocaleString()}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {isMandatory ? (
        <CheckCircle size={20} color="var(--nw-success)" />
      ) : (
        <label className="toggle">
          <input
            type="checkbox"
            checked={included}
            onChange={(e) => onToggle(coverageKey, e.target.checked)}
            disabled={saving}
          />
          <span className="toggle-slider" />
        </label>
      )}
    </div>
  );
}

export default function PolicyDetailPage() {
  const { id } = useParams();
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.get(`/policies/${id}`).then((r) => setPolicy(r.data)).finally(() => setLoading(false));
  }, [id]);

  async function patchCoverage(coverageKey, field, value) {
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await api.patch(`/policies/${id}/coverage`, { coverageKey, field, value });
      setPolicy(data.policy);
      setMessage({ type: 'success', text: 'Coverage updated successfully.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Update failed.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="spinner" />;
  if (!policy)  return <div className="alert alert-error">Policy not found.</div>;

  const isAuto      = policy.type === 'auto';
  const coverageMeta = isAuto ? AUTO_COVERAGES : HOME_COVERAGES;
  const coverageData = policy.coverages?.[policy.type];
  const headerLabel  = isAuto
    ? `${policy.vehicle?.year} ${policy.vehicle?.make} ${policy.vehicle?.model}`
    : policy.property?.address;

  return (
    <div>
      <div className="page-header">
        <Link to="/policies" className="btn btn-ghost btn-sm mb-4" style={{ display: 'inline-flex' }}>
          <ChevronLeft size={14} /> Back to Policies
        </Link>
        <h1 className="page-title">{headerLabel}</h1>
        <p className="page-sub">{policy.policyNumber} · {isAuto ? 'Automobile' : 'Home'} Insurance</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="grid-2">
        {/* Policy info */}
        <div className="card">
          <div className="card-header"><span className="card-title">Policy Details</span></div>
          <div className="card-body">
            {isAuto && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: 14 }}>
                <div><div className="text-xs text-muted">Year</div><div className="font-semibold">{policy.vehicle?.year}</div></div>
                <div><div className="text-xs text-muted">Make / Model</div><div className="font-semibold">{policy.vehicle?.make} {policy.vehicle?.model}</div></div>
                <div><div className="text-xs text-muted">Plate</div><div className="font-semibold">{policy.vehicle?.plate}</div></div>
                <div><div className="text-xs text-muted">VIN</div><div className="font-semibold" style={{ fontSize: 12 }}>{policy.vehicle?.vin}</div></div>
              </div>
            )}
            {!isAuto && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: 14 }}>
                <div><div className="text-xs text-muted">Address</div><div className="font-semibold">{policy.property?.address}</div></div>
                <div><div className="text-xs text-muted">City</div><div className="font-semibold">{policy.property?.city}</div></div>
                <div><div className="text-xs text-muted">Type</div><div className="font-semibold" style={{ textTransform: 'capitalize' }}>{policy.property?.propertyType}</div></div>
                <div><div className="text-xs text-muted">Year Built</div><div className="font-semibold">{policy.property?.yearBuilt}</div></div>
              </div>
            )}
            <hr className="divider" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: 14 }}>
              <div><div className="text-xs text-muted">Annual Premium</div><div className="font-semibold">${policy.annualPremium.toLocaleString()}</div></div>
              <div><div className="text-xs text-muted">Monthly</div><div className="font-semibold">${(policy.annualPremium / 12).toFixed(2)}</div></div>
            </div>
          </div>
        </div>

        {/* Coverage editor */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Coverage Options</span>
            {saving && <span className="text-xs text-muted">Saving…</span>}
          </div>
          <div className="card-body">
            {coverageMeta.map((meta) => (
              <CoverageRow
                key={meta.key}
                coverageKey={meta.key}
                meta={meta}
                coverageData={coverageData}
                onToggle={(key, val) => patchCoverage(key, 'included', val)}
                onDeductibleChange={(key, field, val) => patchCoverage(key, field, val)}
                saving={saving}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
