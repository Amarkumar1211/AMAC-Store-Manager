import React, { useEffect, useState } from 'react';
import {
  Flame,
  Palette,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  XCircle,
  ArrowDownToLine,
  ArrowUpFromLine
} from 'lucide-react';
import { CoreCylinderIcon } from '../components/CoreCylinderIcon';
import api from '../services/api';
import {
  CoreMaster,
  CoreDailyTracking,
  CoreRejection,
  CylinderMaster,
  MaterialColourCode,
  User,
  Supplier
} from '../types';
import { Modal } from '../components/ModalAndPrintables';

export const ManufacturingPage: React.FC<{ user: User | null }> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'cores' | 'plan-actual' | 'rejections' | 'cylinders' | 'colours'>('cores');
  const [cores, setCores] = useState<CoreMaster[]>([]);
  const [trackings, setTrackings] = useState<CoreDailyTracking[]>([]);
  const [rejections, setRejections] = useState<CoreRejection[]>([]);
  const [cylinders, setCylinders] = useState<CylinderMaster[]>([]);
  const [colourCodes, setColourCodes] = useState<MaterialColourCode[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddCoreOpen, setIsAddCoreOpen] = useState(false);
  const [coreCode, setCoreCode] = useState('');
  const [coreName, setCoreName] = useState('');
  const [corePrice, setCorePrice] = useState<number | ''>('');
  const [coreWeight, setCoreWeight] = useState<number | ''>('');

  const [isAddCylinderOpen, setIsAddCylinderOpen] = useState(false);
  const [cylName, setCylName] = useState('');
  const [cylGasType, setCylGasType] = useState('LPG');
  const [cylCapacity, setCylCapacity] = useState('17KG');
  const [cylInitialStock, setCylInitialStock] = useState<number | ''>(10);

  const [isAddRejectionOpen, setIsAddRejectionOpen] = useState(false);
  const [rejCoreName, setRejCoreName] = useState('');
  const [rejInvoiceNo, setRejInvoiceNo] = useState('');
  const [rejQty, setRejQty] = useState<number | ''>('');
  const [rejSupplier, setRejSupplier] = useState('');
  const [rejReason, setRejReason] = useState('');

  const [isLogCylinderMovementOpen, setIsLogCylinderMovementOpen] = useState(false);
  const [selectedCylId, setSelectedCylId] = useState('');
  const [cylFullIn, setCylFullIn] = useState<number | ''>(0);
  const [cylEmptyOut, setCylEmptyOut] = useState<number | ''>(0);
  const [cylConsumed, setCylConsumed] = useState<number | ''>(0);

  const [errorMsg, setErrorMsg] = useState('');

  const fetchCores = async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        api.get('/manufacturing/cores', { params: { search: search || undefined } }),
        api.get('/suppliers')
      ]);
      setCores(cRes.data);
      setSuppliers(sRes.data);
    } catch (err) {
      console.error('Error fetching cores', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrackings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/manufacturing/cores/daily-tracking');
      setTrackings(res.data);
    } catch (err) {
      console.error('Error fetching core tracking', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRejections = async () => {
    setLoading(true);
    try {
      const res = await api.get('/manufacturing/cores/rejections');
      setRejections(res.data);
    } catch (err) {
      console.error('Error fetching rejections', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCylinders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/manufacturing/cylinders');
      setCylinders(res.data);
    } catch (err) {
      console.error('Error fetching cylinders', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchColours = async () => {
    setLoading(true);
    try {
      const res = await api.get('/materials/colour-codes', { params: { search: search || undefined } });
      setColourCodes(res.data);
    } catch (err) {
      console.error('Error fetching colour codes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'cores') fetchCores();
    else if (activeTab === 'plan-actual') fetchTrackings();
    else if (activeTab === 'rejections') fetchRejections();
    else if (activeTab === 'cylinders') fetchCylinders();
    else if (activeTab === 'colours') fetchColours();
  }, [activeTab, search]);

  const handleSaveCore = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/manufacturing/cores', {
        coreCode,
        coreName,
        uom: 'NOS',
        weightPerUnitKg: Number(coreWeight),
        standardPrice: Number(corePrice)
      });
      setIsAddCoreOpen(false);
      fetchCores();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to save core.');
    }
  };

  const handleSaveCylinder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/manufacturing/cylinders', {
        cylinderCode: `CYL-${cylName.replace(' ', '').toUpperCase()}`,
        cylinderName: cylName,
        gasType: cylGasType,
        capacity: cylCapacity,
        initialFullStock: Number(cylInitialStock),
        initialEmptyStock: 0
      });
      setIsAddCylinderOpen(false);
      fetchCylinders();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to add cylinder.');
    }
  };

  const handleSaveRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/manufacturing/cores/rejections', {
        coreOrMaterialName: rejCoreName,
        rejectionDate: new Date().toISOString(),
        invoiceNumber: rejInvoiceNo,
        supplierName: rejSupplier,
        rejectedQuantity: Number(rejQty),
        reason: rejReason
      });
      setIsAddRejectionOpen(false);
      fetchRejections();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to record rejection.');
    }
  };

  const handleSaveCylinderMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/manufacturing/cylinders/transactions', {
        cylinderId: parseInt(selectedCylId),
        transactionDate: new Date().toISOString(),
        fullReceivedQty: Number(cylFullIn),
        emptyReturnedQty: Number(cylEmptyOut),
        dailyConsumedQty: Number(cylConsumed)
      });
      setIsLogCylinderMovementOpen(false);
      fetchCylinders();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to log cylinder movement.');
    }
  };

  const canEdit = user?.role === 'Admin' || user?.role === 'StoreManager';

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Foundry Cores, Cylinders & Colour Codes</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Sand weight math, Core plan vs actual dispatch, industrial gas balances & customer part color codes
          </p>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: '10px' }}>
            {activeTab === 'cores' && (
              <button className="btn btn-primary btn-sm" onClick={() => setIsAddCoreOpen(true)}>
                <Plus size={15} /> Add Core Master
              </button>
            )}
            {activeTab === 'cylinders' && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setIsLogCylinderMovementOpen(true)}>
                  <ArrowDownToLine size={15} /> Log Cylinder Movement
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => setIsAddCylinderOpen(true)}>
                  <Plus size={15} /> Add Cylinder Type
                </button>
              </>
            )}
            {activeTab === 'rejections' && (
              <button className="btn btn-danger btn-sm" onClick={() => setIsAddRejectionOpen(true)}>
                <Plus size={15} /> Log Supplier Rejection
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'cores' ? 'active' : ''}`}
          onClick={() => setActiveTab('cores')}
        >
          <CoreCylinderIcon size={16} /> Core Master & Sand Weight
        </button>
        <button
          className={`tab-btn ${activeTab === 'cylinders' ? 'active' : ''}`}
          onClick={() => setActiveTab('cylinders')}
        >
          <Flame size={16} /> Industrial Gas Cylinders
        </button>
        <button
          className={`tab-btn ${activeTab === 'rejections' ? 'active' : ''}`}
          onClick={() => setActiveTab('rejections')}
        >
          <XCircle size={16} /> Supplier Core Rejections
        </button>
        <button
          className={`tab-btn ${activeTab === 'colours' ? 'active' : ''}`}
          onClick={() => setActiveTab('colours')}
        >
          <Palette size={16} /> Material Colour Codes (Bosch/Automotive)
        </button>
      </div>

      {/* Core Master Tab */}
      {activeTab === 'cores' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Core Code</th>
                <th>Core Description</th>
                <th>UOM</th>
                <th>Weight Per Unit (KG)</th>
                <th>Standard Price (₹)</th>
                <th>Calculated Sand Weight (per 1,000 pcs)</th>
              </tr>
            </thead>
            <tbody>
              {cores.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{c.coreCode}</td>
                  <td style={{ fontWeight: 600 }}>{c.coreName}</td>
                  <td>{c.uom}</td>
                  <td style={{ fontWeight: 700 }}>{c.weightPerUnitKg} KG</td>
                  <td style={{ fontWeight: 700 }}>₹{c.standardPrice.toFixed(2)}</td>
                  <td style={{ fontWeight: 700, color: '#0284c7' }}>
                    {(c.weightPerUnitKg * 1000).toLocaleString()} KG
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cylinders Tab */}
      {activeTab === 'cylinders' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {cylinders.map((cyl) => (
            <div key={cyl.id} className="card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Flame size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{cyl.cylinderName}</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cyl.cylinderCode} | {cyl.capacity}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Available Full Cylinders</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669' }}>
                    {cyl.currentFullStock}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Empty Awaiting Refill</span>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#d97706' }}>
                    {cyl.currentEmptyStock}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Supplier Rejections Tab */}
      {activeTab === 'rejections' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rejection Date</th>
                <th>Material / Core Name</th>
                <th>Invoice Number</th>
                <th>Supplier</th>
                <th>Rejected Quantity</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rejections.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.rejectionDate).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 700 }}>{r.coreOrMaterialName}</td>
                  <td>{r.invoiceNumber || 'N/A'}</td>
                  <td style={{ fontWeight: 600 }}>{r.supplierName || 'Futurecome'}</td>
                  <td style={{ fontWeight: 800, color: '#dc2626' }}>{r.rejectedQuantity} NOS</td>
                  <td>{r.reason || 'Foundry Blow Holes / Broken'}</td>
                  <td><span className="badge badge-rejected">{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Colour Codes Tab */}
      {activeTab === 'colours' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Model / Part Number</th>
                <th>Material Specification / Grade</th>
                <th>Colour Identification 1</th>
                <th>Colour Identification 2</th>
              </tr>
            </thead>
            <tbody>
              {colourCodes.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700 }}>{c.customerName}</td>
                  <td style={{ fontWeight: 600 }}>{c.modelNumber}</td>
                  <td><span className="badge" style={{ background: 'var(--border-light)' }}>{c.materialGrade}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: c.colour1.toLowerCase().trim() === 'yellow' ? '#eab308' : (c.colour1.toLowerCase().trim() === 'blue' ? '#3b82f6' : (c.colour1.toLowerCase().trim() === 'red' ? '#ef4444' : '#64748b')), border: '1px solid rgba(0,0,0,0.1)' }} />
                      <span style={{ fontWeight: 600 }}>{c.colour1}</span>
                    </div>
                  </td>
                  <td>
                    {c.colour2 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: c.colour2.toLowerCase().trim() === 'blue' ? '#3b82f6' : (c.colour2.toLowerCase().trim() === 'yellow' ? '#eab308' : (c.colour2.toLowerCase().trim() === 'red' ? '#ef4444' : '#64748b')), border: '1px solid rgba(0,0,0,0.1)' }} />
                        <span style={{ fontWeight: 600 }}>{c.colour2}</span>
                      </div>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Core Modal */}
      <Modal isOpen={isAddCoreOpen} onClose={() => setIsAddCoreOpen(false)} title="Add Core Master Specification">
        <form onSubmit={handleSaveCore}>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Core Code *</label>
              <input type="text" required className="form-control" placeholder="e.g. M050" value={coreCode} onChange={(e) => setCoreCode(e.target.value.toUpperCase())} />
            </div>
            <div className="form-group">
              <label className="form-label">Core Description *</label>
              <input type="text" required className="form-control" placeholder="e.g. CPN6148 CORE" value={coreName} onChange={(e) => setCoreName(e.target.value)} />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Weight Per Unit (KG) *</label>
              <input type="number" step="0.01" required className="form-control" placeholder="e.g. 2.0" value={coreWeight} onChange={(e) => setCoreWeight(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Standard Unit Price (₹) *</label>
              <input type="number" step="0.01" required className="form-control" placeholder="e.g. 181.12" value={corePrice} onChange={(e) => setCorePrice(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddCoreOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary"><CheckCircle size={16} /> Save Core</button>
          </div>
        </form>
      </Modal>

      {/* Log Cylinder Movement Modal */}
      <Modal isOpen={isLogCylinderMovementOpen} onClose={() => setIsLogCylinderMovementOpen(false)} title="Log Daily Cylinder Inward / Outward Movement">
        <form onSubmit={handleSaveCylinderMovement}>
          <div className="form-group">
            <label className="form-label">Select Cylinder Type *</label>
            <select className="form-control" required value={selectedCylId} onChange={(e) => setSelectedCylId(e.target.value)}>
              <option value="">Select Cylinder</option>
              {cylinders.map((c) => (
                <option key={c.id} value={c.id}>{c.cylinderName} (Current Full: {c.currentFullStock})</option>
              ))}
            </select>
          </div>
          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Full Cylinders In (+)</label>
              <input type="number" className="form-control" value={cylFullIn} onChange={(e) => setCylFullIn(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Consumed in Plant (-)</label>
              <input type="number" className="form-control" value={cylConsumed} onChange={(e) => setCylConsumed(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Empty Returned to Supplier</label>
              <input type="number" className="form-control" value={cylEmptyOut} onChange={(e) => setCylEmptyOut(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsLogCylinderMovementOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary"><CheckCircle size={16} /> Update Balance</button>
          </div>
        </form>
      </Modal>

      {/* Add Supplier Rejection Modal */}
      <Modal isOpen={isAddRejectionOpen} onClose={() => setIsAddRejectionOpen(false)} title="Log Supplier Rejection">
        <form onSubmit={handleSaveRejection}>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Material / Core Name *</label>
              <input type="text" required className="form-control" placeholder="e.g. CPN6-055 Core" value={rejCoreName} onChange={(e) => setRejCoreName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier *</label>
              <input type="text" required className="form-control" placeholder="e.g. Futurecome Cores" value={rejSupplier} onChange={(e) => setRejSupplier(e.target.value)} />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Invoice Number</label>
              <input type="text" className="form-control" placeholder="e.g. INV-1045" value={rejInvoiceNo} onChange={(e) => setRejInvoiceNo(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Rejected Quantity (NOS) *</label>
              <input type="number" required className="form-control" value={rejQty} onChange={(e) => setRejQty(e.target.value === '' ? '' : parseFloat(e.target.value))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Rejection Reason</label>
            <input type="text" className="form-control" placeholder="e.g. Sand friability defect / Blowholes" value={rejReason} onChange={(e) => setRejReason(e.target.value)} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddRejectionOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-danger"><CheckCircle size={16} /> Record Rejection</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
