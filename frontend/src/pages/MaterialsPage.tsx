import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  FileDown,
  Edit2,
  Eye,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';
import { Material, MaterialCategory, Department, User } from '../types';
import { Modal } from '../components/ModalAndPrintables';

export const MaterialsPage: React.FC<{ user: User | null }> = ({ user }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [formData, setFormData] = useState({
    materialCode: '',
    materialName: '',
    categoryId: '',
    defaultUom: 'KG',
    minStockLevel: 0,
    reorderLevel: 0,
    maxStockLevel: 0,
    monthlyRequirement: 0,
    userDepartmentId: '',
    standardPrice: 0,
    revisedPrice: 0,
    primarySupplierName: '',
    openingStock: 0
  });
  const [errorMsg, setErrorMsg] = useState('');

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const [matRes, catRes, deptRes] = await Promise.all([
        api.get('/stock/summary', {
          params: {
            search: search || undefined,
            categoryId: selectedCategory || undefined,
            deptId: selectedDept || undefined
          }
        }),
        api.get('/materials/categories'),
        api.get('/materials/departments')
      ]);
      setMaterials(matRes.data);
      setCategories(catRes.data);
      setDepartments(deptRes.data);
    } catch (err) {
      console.error('Error fetching materials', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [search, selectedCategory, selectedDept]);

  const handleOpenAdd = () => {
    setEditingMaterial(null);
    setFormData({
      materialCode: '',
      materialName: '',
      categoryId: '',
      defaultUom: 'KG',
      minStockLevel: 0,
      reorderLevel: 0,
      maxStockLevel: 0,
      monthlyRequirement: 0,
      userDepartmentId: '',
      standardPrice: 0,
      revisedPrice: 0,
      primarySupplierName: '',
      openingStock: 0
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: Material) => {
    setEditingMaterial(m);
    setFormData({
      materialCode: m.materialCode,
      materialName: m.materialName,
      categoryId: m.categoryId ? String(m.categoryId) : '',
      defaultUom: m.defaultUom || 'KG',
      minStockLevel: (m as any).minStockLevel || 0,
      reorderLevel: m.reorderLevel,
      maxStockLevel: (m as any).maxStockLevel || 0,
      monthlyRequirement: m.monthlyRequirement,
      userDepartmentId: m.userDepartmentId ? String(m.userDepartmentId) : '',
      standardPrice: m.standardPrice,
      revisedPrice: m.revisedPrice,
      primarySupplierName: m.primarySupplierName || '',
      openingStock: (m as any).currentStock || 0
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const payload = {
        materialCode: formData.materialCode,
        materialName: formData.materialName,
        categoryId: formData.categoryId ? parseInt(formData.categoryId) : null,
        defaultUom: formData.defaultUom,
        minStockLevel: Number(formData.minStockLevel),
        reorderLevel: Number(formData.reorderLevel),
        maxStockLevel: Number(formData.maxStockLevel),
        monthlyRequirement: Number(formData.monthlyRequirement),
        userDepartmentId: formData.userDepartmentId ? parseInt(formData.userDepartmentId) : null,
        standardPrice: Number(formData.standardPrice),
        revisedPrice: Number(formData.revisedPrice),
        primarySupplierName: formData.primarySupplierName,
        openingStock: Number(formData.openingStock) || 0
      };

      if (editingMaterial) {
        await api.put(`/materials/${editingMaterial.id}`, payload);
      } else {
        await api.post('/materials', payload);
      }
      setIsModalOpen(false);
      fetchMaterials();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to save material.');
    }
  };

  const canEdit = user?.role === 'Admin' || user?.role === 'StoreManager';

  const handleDownloadExcel = async () => {
    try {
      const res = await api.get('/reports/stock/excel', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `AMAC_Material_Master_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download error', err);
      alert('Failed to download material catalog.');
    }
  };

  return (
    <div className="page-wrapper">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Material Master Catalogue</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Unified registry of all 179 materials, categories, units of measure & standard pricing
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={handleDownloadExcel} className="btn btn-secondary btn-sm">
            <FileDown size={15} /> Export Excel
          </button>
          {canEdit && (
            <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
              <Plus size={15} /> Add New Material
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              style={{ paddingLeft: '36px' }}
              placeholder="Search Code or Name (e.g. M001)..."
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
              <option value="">All Categories (17)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              className="form-control"
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              <option value="">All Departments (8)</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Material Code</th>
              <th>Material Description</th>
              <th>Category</th>
              <th>Dept</th>
              <th>UOM</th>
              <th>Reorder Lvl</th>
              <th>Monthly Req</th>
              <th>Std Price (₹)</th>
              <th>Primary Supplier</th>
              <th>Status</th>
              {canEdit && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '30px' }}>Loading materials...</td>
              </tr>
            ) : materials.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '30px' }}>No materials matching filters.</td>
              </tr>
            ) : (
              materials.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{m.materialCode}</td>
                  <td style={{ fontWeight: 600 }}>{m.materialName}</td>
                  <td><span className="badge" style={{ background: 'var(--border-light)', color: 'var(--text-secondary)' }}>{m.categoryName || 'N/A'}</span></td>
                  <td>{m.userDepartmentName || 'ALL'}</td>
                  <td style={{ fontWeight: 600 }}>{m.defaultUom}</td>
                  <td>{m.reorderLevel.toLocaleString()}</td>
                  <td>{m.monthlyRequirement.toLocaleString()}</td>
                  <td style={{ fontWeight: 700 }}>₹{m.standardPrice.toFixed(2)}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.primarySupplierName || '-'}</td>
                  <td>
                    {m.stockStatus === 'Normal' && <span className="badge badge-normal">Normal</span>}
                    {m.stockStatus === 'LowStock' && <span className="badge badge-low">Low Stock</span>}
                    {m.stockStatus === 'OutOfStock' && <span className="badge badge-outofstock">Out of Stock</span>}
                    {m.stockStatus === 'ExcessStock' && <span className="badge badge-excess">Excess Stock</span>}
                  </td>
                  {canEdit && (
                    <td>
                      <button
                        className="btn-icon btn-secondary"
                        onClick={() => handleOpenEdit(m)}
                        title="Edit Material"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMaterial ? `Edit Material: ${editingMaterial.materialCode}` : 'Add New Material Master'}
        size="lg"
      >
        <form onSubmit={handleSave}>
          {errorMsg && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
              <AlertCircle size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              {errorMsg}
            </div>
          )}

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Material Code *</label>
              <input
                type="text"
                className="form-control"
                required
                disabled={!!editingMaterial}
                placeholder="e.g. M001, M050"
                value={formData.materialCode}
                onChange={(e) => setFormData({ ...formData, materialCode: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Material Description / Name *</label>
              <input
                type="text"
                className="form-control"
                required
                placeholder="e.g. ALSI7MG INGOT"
                value={formData.materialName}
                onChange={(e) => setFormData({ ...formData, materialName: e.target.value })}
              />
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-control"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">Select Category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">User Department</label>
              <select
                className="form-control"
                value={formData.userDepartmentId}
                onChange={(e) => setFormData({ ...formData, userDepartmentId: e.target.value })}
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Unit of Measure (UOM)</label>
              <select
                className="form-control"
                value={formData.defaultUom}
                onChange={(e) => setFormData({ ...formData, defaultUom: e.target.value })}
              >
                <option value="KG">KG</option>
                <option value="NOS">NOS</option>
                <option value="SET">SET</option>
                <option value="LTR">LTR</option>
                <option value="PKT">PKT</option>
                <option value="MTR">MTR</option>
                <option value="BAG">BAG</option>
              </select>
            </div>
          </div>

          {/* Initial Opening Stock Section */}
          <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', margin: '14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Boxes size={16} color="#059669" /> Initial Opening Stock Balance ({formData.defaultUom})
                </label>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {editingMaterial
                    ? 'Current active system inventory level (Adjustments must be done via Stock Adjustment module).'
                    : 'Enter physical starting inventory available in store when adding this material for the first time.'}
                </span>
              </div>
              {!editingMaterial && Number(formData.openingStock) > 0 && (
                <div style={{ textAlign: 'right', fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>
                  Opening Valuation: ₹{((Number(formData.openingStock) || 0) * (Number(formData.standardPrice) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
              )}
            </div>

            <div className="form-grid-2">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  Starting Opening Quantity ({formData.defaultUom})
                </label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  disabled={!!editingMaterial}
                  placeholder="e.g. 1500"
                  value={formData.openingStock}
                  onChange={(e) => setFormData({ ...formData, openingStock: parseFloat(e.target.value) || 0 })}
                  style={{ fontWeight: 700, fontSize: '0.9rem', color: '#059669' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  Calculated Opening Valuation (₹)
                </label>
                <input
                  type="text"
                  className="form-control"
                  disabled
                  value={`₹ ${((Number(formData.openingStock) || 0) * (Number(formData.standardPrice) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                  style={{ fontWeight: 700, background: 'var(--bg-card)' }}
                />
              </div>
            </div>
          </div>

          <div className="form-grid-3">
            <div className="form-group">
              <label className="form-label">Min Stock Level (Critical)</label>
              <input
                type="number"
                step="any"
                className="form-control"
                placeholder="e.g. 500"
                value={formData.minStockLevel}
                onChange={(e) => setFormData({ ...formData, minStockLevel: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Re-order Level Threshold (Safety Stock)</label>
              <input
                type="number"
                step="any"
                className="form-control"
                placeholder="e.g. 1000"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Max Stock Level (Overstock)</label>
              <input
                type="number"
                step="any"
                className="form-control"
                placeholder="e.g. 2000"
                value={formData.maxStockLevel}
                onChange={(e) => setFormData({ ...formData, maxStockLevel: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Standard Master Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 434.61"
                value={formData.standardPrice}
                onChange={(e) => setFormData({ ...formData, standardPrice: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Supplier Revised Price (₹)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                placeholder="e.g. 360.00"
                value={formData.revisedPrice}
                onChange={(e) => setFormData({ ...formData, revisedPrice: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Primary Supplier</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Vedanta Ltd / Supreme Metals"
                value={formData.primarySupplierName}
                onChange={(e) => setFormData({ ...formData, primarySupplierName: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <CheckCircle size={16} /> Save Material
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
