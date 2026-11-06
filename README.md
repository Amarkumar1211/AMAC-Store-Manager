# AMAC Store & Material Management System

> **Asiaan Metals & Aluminium Castings Pvt. Ltd. — Unit-5**  
> Complete Enterprise Store, Inventory, Requisitions, Manufacturing & Material Management System.

---

## 📌 Overview

AMAC Store Manager is an enterprise management platform built specifically for industrial foundry and manufacturing operations. It provides end-to-end material tracking, FIFO chute queue allocation, supervisor approval workflows, daily auto-requisitions, vendor management, stock ledger auditing, and executive MRM reporting.

---

## 🚀 Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Canvas Confetti
- **Backend:** ASP.NET Core 9 Web API, Entity Framework Core 9
- **Database:** Microsoft SQL Server (Enterprise/Express) & SQLite (Standalone/Desktop mode)
- **Reporting:** ClosedXML (Excel reports), EPPlus 8, OpenXML (Automated PowerPoint presentations)
- **Packaging:** Inno Setup Windows Installer & Single-file self-contained `.exe`

---

## 🛠 Features

- **Inventory & Materials:** Track 600+ casting alloys, raw materials, fluxes, tools, and consumables with min/max stock thresholds and real-time alerts.
- **FIFO Chute & Heat Tracking:** First-in, first-out chute queues and heat-wise batch consumption for metallurgical quality compliance.
- **Department Requisition Workflow:** Automated requisitions, multi-tier approvals (Department Head -> Store Keeper -> Plant Head), and digital signatures.
- **Purchase Orders & Receipts:** Vendor PO generation, GRN (Goods Receipt Note) inspection tracking, and invoice validation.
- **Manufacturing & Shift Logs:** Furnace melt logs, casting production records, shift-wise operator attendance, and scrap generation.
- **Stock Ledger & Auditing:** Immutable double-entry transaction ledgers, adjustments, and variance auditing.
- **Executive Reporting & MRM:** Automated monthly management review PowerPoint (MRM) slide deck generation and Excel export.

---

## 💻 Getting Started

### Prerequisites

- [.NET 9.0 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Node.js (v20+)](https://nodejs.org/) & npm
- [SQL Server 2022 / Express](https://www.microsoft.com/sql-server/) (or SQLite local storage)

### Running in Development

1. **Backend:**
   ```bash
   cd backend
   dotnet restore
   dotnet run
   ```
   The backend API will start on `http://localhost:5000` (or configured port).

2. **Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The Vite dev server will start on `http://localhost:5173`.

### Desktop Build

Run the automated packaging script to build the self-contained Windows executable and installer:
```powershell
.\build_windows_app.ps1
```

---

## 📄 License & Confidentiality

Internal software property of **Asiaan Metals & Aluminium Castings Pvt. Ltd. (Unit-5)**. All rights reserved.
