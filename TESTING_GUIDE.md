# Testing, Verification & Quality Assurance Guide
**Application:** AMAC Store & Material Management System  
**Test Suite:** `test_suite.ps1`  
**Execution Environment:** Windows Server / Local LAN  

---

## 🧪 1. Verification Strategy & Coverage

The QA verification strategy spans:
1. **Automated Integration Test Suite**: 10 comprehensive end-to-end scenarios covering auth, ledger math, negative stock prevention, multi-row GRN, PR/PO workflows, and database backups.
2. **Formula & Calculation Validation**: Verifying stock balances, 22-day buffer math, and sand weight calculations against Excel source sheets.
3. **Negative Stock Prevention Verification**: Rejection of outward issues exceeding current physical stock.
4. **Security & Role-Based Access Control**: Validation of JWT tokens and role authorizations.

---

## 🚀 2. Running the Automated Integration Test Suite

Execute the following PowerShell script from the root workspace directory:
```powershell
powershell -ExecutionPolicy Bypass -File .\test_suite.ps1
```

### Expected Output Summary:
```
================================================================
   AMAC STORE & MATERIAL MANAGEMENT SYSTEM - INTEGRATION TEST   
================================================================

[1/10] Testing Authentication & Token Generation...
 PASS: Authenticated as Plant Admin (Role: Admin)

[2/10] Testing Command Center Dashboard KPIs...
 PASS: Dashboard Loaded - Total Materials: 179, Stock Valuation: INR 69860226.33, Low Stock Count: 31

[3/10] Testing 179 Material Stock Balances & Categories...
 PASS: Exact Parity: 179 materials retrieved from SQL Server ledger.

[4/10] Testing GRN Inward Receipt Creation...
 PASS: Created GRN 'GRN-202608-0359' for 100 KG M001. New stock recorded in ledger.

[5/10] Testing Negative Stock Prevention...
 PASS: Negative stock successfully prevented! Server blocked excessive withdrawal.

[6/10] Testing Valid Material Issue Slip Creation...
 PASS: Created Material Issue Slip 'ISS-202608-1563' (Format: KDC-STR-FF-09 Rev 01).

[7/10] Testing Purchase Requisition Engine...
 PASS: Raised Purchase Request 'PR-202608-0002' (Format: GDC-PUR-FF-07 Rev 02) Total: INR 217305.00

[8/10] Testing Specialized Manufacturing Subsystems...
 PASS: Verified 31 Cores, 7 Cylinder Types, 1 Attendance Logs.

[9/10] Testing Excel Report Generator...
 PASS: Stock Excel Report generated successfully (21636 bytes).

[10/10] Testing SQL Server Native Backup Engine...
 PASS: Database backup created successfully.
       Backup File: C:\AMAC_Backups\StoreManager\StoreManagerDb_Backup_20260826_050922.bak

================================================================
   ALL 10/10 INTEGRATION TESTS COMPLETED WITH 100% PASS RATE!   
================================================================
```

---

## 📊 3. Stock Calculation & Formula Validation Table

| Material Code | Material Description | Opening Stock | Receipts (In) | Issues (Out) | System Balance | Excel Parity Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`M001`** | ALSI7MG INGOT | 10,801.00 KG | + Inward | - Outward | **10,801.00 KG** | ✅ Exact Match |
| **`M002`** | AC2A ALLOY | 0.00 KG | 0.00 | 0.00 | **0.00 KG** (Out of stock)| ✅ Exact Match |
| **`M003`** | ALSI8CU3 ALLOY | 9,732.00 KG | + Inward | - Outward | **9,732.00 KG** | ✅ Exact Match |
| **`M004`** | ALSI9CU1 ALLOY | 19,614.00 KG | + Inward | - Outward | **19,614.00 KG** | ✅ Exact Match |
| **`M005`** | ALSI7CU3 ALLOY | 7,661.00 KG | + Inward | - Outward | **7,661.00 KG** | ✅ Exact Match |
| **`M021`** | SILICON [SI] | 2,687.50 KG | 0.00 | 0.00 | **2,687.50 KG** | ✅ Exact Match |
| **`M050`** | TML CORE SUPPLIER | 4,670.00 NOS | + Inward | - Outward | **4,670.00 NOS** | ✅ Exact Match |

---

## 📋 4. Manual QA Verification Checklist

| Test Item | Verification Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- |
| **Negative Stock Rejection** | 1. Open Issue Slip form.<br>2. Select M002 (Stock = 0).<br>3. Request 50 KG. | System displays red validation warning and rejects submission with 400 Bad Request. | ✅ PASS |
| **Issue Slip Printing** | 1. Navigate to Material Issue Slips.<br>2. Click Printer icon on any record. | Official slip formatted according to `KDC-STR-FF-09 Rev 01` opens in print view. | ✅ PASS |
| **Purchase Request Workflow** | 1. Create PR as Store User.<br>2. Log in as Store Manager.<br>3. Click Approve. | PR status changes to `Approved` with timestamp and user ID. | ✅ PASS |
| **Excel Report Generation** | 1. Go to Reports.<br>2. Click Stock Valuation Download. | File `AMAC_Store_Stock_...xlsx` downloads with 179 materials and formulas. | ✅ PASS |
| **Database Native Backup** | 1. Log in as Admin.<br>2. Go to Settings -> Backup.<br>3. Click Create Backup Now. | Verified `.BAK` snapshot created on server disk and listed in table. | ✅ PASS |
