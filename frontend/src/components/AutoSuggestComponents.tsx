import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Check, Building, Package, X, Loader2, DollarSign, Tag, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { Supplier, Material, MaterialCategory } from '../types';
import { Modal } from './ModalAndPrintables';

interface AutoSuggestSupplierProps {
  suppliers: Supplier[];
  selectedSupplierId: string | number | null;
  onSelectSupplier: (supplier: Supplier | null) => void;
  onSupplierCreated?: (newSupplier: Supplier) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export const AutoSuggestSupplier: React.FC<AutoSuggestSupplierProps> = ({
  suppliers,
  selectedSupplierId,
  onSelectSupplier,
  onSupplierCreated,
  placeholder = 'Type supplier name to search...',
  className = '',
  required = false
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync selected supplier name into query on mount or external change
  useEffect(() => {
    if (selectedSupplierId) {
      const found = suppliers.find((s) => s.id.toString() === selectedSupplierId.toString());
      if (found) {
        setQuery(found.supplierName);
      }
    } else if (selectedSupplierId === '' || selectedSupplierId === null) {
      setQuery('');
    }
  }, [selectedSupplierId, suppliers]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSuppliers = suppliers.filter((s) =>
    s.supplierName.toLowerCase().includes(query.toLowerCase()) ||
    (s.contactPerson && s.contactPerson.toLowerCase().includes(query.toLowerCase())) ||
    (s.phone && s.phone.includes(query)) ||
    (s.gstNumber && s.gstNumber.toLowerCase().includes(query.toLowerCase()))
  );

  const handleSelect = (supp: Supplier) => {
    setQuery(supp.supplierName);
    onSelectSupplier(supp);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    onSelectSupplier(null);
    setIsOpen(false);
  };

  const handleSupplierCreated = (newSupp: Supplier) => {
    setQuery(newSupp.supplierName);
    onSelectSupplier(newSupp);
    if (onSupplierCreated) onSupplierCreated(newSupp);
    setIsQuickAddOpen(false);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }} className={className}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Building
          size={14}
          style={{
            position: 'absolute',
            left: '10px',
            color: 'var(--text-muted)',
            pointerEvents: 'none'
          }}
        />
        <input
          type="text"
          className="form-control"
          style={{
            paddingLeft: '32px',
            paddingRight: query ? '30px' : '10px',
            fontSize: '0.85rem',
            height: '36px'
          }}
          placeholder={placeholder}
          value={query}
          required={required && !selectedSupplierId}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            // If user deletes text, clear parent selection
            if (!e.target.value) {
              onSelectSupplier(null);
            }
          }}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              padding: '2px'
            }}
            title="Clear selection"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            maxHeight: '260px',
            overflowY: 'auto'
          }}
        >
          {/* Quick Add Supplier Action Button */}
          {query.trim().length > 0 && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(5, 150, 105, 0.08)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>
                Supplier not in list?
              </span>
              <button
                type="button"
                className="btn btn-emerald btn-sm"
                style={{ fontSize: '0.74rem', padding: '3px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={() => setIsQuickAddOpen(true)}
              >
                <Plus size={12} /> Add "{query}" as New Supplier
              </button>
            </div>
          )}

          {filteredSuppliers.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No existing supplier matching "<strong>{query}</strong>"
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: '#059669', borderColor: '#059669', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => setIsQuickAddOpen(true)}
                >
                  <Plus size={13} /> + Create New Supplier
                </button>
              </div>
            </div>
          ) : (
            filteredSuppliers.map((supp) => {
              const isSelected = selectedSupplierId?.toString() === supp.id.toString();
              return (
                <div
                  key={supp.id}
                  onClick={() => handleSelect(supp)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-light)',
                    background: isSelected ? 'rgba(5, 150, 105, 0.12)' : 'transparent',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isSelected ? '#059669' : 'var(--text-primary)' }}>
                      {supp.supplierName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {supp.contactPerson && <span>👤 {supp.contactPerson} • </span>}
                      {supp.phone && <span>📞 {supp.phone} • </span>}
                      {supp.gstNumber && <span>GST: {supp.gstNumber}</span>}
                    </div>
                  </div>
                  {isSelected && <Check size={14} color="#059669" />}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Quick Add Supplier Modal */}
      {isQuickAddOpen && (
        <QuickAddSupplierModal
          initialName={query}
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          onSupplierCreated={handleSupplierCreated}
        />
      )}
    </div>
  );
};

