import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, PenTool, Upload, Trash2 } from 'lucide-react';
import api from '../services/api';
import { MaterialIssue, PurchaseRequest } from '../types';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal-content ${size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button
            onClick={onClose}
            className="btn-icon btn-secondary"
            style={{ border: 'none', background: 'none', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>,
    document.body
  );
};

/**
 * Isolated single-page and multi-page printing engine that extracts ONLY the printable document node,
 * injecting it into a clean, detached print iframe with exact A4 styles, crisp borders, and zero UI artifacts.
 */
export const printElement = (element: HTMLElement | null, title: string = 'Print Document', isLandscape: boolean = false) => {
  if (!element) return;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
            margin: 8mm;
          }
          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 0;
            color: #0f172a;
            background: #ffffff;
            font-size: 0.82rem;
            line-height: 1.35;
          }
          .printable-document {
            width: 100%;
            border: 2px solid #0f172a;
            padding: 16px 18px;
            background: #fff;
            box-sizing: border-box;
          }
          .print-header {
            text-align: center;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 10px;
            margin-bottom: 12px;
          }
          .print-header h2 {
            font-size: 1.25rem;
            margin: 0 0 3px 0;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.2px;
          }
          .print-header p {
            font-size: 0.78rem;
            margin: 0 0 3px 0;
            color: #334155;
          }
          .print-meta-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px 12px;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #cbd5e1;
            font-size: 0.8rem;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 0.76rem;
            page-break-inside: auto;
          }
          table, th, td {
            border: 1px solid #0f172a;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            padding: 6px 8px;
            font-weight: 700;
            text-align: left;
          }
          td {
            padding: 5px 8px;
            color: #0f172a !important;
          }
          tfoot tr {
            background-color: #f8fafc !important;
            font-weight: 800;
          }
          .print-signatures {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
            margin-top: 32px;
            text-align: center;
            page-break-inside: avoid;
          }
          .print-sig-box {
            border-top: 1px dashed #0f172a;
            padding-top: 6px;
            font-weight: 600;
            font-size: 0.76rem;
          }
          .no-print, button, .pbi-modal-footer, .modal-header.no-print {
            display: none !important;
          }
          .pbi-table {
            width: 100%;
            border-collapse: collapse;
          }
          .pbi-table th, .pbi-table td {
            border: 1px solid #cbd5e1;
            padding: 5px 8px;
          }
          .pbi-table th {
            background: #f1f5f9 !important;
            font-weight: 700;
          }
          .text-emerald { color: #059669 !important; }
          .text-blue { color: #2563eb !important; }
          .text-purple { color: #6366f1 !important; }
          .text-amber { color: #d97706 !important; }
          .text-red { color: #dc2626 !important; }
        </style>
      </head>
      <body>
        ${element.outerHTML}
      </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1500);
  }, 250);
};

export const PrintableIssueSlip: React.FC<{ issue: MaterialIssue; onClose: () => void }> = ({
  issue,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isQuickSigOpen, setIsQuickSigOpen] = useState(false);
  const [sigRole, setSigRole] = useState<'indentor' | 'plant_manager' | 'store_incharge'>('store_incharge');
  const [quickSigPreview, setQuickSigPreview] = useState<string>('');
  const [quickSigMsg, setQuickSigMsg] = useState('');
  const [quickSigError, setQuickSigError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Retrieve current logged-in user safely
  const currentUser: any = (() => {
    try {
      const uStr = localStorage.getItem('store_user');
      if (uStr) return JSON.parse(uStr);
    } catch {}
    return null;
  })();

  const isAdmin = currentUser?.role === 'Admin';
  const isStoreManager = currentUser?.role === 'StoreManager';

  // Identity & Governance Checks
  const isSupervisorAuthorized = isAdmin || Boolean(currentUser && (
    (currentUser.fullName && issue.supervisorName && (
      currentUser.fullName.trim().toLowerCase() === issue.supervisorName.trim().toLowerCase() ||
      currentUser.fullName.toLowerCase().includes(issue.supervisorName.toLowerCase()) ||
      issue.supervisorName.toLowerCase().includes(currentUser.fullName.toLowerCase())
    )) ||
    (currentUser.username && issue.supervisorName && currentUser.username.trim().toLowerCase() === issue.supervisorName.trim().toLowerCase()) ||
    (currentUser.departmentName && issue.departmentName && currentUser.departmentName.trim().toLowerCase() === issue.departmentName.trim().toLowerCase() && currentUser.role === 'DepartmentUser')
  ));

  const isPlantManagerAuthorized = isAdmin || isStoreManager;

  const isStoreInChargeAuthorized = isAdmin || isStoreManager || Boolean(currentUser && (
    (currentUser.fullName && issue.issuedBy && currentUser.fullName.trim().toLowerCase() === issue.issuedBy.trim().toLowerCase()) ||
    (currentUser.username && issue.issuedBy && currentUser.username.trim().toLowerCase() === issue.issuedBy.trim().toLowerCase())
  ));

  const isCurrentRoleAuthorized =
    sigRole === 'indentor' ? isSupervisorAuthorized :
    sigRole === 'plant_manager' ? isPlantManagerAuthorized :
    isStoreInChargeAuthorized;

  const targetSignatoryName =
    sigRole === 'indentor' ? (issue.supervisorName || 'Department Supervisor') :
    sigRole === 'plant_manager' ? 'HOD / Plant Head' :
    (issue.issuedBy || 'Store In-Charge');

  const handlePrint = () => {
    printElement(printRef.current);
  };

  const renderRemarks = (remarks: string) => {
    if (!remarks) return '-';
    
    if (remarks.includes('FIFO Issue: Consumed')) {
      const parts = remarks.split('. ');
      const consumeText = parts.find(p => p.includes('FIFO Issue: Consumed'));
      const otherText = parts.filter(p => !p.includes('FIFO Issue: Consumed')).join('. ');
      
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ background: '#f8fafc', border: '1px dashed #94a3b8', color: '#0f172a', padding: '4px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
            {consumeText?.replace('FIFO Issue: ', '')}
          </div>
          {otherText && <div style={{ fontSize: '0.75rem', color: '#334155' }}>{otherText}</div>}
        </div>
      );
    }
    
    return remarks;
  };

  // 1. Resolve supervisor digital signature
  const activeSupervisorSignature = issue.supervisorSignature ||
    (issue.supervisorName ? localStorage.getItem(`sig_sup_${issue.supervisorName.toLowerCase().replace(/\s+/g, '_')}`) : null) ||
    (issue.departmentId ? localStorage.getItem(`sig_dept_${issue.departmentId}`) : null) ||
    localStorage.getItem('dept_current_signature');

  // 2. Resolve HOD / Plant Manager digital signature
  const activePlantManagerSignature =
    localStorage.getItem('sig_plant_manager') ||
    localStorage.getItem('sig_hod') ||
    null;
  const plantManagerTitle = localStorage.getItem('sig_plant_manager_name') || 'Authorized Signatory';

  // 3. Resolve Store In-Charge / Administrator digital signature
  const issuedByName = issue.issuedBy || 'System Administrator';
  const activeStoreInChargeSignature =
    (issue.issuedBy ? localStorage.getItem(`sig_user_${issue.issuedBy.toLowerCase().replace(/\s+/g, '_')}`) : null) ||
    localStorage.getItem('sig_store_incharge') ||
    localStorage.getItem('sig_admin') ||
    localStorage.getItem('sig_user_admin') ||
    (issue.issuedBy ? localStorage.getItem(`sig_sup_${issue.issuedBy.toLowerCase().replace(/\s+/g, '_')}`) : null) ||
    null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isCurrentRoleAuthorized) {
      setQuickSigError(`Security Guard: Only ${targetSignatoryName} can upload their verified signature.`);
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setQuickSigPreview(reader.result.toString());
        setQuickSigError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveQuickSig = async () => {
    if (!isCurrentRoleAuthorized) {
      setQuickSigError(`Security Guard: You cannot modify signatures for other persons.`);
      return;
    }
    if (!quickSigPreview) return;
    try {
      if (sigRole === 'store_incharge') {
        localStorage.setItem('sig_store_incharge', quickSigPreview);
        localStorage.setItem('sig_admin', quickSigPreview);
        if (issue.issuedBy) {
          localStorage.setItem(`sig_user_${issue.issuedBy.toLowerCase().replace(/\s+/g, '_')}`, quickSigPreview);
        }
        await api.put('/system/config', { StoreInChargeSignature: quickSigPreview }).catch(() => {});
      } else if (sigRole === 'plant_manager') {
        localStorage.setItem('sig_plant_manager', quickSigPreview);
        localStorage.setItem('sig_hod', quickSigPreview);
        await api.put('/system/config', { PlantManagerSignature: quickSigPreview }).catch(() => {});
      } else if (sigRole === 'indentor') {
        if (issue.supervisorName) {
          localStorage.setItem(`sig_sup_${issue.supervisorName.toLowerCase().replace(/\s+/g, '_')}`, quickSigPreview);
          await api.post('/supervisors/signature', {
            supervisorName: issue.supervisorName,
            department: issue.departmentName,
            signatureDataUrl: quickSigPreview
          }).catch(() => {});
        }
        if (issue.departmentId) {
          localStorage.setItem(`sig_dept_${issue.departmentId}`, quickSigPreview);
        }
      }
      setQuickSigMsg('🎉 Verified digital signature saved & applied!');
      setTimeout(() => {
        setIsQuickSigOpen(false);
        setQuickSigMsg('');
      }, 1000);
    } catch (err: any) {
      setQuickSigError(err.response?.data?.message || 'Failed to save signature.');
    }
  };

  const openSigManager = () => {
    setQuickSigError('');
    setQuickSigMsg('');
    let defaultRole: 'indentor' | 'plant_manager' | 'store_incharge' = 'store_incharge';
    if (isSupervisorAuthorized && !isStoreInChargeAuthorized) {
      defaultRole = 'indentor';
    } else if (isStoreInChargeAuthorized) {
      defaultRole = 'store_incharge';
    } else if (isPlantManagerAuthorized) {
      defaultRole = 'plant_manager';
    }
    setSigRole(defaultRole);
    setQuickSigPreview(
      defaultRole === 'store_incharge' ? (activeStoreInChargeSignature || '') :
      defaultRole === 'plant_manager' ? (activePlantManagerSignature || '') :
      (activeSupervisorSignature || '')
    );
    setIsQuickSigOpen(true);
  };

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-content modal-lg">
        <div className="modal-header no-print">
          <h3>Print Material Issue Slip</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={openSigManager}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              title="Upload / Manage your verified digital signature"
            >
              <PenTool size={15} color="#059669" />
              ✍️ My Signature
            </button>
            <button className="btn btn-primary btn-sm" onClick={handlePrint}>
              <Printer size={16} /> Print Document
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              <X size={16} /> Close
            </button>
          </div>
        </div>

        <div className="printable-document" ref={printRef}>
          <div className="print-header">
            <h2>ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD</h2>
            <p>UNIT-5: No.306, Sompura Industrial Area Nidavanta, Dabspet, Bangalore - 562 132</p>
            <h3 style={{ marginTop: '8px', textDecoration: 'underline', color: '#0f172a' }}>
              MATERIAL ISSUE SLIP / INDENT
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
              <span>DOC NO: KDC-STR-FF-09</span>
              <span>REV: 01</span>
              <span>REV DATE: 01.04.2022</span>
            </div>
          </div>

          <div className="print-meta-grid">
            <div>
              <strong>SLIP NO:</strong> {issue.issueSlipNumber}
            </div>
            <div>
              <strong>ISSUE DATE:</strong> {new Date(issue.issueDate).toLocaleDateString()}
            </div>
            <div>
              <strong>SHIFT:</strong> {issue.shift || 'General'}
            </div>
            <div>
              <strong>FROM:</strong> STORES DEPARTMENT
            </div>
            <div>
              <strong>TO (DEPT):</strong> {issue.departmentName || 'PRODUCTION'}
            </div>
            <div>
              <strong>SUPERVISOR / USER:</strong> {issue.supervisorName || 'N/A'}
            </div>
            <div>
              <strong>PURPOSE:</strong> {issue.purpose || 'Production Consumption'}
            </div>
            <div>
              <strong>ISSUED TO:</strong> {issue.issuedTo || 'Shop Floor'}
            </div>
            <div>
              <strong>ISSUED BY:</strong> {issue.issuedBy || 'System Administrator'}
            </div>
          </div>

          <table className="data-table" style={{ marginTop: '10px', border: '1px solid #0f172a' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center' }}>S.NO</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px' }}>ITEM CODE</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px' }}>MATERIAL DESCRIPTION</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center' }}>UOM</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>REQD QTY</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>ISSUED QTY</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px' }}>LOCATION</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px' }}>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {issue.items && issue.items.length > 0 ? (
                issue.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', fontWeight: 600 }}>{item.materialCode}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px' }}>{item.materialName}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center' }}>{item.uom || 'KG'}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>{item.requestedQuantity}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right', fontWeight: 700 }}>{item.issuedQuantity}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px' }}>{item.location || 'Store Bin'}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', minWidth: '220px' }}>{renderRemarks(item.remarks || '')}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '10px' }}>No items recorded.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="print-signatures" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginTop: '20px' }}>
            {/* SIGNATURE 1: REQUESTED BY (Supervisor / Indentor) */}
            <div className="print-sig-box" style={{ minHeight: '90px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', padding: '6px' }}>
              {activeSupervisorSignature ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginBottom: '2px' }}>
                  <img
                    src={activeSupervisorSignature}
                    alt="Supervisor Signature"
                    style={{ maxHeight: '45px', maxWidth: '140px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                  />
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', borderTop: '1px solid #0f172a', width: '85%', paddingTop: '2px', textAlign: 'center', marginTop: '2px' }}>
                    {issue.supervisorName || 'Supervisor'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>REQUESTED BY (Indentor)</div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.75rem', marginBottom: '18px' }}>{issue.supervisorName || 'SUPERVISOR'}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', borderTop: '1px dashed #cbd5e1', paddingTop: '4px', width: '85%', margin: '0 auto' }}>
                    REQUESTED BY (Supervisor Signature)
                  </div>
                </div>
              )}
            </div>

            {/* SIGNATURE 2: AUTHORIZED BY (HOD / Plant Manager) */}
            <div className="print-sig-box" style={{ minHeight: '90px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', padding: '6px' }}>
              {activePlantManagerSignature ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginBottom: '2px' }}>
                  <img
                    src={activePlantManagerSignature}
                    alt="Plant Manager Signature"
                    style={{ maxHeight: '45px', maxWidth: '140px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                  />
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', borderTop: '1px solid #0f172a', width: '85%', paddingTop: '2px', textAlign: 'center', marginTop: '2px' }}>
                    {plantManagerTitle}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>AUTHORIZED BY (HOD / Plant Manager)</div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <div style={{ height: '30px' }}></div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', borderTop: '1px solid #0f172a', paddingTop: '4px', width: '85%', margin: '0 auto' }}>
                    AUTHORIZED BY<br />(HOD / Plant Manager)
                  </div>
                </div>
              )}
            </div>

            {/* SIGNATURE 3: ISSUED BY (Store In-Charge / System Administrator) */}
            <div className="print-sig-box" style={{ minHeight: '90px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', padding: '6px' }}>
              {activeStoreInChargeSignature ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', marginBottom: '2px' }}>
                  <img
                    src={activeStoreInChargeSignature}
                    alt="Store In-Charge Signature"
                    style={{ maxHeight: '45px', maxWidth: '140px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                  />
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', borderTop: '1px solid #0f172a', width: '85%', paddingTop: '2px', textAlign: 'center', marginTop: '2px' }}>
                    {issuedByName}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b' }}>ISSUED BY (Store In-Charge)</div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0f172a', height: '30px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    {issuedByName}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', borderTop: '1px solid #0f172a', paddingTop: '4px', width: '85%', margin: '0 auto' }}>
                    ISSUED BY<br />(Store In-Charge)
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QUICK SIGNATURE UPLOAD MODAL WITH IDENTITY PROTECTION */}
      {isQuickSigOpen && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="modal-content modal-md" style={{ background: '#ffffff', color: '#0f172a' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>
                  ✍️ Verified Digital Signature Management
                </h3>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                  Logged in as: <strong>{currentUser?.fullName || currentUser?.username || 'Staff'}</strong> ({currentUser?.role || 'User'})
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsQuickSigOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '12px 0' }}>
              {quickSigMsg && (
                <div style={{ padding: '8px 12px', background: '#d1fae5', color: '#065f46', borderRadius: '8px', marginBottom: '12px', fontSize: '0.84rem', fontWeight: 800 }}>
                  {quickSigMsg}
                </div>
              )}

              {quickSigError && (
                <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', marginBottom: '12px', fontSize: '0.84rem', fontWeight: 800 }}>
                  {quickSigError}
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ fontWeight: 800 }}>Select Signatory Role:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {/* Option 1: Store In-Charge */}
                  <button
                    type="button"
                    onClick={() => {
                      setSigRole('store_incharge');
                      setQuickSigPreview(activeStoreInChargeSignature || '');
                      setQuickSigError('');
                    }}
                    style={{
                      padding: '8px 6px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: sigRole === 'store_incharge' ? '#059669' : '#cbd5e1',
                      background: sigRole === 'store_incharge' ? 'rgba(5,150,105,0.1)' : '#ffffff',
                      color: sigRole === 'store_incharge' ? '#059669' : '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>1. Store In-Charge</span>
                    <span style={{ fontSize: '0.65rem', color: isStoreInChargeAuthorized ? '#059669' : '#94a3b8' }}>
                      {isStoreInChargeAuthorized ? '🟢 Verified (You)' : '🔒 Protected'}
                    </span>
                  </button>

                  {/* Option 2: Plant Manager */}
                  <button
                    type="button"
                    onClick={() => {
                      setSigRole('plant_manager');
                      setQuickSigPreview(activePlantManagerSignature || '');
                      setQuickSigError('');
                    }}
                    style={{
                      padding: '8px 6px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: sigRole === 'plant_manager' ? '#059669' : '#cbd5e1',
                      background: sigRole === 'plant_manager' ? 'rgba(5,150,105,0.1)' : '#ffffff',
                      color: sigRole === 'plant_manager' ? '#059669' : '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>2. HOD / Plant Head</span>
                    <span style={{ fontSize: '0.65rem', color: isPlantManagerAuthorized ? '#059669' : '#94a3b8' }}>
                      {isPlantManagerAuthorized ? '🟢 Verified (You)' : '🔒 Protected'}
                    </span>
                  </button>

                  {/* Option 3: Supervisor */}
                  <button
                    type="button"
                    onClick={() => {
                      setSigRole('indentor');
                      setQuickSigPreview(activeSupervisorSignature || '');
                      setQuickSigError('');
                    }}
                    style={{
                      padding: '8px 6px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: sigRole === 'indentor' ? '#059669' : '#cbd5e1',
                      background: sigRole === 'indentor' ? 'rgba(5,150,105,0.1)' : '#ffffff',
                      color: sigRole === 'indentor' ? '#059669' : '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>3. Supervisor ({issue.supervisorName || 'Indentor'})</span>
                    <span style={{ fontSize: '0.65rem', color: isSupervisorAuthorized ? '#059669' : '#94a3b8' }}>
                      {isSupervisorAuthorized ? '🟢 Verified (You)' : '🔒 Protected'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Identity Protection Guard or Upload Area */}
              {isCurrentRoleAuthorized ? (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileSelect}
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed #059669',
                      borderRadius: '10px',
                      padding: '18px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: '#f0fdf4',
                      marginBottom: '14px'
                    }}
                  >
                    <Upload size={24} color="#059669" style={{ margin: '0 auto 6px' }} />
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#065f46' }}>
                      Click to Browse Your Verified PNG Signature
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Transparent PNG format • Max 3MB
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', textAlign: 'center', marginBottom: '14px' }}>
                  <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.9rem', marginBottom: '4px' }}>
                    🔒 Identity Guard: Signatory Lock Active
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#7f1d1d', lineHeight: 1.4 }}>
                    You are currently logged in as <strong>{currentUser?.fullName || currentUser?.username || 'Staff'}</strong>.
                    <br />
                    Only <strong>{targetSignatoryName}</strong> or a System Administrator is permitted to upload or modify this signature.
                  </div>
                </div>
              )}

              {quickSigPreview && (
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px', textAlign: 'center', marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', marginBottom: '6px' }}>Current Signature Preview:</div>
                  <img
                    src={quickSigPreview}
                    alt="Preview"
                    style={{ maxHeight: '50px', maxWidth: '160px', objectFit: 'contain', margin: '0 auto', display: 'block' }}
                  />
                </div>
              )}

              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                {quickSigPreview && isCurrentRoleAuthorized ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setQuickSigPreview('')}
                  >
                    <Trash2 size={13} /> Clear
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsQuickSigOpen(false)}>
                    Close
                  </button>
                  {isCurrentRoleAuthorized && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveQuickSig}
                      style={{ background: '#059669', borderColor: '#059669', fontWeight: 800 }}
                    >
                      Save & Apply to Slip
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export const PrintablePurchaseRequest: React.FC<{ pr: PurchaseRequest; onClose: () => void }> = ({
  pr,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    printElement(printRef.current);
  };

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal-content modal-lg">
        <div className="modal-header no-print">
          <h3>Print Purchase Requisition</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary btn-sm" onClick={handlePrint}>
              <Printer size={16} /> Print PR Form
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              <X size={16} /> Close
            </button>
          </div>
        </div>

        <div className="printable-document" ref={printRef}>
          <div className="print-header">
            <h2>ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD</h2>
            <p>UNIT-5: No.306, Sompura Industrial Area Nidavanta, Dabspet, Bangalore - 562 132</p>
            <p>Tel. 9606082298, e-mail: kdcpurchase@amacpvt.com</p>
            <h3 style={{ marginTop: '8px', textDecoration: 'underline', color: '#0f172a' }}>
              PURCHASE REQUISITION FORM
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
              <span>FORMAT NO: GDC-PUR-FF-07</span>
              <span>REV NO: 02</span>
              <span>REV DATED: 01.04.2022</span>
            </div>
          </div>

          <div className="print-meta-grid">
            <div>
              <strong>PR NUMBER:</strong> {pr.prNumber}
            </div>
            <div>
              <strong>DATE:</strong> {new Date(pr.requestDate).toLocaleDateString()}
            </div>
            <div>
              <strong>DEPARTMENT:</strong> {pr.departmentName || 'PRODUCTION'}
            </div>
            <div>
              <strong>PRIORITY RATING:</strong> <span style={{ fontWeight: 800, color: pr.priority === 'Emergency' ? '#dc2626' : '#0f172a' }}>{pr.priority.toUpperCase()}</span>
            </div>
            <div>
              <strong>REQUIRED BY DATE:</strong> {pr.requiredByDate ? new Date(pr.requiredByDate).toLocaleDateString() : 'Immediate'}
            </div>
            <div>
              <strong>STATUS:</strong> {pr.status}
            </div>
            <div style={{ gridColumn: 'span 3' }}>
              <strong>PURPOSE / BRIEF USAGE:</strong> {pr.purpose || 'Material replenishment for ongoing production plan'}
            </div>
          </div>

          <table className="data-table" style={{ marginTop: '10px', border: '1px solid #0f172a' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ border: '1px solid #0f172a', padding: '6px' }}>S.NO</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px' }}>M-CODE</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px' }}>MATERIAL DESCRIPTION</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>AVL STOCK</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>REQD QTY</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>UNIT RATE (₹)</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>TOTAL RATE (₹)</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px' }}>PRESENT SUPPLIER</th>
              </tr>
            </thead>
            <tbody>
              {pr.items && pr.items.length > 0 ? (
                pr.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', fontWeight: 600 }}>{item.materialCode}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px' }}>{item.materialName}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>{item.availableStockAtRequest}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right', fontWeight: 700 }}>{item.requestedQuantity} {item.uom}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>₹{item.estimatedUnitPrice.toFixed(2)}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right', fontWeight: 700 }}>₹{item.totalAmount.toFixed(2)}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px' }}>{item.preferredSupplierName || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '10px' }}>No items recorded.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 800, background: '#f8fafc' }}>
                <td colSpan={6} style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>GRAND TOTAL ESTIMATED VALUE:</td>
                <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>₹{pr.totalEstimatedValue.toFixed(2)}</td>
                <td style={{ border: '1px solid #0f172a', padding: '6px' }}></td>
              </tr>
            </tfoot>
          </table>

          <div className="print-signatures" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="print-sig-box">
              PREPARED BY<br />(Store / Purchase)
            </div>
            <div className="print-sig-box">
              CHECKED BY<br />(Stores In-Charge)
            </div>
            <div className="print-sig-box">
              RECOMMENDED BY<br />(Head of Department)
            </div>
            <div className="print-sig-box">
              APPROVED BY<br />(Unit Head / Director)
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const PrintableGoodsReceiptNote: React.FC<{ receipt: any; onClose: () => void }> = ({
  receipt,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    printElement(printRef.current);
  };

  return createPortal(
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div className="modal-content modal-lg">
        <div className="modal-header no-print">
          <h3>Print Goods Receipt Note (GRN) & Inward Invoice</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary btn-sm" onClick={handlePrint}>
              <Printer size={16} /> Print Document
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              <X size={16} /> Close
            </button>
          </div>
        </div>

        <div className="printable-document" ref={printRef}>
          <div className="print-header">
            <h2>ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD</h2>
            <p>UNIT-5: No.306, Sompura Industrial Area Nidavanta, Dabspet, Bangalore - 562 132</p>
            <h3 style={{ marginTop: '8px', textDecoration: 'underline', color: '#0f172a' }}>
              GOODS RECEIPT NOTE (GRN) / INWARD INVOICE VOUCHER
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.78rem', fontWeight: 600 }}>
              <span>DOC NO: AMAC-STR-GRN-01</span>
              <span>REV: 01</span>
              <span>REV DATE: 01.04.2022</span>
            </div>
          </div>

          <div className="print-meta-grid">
            <div>
              <strong>GRN NUMBER:</strong> {receipt.grnNumber}
            </div>
            <div>
              <strong>GRN DATE:</strong> {new Date(receipt.receiptDate).toLocaleDateString()}
            </div>
            <div>
              <strong>SUPPLIER / VENDOR:</strong> {receipt.supplierName || 'N/A'}
            </div>
            <div>
              <strong>INVOICE NUMBER:</strong> {receipt.invoiceNumber || 'N/A'}
            </div>
            <div>
              <strong>INVOICE DATE:</strong> {receipt.invoiceDate ? new Date(receipt.invoiceDate).toLocaleDateString() : 'N/A'}
            </div>
            <div>
              <strong>PO NUMBER:</strong> {receipt.poNumber || 'Direct Inward'}
            </div>
            <div>
              <strong>DC NO / VEHICLE:</strong> {receipt.dcNumber || '-'} {receipt.vehicleNumber ? `(${receipt.vehicleNumber})` : ''}
            </div>
            <div>
              <strong>RECEIVED BY:</strong> {receipt.receivedBy || 'Stores In-Charge'}
            </div>
            <div>
              <strong>REMARKS / PURPOSE:</strong> {receipt.remarks || 'Inward Material Inspection'}
            </div>
          </div>

          <table className="data-table" style={{ marginTop: '10px', border: '1px solid #0f172a', width: '100%' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center' }}>S.NO</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px' }}>ITEM CODE</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px' }}>MATERIAL DESCRIPTION</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center' }}>UOM</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>RECEIVED QTY</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>UNIT RATE (₹)</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>TOTAL AMOUNT (₹)</th>
                <th style={{ border: '1px solid #0f172a', padding: '6px' }}>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items && receipt.items.length > 0 ? (
                receipt.items.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', fontWeight: 600 }}>{item.materialCode}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px' }}>{item.materialName}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'center' }}>{item.uom || 'KG'}</td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right', fontWeight: 700 }}>
                      {item.receivedQuantity}
                    </td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>
                      ₹{item.unitPrice.toFixed(2)}
                    </td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right', fontWeight: 700 }}>
                      ₹{item.totalAmount.toFixed(2)}
                    </td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px' }}>{item.remarks || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '10px' }}>No items recorded.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 800, background: '#f8fafc' }}>
                <td colSpan={6} style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>GRAND TOTAL INWARD INVOICE VALUE:</td>
                <td style={{ border: '1px solid #0f172a', padding: '6px', textAlign: 'right' }}>₹{receipt.totalAmount.toFixed(2)}</td>
                <td style={{ border: '1px solid #0f172a', padding: '6px' }}></td>
              </tr>
            </tfoot>
          </table>

          <div className="print-signatures" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="print-sig-box">
              RECEIVED BY<br />(Stores Operator)
            </div>
            <div className="print-sig-box">
              CHECKED & VERIFIED BY<br />(Stores In-Charge)
            </div>
            <div className="print-sig-box">
              QUALITY INSPECTED BY<br />(QC Engineer)
            </div>
            <div className="print-sig-box">
              ACCOUNTS ENTRY BY<br />(Finance Dept)
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
