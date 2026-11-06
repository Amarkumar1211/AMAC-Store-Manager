import React, { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  Plus,
  Search,
  FileDown,
  Eye,
  Trash2,
  CheckCircle,
  AlertCircle,
  Calendar,
  Building,
  FileText,
  Printer
} from 'lucide-react';
import api from '../services/api';
import { MaterialReceipt, Supplier, Material, User } from '../types';
import { Modal, PrintableGoodsReceiptNote } from '../components/ModalAndPrintables';
import { AutoSuggestSupplier, AutoSuggestMaterial } from '../components/AutoSuggestComponents';

export const ReceiptsPage: React.FC<{ user: User | null; initialCreateOpen?: boolean; onResetQuickAction?: () => void }> = ({
  user,
  initialCreateOpen = false,
  onResetQuickAction
}) => {
  const [receipts, setReceipts] = useState<MaterialReceipt[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(initialCreateOpen);
  const [selectedReceipt, setSelectedReceipt] = useState<MaterialReceipt | null>(null);
  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [printReceipt, setPrintReceipt] = useState<any>(null);

  // Form State
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  type ReceiptBundle = { quantity: number | string };
  type ReceiptBatch = { batchNumber: string; unitPrice: number | string; autoBatchInfo?: string; bundles: ReceiptBundle[] };
  type ReceiptMaterial = { materialId: string; remarks: string; batches: ReceiptBatch[] };

  const [receiptMaterials, setReceiptMaterials] = useState<ReceiptMaterial[]>([
    { materialId: '', remarks: '', batches: [{ batchNumber: '', unitPrice: 0, bundles: [{ quantity: 0 }] }] }
  ]);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const [recRes, suppRes, matRes] = await Promise.all([
        api.get('/receipts', { params: { search: search || undefined } }),
        api.get('/suppliers'),
        api.get('/materials')
      ]);
      setReceipts(recRes.data);
      setSuppliers(suppRes.data);
      setMaterials(matRes.data);
    } catch (err) {
      console.error('Error fetching receipts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [search]);

  useEffect(() => {
    if (initialCreateOpen) {
      setIsCreateOpen(true);
    }
  }, [initialCreateOpen]);

  const handleAddMaterial = () => {
    setReceiptMaterials([...receiptMaterials, { materialId: '', remarks: '', batches: [{ batchNumber: '', unitPrice: 0, bundles: [{ quantity: 0 }] }] }]);
  };

  const handleRemoveMaterial = (mIndex: number) => {
    setReceiptMaterials(receiptMaterials.filter((_, i) => i !== mIndex));
  };

  const handleAddBatch = (mIndex: number) => {
    const newMats = [...receiptMaterials];
    newMats[mIndex].batches.push({ batchNumber: '', unitPrice: 0, bundles: [{ quantity: 0 }] });
    setReceiptMaterials(newMats);
  };

  const handleRemoveBatch = (mIndex: number, bIndex: number) => {
    const newMats = [...receiptMaterials];
    newMats[mIndex].batches.splice(bIndex, 1);
    setReceiptMaterials(newMats);
  };

  const handleAddBundle = (mIndex: number, bIndex: number) => {
    const newMats = [...receiptMaterials];
    newMats[mIndex].batches[bIndex].bundles.push({ quantity: 0 });
    setReceiptMaterials(newMats);
  };

  const handleRemoveBundle = (mIndex: number, bIndex: number, bdIndex: number) => {
    const newMats = [...receiptMaterials];
    newMats[mIndex].batches[bIndex].bundles.splice(bdIndex, 1);
    setReceiptMaterials(newMats);
  };

  const handleMaterialChange = (mIndex: number, field: string, value: any) => {
    const newMats = [...receiptMaterials];
    (newMats[mIndex] as any)[field] = value;
    if (field === 'materialId') {
      const selectedMat = materials.find((m) => m.id === parseInt(value));
      if (selectedMat) {
        newMats[mIndex].batches.forEach(b => { b.unitPrice = selectedMat.standardPrice; });
      }
    }
    setReceiptMaterials(newMats);
  };

  const handleBatchChange = async (mIndex: number, bIndex: number, field: string, value: any) => {
    const newMats = [...receiptMaterials];
    (newMats[mIndex].batches[bIndex] as any)[field] = value;
    
    if (field === 'batchNumber') {
      const batchCode = String(value || '').trim();
      const currentMatId = parseInt(newMats[mIndex].materialId);
      if (currentMatId > 0 && batchCode.length >= 2) {
        try {
          const res = await api.get('/batches/lookup', {
            params: { materialId: currentMatId, batchNumber: batchCode }
          });
          if (res.data.exists && res.data.unitPrice > 0) {
            newMats[mIndex].batches[bIndex].unitPrice = res.data.unitPrice;
            newMats[mIndex].batches[bIndex].autoBatchInfo = `🏷️ Auto-Applied Batch ${res.data.batchNumber} Rate: ₹${res.data.unitPrice}/kg (Current Stock: ${res.data.currentStock} kg)`;
          } else {
            newMats[mIndex].batches[bIndex].autoBatchInfo = undefined;
          }
        } catch {
          newMats[mIndex].batches[bIndex].autoBatchInfo = undefined;
        }
      } else {
        newMats[mIndex].batches[bIndex].autoBatchInfo = undefined;
      }
    }
    
    setReceiptMaterials(newMats);
  };

  const handleBundleChange = (mIndex: number, bIndex: number, bdIndex: number, value: any) => {
    const newMats = [...receiptMaterials];
    newMats[mIndex].batches[bIndex].bundles[bdIndex].quantity = value;
    setReceiptMaterials(newMats);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Flatten to validate
    const flatItems = receiptMaterials.flatMap(m => 
      m.batches.map(b => ({
        materialId: m.materialId,
        batchNumber: b.batchNumber,
        receivedQuantity: b.bundles.reduce((sum, bdl) => sum + Number(bdl.quantity || 0), 0),
        unitPrice: b.unitPrice,
        remarks: m.remarks
      }))
    );

    if (flatItems.some((i) => !i.materialId || i.receivedQuantity <= 0)) {
      setErrorMsg('Please select a material and enter a valid quantity for all batches.');
      return;
    }

    try {
      const selectedSupp = suppliers.find((s) => s.id === parseInt(supplierId));
      const payload = {
        receiptDate: new Date(receiptDate).toISOString(),
        supplierId: supplierId ? parseInt(supplierId) : null,
        supplierName: selectedSupp?.supplierName || undefined,
        poNumber: poNumber || undefined,
        invoiceNumber: invoiceNumber || undefined,
        invoiceDate: new Date(receiptDate).toISOString(),
        vehicleNumber: vehicleNumber || undefined,
        remarks: remarks || undefined,
        items: flatItems.map((i) => ({
          materialId: parseInt(i.materialId),
          batchNumber: i.batchNumber ? String(i.batchNumber).trim() : undefined,
          receivedQuantity: Number(i.receivedQuantity),
          unitPrice: Number(i.unitPrice),
          remarks: i.remarks
        }))
      };

      await api.post('/receipts', payload);
      setIsCreateOpen(false);
      if (onResetQuickAction) onResetQuickAction();
      // Reset form
      setReceiptMaterials([{ materialId: '', remarks: '', batches: [{ batchNumber: '', unitPrice: 0, bundles: [{ quantity: 0 }] }] }]);
      setPoNumber('');
      setInvoiceNumber('');
      setRemarks('');
      fetchReceipts();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create GRN receipt.');
    }
  };

  const handleViewDetails = async (id: number) => {
    try {
      const res = await api.get(`/receipts/${id}`);
      setSelectedReceipt(res.data);
      // Map items to editedItems state to allow modification before approval
      setEditedItems(res.data.items?.map((i: any) => ({
        id: i.id,
        receivedQuantity: i.receivedQuantity,
        unitPrice: i.unitPrice,
        batchNumber: i.batchNumber || ''
      })) || []);
      setIsDetailOpen(true);
    } catch (err) {
      console.error('Error fetching details', err);
    }
  };

  const handleApprove = async () => {
    if (!selectedReceipt) return;
    try {
      await api.post(`/receipts/${selectedReceipt.id}/approve`, { items: editedItems });
      setIsDetailOpen(false);
      fetchReceipts();
      if (onResetQuickAction) onResetQuickAction();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to approve GRN');
    }
  };

  const handleReject = async () => {
    if (!selectedReceipt) return;
    if (!window.confirm('Are you sure you want to reject this GRN?')) return;
    try {
      await api.post(`/receipts/${selectedReceipt.id}/reject`);
      setIsDetailOpen(false);
      fetchReceipts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject GRN');
    }
  };

  const calculateTotal = () => {
    return receiptMaterials.reduce((totalSum, m) => {
      return totalSum + m.batches.reduce((bSum, b) => {
        const bQty = b.bundles.reduce((qtySum, bdl) => qtySum + Number(bdl.quantity || 0), 0);
        return bSum + (bQty * Number(b.unitPrice || 0));
      }, 0);
    }, 0);
  };

  const handleDownloadExcel = async () => {
    try {
      const res = await api.get('/reports/purchase/excel', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `AMAC_GRN_Inward_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download error', err);
      alert('Failed to download report.');
    }
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Material Inward (GRN) Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Goods Receipt Notes, PO matching, supplier invoice logging & automatic stock updating
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={handleDownloadExcel} className="btn btn-secondary btn-sm">
            <FileDown size={15} /> Inward Excel Report
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setIsCreateOpen(true)}>
            <Plus size={15} /> Create GRN Receipt
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '36px' }}
            placeholder="Search GRN, Supplier, Invoice or PO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>GRN Number</th>
              <th>Receipt Date</th>
              <th>Supplier Name</th>
              <th>PO Number</th>
              <th>Invoice No</th>
              <th>Status</th>
              <th>Items Count</th>
              <th>Total Value (₹)</th>
              <th>Received By</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '30px' }}>Loading receipts...</td>
              </tr>
            ) : receipts.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '30px' }}>No GRN receipts recorded.</td>
              </tr>
            ) : (
              receipts.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{r.grnNumber}</td>
                  <td>{new Date(r.receiptDate).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 600 }}>{r.supplierName || 'N/A'}</td>
                  <td>{r.poNumber || '-'}</td>
                  <td>{r.invoiceNumber || '-'}</td>
                  <td>
                    {r.status === 'Pending' && <span className="badge badge-pending" style={{ background: '#fef3c7', color: '#d97706' }}>Pending Review</span>}
                    {r.status === 'Approved' && <span className="badge badge-submitted" style={{ background: '#dcfce7', color: '#15803d' }}>Approved</span>}
                    {r.status === 'Rejected' && <span className="badge badge-rejected" style={{ background: '#fee2e2', color: '#b91c1c' }}>Rejected</span>}
                    {!r.status && <span className="badge badge-submitted">Approved</span>}
                  </td>
                  <td><span className="badge" style={{ background: '#e2e8f0', color: '#475569' }}>{r.itemCount} items</span></td>
                  <td style={{ fontWeight: 700 }}>₹{r.totalAmount.toLocaleString()}</td>
                  <td style={{ fontSize: '0.8rem' }}>{r.receivedBy || 'Store Operator'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn-icon btn-secondary"
                        onClick={() => handleViewDetails(r.id)}
                        title="View GRN Details"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        className="btn-icon btn-secondary"
                        onClick={async () => {
                          try {
                            const res = await api.get(`/receipts/${r.id}`);
                            setPrintReceipt(res.data);
                          } catch (err) {
                            console.error('Error fetching receipt for print', err);
                          }
                        }}
                        title="Print GRN Document"
                      >
                        <Printer size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create GRN Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); if (onResetQuickAction) onResetQuickAction(); }}
        title="Create Goods Receipt Note (GRN Inward)"
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
              <label className="form-label">Receipt Date *</label>
              <input
                type="date"
                className="form-control"
                required
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Supplier Name *</label>
              <AutoSuggestSupplier
                suppliers={suppliers}
                selectedSupplierId={supplierId}
                onSelectSupplier={(supp) => setSupplierId(supp ? supp.id.toString() : '')}
                onSupplierCreated={(newSupp) => {
                  setSuppliers((prev) => [...prev, newSupp]);
                  setSupplierId(newSupp.id.toString());
                }}
                placeholder="Type or select supplier..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">PO Number (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. PO-202607-0001"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Supplier Invoice No</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. INV-9842"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. KA-04-AB-1234"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Remarks / Note</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Inward batch quality verified"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>

          <h4 style={{ margin: '16px 0 10px', fontSize: '0.95rem' }}>Received Items List</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
            {receiptMaterials.map((m, mIdx) => (
              <div key={mIdx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ width: '40%' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Material *</label>
                    <AutoSuggestMaterial
                      materials={materials}
                      selectedMaterialId={m.materialId}
                      onSelectMaterial={(mat) => handleMaterialChange(mIdx, 'materialId', mat ? mat.id.toString() : '')}
                      onMaterialCreated={(newMat) => {
                        setMaterials((prev) => [...prev, newMat]);
                        handleMaterialChange(mIdx, 'materialId', newMat.id.toString());
                      }}
                      placeholder="Search code or name..."
                    />
                  </div>
                  <div style={{ width: '45%' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Material Remarks</label>
                    <input type="text" className="form-control" placeholder="Optional notes about this material" value={m.remarks} onChange={e => handleMaterialChange(mIdx, 'remarks', e.target.value)} />
                  </div>
                  {receiptMaterials.length > 1 && (
                    <button type="button" className="btn-icon btn-danger" onClick={() => handleRemoveMaterial(mIdx)} style={{ marginTop: '22px' }} title="Remove Material">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {/* Batches Container */}
                <div style={{ paddingLeft: '16px', borderLeft: '3px solid #cbd5e1' }}>
                  <h5 style={{ fontSize: '0.85rem', marginBottom: '8px', color: '#334155' }}>Batches for this Material</h5>
                  {m.batches.map((b, bIdx) => {
                    const batchTotalQty = b.bundles.reduce((sum, bdl) => sum + Number(bdl.quantity || 0), 0);
                    return (
                      <div key={bIdx} style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px', marginBottom: '10px', background: '#ffffff' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Batch / Heat No</label>
                            <input type="text" className="form-control" placeholder="e.g. 23aa" value={b.batchNumber} onChange={e => handleBatchChange(mIdx, bIdx, 'batchNumber', e.target.value.toUpperCase())} />
                            {b.autoBatchInfo && <div style={{ fontSize: '0.65rem', color: '#0284c7', marginTop: '4px', fontWeight: 700 }}>{b.autoBatchInfo}</div>}
                          </div>
                          <div style={{ width: '120px' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Unit Price (₹)</label>
                            <input type="number" step="0.01" className="form-control" value={b.unitPrice} onChange={e => handleBatchChange(mIdx, bIdx, 'unitPrice', e.target.value)} />
                          </div>
                          <div style={{ width: '130px', textAlign: 'right' }}>
                            <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Batch Total</label>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#059669', paddingTop: '6px' }}>{batchTotalQty}</div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginTop: '2px' }}>₹{(batchTotalQty * Number(b.unitPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </div>
                          {m.batches.length > 1 && (
                            <button type="button" className="btn-icon btn-secondary" onClick={() => handleRemoveBatch(mIdx, bIdx)} style={{ marginTop: '20px' }} title="Remove Batch">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        {/* Bundles Container */}
                        <div style={{ marginTop: '12px', background: '#f1f5f9', padding: '8px', borderRadius: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>Individual Bundles / Pallets</span>
                            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => handleAddBundle(mIdx, bIdx)}>
                              <Plus size={12} /> Add Bundle
                            </button>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {b.bundles.map((bdl, bdIdx) => (
                              <div key={bdIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fff', border: '1px solid #cbd5e1', padding: '4px', borderRadius: '4px' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>#{bdIdx + 1}</span>
                                <input type="number" step="any" required className="form-control" style={{ width: '80px', padding: '2px 6px', height: '24px', fontSize: '0.8rem' }} placeholder="Qty" value={bdl.quantity} onChange={e => handleBundleChange(mIdx, bIdx, bdIdx, e.target.value)} />
                                {b.bundles.length > 1 && (
                                  <button type="button" className="btn-icon" style={{ background: 'transparent', padding: '2px' }} onClick={() => handleRemoveBundle(mIdx, bIdx, bdIdx)}>
                                    <Trash2 size={12} color="#ef4444" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: '4px' }} onClick={() => handleAddBatch(mIdx)}>
                    <Plus size={14} /> Add Another Batch
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddMaterial}>
              <Plus size={14} /> Add Another Material
            </button>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
              Grand Total: ₹{calculateTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <CheckCircle size={16} /> Save GRN & Inward Stock
            </button>
          </div>
        </form>
      </Modal>

      {/* View Detail Modal */}
      {selectedReceipt && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={`GRN Inward Details: ${selectedReceipt.grnNumber}`}
          size="lg"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px', padding: '14px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Receipt Date</span>
              <div style={{ fontWeight: 700 }}>{new Date(selectedReceipt.receiptDate).toLocaleDateString()}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supplier Name</span>
              <div style={{ fontWeight: 700 }}>{selectedReceipt.supplierName || 'N/A'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PO Number</span>
              <div style={{ fontWeight: 700 }}>{selectedReceipt.poNumber || 'Direct Inward'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Invoice Number</span>
              <div style={{ fontWeight: 700 }}>{selectedReceipt.invoiceNumber || 'N/A'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vehicle No</span>
              <div style={{ fontWeight: 700 }}>{selectedReceipt.vehicleNumber || 'N/A'}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</span>
              <div>
                {selectedReceipt.status === 'Pending' && <span className="badge badge-pending" style={{ background: '#fef3c7', color: '#d97706' }}>Pending Review</span>}
                {selectedReceipt.status === 'Approved' && <span className="badge badge-submitted" style={{ background: '#dcfce7', color: '#15803d' }}>Approved</span>}
                {selectedReceipt.status === 'Rejected' && <span className="badge badge-rejected" style={{ background: '#fee2e2', color: '#b91c1c' }}>Rejected</span>}
              </div>
            </div>
            {selectedReceipt.approvedBy && (
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedReceipt.status === 'Approved' ? 'Approved By' : 'Rejected By'}</span>
                <div style={{ fontWeight: 700 }}>{selectedReceipt.approvedBy}</div>
              </div>
            )}
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Value</span>
              <div style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>₹{selectedReceipt.totalAmount.toLocaleString()}</div>
            </div>
          </div>

          <h4 style={{ marginBottom: '10px' }}>Inward Materials</h4>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material Code</th>
                  <th>Material Name</th>
                  <th>Batch / Heat No</th>
                  <th>Quantity</th>
                  <th>Unit Rate (₹)</th>
                  <th>Total Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {selectedReceipt.items?.map((item, idx) => {
                  const isEditable = selectedReceipt.status === 'Pending' && (user?.role === 'Admin' || user?.role === 'StoreManager');
                  const editedItem = editedItems.find(ei => ei.id === item.id);
                  return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700 }}>{item.materialCode}</td>
                    <td>{item.materialName}</td>
                    <td>
                      {isEditable ? (
                        <input
                          type="text"
                          className="form-control"
                          style={{ width: '100px', padding: '4px' }}
                          value={editedItem?.batchNumber || ''}
                          onChange={e => {
                            const newEdited = [...editedItems];
                            const curr = newEdited.find(ei => ei.id === item.id);
                            if (curr) curr.batchNumber = e.target.value;
                            setEditedItems(newEdited);
                          }}
                        />
                      ) : (
                        item.batchNumber ? (
                          <span style={{ background: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.78rem' }}>
                            🏷️ {item.batchNumber}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )
                      )}
                    </td>
                    <td style={{ fontWeight: 700, display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {isEditable ? (
                        <input
                          type="number"
                          className="form-control"
                          style={{ width: '80px', padding: '4px' }}
                          value={editedItem?.receivedQuantity || 0}
                          onChange={e => {
                            const newEdited = [...editedItems];
                            const curr = newEdited.find(ei => ei.id === item.id);
                            if (curr) curr.receivedQuantity = Number(e.target.value);
                            setEditedItems(newEdited);
                          }}
                        />
                      ) : (
                        item.receivedQuantity
                      )} {item.uom}
                    </td>
                    <td>
                      {isEditable ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          ₹ <input
                            type="number"
                            step="0.01"
                            className="form-control"
                            style={{ width: '90px', padding: '4px' }}
                            value={editedItem?.unitPrice || 0}
                            onChange={e => {
                              const newEdited = [...editedItems];
                              const curr = newEdited.find(ei => ei.id === item.id);
                              if (curr) curr.unitPrice = Number(e.target.value);
                              setEditedItems(newEdited);
                            }}
                          />
                        </div>
                      ) : (
                        `₹${item.unitPrice.toFixed(2)}`
                      )}
                    </td>
                    <td style={{ fontWeight: 700 }}>
                      ₹{isEditable ? ((editedItem?.receivedQuantity || 0) * (editedItem?.unitPrice || 0)).toLocaleString() : item.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setIsDetailOpen(false); setPrintReceipt(selectedReceipt); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={15} /> Print
              </button>
              {selectedReceipt.status === 'Pending' && (user?.role === 'Admin' || user?.role === 'StoreManager') && (
                <>
                  <button type="button" className="btn btn-primary" onClick={handleApprove} style={{ background: '#10b981' }}>
                    Approve GRN
                  </button>
                  <button type="button" className="btn btn-danger" onClick={handleReject}>
                    Reject GRN
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsDetailOpen(false)}
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* Printable GRN Document */}
      {printReceipt && (
        <PrintableGoodsReceiptNote
          receipt={printReceipt}
          onClose={() => setPrintReceipt(null)}
        />
      )}
    </div>
  );
};
