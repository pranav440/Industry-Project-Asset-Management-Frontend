<div align="center">

# 🏢 AssetMX — Enterprise Asset Management System

**An enterprise-grade asset management and movement platform engineered for real-time visibility, security, accountability, and compliance across physical and consumable assets.**

[![React 19](https://img.shields.io/badge/React-19.0.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript 5.8](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 8.2](https://img.shields.io/badge/Vite-8.2-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python 3.13](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![MySQL 8.0](https://img.shields.io/badge/MySQL-8.0-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![SQLAlchemy 2.0](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?style=flat-square&logo=sqlalchemy&logoColor=white)](https://www.sqlalchemy.org/)
[![Pytest](https://img.shields.io/badge/Pytest-180%20Passed-brightgreen?style=flat-square&logo=pytest&logoColor=white)](https://docs.pytest.org/)
[![Vitest](https://img.shields.io/badge/Vitest-204%20Passed-brightgreen?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-50%2F50%20Passed-green?style=flat-square&logo=playwright&logoColor=white)](https://playwright.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-blue?style=flat-square)](#license)

[Features](#-key-features) • [Roles & RBAC](#-role-based-access-control-5-canonical-roles) • [Architecture](#-system-architecture) • [Quickstart](#-quickstart--local-setup) • [API Matrix](#-api-integration-matrix-74-endpoints) • [Testing](#-testing--quality-assurance) • [Documentation](#-project-documentation)

---

</div>

## 📌 Executive Overview

**AssetMX** is a unified asset management platform designed to centralize and automate organizational asset lifecycles. It provides full transparency and policy compliance for durable machinery, IT hardware, and regular consumable supplies through digitized **Gate Passes (Returnable & Non-Returnable)**, **Cryptographic QR Checkpoints**, **Multi-Stage Request Approval Workflows**, and **Immutable Audit Trails**.

Built strictly around **five canonical enterprise roles**, AssetMX enforces security boundaries at both frontend route guards and backend API middlewares, backed by a persistent MySQL 8.0 transactional engine.

---

## ⚡ Key Features

### 💻 Non-Consumable Asset Lifecycle (Hardware & Equipment)
- **Unique Identification & QR Tagging:** Cryptographic QR codes dynamically generated upon asset registration encoding Asset ID, category, location, and custodian details.
- **Complete Lifecycle Stages:** Tracks assets across `Allocation ➔ Active Usage ➔ Maintenance ➔ Disposal`.
- **Inter-Department Transfers:** Audited reassignment and relocation with QR checkpoint scans and movement history.
- **Preventative & Corrective Maintenance:** Centralized ledger capturing service dates, vendor details, costs, and status transitions.
- **Manual Valuation Ledger:** Historical record of book values, accounting adjustments, and depreciation tracking.
- **Bulk Ingestion & Filtered Exports:** Multi-page sequential CSV export complying with RFC 4180 rules.

### 📦 Consumable Inventory Control (Supplies & Materials)
- **SKU & Category Ledger:** Real-time stock levels, locations, and unit specifications.
- **Dynamic Reorder Thresholds:** Automatic low-stock calculation and warning alerts when stock breaches minimum safety margins.
- **Custodian Issuance & Quotas:** Direct allocation against department or employee quota with immediate stock decrement.
- **Stock Movement Log:** Inward replenishment, inventory write-offs, and physical count corrections with audit notes.

### 🎫 Digital Gate Pass & Checkpoint System
- **Dual Pass Types:** Dedicated workflows for **Returnable** (equipment out for repair/fieldwork) and **Non-Returnable** (disposals, client shipments) materials.
- **Multi-Party Approval:** Requisition by Hosts/Employees, formal review and decision approval by Administrators with emergency override capabilities.
- **Live Camera QR Scanning:** Guard verification console powered by `html5-qrcode` video scanning, instant QR cryptographic validation, and physical item inspection checklists.
- **Automated Overdue Escalation:** System monitor flags returnable passes exceeding movement return windows, applying exit clearance holds and recording security incident escalations.

### 📋 Requisition & Approval Workflow
- **Internal & External Intake:** Self-service requisitions for employees plus administrative intake for paper/external requisitions with uploaded signed authorizations.
- **Multi-Stage State Machine:** Standardized transitions (`Pending ➔ In Review ➔ Fulfilled / Rejected`).
- **Secure File Storage:** Multi-part document upload with binary stream download and inline browser previews (PDF, images, receipts).

### 🛡️ SuperAdmin Governance & Compliance Suite
- **User Directory Administration:** Create, update, deactivate/activate user accounts, assign canonical roles, and override password credentials.
- **Immutable Audit Ledger:** Comprehensive, chronological activity tracking with action filters, date ranges, JSON before/after state diffs, and CSV exports.
- **Dynamic System Configuration:** Real-time key-value platform configuration management with change confirmation dialogues.
- **Platform Analytics:** Real-time metric cards, monthly movement trends, and audit event distribution charts.

---

## 👥 Role-Based Access Control (5 Canonical Roles)

AssetMX strictly enforces exactly **five authorized user roles** across frontend route guards and backend JWT dependency resolvers:

```
                            ┌───────────────────────────┐
                            │        SUPERADMIN         │
                            │  User Directory, Audits,  │
                            │  Analytics, System Config │
                            └─────────────┬─────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
        ┌───────────▼───────────┐         │         ┌───────────▼───────────┐
        │         ADMIN         │         │         │         GUARD         │
        │ Assets, Consumables,  │         │         │  QR Camera Scanning,  │
        │ Requests, Approvals   │         │         │  Entry/Exit Checkpoint│
        └───────────┬───────────┘         │         └───────────────────────┘
                    │                     │
        ┌───────────▼───────────┐         │
        │         HOST          │         │
        │   Gate Passes & Team  │         │
        │   Movement Tracking   │         │
        └───────────┬───────────┘         │
                    │                     │
                    └──────────┬──────────┘
                               │
                  ┌────────────▼────────────┐
                  │        EMPLOYEE         │
                  │   Requisitions, Profile,│
                  │   My Assigned Assets    │
                  └─────────────────────────┘
```

| Role | Accessible Routes | Primary Responsibilities |
| :--- | :--- | :--- |
| **`employee`** | `/dashboard`, `/create-request`, `/my-requests`, `/my-requests/:id`, `/my-assigned-assets`, `/my-consumption` | Submit requisitions, track personal requests, view assigned assets and consumable usage, update self-service profile. |
| **`host`** | `/dashboard`, `/gate-pass`, `/gate-pass/:id`, `/movement` | Create gate pass requisitions, monitor team and visitor asset movements, view movement activity ledger. |
| **`admin`** | `/dashboard`, `/assets/*`, `/consumables/*`, `/requests/*`, `/gate-pass/*`, `/reports/*` | Manage asset inventory, maintenance, valuations, stock adjustments, requisition approvals, gate pass decisions, operational reporting. |
| **`guard`** | `/dashboard`, `/gate-verification`, `/entry-exit-logs`, `/security-incidents` | Live camera QR scanning, physical item verification, timestamping exit/entry clearances, logging checkpoint discrepancies and security incidents. |
| **`superadmin`** | `/dashboard`, `/superadmin/users`, `/superadmin/audit-logs/*`, `/superadmin/config`, `/superadmin/analytics` | Manage organization accounts, force password resets, maintain system configurations, inspect immutable audit trails with JSON state diffs. |

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND CLIENT (SPA)                           │
│  React 19 • TypeScript 5.8 • Vite 8.2 • Tailwind & Custom CSS Modules  │
│  41 Page Components • 29 Canonical Routes • 13 Workflow Modal Dialogs  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST (JWT Bearer Auth)
┌───────────────────────────────────▼────────────────────────────────────┐
│                         BACKEND APPLICATION                            │
│  FastAPI • Python 3.13 • Pydantic 2.0 Schemas • bcrypt Encryption      │
│  74 REST API Endpoints • Role Middleware Security Dependencies         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ SQLAlchemy 2.0 ORM (PyMySQL)
┌───────────────────────────────────▼────────────────────────────────────┐
│                        PERSISTENCE & STORAGE                           │
│  MySQL 8.0 Community Server (utf8mb4_unicode_ci) • 17 Schema Tables    │
│  Local Secure File Storage (/uploads/requests)                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- **Node.js:** v18.0.0 or higher (v20+ recommended)
- **Python:** v3.11 or higher (v3.13 tested)
- **MySQL:** v8.0 Community Server running locally or via Docker
- **Package Managers:** `npm` and `pip`

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/pranav440/Industry-Project-Asset-Management-Frontend.git
cd Industry-Project-Asset-Management-Frontend
```

---

### Step 2: Database Initialization (MySQL 8.0)
Log in to your local MySQL instance (port 3306) and execute:
```sql
CREATE DATABASE assetmx CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'assetmx'@'%' IDENTIFIED BY 'assetmx';
GRANT ALL PRIVILEGES ON assetmx.* TO 'assetmx'@'%';
FLUSH PRIVILEGES;
```

---

### Step 3: Backend Setup & Seed
1. Navigate to the backend directory and set up a virtual environment:
   ```bash
   cd backend
   python -m venv .venv
   
   # Windows PowerShell:
   .\.venv\Scripts\Activate.ps1
   # macOS/Linux:
   source .venv/bin/activate
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create your `backend/.env` configuration:
   ```ini
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USER=assetmx
   MYSQL_PASSWORD=assetmx
   MYSQL_DATABASE=assetmx
   JWT_SECRET=your-secure-random-jwt-secret-string-here
   JWT_ALGORITHM=HS256
   JWT_EXPIRE_MINUTES=480
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   FRONTEND_URL=http://localhost:5173
   ```
4. Bootstrap all 17 database tables and seed demo accounts:
   ```bash
   python -m app.seed
   ```
5. Start the FastAPI development server:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```
   *The backend will be available at [http://127.0.0.1:8000](http://127.0.0.1:8000). Interactive Swagger API docs at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).*

---

### Step 4: Frontend Setup
1. In a new terminal from the project root:
   ```bash
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔑 Seeded Demo Credentials

All seeded accounts share the default development password: **`AssetMX@123`**

| Role | Email Identifier | Employee ID | Default Landing Page |
| :--- | :--- | :--- | :--- |
| **SuperAdmin** | `superadmin@assetmx.local` | `SAD001` | `/superadmin/users` |
| **Admin** | `admin@assetmx.local` | `ADM001` | `/dashboard` (Admin Overview) |
| **Guard** | `guard@assetmx.local` | `GRD001` | `/dashboard` (Checkpoint Console) |
| **Host** | `host@assetmx.local` | `HST001` | `/dashboard` (Host Console) |
| **Employee** | `employee@assetmx.local` | `EMP001` | `/dashboard` (My Workspace) |

---

## 📊 API Integration Matrix (74 Endpoints)

AssetMX exposes 74 operational REST endpoints organized across 10 functional domains:

| Domain | Endpoints | Key Actions & Routes |
| :--- | :---: | :--- |
| **Auth** | 5 | `POST /api/auth/login`, `GET/PUT /api/auth/me`, `POST /api/auth/password-reset/*` |
| **Dashboard** | 6 | `GET /api/dashboard/{employee\|host\|admin\|guard}`, `/host/alerts`, `/host/movements` |
| **Requests** | 11 | `GET/POST /api/requests`, `POST /requests/external`, `GET /requests/my`, `/transition`, `/attachments/*` |
| **Assets** | 11 | `GET/POST /api/assets`, `/bulk`, `GET /assets/my`, `PUT /assets/{id}`, `/transfer`, `/maintenance`, `/valuations` |
| **Consumables** | 7 | `GET/POST /api/consumables`, `GET /consumables/my`, `PUT /consumables/{id}`, `/issue`, `/stock` |
| **Gate Passes** | 11 | `GET/POST /api/gate-passes`, `/movement-logs`, `/escalation-register`, `/decision`, `/exit-verification`, `/entry-verification`, `/escalate`, `/validate-qr` |
| **SuperAdmin** | 11 | `GET/POST/PUT/PATCH /api/superadmin/users/*`, `POST /users/{id}/reset-password`, `GET /audit-logs`, `/audit-logs/{id}`, `/audit-logs/export`, `GET/PUT /config`, `GET /analytics` |
| **Departments** | 4 | `GET/POST /api/departments`, `GET/PUT /api/departments/{id}` |
| **Reports** | 1 | `GET /api/reports/admin` (utilization, requests, maintenance, disposals) |
| **Notifications** | 5 | `GET /api/notifications`, `POST /check-alerts`, `POST /read-all`, `PATCH/POST /{id}/read` |
| **Healthcheck** | 1 | `GET /api/health` |

---

## 🧪 Testing & Quality Assurance

AssetMX is verified by automated test suites spanning unit, API integration, database persistence, and browser end-to-end automation.

### Running Backend Tests (Pytest)
```bash
cd backend
python -m pytest
```
*Result:* **180 passed**, 0 failed, 1 warning (100% pass rate).

### Running Frontend Tests (Vitest)
```bash
npm test -- --run --testTimeout=15000
```
*Result:* **204 passed**, 0 failed across 21 test files (100% pass rate).

### Running Production Bundle Build
```bash
npm run build
```
*Result:* Compiles TypeScript and packages production bundle in `dist/` in **< 2 seconds** with zero compiler errors.

### Running Live MySQL Workflow Test
```bash
python scratch/verify_mysql_workflow.py
```
*Result:* 7 / 7 cross-role lifecycle operations pass cleanly against live MySQL 8.0.

---

## 📁 Repository Structure

```
Industry-Project-Asset-Management-Frontend/
├── .gitignore                                 # Git exclusion rules
├── README.md                                  # Project documentation & quickstart
├── ASSETMX_FINAL_HANDOVER_REPORT.md           # Authoritative handover summary report
├── FINAL_ASSETMX_RELEASE_CERTIFICATION.md     # Full audit certification & API matrix
├── ASSETMX_RELEASE_PREPARATION.md             # Production deployment & operations guide
├── FULL_PROJECT_FRONTEND_AUDIT.md             # 10-phase frontend audit report
├── index.html                                 # Vite HTML entrypoint
├── package.json                               # Frontend dependencies & scripts
├── tsconfig.json                              # TypeScript strict configuration
├── vite.config.ts                             # Vite builder configuration
├── vitest.config.ts                           # Vitest testing environment
│
├── backend/                                   # FastAPI Backend Application
│   ├── requirements.txt                       # Python dependencies
│   ├── .env.example                           # Sample environment configuration
│   ├── app/
│   │   ├── config.py                          # Pydantic-settings configuration
│   │   ├── database.py                        # SQLAlchemy engine & session factory
│   │   ├── deps.py                            # Role-based auth dependencies (RBAC)
│   │   ├── email_service.py                   # Outbound SMTP email dispatch service
│   │   ├── main.py                            # FastAPI entrypoint & router mounts
│   │   ├── models.py                          # SQLAlchemy ORM database models (17 tables)
│   │   ├── schemas.py                         # Pydantic validation request/response schemas
│   │   ├── security.py                        # bcrypt hashing & JWT token handling
│   │   ├── seed.py                            # Database bootstrapping & demo seeds
│   │   └── routers/                           # Domain-driven API routers
│   │       ├── assets.py                      # Non-consumable inventory, transfers, maintenance
│   │       ├── auth.py                        # Login, JWT, profile update, password reset
│   │       ├── consumables.py                 # Consumable stock, issues, adjustments
│   │       ├── dashboard.py                   # Role-specific operational dashboards
│   │       ├── departments.py                 # Corporate department & cost-center CRUD
│   │       ├── gate_passes.py                 # Gate pass lifecycle, QR verification, escalations
│   │       ├── notifications.py               # In-app alerts, background monitor, mark-read
│   │       ├── reports.py                     # Administrative analytics & operational reports
│   │       ├── requests.py                    # Requisitions, state machine, attachments
│   │       └── superadmin.py                  # User management, audit trail, config, analytics
│   └── tests/                                 # Pytest test suites (180 tests)
│
└── src/                                       # React Frontend Application
    ├── App.tsx                                # Canonical routing & top-level route guards
    ├── main.tsx                               # DOM entrypoint
    ├── api/                                   # Axios/Fetch API client abstractions (10 clients)
    ├── auth/                                  # Session storage & auth state helpers
    ├── components/                            # Reusable UI components (Header, Sidebar, Cards)
    ├── layouts/                               # Application shells & dashboard layout
    └── pages/                                 # 41 Page Components across all 5 roles
        ├── AddConsumable.tsx                  # Consumable SKU creation
        ├── AddExternalRequest.tsx             # External requisition intake form
        ├── AddNewAsset.tsx                    # Asset registration & QR tag modal
        ├── AssetDetails.tsx                   # Asset lifecycle, movements, valuations
        ├── AssetMaintenance.tsx               # Preventative maintenance log
        ├── Assets.tsx                         # Filtered non-consumable asset inventory
        ├── AssetTransfer.tsx                  # Inter-department asset transfer
        ├── ConsumableDetails.tsx              # Consumable usage, issue modal
        ├── Consumables.tsx                    # Consumable stock monitoring
        ├── Dashboard.tsx                      # Admin operational dashboard
        ├── EmployeeCreateRequest.tsx          # Employee requisition submission
        ├── EmployeeDashboard.tsx              # Employee personal overview
        ├── EmployeeMyAssignedAssets.tsx       # Employee custodian equipment
        ├── EmployeeMyConsumption.tsx          # Employee consumable usage summary
        ├── EmployeeMyRequests.tsx             # Employee personal request ledger
        ├── EmployeeRequestDetails.tsx         # Request status timeline & preview
        ├── ForgotPassword.tsx                 # Self-service password recovery
        ├── GatePass.tsx                       # Admin gate pass approval console
        ├── GatePassDetails.tsx                # Gate pass review, override actions
        ├── GuardDashboard.tsx                 # Guard checkpoint console & metrics
        ├── GuardEntryExitLogs.tsx             # Checkpoint movement ledger
        ├── GuardGateVerification.tsx          # Live camera QR verification scanner
        ├── GuardSecurityIncidents.tsx         # Discrepancy escalation register
        ├── HostDashboard.tsx                  # Host gate pass overview
        ├── HostGatePasses.tsx                 # Host gate pass creation & tracking
        ├── HostMovementActivity.tsx           # Department movement history
        ├── Login.tsx                          # Authentication portal
        ├── ReportsOverview.tsx                # Reporting index
        ├── SuperAdminAuditDetails.tsx         # Dedicated audit event inspection
        ├── SuperAdminAuditLogs.tsx            # Immutable system audit trail & export
        ├── SuperAdminPlatformAnalytics.tsx    # Governance metrics & trend charts
        ├── SuperAdminSystemConfig.tsx         # Dynamic platform configuration
        ├── SuperAdminUserManagement.tsx       # User directory, modals, password reset
        └── __tests__/                         # Vitest unit test suites (204 tests)
```

---

## 📄 Project Documentation

For deeper architectural, compliance, and deployment insights, consult the project documents:
- 📑 [ASSETMX_FINAL_HANDOVER_REPORT.md](file:///c:/Users/ASUS/OneDrive/Desktop/Industry%20Project/ASSETMX_FINAL_HANDOVER_REPORT.md): Authoritative final project completion and handover report.
- 📋 [FINAL_ASSETMX_RELEASE_CERTIFICATION.md](file:///c:/Users/ASUS/OneDrive/Desktop/Industry%20Project/FINAL_ASSETMX_RELEASE_CERTIFICATION.md): Comprehensive source-code reconciliation, requirement traceability, and endpoint audit.
- 🚀 [ASSETMX_RELEASE_PREPARATION.md](file:///c:/Users/ASUS/OneDrive/Desktop/Industry%20Project/ASSETMX_RELEASE_PREPARATION.md): Production deployment sequence, infrastructure configuration, and pre-flight checklists.
- 🔍 [FULL_PROJECT_FRONTEND_AUDIT.md](file:///c:/Users/ASUS/OneDrive/Desktop/Industry%20Project/FULL_PROJECT_FRONTEND_AUDIT.md): Complete 10-phase frontend audit and E2E verification report.

---

## ⚖️ License

AssetMX is proprietary software. All rights reserved. Unauthorized copying, distribution, or deployment without organizational approval is strictly prohibited.
