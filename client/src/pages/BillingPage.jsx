import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CreditCard, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '../services/api';

function paymentStatusIcon(status) {
  if (status === 'paid')    return <CheckCircle size={14} color="var(--nw-success)" />;
  if (status === 'failed')  return <XCircle size={14} color="var(--nw-danger)" />;
  return <Clock size={14} color="var(--nw-warning)" />;
}

export default function BillingPage() {
  const [billing, setBilling] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/billing').then((r) => setBilling(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  const totalNextPayment = billing.reduce((s, b) => s + b.nextDueAmount, 0);
  const nextDueDate = billing.sort((a, b) => new Date(a.nextDueDate) - new Date(b.nextDueDate))[0]?.nextDueDate;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Billing</h1>
        <p className="page-sub">Payment history and upcoming amounts for all your policies</p>
      </div>

      {/* Summary row */}
      <div className="stat-grid mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Next Payment</div>
          <div className="stat-value" style={{ fontSize: 24 }}>${totalNextPayment.toFixed(2)}</div>
          <div className="stat-sub">{nextDueDate ? `Due ${format(new Date(nextDueDate), 'MMM d, yyyy')}` : '—'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Policies Billed</div>
          <div className="stat-value">{billing.length}</div>
          <div className="stat-sub">All active</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Annual Total</div>
          <div className="stat-value" style={{ fontSize: 24 }}>${billing.reduce((s, b) => s + b.annualTotal, 0).toLocaleString()}</div>
          <div className="stat-sub">Combined premiums</div>
        </div>
      </div>

      {billing.map((b) => {
        const policy = b.policyId;
        const policyLabel = policy?.type === 'auto'
          ? `${policy?.vehicle?.year} ${policy?.vehicle?.make} ${policy?.vehicle?.model}`
          : policy?.property?.address;

        return (
          <div key={b._id} className="card mb-6">
            <div className="card-header">
              <div>
                <span className="card-title">{policyLabel || policy?.policyNumber}</span>
                <span className="text-xs text-muted" style={{ marginLeft: 8 }}>{policy?.policyNumber} · {policy?.type?.toUpperCase()}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="font-bold" style={{ fontSize: 18, color: 'var(--nw-navy)' }}>${b.nextDueAmount.toFixed(2)}</div>
                <div className="text-xs text-muted">due {format(new Date(b.nextDueDate), 'MMM d, yyyy')}</div>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: 20, fontSize: 13 }}>
                <div><div className="text-xs text-muted">Frequency</div><div className="font-semibold" style={{ textTransform: 'capitalize' }}>{b.paymentFrequency}</div></div>
                <div><div className="text-xs text-muted">Method</div><div className="font-semibold" style={{ textTransform: 'capitalize' }}>{b.paymentMethod.replace('_', ' ')}</div></div>
                <div><div className="text-xs text-muted">Annual Total</div><div className="font-semibold">${b.annualTotal.toLocaleString()}</div></div>
                <div><div className="text-xs text-muted">Paid YTD</div><div className="font-semibold">${b.paidYTD.toFixed(2)}</div></div>
              </div>

              <div>
                <div className="text-xs text-muted mb-4" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment History</div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.paymentHistory.slice().reverse().map((p, i) => (
                      <tr key={i}>
                        <td>{format(new Date(p.date), 'MMM d, yyyy')}</td>
                        <td className="font-semibold">${p.amount.toFixed(2)}</td>
                        <td className="text-muted" style={{ textTransform: 'capitalize' }}>{p.method.replace('_', ' ')}</td>
                        <td className="text-xs text-muted">{p.reference}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            {paymentStatusIcon(p.status)}
                            <span className="text-sm" style={{ textTransform: 'capitalize' }}>{p.status}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