interface AutoSuggestMaterialProps {
  materials: Material[];
  selectedMaterialId: string | number | null;
  onSelectMaterial: (material: Material | null) => void;
  onMaterialCreated?: (newMaterial: Material) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export const AutoSuggestMaterial: React.FC<AutoSuggestMaterialProps> = ({
  materials,
  selectedMaterialId,
  onSelectMaterial,
  onMaterialCreated,
  placeholder = 'Type code or material name...',
  className = '',
  required = false
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync selected material name into query on mount or external change
  useEffect(() => {
    if (selectedMaterialId) {
      const found = materials.find((m) => m.id.toString() === selectedMaterialId.toString());
      if (found) {
        setQuery(`${found.materialCode} — ${found.materialName}`);
      }
    } else if (selectedMaterialId === '' || selectedMaterialId === null) {
      setQuery('');
    }
  }, [selectedMaterialId, materials]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMaterials = materials.filter((m) =>
    m.materialCode.toLowerCase().includes(query.toLowerCase()) ||
    m.materialName.toLowerCase().includes(query.toLowerCase()) ||
    (m.categoryName && m.categoryName.toLowerCase().includes(query.toLowerCase())) ||
    (m.defaultUom && m.defaultUom.toLowerCase().includes(query.toLowerCase()))
  );

  const handleSelect = (mat: Material) => {
    setQuery(`${mat.materialCode} — ${mat.materialName}`);
    onSelectMaterial(mat);
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    onSelectMaterial(null);
    setIsOpen(false);
  };

  const handleMaterialCreated = (newMat: Material) => {
    setQuery(`${newMat.materialCode} — ${newMat.materialName}`);
    onSelectMaterial(newMat);
    if (onMaterialCreated) onMaterialCreated(newMat);
    setIsQuickAddOpen(false);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }} className={className}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Package
          size={14}
          style={{
            position: 'absolute',
            left: '10px',
            color: 'var(--text-muted)',
            pointerEvents: 'none'
          }}
        />
        <input
          type="text"
          className="form-control"
          style={{
            paddingLeft: '30px',
            paddingRight: query ? '28px' : '8px',
            fontSize: '0.82rem',
            height: '34px'
          }}
          placeholder={placeholder}
          value={query}
          required={required && !selectedMaterialId}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (!e.target.value) {
              onSelectMaterial(null);
            }
          }}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '6px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              padding: '2px'
            }}
            title="Clear selection"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            maxHeight: '260px',
            overflowY: 'auto',
            minWidth: '320px'
          }}
        >
          {/* Quick Add Material Action Button */}
          {query.trim().length > 0 && (
            <div
              style={{
                padding: '6px 10px',
                background: 'rgba(5, 150, 105, 0.08)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ fontSize: '0.74rem', color: '#059669', fontWeight: 600 }}>
                Material not in master?
              </span>
              <button
                type="button"
                className="btn btn-emerald btn-sm"
                style={{ fontSize: '0.72rem', padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                onClick={() => setIsQuickAddOpen(true)}
              >
                <Plus size={11} /> Add "{query}" as New Material
              </button>
            </div>
          )}

          {filteredMaterials.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No material matching "<strong>{query}</strong>"
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: '#059669', borderColor: '#059669', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => setIsQuickAddOpen(true)}
                >
                  <Plus size={13} /> + Create New Material SKU
                </button>
              </div>
            </div>
          ) : (
            filteredMaterials.map((mat) => {
              const isSelected = selectedMaterialId?.toString() === mat.id.toString();
              return (
                <div
                  key={mat.id}
                  onClick={() => handleSelect(mat)}
                  style={{
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-light)',
                    background: isSelected ? 'rgba(5, 150, 105, 0.12)' : 'transparent',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          background: 'rgba(5, 150, 105, 0.15)',
                          color: '#059669'
                        }}
                      >
                        {mat.materialCode}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem', color: isSelected ? '#059669' : 'var(--text-primary)' }}>
                        {mat.materialName}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>{mat.categoryName || 'General'} • </span>
                      <span>UOM: <strong>{mat.defaultUom}</strong> • </span>
                      <span>Rate: <strong>₹{mat.standardPrice.toFixed(2)}</strong></span>
                    </div>
                  </div>
                  {isSelected && <Check size={14} color="#059669" />}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Quick Add Material Modal */}
      {isQuickAddOpen && (
        <QuickAddMaterialModal
          initialName={query}
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          onMaterialCreated={handleMaterialCreated}
        />
      )}
    </div>
  );
};

// ==========================================
// QUICK ADD SUPPLIER MODAL COMPONENT
// ==========================================
interface QuickAddSupplierModalProps {
  initialName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSupplierCreated: (supplier: Supplier) => void;
}

export const QuickAddSupplierModal: React.FC<QuickAddSupplierModalProps> = ({
  initialName = '',
  isOpen,
  onClose,
  onSupplierCreated
}) => {
  const [supplierName, setSupplierName] = useState(initialName);
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      setErrorMsg('Please enter a supplier name.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.post('/suppliers', {
        supplierName: supplierName.trim(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        gstNumber: gstNumber.trim() || undefined,
        address: address.trim() || undefined
      });
      onSupplierCreated(res.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create supplier.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Add New Supplier" size="md">
      <form onSubmit={handleSubmit}>
        {errorMsg && (
          <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {errorMsg}
          </div>
        )}

        <div className="form-group" style={{ marginBottom: '12px' }}>
          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
            Supplier / Vendor Name *
          </label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. Vedanta Aluminium Ltd"
            required
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-grid-2" style={{ marginBottom: '12px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.82rem' }}>Contact Person</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Rajesh Kumar"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.82rem' }}>Phone Number</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. +91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid-2" style={{ marginBottom: '12px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.82rem' }}>GSTIN Number</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 27AAAAA0000A1Z5"
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.82rem' }}>Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="e.g. sales@vendor.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '18px' }}>
          <label className="form-label" style={{ fontSize: '0.82rem' }}>City / Factory Address</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. Plot 18, MIDC Bhosari, Pune"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={loading || !supplierName.trim()}
            style={{ background: '#059669', borderColor: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {loading ? 'Saving Supplier...' : 'Save & Select Supplier'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ==========================================
// QUICK ADD MATERIAL SKU MODAL COMPONENT
// ==========================================
interface QuickAddMaterialModalProps {
  initialName?: string;
  isOpen: boolean;
  onClose: () => void;
  onMaterialCreated: (material: Material) => void;
}

export const QuickAddMaterialModal: React.FC<QuickAddMaterialModalProps> = ({
  initialName = '',
  isOpen,
  onClose,
  onMaterialCreated
}) => {
  const [materialCode, setMaterialCode] = useState('');
  const [materialName, setMaterialName] = useState(initialName);
  const [categoryId, setCategoryId] = useState<string>('');
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [defaultUom, setDefaultUom] = useState('KG');
  const [standardPrice, setStandardPrice] = useState<number>(0);
  const [openingStock, setOpeningStock] = useState<number>(0);
  const [reorderLevel, setReorderLevel] = useState<number>(100);
  const [monthlyRequirement, setMonthlyRequirement] = useState<number>(500);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Generate suggested code (e.g. M + random digits or fetch latest)
    const codeGuess = `M${Math.floor(100 + Math.random() * 900)}`;
    setMaterialCode(codeGuess);

    // Fetch categories
    api.get('/materials/categories')
      .then((res) => {
        setCategories(res.data);
        if (res.data.length > 0) {
          setCategoryId(res.data[0].id.toString());
        }
      })
      .catch((err) => console.error('Error loading categories', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialCode.trim() || !materialName.trim()) {
      setErrorMsg('Please enter both a material code and description.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.post('/materials', {
        materialCode: materialCode.trim().toUpperCase(),
        materialName: materialName.trim(),
        categoryId: categoryId ? parseInt(categoryId) : null,
        defaultUom: defaultUom.trim() || 'KG',
        standardPrice: Number(standardPrice) || 0,
        revisedPrice: Number(standardPrice) || 0,
        reorderLevel: Number(reorderLevel) || 0,
        monthlyRequirement: Number(monthlyRequirement) || 0,
        openingStock: Number(openingStock) || 0
      });
      onMaterialCreated(res.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create material.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Add New Material SKU" size="md">
      <form onSubmit={handleSubmit}>
        {errorMsg && (
          <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {errorMsg}
          </div>
        )}

        <div className="form-grid-2" style={{ marginBottom: '12px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
              Material Code *
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. M180"
              required
              value={materialCode}
              onChange={(e) => setMaterialCode(e.target.value.toUpperCase())}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
              Unit of Measurement (UOM) *
            </label>
            <select
              className="form-control"
              value={defaultUom}
              onChange={(e) => setDefaultUom(e.target.value)}
            >
              <option value="KG">KG (Kilograms)</option>
              <option value="NOS">NOS (Numbers / Pieces)</option>
              <option value="LTR">LTR (Litres)</option>
              <option value="BAG">BAG (Bags / Sacks)</option>
              <option value="SET">SET (Sets)</option>
              <option value="MTR">MTR (Metres)</option>
              <option value="DRUM">DRUM (Drums / Barrels)</option>
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '12px' }}>
          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>
            Material Description / Name *
          </label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. LM24 Aluminium Ingot / Cold Box Resin"
            required
            value={materialName}
            onChange={(e) => setMaterialName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-grid-2" style={{ marginBottom: '12px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.82rem' }}>Category</label>
            <select
              className="form-control"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.82rem' }}>Standard Unit Price (₹) *</label>
            <input
              type="number"
              step="0.01"
              className="form-control"
              placeholder="e.g. 245.00"
              required
              value={standardPrice || ''}
              onChange={(e) => setStandardPrice(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="form-grid-2" style={{ marginBottom: '12px', background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669' }}>
              Initial Opening Stock ({defaultUom})
            </label>
            <input
              type="number"
              step="any"
              className="form-control"
              placeholder="e.g. 500"
              value={openingStock || ''}
              onChange={(e) => setOpeningStock(parseFloat(e.target.value) || 0)}
              style={{ fontWeight: 700, color: '#059669' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.82rem' }}>Opening Valuation (₹)</label>
            <input
              type="text"
              className="form-control"
              disabled
              value={`₹ ${((Number(openingStock) || 0) * (Number(standardPrice) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
              style={{ fontWeight: 700, background: 'var(--bg-card)' }}
            />
          </div>
        </div>

        <div className="form-grid-2" style={{ marginBottom: '18px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.82rem' }}>Reorder Level Threshold</label>
            <input
              type="number"
              className="form-control"
              placeholder="e.g. 1000"
              value={reorderLevel || ''}
              onChange={(e) => setReorderLevel(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.82rem' }}>Monthly Requirement Plan</label>
            <input
              type="number"
              className="form-control"
              placeholder="e.g. 5000"
              value={monthlyRequirement || ''}
              onChange={(e) => setMonthlyRequirement(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={loading || !materialName.trim()}
            style={{ background: '#059669', borderColor: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {loading ? 'Creating Material...' : 'Save & Select Material'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
