import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { PlusCircle, FileText } from 'lucide-react';
import api from '../services/api';

const INCIDENT_TYPES_AUTO = ['collision', 'comprehensive', 'theft', 'vandalism', 'glass'];
const INCIDENT_TYPES_HOME = ['water_damage', 'fire', 'theft_home', 'liability', 'weather', 'sewer_backup', 'other'];

function statusBadge(status) {
  const map = {
    submitted:    'badge-submitted',
    under_review: 'badge-under-review',
    approved:     'badge-settled',
    settled:      'badge-settled',
    denied:       'badge-denied',
    closed:       'badge-closed',
  };
  return <span className={`badge ${map[status] || 'badge-closed'}`}>{status.replace('_', ' ')}</span>;
}

export default function ClaimsPage() {
  const [claims, setClaims]     = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ policyId: '', incidentType: '', incidentDate: '', description: '', estimatedLoss: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    Promise.all([api.get('/claims'), api.get('/policies')])
      .then(([c, p]) => { setClaims(c.data); setPolicies(p.data); })
      .finally(() => setLoading(false));
  }, []);

  const selectedPolicy = policies.find((p) => p._id === form.policyId);
  const incidentTypes  = selectedPolicy?.type === 'home' ? INCIDENT_TYPES_HOME : INCIDENT_TYPES_AUTO;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/claims', {
        ...form,
        estimatedLoss: form.estimatedLoss ? Number(form.estimatedLoss) : undefined,
      });
      setClaims([data, ...claims]);
      setShowForm(false);
      setForm({ policyId: '', incidentType: '', incidentDate: '', description: '', estimatedLoss: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit claim.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Claims</h1>
          <p className="page-sub">{claims.length} {claims.length === 1 ? 'claim' : 'claims'} on file</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <PlusCircle size={16} /> Open a Claim
        </button>
      </div>

      {/* New claim form */}
      {showForm && (
        <div className="card mb-6">
          <div className="card-header"><span className="card-title">New Claim</span></div>
          <div className="card-body">
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Policy</label>
                <select className="form-select" value={form.policyId} onChange={(e) => setForm({ ...form, policyId: e.target.value, incidentType: '' })} required>
                  <option value="">Select a policy…</option>
                  {policies.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.type === 'auto'
                        ? `${p.vehicle?.year} ${p.vehicle?.make} ${p.vehicle?.model} (${p.policyNumber})`
                        : `${p.property?.address} (${p.policyNumber})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Incident Type</label>
                <select className="form-select" value={form.incidentType} onChange={(e) => setForm({ ...form, incidentType: e.target.value })} required disabled={!form.policyId}>
                  <option value="">Select type…</option>
                  {incidentTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Incident Date</label>
                <input className="form-input" type="date" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} max={new Date().toISOString().split('T')[0]} required />
              </div>

              <div className="form-group">
                <label className="form-label">Estimated Loss ($)</label>
                <input className="form-input" type="number" placeholder="Optional" min="0" value={form.estimatedLoss} onChange={(e) => setForm({ ...form, estimatedLoss: e.target.value })} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Description</label>
                <textarea className="form-textarea" placeholder="Describe what happened…" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required maxLength={2000} />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12 }}>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Claim'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Claims list */}
      {claims.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <FileText size={40} color="var(--nw-slate-dark)" style={{ margin: '0 auto 12px' }} />
            <p className="font-semibold">No claims on file</p>
            <p className="text-sm text-muted mt-4">Drive safe and stay claim-free!</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Claim #</th>
                <th>Policy</th>
                <th>Type</th>
                <th>Incident Date</th>
                <th>Filed</th>
                <th>Estimate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c) => (
                <tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/claims/${c._id}`}>
                  <td><Link to={`/claims/${c._id}`} style={{ fontWeight: 600 }}>{c.claimNumber}</Link></td>
                  <td className="text-sm text-muted">{c.policyId?.policyNumber || '—'}</td>
                  <td className="text-sm" style={{ textTransform: 'capitalize' }}>{c.incidentType.replace(/_/g, ' ')}</td>
                  <td className="text-sm">{format(new Date(c.incidentDate), 'MMM d, yyyy')}</td>
                  <td className="text-sm">{format(new Date(c.filedDate), 'MMM d, yyyy')}</td>
                  <td className="text-sm">{c.estimatedLoss ? `$${c.estimatedLoss.toLocaleString()}` : '—'}</td>
                  <td>{statusBadge(c.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
