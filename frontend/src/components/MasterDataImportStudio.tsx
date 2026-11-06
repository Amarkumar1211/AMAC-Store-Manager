import React, { useState, useRef } from 'react';
import {
  Download,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileCheck,
  TrendingUp,
  LayoutDashboard,
  Building2,
  Users,
  Boxes,
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Loader2,
  ShieldAlert,
  Info,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import api from '../services/api';

interface PreviewData {
  isValid: boolean;
  sheetCount: number;
  sheetNames: string[];
  detectedMaterialsCount: number;
  detectedSuppliersCount: number;
  detectedDepartmentsCount: number;
  detectedReceiptsCount: number;
  detectedIssuesCount: number;
  detectedProjectionsCount: number;
  totalOpeningStockValue: number;
  warnings: string[];
  errors: string[];
}

interface ImportResult {
  success: boolean;
  message: string;
  departmentsCreated: number;
  suppliersCreated: number;
  materialsUpserted: number;
  receiptsCreated: number;
  issuesCreated: number;
  projectionsCreated: number;
  batchesCreated: number;
  totalOpeningStockValuation: number;
  logs: string[];
  warnings: string[];
}

export const MasterDataImportStudio: React.FC<{
  onNavigateTab?: (tab: string) => void;
}> = ({ onNavigateTab }) => {
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [resetFirst, setResetFirst] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Download Master Template
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setErrorBanner(null);
    try {
      const res = await api.get('/master-data/template', {
        responseType: 'blob'
      });

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `AMAC_Master_Data_Onboarding_Template_${timestamp}.xlsx`;

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error('Error downloading template', err);
      setErrorBanner('Failed to download master template. Please check server connection.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // 2. Select & Inspect File
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xlsm')) {
      setErrorBanner('Please select a valid Excel file (.xlsx or .xlsm)');
      return;
    }

    setSelectedFile(file);
    setPreview(null);
    setImportResult(null);
    setErrorBanner(null);
    setIsInspecting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post('/master-data/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setPreview(res.data);
    } catch (err: any) {
      console.error('Error inspecting file', err);
      setErrorBanner(err.response?.data?.message || 'Failed to inspect Excel file. Please ensure sheets match the standard format.');
    } finally {
      setIsInspecting(false);
    }
  };

  // 3. Commit Master Import
  const handleCommitImport = async () => {
    if (!selectedFile) return;

    if (resetFirst) {
      const confirmReset = window.confirm(
        '⚠️ WARNING: You selected "Fresh Factory Reset & Clean Feed". This will delete all existing data before feeding from this Excel. Are you sure you want to proceed?'
      );
      if (!confirmReset) return;
    }

    setIsUploading(true);
    setErrorBanner(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('resetExistingFirst', resetFirst.toString());

      const res = await api.post('/master-data/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setImportResult(res.data);
    } catch (err: any) {
      console.error('Error uploading master data', err);
      setErrorBanner(err.response?.data?.message || 'Master data ingestion failed. Check warnings below.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetForm = () => {
    setSelectedFile(null);
    setPreview(null);
    setImportResult(null);
    setErrorBanner(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Hero Header Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.08) 0%, rgba(2, 132, 199, 0.08) 100%)',
          border: '1px solid rgba(5, 150, 105, 0.25)',
          padding: '24px',
          borderRadius: '12px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  background: '#059669',
                  color: '#fff',
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
                }}
              >
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.28rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Universal Master Excel Data Feeder & Onboarding Studio
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Feed your entire plant dataset (Material Master, Opening Stock, Suppliers, Departments, Supervisors, GRN Receipts, Issues, and Monthly Projections) in a single unified Excel spreadsheet.
                </p>
              </div>
            </div>

            {/* Feature Badges */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
              <span className="badge badge-success" style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Boxes size={13} /> Material Master & Opening Stock
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Building2 size={13} /> Suppliers & Vendors
              </span>
              <span className="badge badge-info" style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Users size={13} /> Departments & Supervisors
              </span>
              <span className="badge badge-warning" style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ArrowDownToLine size={13} /> Historical GRN Inwards
              </span>
              <span className="badge badge-purple" style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <ArrowUpRight size={13} /> Consumption Issues
              </span>
              <span className="badge badge-secondary" style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <TrendingUp size={13} /> Monthly Projections
              </span>
            </div>
          </div>

          {/* Download Official Template Button */}
          <div>
            <button
              className="btn btn-primary"
              style={{
                background: '#059669',
                borderColor: '#059669',
                fontWeight: 700,
                padding: '10px 18px',
                fontSize: '0.88rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)'
              }}
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
            >
              {downloadingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Download Master Template (.xlsx)
            </button>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '5px' }}>
              Includes 7 pre-formatted sheets with sample plant data
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorBanner && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#ef4444',
            fontSize: '0.85rem',
            fontWeight: 600
          }}
        >
          <AlertTriangle size={18} />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Execution Results View */}
      {importResult && (
        <div
          className="card"
          style={{
            background: 'var(--bg-secondary)',
            border: '2px solid #059669',
            padding: '24px',
            borderRadius: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#059669', color: '#fff', padding: '6px', borderRadius: '50%' }}>
                <Check size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#059669' }}>
                  {importResult.message}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  All ledger records, opening stocks, batches, and transactions have been recorded in the database.
                </span>
              </div>
            </div>

            <button className="btn btn-secondary btn-sm" onClick={handleResetForm}>
              <RefreshCw size={13} /> Feed Another File
            </button>
          </div>

          {/* Metrics Summary Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Materials Upserted</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>{importResult.materialsUpserted}</div>
            </div>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Opening Valuation</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0284c7', marginTop: '2px' }}>₹{importResult.totalOpeningStockValuation.toLocaleString()}</div>
            </div>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Suppliers Created</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>{importResult.suppliersCreated}</div>
            </div>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Depts & Supervisors</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>{importResult.departmentsCreated}</div>
            </div>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>GRN Receipts & Batches</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>{importResult.receiptsCreated} ({importResult.batchesCreated} Batches)</div>
            </div>
            <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Issues & Projections</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#7c3aed', marginTop: '2px' }}>{importResult.issuesCreated} Slips / {importResult.projectionsCreated} Plan</div>
            </div>
          </div>

          {/* Quick Navigation Jump Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', alignSelf: 'center' }}>Explore Live Data:</span>
            {onNavigateTab && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('materials')}>
                  <Boxes size={13} /> View Material Master <ChevronRight size={12} />
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('receipts')}>
                  <ArrowDownToLine size={13} /> View Inward GRNs <ChevronRight size={12} />
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('issues')}>
                  <ArrowUpRight size={13} /> View Material Issues <ChevronRight size={12} />
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => onNavigateTab('dashboard')}>
                  <LayoutDashboard size={13} /> View Executive Dashboard <ChevronRight size={12} />
                </button>
              </>
            )}
          </div>

          {/* Execution Log stream */}
          <div style={{ background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text-muted)' }}>Audit Execution Stream:</div>
            {importResult.logs.map((log, idx) => (
              <div key={idx} style={{ color: '#059669', marginBottom: '3px' }}>
                ✓ {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Wizard */}
      {!importResult && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 16px 0' }}>
            Step 1: Select or Drag & Drop Master Excel File (.xlsx)
          </h3>

          {/* Drag & Drop File Zone */}
          <div
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: '10px',
              padding: '36px 20px',
              textAlign: 'center',
              background: selectedFile ? 'rgba(5, 150, 105, 0.04)' : 'var(--bg-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept=".xlsx, .xlsm"
              onChange={handleFileChange}
            />

            <UploadCloud size={40} color={selectedFile ? '#059669' : 'var(--text-muted)'} style={{ margin: '0 auto 10px auto' }} />

            {selectedFile ? (
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#059669' }}>
                  {selectedFile.name}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {(selectedFile.size / 1024).toFixed(1)} KB • Ready for Ingestion
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '10px', fontSize: '0.72rem' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetForm();
                  }}
                >
                  Choose a Different File
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700 }}>
                  Click to Browse or Drag & Drop your Master Excel Sheet here
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Supports .xlsx or .xlsm workbooks with standard multi-sheet headers
                </div>
              </div>
            )}
          </div>

          {/* Inspection In-Progress */}
          {isInspecting && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', color: '#059669' }} />
              <div>Inspecting sheets, validating columns, and verifying stock totals...</div>
            </div>
          )}

          {/* Step 2: Live In-Memory Inspection Preview */}
          {preview && (
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileCheck size={16} /> Step 2: Excel Inspection & Verification
                </h4>
                <span className="badge badge-success">
                  {preview.sheetCount} Worksheets Verified
                </span>
              </div>

              {/* Detected Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Material Master Items</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>{preview.detectedMaterialsCount} SKUs</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Opening Stock Valuation</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0284c7' }}>₹{preview.totalOpeningStockValue.toLocaleString()}</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Suppliers & Vendors</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{preview.detectedSuppliersCount} Vendors</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Depts & Supervisors</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{preview.detectedDepartmentsCount} Depts</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Inward GRNs & Issues</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#d97706' }}>{preview.detectedReceiptsCount} GRNs / {preview.detectedIssuesCount} Issues</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Monthly Projections</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7c3aed' }}>{preview.detectedProjectionsCount} Items</div>
                </div>
              </div>

              {/* Detected Sheet Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>Detected Sheets:</span>
                {preview.sheetNames.map((s) => (
                  <span key={s} className="badge badge-secondary" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={11} color="#059669" /> {s}
                  </span>
                ))}
              </div>

              {/* Ingestion Mode Settings */}
              <div style={{ background: 'var(--bg-secondary)', padding: '14px 18px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                <div style={{ fontWeight: 800, fontSize: '0.82rem', marginBottom: '8px', color: 'var(--text-primary)' }}>
                  Step 3: Choose Ingestion Strategy & Commit
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={!resetFirst}
                      onChange={() => setResetFirst(false)}
                    />
                    <div>
                      <strong>Merge & Upsert Mode (Recommended)</strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Updates existing materials, adds new suppliers, and records new GRNs/Issues without deleting existing active records.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.82rem' }}>
                    <input
                      type="radio"
                      name="importMode"
                      checked={resetFirst}
                      onChange={() => setResetFirst(true)}
                    />
                    <div>
                      <strong style={{ color: '#ef4444' }}>Fresh Factory Reset & Complete Onboarding (Danger Zone)</strong>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Creates an automated pre-reset backup, wipes past dummy data, and cleanly seeds everything from this Excel sheet.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Commit Action */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={handleResetForm} disabled={isUploading}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  style={{
                    background: resetFirst ? '#ef4444' : '#059669',
                    borderColor: resetFirst ? '#ef4444' : '#059669',
                    fontWeight: 800,
                    padding: '10px 22px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: resetFirst ? '0 4px 14px rgba(239, 68, 68, 0.3)' : '0 4px 14px rgba(5, 150, 105, 0.3)'
                  }}
                  onClick={handleCommitImport}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : <FileCheck size={16} />}
                  {isUploading ? 'Ingesting Master Data...' : resetFirst ? 'Execute Reset & Feed Master Data' : 'Ingest & Commit Master Data'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Guide & Rules Reference Accordion */}
      <div className="card" style={{ padding: '20px' }}>
        <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Info size={16} color="#0284c7" /> Master Excel Sheet Architecture & Guidelines
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', fontSize: '0.78rem' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '6px', borderLeft: '3px solid #059669' }}>
            <strong>1. Material Master & Stock (Sheet 1):</strong>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
              Defines SKU codes (`M001`, `M002`), UOM, standard prices, reorder thresholds, and bin locations. The Opening Stock value is automatically seeded into the physical audit ledger.
            </p>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '6px', borderLeft: '3px solid #1e40af' }}>
            <strong>2. Suppliers & Vendors (Sheet 2):</strong>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
              Registers official vendors with GST numbers, contact persons, phones, and credit terms. Missing vendors in other sheets will be auto-created.
            </p>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '6px', borderLeft: '3px solid #7c3aed' }}>
            <strong>3. Departments & Supervisors (Sheet 3):</strong>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
              Used for department-wise material indents, shift consumptions, and authorization signature chains.
            </p>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '6px', borderLeft: '3px solid #047857' }}>
            <strong>4. Received Inwards / GRN (Sheet 4):</strong>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
              Records past and current Goods Receipt Notes. For ingots, specify `Batch / Heat Code` (e.g. `23aa`, `24aa`) to activate auto-pricing memory and batch ledgers.
            </p>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '6px', borderLeft: '3px solid #d97706' }}>
            <strong>5. Material Issues (Sheet 5):</strong>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
              Logs store consumption slips (`IS-2026-0801`) to deduct stock, allocate departmental costs, and calculate days-of-stock.
            </p>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '6px', borderLeft: '3px solid #0d9488' }}>
            <strong>6. Monthly Projections (Sheet 6):</strong>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
              Sets planned monthly requirement quotas and target safety stock buffers for predictive reorder alerts and purchase budgeting.
            </p>
          </div>
        </div>

        {/* Multi-Item Invoices & Issue Slips Visual Showcase */}
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <h5 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
            💡 How to Enter Multiple Materials for 1 Invoice or 1 Issue Slip:
          </h5>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '14px' }}>
            {/* GRN Example */}
            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#047857', marginBottom: '6px' }}>
                📥 1 Supplier Invoice with 3 Different Materials (GRN Sheet 4)
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                Repeat the <strong>same GRN Number & Invoice Number</strong> on each row, and change only the <strong>Material Code, Batch, and Qty</strong>:
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.68rem', borderCollapse: 'collapse', background: 'var(--bg-primary)' }}>
                  <thead>
                    <tr style={{ background: '#047857', color: '#fff', textAlign: 'left' }}>
                      <th style={{ padding: '4px 6px' }}>GRN No</th>
                      <th style={{ padding: '4px 6px' }}>Invoice No</th>
                      <th style={{ padding: '4px 6px' }}>Material Code</th>
                      <th style={{ padding: '4px 6px' }}>Batch</th>
                      <th style={{ padding: '4px 6px' }}>Qty</th>
                      <th style={{ padding: '4px 6px' }}>Rate (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 700 }}>GRN-2026-0001</td>
                      <td style={{ padding: '4px 6px', fontWeight: 700 }}>INV-9921</td>
                      <td style={{ padding: '4px 6px', color: '#059669', fontWeight: 700 }}>M001 (LM24)</td>
                      <td style={{ padding: '4px 6px' }}>23aa</td>
                      <td style={{ padding: '4px 6px' }}>3,000</td>
                      <td style={{ padding: '4px 6px' }}>425.00</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 700 }}>GRN-2026-0001</td>
                      <td style={{ padding: '4px 6px', fontWeight: 700 }}>INV-9921</td>
                      <td style={{ padding: '4px 6px', color: '#059669', fontWeight: 700 }}>M002 (AC2A)</td>
                      <td style={{ padding: '4px 6px' }}>24aa</td>
                      <td style={{ padding: '4px 6px' }}>1,500</td>
                      <td style={{ padding: '4px 6px' }}>450.00</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 6px', fontWeight: 700 }}>GRN-2026-0001</td>
                      <td style={{ padding: '4px 6px', fontWeight: 700 }}>INV-9921</td>
                      <td style={{ padding: '4px 6px', color: '#059669', fontWeight: 700 }}>M005 (ALSI9)</td>
                      <td style={{ padding: '4px 6px' }}>HT-88</td>
                      <td style={{ padding: '4px 6px' }}>2,000</td>
                      <td style={{ padding: '4px 6px' }}>420.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#059669', marginTop: '6px', fontWeight: 600 }}>
                ✓ Result: The system automatically generates 1 single GRN document with 3 line items totaling ₹27,85,000!
              </div>
            </div>

            {/* Issue Slip Example */}
            <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#d97706', marginBottom: '6px' }}>
                📤 1 Department Issue Slip with 3 Different Materials (Issues Sheet 5)
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                Repeat the <strong>same Issue Slip Number & Department</strong> on each row, and specify each <strong>Material Code & Qty</strong>:
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.68rem', borderCollapse: 'collapse', background: 'var(--bg-primary)' }}>
                  <thead>
                    <tr style={{ background: '#d97706', color: '#fff', textAlign: 'left' }}>
                      <th style={{ padding: '4px 6px' }}>Slip No</th>
                      <th style={{ padding: '4px 6px' }}>Department</th>
                      <th style={{ padding: '4px 6px' }}>Material Code</th>
                      <th style={{ padding: '4px 6px' }}>Batch</th>
                      <th style={{ padding: '4px 6px' }}>Qty</th>
                      <th style={{ padding: '4px 6px' }}>Rate (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 700 }}>IS-2026-0801</td>
                      <td style={{ padding: '4px 6px' }}>HPDC Casting</td>
                      <td style={{ padding: '4px 6px', color: '#d97706', fontWeight: 700 }}>M001 (Ingot)</td>
                      <td style={{ padding: '4px 6px' }}>23aa</td>
                      <td style={{ padding: '4px 6px' }}>800</td>
                      <td style={{ padding: '4px 6px' }}>425.00</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 700 }}>IS-2026-0801</td>
                      <td style={{ padding: '4px 6px' }}>HPDC Casting</td>
                      <td style={{ padding: '4px 6px', color: '#d97706', fontWeight: 700 }}>M019 (Resin)</td>
                      <td style={{ padding: '4px 6px' }}>-</td>
                      <td style={{ padding: '4px 6px' }}>50</td>
                      <td style={{ padding: '4px 6px' }}>245.00</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 6px', fontWeight: 700 }}>IS-2026-0801</td>
                      <td style={{ padding: '4px 6px' }}>HPDC Casting</td>
                      <td style={{ padding: '4px 6px', color: '#d97706', fontWeight: 700 }}>M046 (Hydraulic Oil)</td>
                      <td style={{ padding: '4px 6px' }}>-</td>
                      <td style={{ padding: '4px 6px' }}>20</td>
                      <td style={{ padding: '4px 6px' }}>210.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#d97706', marginTop: '6px', fontWeight: 600 }}>
                ✓ Result: The system automatically generates 1 single Issue Slip with 3 materials deducted from stock!
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
