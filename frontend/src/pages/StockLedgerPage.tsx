import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  FileDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sliders,
  History,
  Info,
  Calendar
} from 'lucide-react';
import api from '../services/api';
import { Material, StockLedgerEntry, MaterialCategory } from '../types';
import { Modal } from '../components/ModalAndPrintables';

export const StockLedgerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stock' | 'ledger'>('stock');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<StockLedgerEntry[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Material Drilldown modal
  const [drilldownMaterial, setDrilldownMaterial] = useState<Material | null>(null);
  const [materialLedger, setMaterialLedger] = useState<StockLedgerEntry[]>([]);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);

  const fetchStockData = async () => {
    setLoading(true);
    try {
      const matRes = await api.get('/stock/summary', {
        params: {
          search: search || undefined,
          categoryId: selectedCategory || undefined,
          status: selectedStatus || undefined
        }
      });
      setMaterials(matRes.data);
    } catch (err) {
      console.error('Error fetching stock summary', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedgerData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/stock/ledger', {
        params: {
          search: search || undefined,
          categoryId: selectedCategory || undefined
        }
      });
      setLedgerEntries(res.data);
    } catch (err) {
      console.error('Error fetching ledger', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const catRes = await api.get('/materials/categories');
        setCategories(catRes.data);
      } catch (err) {
        console.error('Error fetching categories', err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'stock') {
        fetchStockData();
      } else {
        fetchLedgerData();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [activeTab, search, selectedCategory, selectedStatus]);

  const handleDrilldown = async (m: Material) => {
    setDrilldownMaterial(m);
    setMaterialLedger([]);
    setIsDrilldownOpen(true);
    try {
      const res = await api.get('/stock/ledger', { params: { materialId: m.id } });
      setMaterialLedger(res.data);
    } catch (err) {
      console.error('Error fetching material ledger', err);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const res = await api.get('/reports/stock/excel', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `AMAC_Stock_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download error', err);
      alert('Failed to download stock report.');
    }
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Store Stock & Transaction Ledger</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Real-time multi-tier stock valuation, dynamic safety buffers & immutable ledger traceability
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={handleDownloadExcel} className="btn btn-secondary btn-sm">
            <FileDown size={15} /> Download Stock Report (Excel)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'stock' ? 'active' : ''}`}
          onClick={() => setActiveTab('stock')}
        >
          <ClipboardList size={16} /> Live Available Stock (179 Materials)
        </button>
        <button
          className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setActiveTab('ledger')}
        >
          <History size={16} /> Complete Movement Ledger (Inward / Outward / Adjustments)
        </button>
      </div>

      {/* Filter Row */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '36px' }}
              placeholder="Search code or material name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div>
            <select
              className="form-control"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {activeTab === 'stock' && (
            <div>
              <select
                className="form-control"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">All Stock Statuses</option>
                <option value="Normal">Normal</option>
                <option value="LowStock">Low Stock (Below Reorder)</option>
                <option value="OutOfStock">Out of Stock (Zero)</option>
                <option value="ExcessStock">Excess Stock (&gt;60 Days)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Stock Summary Tab */}
      {activeTab === 'stock' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Material Code</th>
                <th>Material Description</th>
                <th>Category</th>
                <th>UOM</th>
                <th>Reorder Lvl</th>
                <th>Available Stock</th>
                <th>Daily Cons Rate</th>
                <th>Days of Stock</th>
                <th>PO Pending</th>
                <th>Req PO Qty</th>
                <th>Unit Price (₹)</th>
                <th>Stock Value (₹)</th>
                <th>Status</th>
                <th>Trace</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: '30px' }}>Loading stock balances...</td>
                </tr>
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: '30px' }}>No materials found.</td>
                </tr>
              ) : (
                materials.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{m.materialCode}</td>
                    <td style={{ fontWeight: 600 }}>{m.materialName}</td>
                    <td><span className="badge" style={{ background: 'var(--border-light)', color: 'var(--text-secondary)' }}>{m.categoryName || 'N/A'}</span></td>
                    <td style={{ fontWeight: 600 }}>{m.defaultUom}</td>
                    <td>{m.reorderLevel.toLocaleString()}</td>
                    <td style={{
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      color: m.currentStock <= 0 ? '#dc2626' : (m.currentStock < m.reorderLevel ? '#d97706' : 'var(--text-primary)')
                    }}>
                      {m.currentStock.toLocaleString()}
                    </td>
                    <td>{m.dailyConsumptionRate > 0 ? m.dailyConsumptionRate.toFixed(1) : '-'}</td>
                    <td>
                      <span style={{ fontWeight: 600 }}>
                        {m.daysOfStock < 999 ? `${m.daysOfStock} D` : (m.currentStock > 0 ? 'Adequate' : '0 D')}
                      </span>
                    </td>
                    <td>{m.pendingPoQuantity > 0 ? <span style={{ color: '#0284c7', fontWeight: 600 }}>{m.pendingPoQuantity.toLocaleString()}</span> : '-'}</td>
                    <td>{m.requiredPoQuantity > 0 ? <span style={{ color: '#ea580c', fontWeight: 700 }}>{m.requiredPoQuantity.toLocaleString()}</span> : '0'}</td>
                    <td>₹{m.standardPrice.toFixed(2)}</td>
                    <td style={{ fontWeight: 700 }}>₹{m.stockValue.toLocaleString()}</td>
                    <td>
                      {m.stockStatus === 'Normal' && <span className="badge badge-normal">Normal</span>}
                      {m.stockStatus === 'LowStock' && <span className="badge badge-low">Low Stock</span>}
                      {m.stockStatus === 'OutOfStock' && <span className="badge badge-outofstock">Out of Stock</span>}
                      {m.stockStatus === 'ExcessStock' && <span className="badge badge-excess">Excess</span>}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                        onClick={() => handleDrilldown(m)}
                        title="View Full Movement Audit Ledger"
                      >
                        <History size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Full Movement Ledger Tab */}
      {activeTab === 'ledger' && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Material Code</th>
                <th>Material Description</th>
                <th>Batch / Heat No</th>
                <th>Type</th>
                <th>Reference No</th>
                <th>Qty In</th>
                <th>Qty Out</th>
                <th>Unit Cost (₹)</th>
                <th>Total Cost (₹)</th>
                <th>Closing Balance</th>
                <th>Notes / Remarks</th>
                <th>User</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '30px' }}>Loading movement ledger...</td>
                </tr>
              ) : ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '30px' }}>No ledger transactions recorded yet.</td>
                </tr>
              ) : (
                ledgerEntries.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.transactionDate).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 700 }}>{e.materialCode}</td>
                    <td>{e.materialName}</td>
                    <td>
                      {e.batchNumber ? (
                        <span style={{ background: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.78rem' }}>
                          🏷️ {e.batchNumber}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>
                      {e.transactionType === 'Receipt' && <span className="badge badge-normal"><ArrowDownToLine size={12} /> Receipt</span>}
                      {e.transactionType === 'Issue' && <span className="badge badge-submitted"><ArrowUpFromLine size={12} /> Issue</span>}
                      {e.transactionType === 'Opening' && <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>Opening</span>}
                      {e.transactionType === 'Adjustment' && <span className="badge badge-low"><Sliders size={12} /> Adjustment</span>}
                    </td>
                    <td style={{ fontWeight: 600 }}>{e.referenceNumber || '-'}</td>
                    <td style={{ color: '#059669', fontWeight: 700 }}>{e.quantityIn > 0 ? `+${e.quantityIn.toLocaleString()}` : '-'}</td>
                    <td style={{ color: '#dc2626', fontWeight: 700 }}>{e.quantityOut > 0 ? `-${e.quantityOut.toLocaleString()}` : '-'}</td>
                    <td>₹{e.unitCost.toFixed(2)}</td>
                    <td>₹{e.totalCost.toLocaleString()}</td>
                    <td style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{e.balanceQuantityAfter.toLocaleString()} {e.uom}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.notes || '-'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{e.createdByUsername || 'System'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Material Drilldown Modal */}
      {drilldownMaterial && (
        <Modal
          isOpen={isDrilldownOpen}
          onClose={() => setIsDrilldownOpen(false)}
          title={`Inventory Traceability: ${drilldownMaterial.materialCode} — ${drilldownMaterial.materialName}`}
          size="lg"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px', padding: '14px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Available Stock</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                {drilldownMaterial.currentStock} {drilldownMaterial.defaultUom}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Reorder Threshold</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                {drilldownMaterial.reorderLevel} {drilldownMaterial.defaultUom}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Days of Buffer Stock</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                {drilldownMaterial.daysOfStock < 999 ? `${drilldownMaterial.daysOfStock} Days` : 'N/A'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Standard Valuation</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                ₹{drilldownMaterial.stockValue.toLocaleString()}
              </div>
            </div>
          </div>

          <h4 style={{ marginBottom: '10px', fontSize: '0.95rem' }}>Transaction History (Source of Truth)</h4>
          <div className="table-container" style={{ maxHeight: '350px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Ref Doc</th>
                  <th>Qty In</th>
                  <th>Qty Out</th>
                  <th>Balance After</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {materialLedger.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '16px' }}>No transactions recorded.</td>
                  </tr>
                ) : (
                  materialLedger.map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.transactionDate).toLocaleDateString()}</td>
                      <td>{e.transactionType}</td>
                      <td>{e.referenceNumber}</td>
                      <td style={{ color: '#059669', fontWeight: 700 }}>{e.quantityIn > 0 ? `+${e.quantityIn}` : '-'}</td>
                      <td style={{ color: '#dc2626', fontWeight: 700 }}>{e.quantityOut > 0 ? `-${e.quantityOut}` : '-'}</td>
                      <td style={{ fontWeight: 800 }}>{e.balanceQuantityAfter}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{e.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
};
