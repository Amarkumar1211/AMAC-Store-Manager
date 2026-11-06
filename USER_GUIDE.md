# AMAC Store & Material Management — Role-Based User Manual
**Plant:** ASIAAN METALS & ALUMINIUM CASTINGS PVT LTD — UNIT-5 (Bangalore)  
**Standard Formats:**
- **Material Issue Slip:** `Format KDC-STR-FF-09 Rev 01`
- **Purchase Requisition:** `Format GDC-PUR-FF-07 Rev 02`

---

## 👥 1. User Roles & Access Hierarchy

```
   ┌──────────────────────────────────────────────────────────┐
   │                        Plant Admin                       │
   │  - User Management  - Native SQL Backup  - Audit Logs    │
   └─────────────────────────────┬────────────────────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         │                                               │
┌────────▼───────────┐                         ┌─────────▼───────────┐
│   Store Manager    │                         │    Purchase Team    │
│  - Inward (GRN)    │                         │  - Purchase Requests│
│  - Outward Issues  │                         │  - PO Tracking      │
│  - Stock Ledgers   │                         │  - Supplier Monitor │
│  - Adjustments     │                         │  - Cost Savings     │
└────────┬───────────┘                         └─────────────────────┘
         │
┌────────▼───────────┐
│ Store User / Oper. │
│  - Issue Requests  │
│  - Cylinders/PPE   │
│  - Attendance Log  │
└────────────────────┘
```

---

## 📦 2. Daily Operations for Store In-Charge & Operators

### A. Inward Material Receipt (GRN Creation)
1. Navigate to **Material Inward (GRN)** from the sidebar or click **+ Inward GRN** on top header.
2. Select **Supplier Name**, enter **Invoice Number**, **Invoice Date**, and **Vehicle Number**.
3. In the item table, select the **Material** from the search dropdown, enter the **Received Quantity** and **Unit Rate**.
4. Click **+ Add Item** if multiple items arrived on the same invoice.
5. Click **Submit GRN**. The system automatically creates the GRN record and increments the material stock ledger balance in real time.

---

### B. Outward Material Issue Slip (`Format KDC-STR-FF-09 Rev 01`)
1. Navigate to **Material Issue Slips** from the sidebar or click **+ Issue Slip** on the top header.
2. Select the **Department** (e.g. `Foundry / Melting`, `Core Shop`, `Fettling`, `Quality`).
3. Enter **Supervisor Name**, **Shift** (`1st Shift`, `2nd Shift`, `General`), and **Purpose** (e.g. `Melt Batch 104`).
4. Select the material and enter the **Requested Quantity**.
   > **Note on Negative Stock Prevention:** The system checks available stock immediately. If the requested quantity exceeds physical inventory, the entry is highlighted in red and submission is blocked.
5. Click **Submit Issue Slip**.
6. Click the **🖨️ Printer Icon** on the created issue slip to open the official printable document formatted according to `KDC-STR-FF-09 Rev 01`.

---

### C. Physical Stock Reconciliation (Stock Adjustment)
1. Navigate to **Stock Adjustment** from the sidebar.
2. Select the material and enter the verified **Physical Stock Count**.
3. The system automatically computes the variance ($\text{Physical} - \text{System}$).
4. Enter the **Mandatory Audit Reason** (e.g. `Physical audit count reconciliation`, `Spillage / Slag loss`).
5. Click **Post Adjustment**. The stock balance is updated and logged in the immutable audit trail.

---

## 💼 3. Daily Operations for Purchase Team

### A. Raising a Purchase Requisition (`Format GDC-PUR-FF-07 Rev 02`)
1. Navigate to **Purchase Requests** from the sidebar.
2. Click **+ New Purchase Request**.
3. Select **Priority** (`Normal`, `Urgent`, `Shutdown`), enter **Required By Date**, and **Purpose**.
4. Add line items with **Requested Quantities** and **Estimated Rates**.
5. Click **Submit Requisition**.
6. Authorized managers can click **Approve** or **Reject** with comments.
7. Click the **🖨️ Printer Icon** to print the formal plant standard PR document `GDC-PUR-FF-07 Rev 02`.

---

### B. Purchase Order (PO) Delivery Tracking
1. Navigate to **Purchase Orders** from the sidebar.
2. Monitor the **Pending Quantity** column for active orders.
3. As the store team posts Inward GRNs referencing the PO number, the system automatically decrements pending quantities and marks fulfilled orders as `Completed`.

---

### C. Multi-Supplier Price Comparison & Cost Saving Initiatives
1. Navigate to **Suppliers & Benchmarks**.
2. Review the side-by-side price comparison matrix across primary vendors (e.g. IMAC Mr. Saravanan vs Supreme Aluminium vs Unique Auto).
3. View the **Cost Saving Initiatives** tab to monitor planned vs realized foundry cost reductions.

---

## 🏭 4. Specialized Foundry Subsystems

- **Core Master & Weight Calculations:** View core catalogue, unit sand weights (KG), and total planned core weight requirements.
- **Gas Cylinder Tracking:** Enter daily receipts of Full Cylinders and dispatches of Empty Cylinders for 17KG LPG, 33KG LPG, Commercial LPG, Nitrogen, and Oxygen.
- **Store Attendance Register:** Record daily staff attendance ($P$, $A$, $H$, $L$) and overtime hours.
- **PPE Gloves Tracker:** Log weekly Cotton Gloves consumption by department.

---

## 🖨️ 5. Reports Hub & 1-Click Excel Exports
1. Navigate to **Reports & Exports** from the sidebar.
2. Select the desired report:
   - **Stock Valuation & Status Report** (Complete 179 material stock with values and buffer days).
   - **Material Consumption Report** (Filterable by date range).
   - **Purchase Inward Analysis Report**.
3. Click **Download Excel (.xlsx)**. A formatted spreadsheet will be generated and downloaded immediately.

---

## 🌐 6. Multi-Device LAN Access Guide (HTTP)

The AMAC Store & Material Management System runs on standard **HTTP** for instant, zero-warning multi-device access across the factory network.

### 📱 Access URLs:
- **This PC (Localhost)**: [`http://localhost:5174`](http://localhost:5174) or [`http://localhost:5000`](http://localhost:5000)
- **Other Devices on Local Network (Phones / Tablets / Laptops)**: `http://<Host-PC-IP>:5174` (e.g., `http://192.168.1.109:5174`)

### ⚡ 1-Click Scripts:
| File | Action |
|---|---|
| `START_APPLICATION.bat` | Starts the backend and frontend servers and launches your browser. |
| `STOP_APPLICATION.bat` | Safely stops background server processes. |
| `ALLOW_FIREWALL_LAN_ACCESS.bat` | Opens ports 5174 & 5000 in Windows Firewall for multi-device access across the plant Wi-Fi. |
| `create_desktop_shortcut.ps1` | Creates a convenient 1-click desktop shortcut. |

