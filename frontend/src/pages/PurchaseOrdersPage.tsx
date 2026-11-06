import React, { useEffect, useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Eye,
  Trash2,
  CheckCircle,
  AlertCircle,
  FileText,
  Clock,
  ArrowDownToLine,
  Zap,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import api from '../services/api';
import { PurchaseOrder, Supplier, Material, User, AutoRequisitionResult } from '../types';
import { Modal } from '../components/ModalAndPrintables';

export const PurchaseOrdersPage: React.FC<{ user: User | null }> = ({ user }) => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTriggeringAuto, setIsTriggeringAuto] = useState(false);
  const [autoResult, setAutoResult] = useState<AutoRequisitionResult | null>(null);

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Form State
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 Days Credit');
  const [deliveryAddress, setDeliveryAddress] = useState('No.306, Sompura Industrial Area Nidavanta, Dabspet, Bangalore - 562 132');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<{ materialId: string; poQuantity: number; unitPrice: number; remarks: string }[]>([
    { materialId: '', poQuantity: 0, unitPrice: 0, remarks: '' }
  ]);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [poRes, suppRes, matRes] = await Promise.all([
        api.get('/purchasing/orders', {
          params: {
            search: search || undefined,
            status: selectedStatus || undefined
          }
        }),
        api.get('/suppliers'),
        api.get('/materials')
      ]);
      setOrders(poRes.data);
      setSuppliers(suppRes.data);
      setMaterials(matRes.data);
    } catch (err) {
      console.error('Error fetching POs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [search, selectedStatus]);

  const handleAddItem = () => {
    setItems([...items, { materialId: '', poQuantity: 0, unitPrice: 0, remarks: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;

    if (field === 'materialId') {
      const mat = materials.find((m) => m.id === parseInt(value));
      if (mat) {
        newItems[index].unitPrice = mat.standardPrice;
      }
    }
    setItems(newItems);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!supplierId) {
      setErrorMsg('Please select a supplier.');
      return;
    }

    if (items.some((i) => !i.materialId || i.poQuantity <= 0)) {
      setErrorMsg('Please select a material and enter a valid PO quantity for all rows.');
      return;
    }

    try {
      const payload = {
        poDate: new Date(poDate).toISOString(),
        supplierId: parseInt(supplierId),
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : null,
        paymentTerms,
        deliveryAddress,
        remarks: remarks || undefined,
        items: items.map((i) => ({
          materialId: parseInt(i.materialId),
          poQuantity: Number(i.poQuantity),
          unitPrice: Number(i.unitPrice),
          remarks: i.remarks || undefined
        }))
      };

      await api.post('/purchasing/orders', payload);
      setIsCreateOpen(false);
      setItems([{ materialId: '', poQuantity: 0, unitPrice: 0, remarks: '' }]);
      setRemarks('');
      fetchOrders();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create purchase order.');
    }
  };

  const handleViewDetails = async (id: number) => {
    try {
      const res = await api.get(`/purchasing/orders/${id}`);
      setSelectedPo(res.data);
      setIsDetailOpen(true);
    } catch (err) {
      console.error('Error fetching PO details', err);
    }
  };

  const handleTriggerAutoPoNow = async () => {
    setIsTriggeringAuto(true);
    try {
      const res = await api.post('/purchasing/auto-requisitions/trigger-now');
      setAutoResult(res.data);
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to trigger automated purchase orders.');
    } finally {
      setIsTriggeringAuto(false);
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.poQuantity * item.unitPrice), 0);
  };

  const canCreate = user?.role === 'Admin' || user?.role === 'StoreManager' || user?.role === 'PurchaseUser';

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Purchase Orders & Pending Delivery Tracking</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Track PO quantities, partial receipts, pending quantities & automated L1 supplier procurement
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {canCreate && (
            <button
              className="btn btn-sm"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={handleTriggerAutoPoNow}
              disabled={isTriggeringAuto}
              title="Run 6:00 PM Auto-PO Engine immediately"
            >
              {isTriggeringAuto ? <RefreshCw size={14} className="spin-icon" /> : <Zap size={14} />}
              Run 6:00 PM Auto-PO Engine Now
            </button>
          )}

          {canCreate && (
            <button className="btn btn-primary btn-sm" onClick={() => setIsCreateOpen(true)}>
              <Plus size={15} /> Issue New Purchase Order
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '36px' }}
              placeholder="Search PO Number or Supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <select
              className="form-control"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All PO Statuses</option>
              <option value="Issued">Issued (Open)</option>
              <option value="PartiallyReceived">Partially Received</option>
              <option value="Completed">Completed (Fully Delivered)</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>PO Number</th>
              <th>PO Date</th>
              <th>Supplier Name</th>
              <th>Expected Date</th>
              <th>Ordered Qty</th>
              <th>Received Qty</th>
              <th>Pending Qty</th>
              <th>Total Amount (₹)</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '30px' }}>Loading purchase orders...</td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '30px' }}>No purchase orders found.</td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{o.poNumber}</td>
                  <td>{new Date(o.poDate).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 600 }}>{o.supplierName || 'N/A'}</td>
                  <td>{o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toLocaleDateString() : 'Immediate'}</td>
                  <td style={{ fontWeight: 600 }}>{o.totalPoQuantity.toLocaleString()}</td>
                  <td style={{ color: '#059669', fontWeight: 600 }}>{o.totalReceivedQuantity.toLocaleString()}</td>
                  <td style={{ color: o.totalPendingQuantity > 0 ? '#ea580c' : '#059669', fontWeight: 700 }}>
                    {o.totalPendingQuantity.toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 700 }}>₹{o.totalAmount.toLocaleString()}</td>
                  <td>
                    {o.status === 'Issued' && <span className="badge badge-submitted">Issued</span>}
                    {o.status === 'PartiallyReceived' && <span className="badge badge-low">Partially Recd</span>}
                    {o.status === 'Completed' && <span className="badge badge-approved">Completed</span>}
                    {o.status === 'Cancelled' && <span className="badge badge-rejected">Cancelled</span>}
                  </td>
                  <td>
                    <button
                      className="btn-icon btn-secondary"
                      onClick={() => handleViewDetails(o.id)}
                      title="View PO Breakdown"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create PO Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Issue Purchase Order (PO)"
        size="lg"
      >
        <form onSubmit={handleCreate}>
          {errorMsg && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <AlertCircle size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              {errorMsg}
            </div>
          )}

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">PO Date *</label>
              <input
                type="date"
                className="form-control"
                required
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier *</label>
              <select
                className="form-control"
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.supplierName}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Expected Delivery Date</label>
              <input
                type="date"
                className="form-control"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Payment Terms</label>
              <input
                type="text"
                className="form-control"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Delivery Address</label>
              <input
                type="text"
                className="form-control"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
            </div>
          </div>

          <h4 style={{ margin: '16px 0 10px', fontSize: '0.95rem' }}>PO Line Items</h4>
          <div className="table-container" style={{ marginBottom: '16px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>Material *</th>
                  <th style={{ width: '20%' }}>PO Quantity *</th>
                  <th style={{ width: '20%' }}>Unit Price (₹) *</th>
                  <th style={{ width: '15%' }}>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      <select
                        className="form-control"
                        required
                        value={item.materialId}
                        onChange={(e) => handleItemChange(idx, 'materialId', e.target.value)}
                      >
                        <option value="">Select Material</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.materialCode} — {m.materialName} ({m.defaultUom})
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        step="any"
                        required
                        className="form-control"
                        placeholder="Qty"
                        value={item.poQuantity || ''}
                        onChange={(e) => handleItemChange(idx, 'poQuantity', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        required
                        className="form-control"
                        placeholder="Price"
                        value={item.unitPrice || ''}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      ₹{(item.poQuantity * item.unitPrice).toFixed(2)}
                    </td>
                    <td>
                      {items.length > 1 && (
                        <button
                          type="button"
                          className="btn-icon btn-danger"
                          onClick={() => handleRemoveItem(idx)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem}>
              <Plus size={14} /> Add Another Line Item
            </button>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
              Grand Total: ₹{calculateTotal().toLocaleString()}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <CheckCircle size={16} /> Issue Purchase Order
            </button>
          </div>
        </form>
      </Modal>

      {/* PO Details Modal */}
      {selectedPo && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`Purchase Order: ${selectedPo.poNumber}`}
          size="lg"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px', padding: '14px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PO Date</span>
              <div style={{ fontWeight: 700 }}>{new Date(selectedPo.poDate).toLocaleDateString()}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supplier</span>
              <div style={{ fontWeight: 700 }}>{selectedPo.supplierName || 'N/A'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</span>
              <div style={{ fontWeight: 800 }}>{selectedPo.status}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Expected Delivery</span>
              <div style={{ fontWeight: 600 }}>{selectedPo.expectedDeliveryDate ? new Date(selectedPo.expectedDeliveryDate).toLocaleDateString() : 'N/A'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payment Terms</span>
              <div style={{ fontWeight: 600 }}>{selectedPo.paymentTerms || 'Standard'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Amount</span>
              <div style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>₹{selectedPo.totalAmount.toLocaleString()}</div>
            </div>
          </div>

          <h4 style={{ marginBottom: '10px' }}>Delivery Progress & Pending Quantities</h4>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material Code</th>
                  <th>Material Description</th>
                  <th>Ordered Qty</th>
                  <th>Received (Inward)</th>
                  <th>Pending Delivery</th>
                  <th>Unit Rate (₹)</th>
                  <th>Line Total (₹)</th>
                </tr>
              </thead>
              <tbody>
                {selectedPo.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700 }}>{item.materialCode}</td>
                    <td>{item.materialName}</td>
                    <td style={{ fontWeight: 600 }}>{item.poQuantity} {item.uom}</td>
                    <td style={{ color: '#059669', fontWeight: 600 }}>{item.receivedQuantity} {item.uom}</td>
                    <td style={{ color: item.pendingQuantity > 0 ? '#ea580c' : '#059669', fontWeight: 700 }}>
                      {item.pendingQuantity} {item.uom}
                    </td>
                    <td>₹{item.unitPrice.toFixed(2)}</td>
                    <td style={{ fontWeight: 700 }}>₹{item.totalPrice.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Auto-PO Result Modal */}
      {autoResult && (
        <Modal
          isOpen={true}
          onClose={() => setAutoResult(null)}
          title="Automated Purchase Orders Summary (L1 Lowest Supplier)"
          size="md"
        >
          <div style={{ textAlign: 'center', padding: '10px 0 16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: autoResult.success ? 'rgba(5, 150, 105, 0.12)' : 'rgba(220, 38, 38, 0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px'
              }}
            >
              {autoResult.success ? <CheckCircle size={24} color="#059669" /> : <AlertCircle size={24} color="#dc2626" />}
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 6px' }}>
              {autoResult.success ? 'Purchase Order(s) Generated' : 'Auto-PO Notice'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              {autoResult.message}
            </p>
          </div>

          {autoResult.createdPoNumbers && autoResult.createdPoNumbers.length > 0 && (
            <div style={{ background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '8px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Issued Purchase Orders:
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {autoResult.createdPoNumbers.map((poNum) => (
                  <span key={poNum} className="badge badge-excess" style={{ fontSize: '0.82rem', padding: '4px 10px', fontWeight: 700 }}>
                    🛒 {poNum}
                  </span>
                ))}
              </div>
            </div>
          )}

          {autoResult.logs && autoResult.logs.length > 0 && (
            <div style={{ maxHeight: '140px', overflowY: 'auto', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', fontSize: '0.78rem', fontFamily: 'monospace', marginBottom: '16px' }}>
              {autoResult.logs.map((log, i) => (
                <div key={i} style={{ marginBottom: '3px' }}>• {log}</div>
              ))}
            </div>
          )}

          <div className="modal-footer">
            <button className="btn btn-primary" onClick={() => setAutoResult(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
export default PurchaseOrdersPage;

