import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Car, Home } from 'lucide-react';
import { format } from 'date-fns';
import api from '../services/api';

function PolicyCard({ policy }) {
  const isAuto = policy.type === 'auto';
  const Icon = isAuto ? Car : Home;
  const label = isAuto
    ? `${policy.vehicle?.year} ${policy.vehicle?.make} ${policy.vehicle?.model}`
    : policy.property?.address;
  const sublabel = isAuto ? policy.vehicle?.plate : `${policy.property?.city}, ON`;

  return (
    <Link to={`/policies/${policy._id}`} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
        onMouseEnter={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
        onMouseLeave={(e) => e.currentTarget.style.boxShadow = ''}
      >
        <div className="card-body">
          <div className="flex items-center gap-4 mb-4">
            <div style={{
              width: 48, height: 48, borderRadius: 10,
              background: isAuto ? '#e8f0fe' : '#fef3e2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={22} color={isAuto ? '#1a3a5c' : '#c8720a'} />
            </div>
            <div>
              <div className="font-bold" style={{ fontSize: 16 }}>{label}</div>
              <div className="text-xs text-muted">{sublabel}</div>
            </div>
            <span className="badge badge-active" style={{ marginLeft: 'auto' }}>Active</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: 13 }}>
            <div>
              <div className="text-xs text-muted">Policy Number</div>
              <div className="font-semibold">{policy.policyNumber}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Type</div>
              <div className="font-semibold">{isAuto ? 'Automobile' : 'Home'}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Expiry Date</div>
              <div className="font-semibold">{format(new Date(policy.expiryDate), 'MMM d, yyyy')}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Monthly Premium</div>
              <div className="font-semibold" style={{ color: 'var(--nw-navy)' }}>
                ${(policy.annualPremium / 12).toFixed(2)}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--nw-slate)', display: 'flex', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 13, color: 'var(--nw-navy-light)', fontWeight: 500 }}>View & Edit Coverage →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    api.get('/policies').then((r) => setPolicies(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  const auto = policies.filter((p) => p.type === 'auto');
  const home = policies.filter((p) => p.type === 'home');

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">My Policies</h1>
          <p className="page-sub">{policies.length} active {policies.length === 1 ? 'policy' : 'policies'} on file</p>
        </div>
      </div>

      {auto.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Car size={18} color="var(--nw-navy)" />
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Automobile Insurance</h2>
          </div>
          <div className="grid-2">
            {auto.map((p) => <PolicyCard key={p._id} policy={p} />)}
          </div>
        </section>
      )}

      {home.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Home size={18} color="var(--nw-navy)" />
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Home Insurance</h2>
          </div>
          <div className="grid-2">
            {home.map((p) => <PolicyCard key={p._id} policy={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
