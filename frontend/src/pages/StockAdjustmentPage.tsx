import React, { useEffect, useState } from 'react';
import {
  Sliders,
  CheckCircle,
  AlertCircle,
  Search,
  History,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import api from '../services/api';
import { Material, User } from '../types';

export const StockAdjustmentPage: React.FC<{ user: User | null }> = ({ user }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('PhysicalCountSurplus');
  const [physicalStock, setPhysicalStock] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await api.get('/stock/summary');
        setMaterials(res.data);
      } catch (err) {
        console.error('Error fetching materials', err);
      }
    };
    fetchMaterials();
  }, []);

  const selectedMat = materials.find((m) => m.id === parseInt(selectedMaterialId));
  const systemStock = selectedMat?.currentStock ?? 0;
  const difference = physicalStock !== '' ? Number(physicalStock) - systemStock : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedMaterialId || physicalStock === '' || isNaN(Number(physicalStock)) || !reason.trim()) {
      setErrorMsg('Please select a material, enter a valid physical count, and provide an adjustment reason.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        materialId: parseInt(selectedMaterialId),
        adjustmentDate: new Date().toISOString(),
        adjustmentType,
        physicalStock: Number(physicalStock),
        reason: reason.trim()
      };

      const res = await api.post('/stock/adjustments', payload);
      setSuccessMsg(res.data.message || 'Stock adjustment applied successfully.');
      // Refresh materials
      const matRes = await api.get('/stock/summary');
      setMaterials(matRes.data);
      setSelectedMaterialId('');
      setPhysicalStock('');
      setReason('');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to apply stock adjustment.');
    } finally {
      setLoading(false);
    }
  };

  const isAuthorized = user?.role === 'Admin' || user?.role === 'StoreManager';

  return (
    <div className="page-wrapper">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Authorized Stock Correction & Audit</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Physical inventory audit reconciliation — Every adjustment creates a permanent ledger audit trail
        </p>
      </div>

      {!isAuthorized ? (
        <div className="card" style={{ borderLeft: '4px solid #ef4444', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#dc2626' }}>
            <ShieldAlert size={28} />
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Access Restricted</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Only Administrators and Store Managers have authorization to perform stock count adjustments.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          {/* Adjustment Form */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Sliders size={18} /> Apply Stock Reconciliation
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {errorMsg && (
                <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                  <AlertCircle size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div style={{ padding: '10px 14px', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
                  <CheckCircle size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
                  {successMsg}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Select Material *</label>
                <select
                  className="form-control"
                  required
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                >
                  <option value="">Choose material from inventory...</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.materialCode} — {m.materialName} (System Stock: {m.currentStock} {m.defaultUom})
                    </option>
                  ))}
                </select>
              </div>

              {selectedMat && (
                <div style={{ padding: '14px', background: 'var(--bg-primary)', borderRadius: '8px', marginBottom: '16px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Current System Stock</span>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
                      {systemStock} {selectedMat.defaultUom}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Physical Count</span>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                      {physicalStock !== '' ? `${physicalStock} ${selectedMat.defaultUom}` : '-'}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Ledger Variance</span>
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: difference > 0 ? '#059669' : (difference < 0 ? '#dc2626' : 'inherit') }}>
                      {difference > 0 ? `+${difference}` : difference} {selectedMat.defaultUom}
                    </div>
                  </div>
                </div>
              )}

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Adjustment Type *</label>
                  <select
                    className="form-control"
                    value={adjustmentType}
                    onChange={(e) => setAdjustmentType(e.target.value)}
                  >
                    <option value="PhysicalCountSurplus">Physical Count Surplus (+)</option>
                    <option value="PhysicalCountDeficit">Physical Count Deficit (-)</option>
                    <option value="Damaged">Damaged / Scrap Write-off</option>
                    <option value="Reclassification">Reclassification / Grade Conversion</option>
                    <option value="ManualCorrection">Manual Historical Correction</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Actual Physical Count Verified *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    className="form-control"
                    placeholder="Enter physical count"
                    value={physicalStock}
                    onChange={(e) => setPhysicalStock(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reason & Audit Remarks *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  required
                  placeholder="Explain why the adjustment is needed (e.g. Month-end physical verification by Stores In-Charge)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                <CheckCircle size={16} /> {loading ? 'Applying Correction...' : 'Commit Stock Correction to Ledger'}
              </button>
            </form>
          </div>

          {/* Audit Verification Guidelines */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <ShieldAlert size={18} /> Store Audit Guidelines
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p>
                <strong>Immutable Audit Trail:</strong> Direct database edits on stock balances are strictly prohibited. Every stock correction writes a debit or credit entry to the <code>StockLedger</code>.
              </p>
              <p>
                <strong>Year-End / Monthly Physical Verification:</strong>
                <br />For Foundry Ingot balances, always reconcile against physical weights including:
              </p>
              <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>Primary Virgin Ingot Bins</li>
                <li>Burr Ingot & Runners</li>
                <li>Foundry Dross & Spills</li>
                <li>Shop-floor Fettling Returns</li>
              </ul>
              <p>
                All corrections require justification and are signed by the authorized user with IP timestamp recording.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
