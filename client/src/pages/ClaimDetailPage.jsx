import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronLeft, MessageSquare } from 'lucide-react';
import api from '../services/api';

function statusBadge(status) {
  const map = { submitted: 'badge-submitted', under_review: 'badge-under-review', approved: 'badge-settled', settled: 'badge-settled', denied: 'badge-denied', closed: 'badge-closed' };
  return <span className={`badge ${map[status] || 'badge-closed'}`}>{status.replace('_', ' ')}</span>;
}

const STATUS_STEPS = ['submitted', 'under_review', 'approved', 'settled'];

export default function ClaimDetailPage() {
  const { id } = useParams();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/claims/${id}`).then((r) => setClaim(r.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="spinner" />;
  if (!claim)  return <div className="alert alert-error">Claim not found.</div>;

  const stepIndex = STATUS_STEPS.indexOf(claim.status);

  return (
    <div>
      <div className="page-header">
        <Link to="/claims" className="btn btn-ghost btn-sm mb-4" style={{ display: 'inline-flex' }}>
          <ChevronLeft size={14} /> Back to Claims
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="page-title">{claim.claimNumber}</h1>
          {statusBadge(claim.status)}
        </div>
        <p className="page-sub">
          Filed {format(new Date(claim.filedDate), 'MMMM d, yyyy')}
          {claim.adjusterName && <> · Adjuster: <strong>{claim.adjusterName}</strong></>}
        </p>
      </div>

      {/* Progress tracker */}
      {!['denied', 'closed'].includes(claim.status) && (
        <div className="card mb-6">
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {STATUS_STEPS.map((step, i) => (
                <React.Fragment key={step}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: i <= stepIndex ? 'var(--nw-navy)' : 'var(--nw-slate-dark)',
                      color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700,
                    }}>{i + 1}</div>
                    <div style={{ fontSize: 11, marginTop: 6, color: i <= stepIndex ? 'var(--nw-navy)' : 'var(--nw-text-muted)', textTransform: 'capitalize', textAlign: 'center' }}>
                      {step.replace('_', ' ')}
                    </div>
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 2, background: i < stepIndex ? 'var(--nw-navy)' : 'var(--nw-slate-dark)', marginBottom: 20 }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Claim details */}
        <div className="card">
          <div className="card-header"><span className="card-title">Claim Details</span></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', fontSize: 14 }}>
              <div><div className="text-xs text-muted">Policy Number</div><div className="font-semibold">{claim.policyId?.policyNumber}</div></div>
              <div><div className="text-xs text-muted">Policy Type</div><div className="font-semibold" style={{ textTransform: 'capitalize' }}>{claim.policyType}</div></div>
              <div><div className="text-xs text-muted">Incident Type</div><div className="font-semibold" style={{ textTransform: 'capitalize' }}>{claim.incidentType.replace(/_/g, ' ')}</div></div>
              <div><div className="text-xs text-muted">Incident Date</div><div className="font-semibold">{format(new Date(claim.incidentDate), 'MMMM d, yyyy')}</div></div>
              {claim.estimatedLoss && (
                <div><div className="text-xs text-muted">Estimated Loss</div><div className="font-semibold">${claim.estimatedLoss.toLocaleString()}</div></div>
              )}
              {claim.settledAmount && (
                <div><div className="text-xs text-muted">Settled Amount</div><div className="font-semibold" style={{ color: 'var(--nw-success)' }}>${claim.settledAmount.toLocaleString()}</div></div>
              )}
              {claim.settledDate && (
                <div><div className="text-xs text-muted">Settled Date</div><div className="font-semibold">{format(new Date(claim.settledDate), 'MMMM d, yyyy')}</div></div>
              )}
            </div>
            <hr className="divider" />
            <div>
              <div className="text-xs text-muted mb-4">Description</div>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>{claim.description}</p>
            </div>
          </div>
        </div>

        {/* Adjuster notes */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Adjuster Notes</span>
            <MessageSquare size={16} color="var(--nw-text-muted)" />
          </div>
          <div className="card-body">
            {claim.notes?.length === 0 ? (
              <p className="text-sm text-muted">No notes yet. Your adjuster will post updates here.</p>
            ) : (
              claim.notes.map((note, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--nw-slate)' }}>
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold text-sm">{note.author}</span>
                    <span className="text-xs text-muted">{format(new Date(note.date), 'MMM d, yyyy')}</span>
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.5 }}>{note.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
