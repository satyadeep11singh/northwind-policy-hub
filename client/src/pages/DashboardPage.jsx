import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, FileText, CreditCard, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import api from '../services/api';

export default function DashboardPage() {
  const [policies, setPolicies]  = useState([]);
  const [claims, setClaims]      = useState([]);
  const [billing, setBilling]    = useState([]);
  const [loading, setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/policies'),
      api.get('/claims'),
      api.get('/billing'),
    ]).then(([p, c, b]) => {
      setPolicies(p.data);
      setClaims(c.data);
      setBilling(b.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  const activeClaims  = claims.filter((c) => ['submitted', 'under_review'].includes(c.status));
  const nextPayment   = billing.sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate))[0];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Dashboard</h1>
        <p className="page-sub">Overview of your NorthWind Insurance policies and activity</p>
      </div>

      {/* Stat row */}
      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Active Policies</div>
          <div className="stat-value">{policies.length}</div>
          <div className="stat-sub">{policies.filter(p => p.type === 'auto').length} auto · {policies.filter(p => p.type === 'home').length} home</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Open Claims</div>
          <div className="stat-value" style={{ color: activeClaims.length > 0 ? 'var(--nw-warning)' : 'var(--nw-navy)' }}>
            {activeClaims.length}
          </div>
          <div className="stat-sub">{claims.length} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Next Payment Due</div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            {nextPayment ? `$${nextPayment.nextDueAmount.toFixed(2)}` : '—'}
          </div>
          <div className="stat-sub">
            {nextPayment ? format(new Date(nextPayment.nextDueDate), 'MMM d, yyyy') : 'No upcoming payments'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Annual Total</div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            ${policies.reduce((s, p) => s + p.annualPremium, 0).toLocaleString()}
          </div>
          <div className="stat-sub">All policies combined</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Policies summary */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">My Policies</span>
            <Link to="/policies" className="btn btn-ghost btn-sm">View All</Link>
          </div>
          <div className="card-body">
            {policies.length === 0 ? (
              <p className="text-muted text-sm">No policies found.</p>
            ) : (
              policies.map((p) => (
                <Link key={p._id} to={`/policies/${p._id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--nw-slate)', cursor: 'pointer' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: p.type === 'auto' ? '#e8f0fe' : '#fef3e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ShieldCheck size={18} color={p.type === 'auto' ? '#1a3a5c' : '#c8720a'} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold" style={{ fontSize: 14 }}>
                        {p.type === 'auto'
                          ? `${p.vehicle?.year} ${p.vehicle?.make} ${p.vehicle?.model}`
                          : p.property?.address}
                      </div>
                      <div className="text-xs text-muted">{p.policyNumber} · {p.type.toUpperCase()}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--nw-navy)' }}>
                      ${(p.annualPremium / 12).toFixed(2)}/mo
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent claims */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Claims</span>
            <Link to="/claims" className="btn btn-ghost btn-sm">View All</Link>
          </div>
          <div className="card-body">
            {claims.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <FileText size={32} color="var(--nw-slate-dark)" style={{ margin: '0 auto 8px' }} />
                <p className="text-sm text-muted">No claims on file. Drive safe!</p>
              </div>
            ) : (
              claims.slice(0, 4).map((c) => (
                <Link key={c._id} to={`/claims/${c._id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--nw-slate)' }}>
                    <AlertTriangle size={16} color={c.status === 'settled' ? 'var(--nw-success)' : 'var(--nw-warning)'} style={{ marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div className="font-semibold text-sm">{c.claimNumber}</div>
                      <div className="text-xs text-muted">{c.incidentType.replace(/_/g, ' ')} · {format(new Date(c.filedDate), 'MMM d, yyyy')}</div>
                    </div>
                    <span className={`badge badge-${c.status.replace('_', '-')}`}>{c.status.replace('_', ' ')}</span>
                  </div>
                </Link>
              ))
            )}
            <div style={{ marginTop: 16 }}>
              <Link to="/claims" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                <FileText size={14} /> Open a Claim
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
