# ABS Eagle CRoll — Solution Architecture
**Version:** 2.1  
**Status:** Updated — Azure AD Login + User-Based Case Saving  
**Date:** 2026-06-17  
**Author:** Eagle Digital Team  

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Business Goals](#2-business-goals)
3. [Stakeholders](#3-stakeholders)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Assumptions and Constraints](#6-assumptions-and-constraints)
7. [System Overview](#7-system-overview)
8. [Deployment Architectures](#8-deployment-architectures)
   - 8.1 [Desktop (Electron) Mode](#81-desktop-electron-mode)
   - 8.2 [Web (Azure) Mode](#82-web-azure-mode)
9. [Component Architecture](#9-component-architecture)
10. [Technology Stack](#10-technology-stack)
11. [Data Architecture](#11-data-architecture)
12. [API Design](#12-api-design)
13. [Security Architecture](#13-security-architecture)
    - 13.1 [Cloud Security](#131-cloud-security)
    - 13.2 [Desktop Security](#132-desktop-security)
    - 13.3 [Delivery (CI/CD) Security](#133-delivery-cicd-security)
14. [Observability and Logging](#14-observability-and-logging)
15. [Report Generation](#15-report-generation)
16. [CI/CD Pipeline](#16-cicd-pipeline)
17. [Environments and Branch Strategy](#17-environments-and-branch-strategy)
18. [Scalability and Performance](#18-scalability-and-performance)
19. [Key Deliverables — v2.0 → v2.1](#19-key-deliverables--v20--v21-2026-05-18--2026-06-17)
20. [Open Questions and Decisions](#20-open-questions-and-decisions)
21. [Glossary](#21-glossary)

---

## 1. Purpose and Scope

This document describes the solution architecture for **ABS Eagle CRoll** (Polar Roll Calculator), an engineering tool used by vessel surveyors and naval architects to compute and visualise polar roll diagrams for ships under assessment.

The system supports two independent operational modes:

| Mode | Delivery | Storage | Audience |
|---|---|---|---|
| Desktop | Electron packaged app (Windows) | Local file system + SQLite | Offline/field surveyors |
| Web | Azure-hosted React SPA + .NET 8 API | Azure Blob Storage + Azure SQL Database | Office/connected users |

Both modes share a single React + Vite frontend codebase. Runtime detection at startup determines which file-system service is wired in.

---

## 2. Business Goals

- Provide ABS surveyors with an accurate, fast polar roll calculator that works in connected and disconnected environments.
- Replace ad-hoc spreadsheet tooling with a maintainable, auditable software product.
- Enable centralised data storage so project files are accessible across the organisation for the web mode.
- Produce consistently formatted PDF reports suitable for inclusion in survey deliverables.

---

## 3. Stakeholders

| Role | Interest |
|---|---|
| ABS Surveyors | Day-to-day calculation and report generation |
| Naval Architects | Validation of calculation accuracy |
| ABS IT / DevOps | Infrastructure, security, deployment |
| Project Manager | Delivery schedule, feature completeness |
| Security / Compliance | Data handling, access control, audit |

---

## 4. Functional Requirements

1. **Project loading** — user selects a vessel control file; the system reads associated data files and populates input parameters.
2. **Polar calculation** — given speed, heading, and GM inputs, compute and render an interactive polar roll diagram.
3. **Case management** — users can save, name, load, and delete calculation cases; each case is scoped to its originating vessel/project.
4. **Multi-vessel isolation** — cases from different vessel datasets must not interfere with one another.
5. **Report generation** — produce a PDF report containing the polar chart image and tabular parameters for one selected case or all saved cases.
6. **File upload (web mode)** — users can upload new vessel data files to Azure Blob Storage from the browser.
7. **Offline operation (desktop mode)** — all functionality must be available without network connectivity.

---

## 5. Non-Functional Requirements

| Attribute | Requirement |
|---|---|
| Availability | Web: 99.5 % during business hours |
| Performance | Polar calculation and chart render < 2 s |
| Security | No secrets in source control; private network endpoints; branch-scoped deployments |
| Portability | Desktop app runs on Windows 10/11 (x64) |
| Maintainability | Single shared React codebase for both modes |
| Auditability | All deployments triggered by named branch pushes; pipeline logs retained |

---

## 6. Assumptions and Constraints

- Desktop mode is Windows-only; cross-platform packaging is out of scope for the current release.
- Web mode is internal-facing; public internet access to app services is disabled by design.
- The SQLite database used in desktop mode is user-local and is explicitly excluded from version control.
- Vessel data files are managed by surveyors; the system does not validate their structural correctness beyond what the parser requires.

---

## 7. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                   │
│                                                                   │
│   ┌──────────────┐   ┌────────────────────────────────────────┐ │
│   │  ElectronCtx │   │              Web Context               │ │
│   │  (runtime    │   │  (runtime detection: window.electronAPI │ │
│   │   detection) │   │   absent → web mode)                   │ │
│   └──────┬───────┘   └────────────────┬───────────────────────┘ │
│          │                            │                           │
│   FileSystemService           ApiFileSystemService               │
│   (local FS reads via          (Azure Blob REST via              │
│    Electron IPC)                .NET 8 API proxy)                │
└──────────┬─────────────────────────────┬────────────────────────┘
           │                             │
┌──────────▼────────┐         ┌──────────▼──────────────┐
│  Electron + Node  │         │   .NET 8 API            │
│  (main process)   │         │   (Azure App Service)   │
│                   │         │                         │
│  • better-sqlite3 │         │  • Blob proxy endpoints │
│  • PDF export     │         │  • File upload          │
│  • IPC handlers   │         │  • Azure SQL Database   │
│  • single-inst.   │         │    (case persistence)   │
│    lock           │         │                         │
└──────────┬────────┘         └──────────┬──────────────┘
           │                             │
   Local file system            Azure Blob Storage
   + SQLite DB                  + Azure SQL Database
```

**Key distinction from earlier versions of this document:** The desktop mode does **not** use a .NET backend. All server-side logic for the desktop is provided by the Electron main process (Node.js). The .NET 8 API is exclusively a cloud-side component serving the web mode.

---

## 8. Deployment Architectures

### 8.1 Desktop (Electron) Mode

```
  Windows Machine
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │  Renderer Process (Chromium)                     │
  │  └── React + Vite SPA                            │
  │       └── FileSystemService (IPC calls)          │
  │                    │                             │
  │             IPC Bridge (preload.ts)              │
  │                    │                             │
  │  Main Process (Node.js)                          │
  │  ├── IPC handlers (file reads, DB, PDF)          │
  │  ├── better-sqlite3 → croll_cases.db             │
  │  │     • composite PRIMARY KEY (id, data_file_path)│
  │  │     • WAL mode + 3 s busy timeout             │
  │  │     • schema_version migration table          │
  │  └── app.requestSingleInstanceLock()             │
  │                                                  │
  │  Local Storage                                   │
  │  └── Vessel project folders (user-managed)       │
  │  └── croll_cases.db  (excluded from VCS)         │
  │                                                  │
  └──────────────────────────────────────────────────┘
```

**Runtime detection:** At startup, the React app checks for the presence of `window.electronAPI`. If found, `FileSystemService` (local reads via IPC) is used. If absent, `ApiFileSystemService` (HTTP calls to the .NET API) is used.

**Single-instance enforcement:** `app.requestSingleInstanceLock()` is called in `electron/main.ts`. If a second instance is launched, it immediately quits and focuses the already-running window. This prevents concurrent write conflicts on the SQLite database.

**SQLite schema management:** A `schema_version` table tracks the applied migration version. On first run after upgrade, the `cases` table is recreated with the composite primary key and existing data is migrated. This ensures the database is always in a consistent state without requiring manual intervention.

### 8.2 Web (Azure) Mode

```
  User Browser
       │  HTTPS (private endpoint, Azure Front Door / internal only)
       ▼
  ┌──────────────────────────────────────────────┐
  │  Azure App Service: app-ngea-cr-{env}-001    │
  │  (React SPA, IIS + web.config SPA routing)  │
  │  Private endpoint — no public IP             │
  └───────────────────┬──────────────────────────┘
                      │ HTTPS (VNet-internal)
                      ▼
  ┌──────────────────────────────────────────────┐
  │  Azure App Service: api-ngea-cr-{env}-001    │
  │  (.NET 8 Web API)                            │
  │  Private endpoint — no public IP             │
  │                                              │
  │  ├── BlobStorageService                      │
  │  │    └── Azure Blob Storage (private EP)    │
  │  │        Container: croll-data[-uat]        │
  │  │                                           │
  │  └── Entity Framework / ADO.NET              │
  │       └── Azure SQL Database (private EP)    │
  └──────────────────────────────────────────────┘
                      │
  ┌───────────────────▼──────────────────────────┐
  │  Azure Key Vault: kv-ngea-cr-{env}-001       │
  │  (storage keys, connection strings)          │
  │  Private endpoint — API uses Managed Identity│
  └──────────────────────────────────────────────┘
```

**Private endpoints:** Both App Services (frontend and API), Azure Blob Storage, Azure SQL Database, and Azure Key Vault are accessed exclusively via private endpoints within `vnet-ngea-cr-{env}`. Public network access is disabled on all resources.

**Azure Firewall:** All egress from the VNet is routed through Azure Firewall via route table `rt-ngea-cr-001`. Only explicitly permitted flows (e.g., self-hosted runner subnet → CRoll private endpoints) are allowed.

---

## 9. Component Architecture

### Frontend Components

| Component | Purpose |
|---|---|
| `src/pages/Home.tsx` | Project selection landing page |
| `src/pages/Project.tsx` | Main calculation page — inputs, polar chart, case management, report trigger |
| `src/pages/Project.css` | Layout, responsive breakpoints (1400 / 1280 / 1024 / 768 px) |
| `src/context/ElectronContext.tsx` | Runtime detection; wires correct file-system service |
| `src/context/UserEmailContext.tsx` | Provides logged-in user email to all components via `useUserEmail()` hook |
| `src/auth/AuthGuard.tsx` | Web-only guard — auto-redirects unauthenticated users to Microsoft login |
| `src/auth/msalConfig.ts` | MSAL configuration — Client ID, Tenant ID, redirect URIs, login scopes |
| `src/auth/WebUserEmailProvider.tsx` | Reads `useMsal()` accounts and feeds email into `UserEmailContext` |
| `src/auth/msalInstance.ts` | Module-level MSAL instance reference for silent token acquisition outside React |
| `src/services/fileSystem.ts` | Desktop file service (reads local FS via Electron IPC) |
| `src/services/apiFileService.ts` | Web file service (HTTP calls to .NET API) |
| `src/services/apiCaseService.ts` | Web case service — HTTP calls to `/api/cases`; adds Bearer token header |
| `src/components/CanvasPolarChart.tsx` | Canvas-rendered polar roll diagram |
| `src/components/ReportModal.tsx` | In-browser PDF preview and download |

### Electron Main Process Components

| Module | Purpose |
|---|---|
| `electron/main.ts` | App lifecycle, IPC handlers, SQLite init, single-instance lock |
| `electron/preload.ts` | Context bridge — exposes `window.electronAPI` to renderer |
| `src/types/electron.d.ts` | TypeScript interface for `ElectronAPI` |

### Backend API Components (.NET 8)

| Module | Purpose |
|---|---|
| `BlobStorageController` | Proxy for listing, reading, and uploading vessel files to Azure Blob |
| `CasesController` | REST endpoints for case persistence (web mode) |
| `KeyVaultService` | Retrieves secrets at startup via Managed Identity |
| `appsettings.json` | Safe defaults — committed to source control |
| `appsettings.Development.json` | Local credentials — excluded from source control via `.gitignore` |

---

## 10. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | React | 18 |
| Build tool | Vite | 5 |
| Desktop shell | Electron | 29 |
| Desktop DB | SQLite via `better-sqlite3` | 9 |
| PDF generation | jsPDF + html2canvas | Latest |
| Authentication (web) | MSAL — `@azure/msal-browser` + `@azure/msal-react` | 5.11 / 5.4 |
| Backend | .NET | 8 (LTS) |
| Backend auth | Microsoft.Identity.Web (JWT Bearer) | 3.8 |
| Backend data access | ADO.NET / `Microsoft.Data.SqlClient` (raw SQL) | 8 / 5.2 |
| Cloud database | Azure SQL Database | — |
| Cloud storage | Azure Blob Storage | — |
| Secret management | Azure Key Vault | — |
| CI/CD | GitHub Actions | — |
| Container registry | Not used — App Service direct deploy | — |
| IaC | Manual (Azure Portal + GitHub Actions) | — |

---

## 11. Data Architecture

### Desktop — SQLite

Local SQLite database at `%APPDATA%\Eagle CRoll\croll_cases.db` (or user profile path on Windows).

```sql
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY
);

CREATE TABLE cases (
    id              TEXT    NOT NULL,
    data_file_path  TEXT    NOT NULL,
    name            TEXT,
    parameters      TEXT,   -- JSON blob
    chart_image     TEXT,   -- base64 PNG snapshot
    created_at      TEXT    DEFAULT (datetime('now')),
    PRIMARY KEY (id, data_file_path)
);
```

**Key design decisions:**

- **Composite primary key `(id, data_file_path)`** — `data_file_path` acts as a vessel/project namespace. Cases with the same ID from different vessels do not collide.
- **WAL mode** — Write-Ahead Logging is enabled for improved concurrent read performance and crash resilience. A 3-second busy timeout is set before WAL pragma to handle any transient lock at startup.
- **Schema versioning** — `schema_version` tracks the highest applied migration. Future schema changes can be applied incrementally without data loss.
- **Excluded from version control** — `croll_cases.db`, `.db-shm`, and `.db-wal` are listed in `.gitignore` and were untracked with `git rm --cached`. User data is never committed to the repository.

### Web — Azure SQL Database

Cases for the web mode are persisted to **Azure SQL Database**. Connection strings are stored in Azure Key Vault and injected into the App Service at runtime via environment variables.

```
ConnectionStrings__DefaultConnection = <Azure SQL connection string from Key Vault>
```

**Cases table schema (SQL Server):**

```sql
CREATE TABLE Cases (
    Id               NVARCHAR(50)   NOT NULL PRIMARY KEY,
    CreatedAt        BIGINT         NOT NULL,   -- Unix timestamp ms
    OsUsername       NVARCHAR(255)  NOT NULL,   -- Azure AD email (web) or Windows username (desktop)
    MachineName      NVARCHAR(255)  NOT NULL,
    Color            NVARCHAR(10)   NOT NULL,   -- 'green' | 'pink'
    DraftAft         FLOAT,
    DraftFore        FLOAT,
    Gm               FLOAT,
    Heading          FLOAT,
    Speed            FLOAT,
    MaxRoll          FLOAT,
    Hs               FLOAT,
    Tz               FLOAT,
    WaveDirection    FLOAT,
    DataFilePath     NVARCHAR(500),
    FittedDraft      FLOAT,
    FittedGm         FLOAT,
    FittedHs         FLOAT,
    FittedTz         FLOAT,
    ChartMode        NVARCHAR(50),
    ChartOrientation NVARCHAR(50),
    ChartImage       NVARCHAR(MAX),  -- base64 PNG
    Synced           INT            NOT NULL DEFAULT 0,
    ProjectId        NVARCHAR(255),  -- blob container folder name (project scope)
    UpdatedAt        DATETIME2
);
```

**User isolation:** Every query to `GET /api/cases` filters by `OsUsername`. Users can only see and modify their own cases. On web, `OsUsername` is the Azure AD email from the MSAL token (e.g. `schappidi@eagle.org`). On desktop, it is the Windows login username.

### Blob Storage

Vessel project files are stored in Azure Blob Storage:

| Environment | Account | Container |
|---|---|---|
| DEV | `stngeacrdev001` | `croll-data` |
| UAT | `stngeacruat001` | `croll-data-uat` |

Access is controlled by account keys stored in Azure Key Vault. The API reads the account name and container name from App Service environment variables and the account key from Key Vault at startup.

---

## 12. API Design

The .NET 8 API follows RESTful conventions. All endpoints require internal network access (private endpoint — no public routes).

### Blob Proxy Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/files` | List all vessel project files in the blob container |
| GET | `/api/files/{fileName}` | Download a specific file |
| POST | `/api/files/upload` | Upload a new vessel data file (multipart/form-data) |

### Case Endpoints (Web Mode)

All case endpoints require a valid Azure AD Bearer token (`Authorization: Bearer <token>`).

| Method | Path | Description |
|---|---|---|
| GET | `/api/cases?osUsername={email}` | List saved cases for a specific user (filtered by `OsUsername`) |
| GET | `/api/cases/{id}` | Get a single case by ID |
| POST | `/api/cases` | Save a new case |
| PUT | `/api/cases/{id}` | Update all fields of an existing case |
| PATCH | `/api/cases/{id}/chart` | Update only the chart image (called after chart capture) |
| DELETE | `/api/cases/{id}` | Delete a case |

### Configuration Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check — returns 200 OK if API is reachable |

---

## 13. Security Architecture

### 13.1 Cloud Security

**Authentication — Azure AD (MSAL):**

Web app users authenticate with their ABS Azure AD account (`@eagle.org`) before accessing any application functionality. The flow is:

1. User opens the web app → `AuthGuard` detects unauthenticated state → `loginRedirect()` sends user to Microsoft login page.
2. Microsoft authenticates the user and redirects back with an authorization code.
3. MSAL exchanges the code for an ID token (user identity) and an access token (API access).
4. All API calls from `apiCaseService.ts` include `Authorization: Bearer <access_token>`.
5. The .NET API validates the token using `Microsoft.Identity.Web` (JWT Bearer middleware). Only tokens issued for the correct Azure AD tenant and API audience are accepted.

**App Registration: `ea-ngea-croll-nonprod`**

| Setting | Value |
|---|---|
| Client ID | `443b366a-a00b-4fde-aa19-3578cc040008` |
| Tenant ID | `d810b06c-d004-4d52-b0aa-4f3581ee7020` |
| API scope | `api://443b366a-a00b-4fde-aa19-3578cc040008/access_as_user` |
| Redirect URIs (SPA) | `https://app-ngea-cr-dev-001.azurewebsites.net`, `https://app-ngea-cr-uat-001.azurewebsites.net`, `http://localhost:5173` |

Electron desktop mode is completely unaffected — `AuthGuard` bypasses MSAL when `window.electronAPI` is present.

**Network isolation:**

- All Azure resources (frontend App Service, API App Service, Blob Storage, Azure SQL Database, Key Vault) are placed behind **private endpoints** within `vnet-ngea-cr-{env}`. There are no publicly accessible IP addresses or DNS entries for any resource.
- Route table `rt-ngea-cr-001` directs all VNet egress through **Azure Firewall**. Only explicitly approved source/destination combinations are permitted. Network rules are maintained by the ABS network team and reviewed on change.
- The self-hosted GitHub Actions runner operates within the VNet and is the only compute resource permitted to reach private endpoints during deployments. This runner is the sole deployment boundary — no deployment action reaches Azure directly from the internet.

**Identity and access:**

- The API App Service uses a **system-assigned Managed Identity** to authenticate to Azure Key Vault. No credentials are stored in application code or environment variable files.
- Role assignments follow least-privilege: the Managed Identity holds `Key Vault Secrets User` only; it does not have `Key Vault Administrator` or contributor rights.
- Sensitive App Service environment variables (`StorageAccountName`, `BlobContainerName`, `Storage__AccountKey`, `ConnectionStrings__DefaultConnection`) are set directly in the Azure Portal and are never present in source control.

**Secret management:**

| Secret | Location | Access Method |
|---|---|---|
| Storage account key | Azure Key Vault | Managed Identity at runtime |
| SQL Database connection string | Azure Key Vault / App Service env vars | Managed Identity / ASP.NET Core config |
| GitHub Actions credentials | GitHub Secrets | Federated OIDC — no stored passwords |

**CORS:**

- The API's allowed origin is restricted to the frontend App Service URL for each environment (`CRollReactApp` App Setting). Wildcard CORS is not permitted.

### 13.2 Desktop Security

**Single-instance enforcement:**

`app.requestSingleInstanceLock()` is called at the top of `electron/main.ts` before any database access. If a second instance is launched, it immediately quits and brings the first instance to focus. This prevents concurrent write operations on the SQLite database, which could corrupt the WAL or produce a `SQLITE_BUSY` error.

**SQLite integrity:**

- `PRAGMA busy_timeout = 3000` is set before WAL mode is enabled. This allows up to 3 seconds of retry on a locked database before failing, gracefully handling the rare case where the lock is briefly held at startup.
- WAL mode (`PRAGMA journal_mode = WAL`) is set in a `try/catch`. If the filesystem does not support WAL (e.g., a network drive), the database falls back to the default journal mode rather than crashing.
- The composite primary key `(id, data_file_path)` ensures that cases from different vessel projects are fully isolated at the storage layer, not just in application state.
- Schema migrations are managed via the `schema_version` table. Each migration is version-gated so it runs exactly once and is idempotent.

**Data exclusion from VCS:**

- `croll_cases.db`, `croll_cases.db-shm`, and `croll_cases.db-wal` are listed in `.gitignore`.
- These files have been explicitly untracked (`git rm --cached`) so they will never be accidentally committed, even if a contributor's Git client has the `--force` flag disabled.
- `appsettings.Development.json` (which contains local database credentials) is also listed in `.gitignore` and excluded from all commits.

**Electron context isolation:**

- The renderer process (Chromium/React) runs with `contextIsolation: true` and `nodeIntegration: false`.
- All Node.js and Electron APIs are accessed exclusively through the `contextBridge` in `electron/preload.ts`, which exposes only the specific IPC calls the renderer requires (`window.electronAPI`).
- `webSecurity` is not disabled.

**Local credential handling:**

- No API keys, passwords, or tokens are bundled with the desktop application package.
- The desktop app does not make outbound calls to Azure or any external service. It operates entirely on the local file system.

### 13.3 Delivery (CI/CD) Security

**OIDC authentication — no stored secrets:**

GitHub Actions authenticates to Azure using **OpenID Connect (OIDC) federated credentials** via the `azure/login@v2` action. No client secrets or certificates are stored in GitHub Secrets or in the repository. The credentials in use are:

| Secret Name | Purpose |
|---|---|
| `AZURE_CLIENT_ID_NONPROD` | App Registration client ID for OIDC |
| `AZURE_TENANT_ID` | Azure AD tenant |
| `AZURE_SUBSCRIPTION_ID` | Target Azure subscription |

The App Registration (`ea-ngea-croll-nonprod`) has **branch-scoped federated credential subjects**. A token is only issued when the workflow runs from a branch explicitly listed in the federated credential configuration (`develop` for DEV, `uat` for UAT). A workflow triggered from any other branch cannot obtain a token and cannot deploy.

**Self-hosted runner as deployment boundary:**

The deploy job in every pipeline runs on the `ABS-IMS-DevOps-Self-Hosted` runner group. This runner is inside the Azure VNet and is the only compute that can reach the private endpoints of both the DEV and UAT App Services. No inbound port is opened for deployment; the runner initiates outbound connections over private endpoints.

The build job runs on `ubuntu-latest` (GitHub-hosted). It produces a deployment artifact (zipped build output) that is passed to the deploy job via `actions/upload-artifact` / `actions/download-artifact`. The GitHub-hosted runner never has network access to Azure resources.

**npm security:**

- CI uses `npm ci --ignore-scripts` to install dependencies. The `--ignore-scripts` flag prevents any `postinstall` or `preinstall` lifecycle scripts from executing on the CI runner, blocking a class of supply-chain attacks via malicious npm packages.
- The lockfile (`package-lock.json`) is committed and is used by `npm ci` to enforce exact version pinning.

**Build integrity:**

- `npx vite build --base=/` overrides the local `base: './'` setting in `vite.config.ts` so that all asset paths are absolute. This ensures the deployed build works correctly on Azure App Service IIS without path rewriting issues.
- `public/web.config` provides IIS SPA routing rules so that deep-linking and page refresh return `index.html` rather than a 404.

**Artifact scope:**

- The API build job publishes only the compiled .NET output (`dotnet publish`); no source code, secrets, or development configuration files are included in the artifact.
- The frontend build job publishes only the contents of `dist/`; `node_modules`, `.env*` files, and Electron-specific files are not included.

---

## 14. Observability and Logging

### Cloud (Web Mode)

| Layer | Mechanism |
|---|---|
| API structured logging | ASP.NET Core `ILogger` → Azure Monitor / Application Insights (if wired) |
| App Service logs | Platform-level HTTP access logs — enabled in App Service Diagnostics |
| Deployment logs | GitHub Actions run logs — retained per GitHub repository settings |
| Health check | `GET /api/health` — can be called from internal monitoring |

### Desktop (Electron Mode)

> **Known gap:** The current desktop release does not implement structured logging to a file or centralised sink. The Electron main process writes unhandled exceptions to `stderr` (visible in a dev console or crash dump) but does not persist logs.
>
> **Planned:** A file-based logger (e.g., `electron-log`) writing to `%APPDATA%\Eagle CRoll\logs\` is planned for a future release. This will allow support engineers to retrieve logs without reproducing issues locally.

---

## 15. Report Generation

### Flow

1. User selects a saved case (or all cases) from the case panel.
2. User clicks **Generate Report**.
3. The React app constructs a `ReportModal` component populated with the case parameters.
4. For each case, the **chart image** displayed in the report is the **frozen PNG snapshot** captured at save time (`chartImageUrl`), not a re-render of the current input state. This ensures the report accurately reflects the calculation that was saved, regardless of any subsequent user edits.
5. jsPDF renders the modal content to a PDF:
   - Polar chart image: `Math.min(contentWidth, 160)` mm wide (centred)
   - Parameter table: full-width, multi-row
6. PDF is downloaded to the browser (web) or the local Downloads folder (desktop via Electron dialog).

### Chart Snapshot Mechanism

When a case is saved:

1. `pendingChartCaptureRef` is set to `{ id: caseId, projectKey }`.
2. A hidden `CanvasPolarChart` renders at `700 × 700` px (full-size font thresholds apply — `isSmall = false`).
3. On `onDrawn`, the canvas `toDataURL('image/png')` is stored as `chartImageUrl` on the `SavedCase` object and written to the SQLite database (desktop) or API (web).
4. The `700 × 700` canvas is displayed in the report modal inside a `transform: scale(0.6)` CSS wrapper, rendering at `420 × 420` visual pixels with full font quality.

---

## 16. CI/CD Pipeline

### Workflow Triggers

| Workflow | Trigger | Target |
|---|---|---|
| `deploy-web.yml` | Push to `develop` | DEV frontend App Service |
| `deploy-api.yml` | Push to `develop` | DEV API App Service |
| `deploy-web-uat.yml` | Push to `uat` | UAT frontend App Service |
| `deploy-api-uat.yml` | Push to `uat` | UAT API App Service |

### Job Structure (all workflows follow the same pattern)

```
build (ubuntu-latest, GitHub-hosted)
  ├── Checkout
  ├── Setup runtime (Node 20 / .NET 8)
  ├── Install / restore dependencies
  ├── Build
  └── Upload artifact

deploy (ABS-IMS-DevOps-Self-Hosted, VNet-internal)
  ├── Download artifact
  ├── azure/login@v2 (OIDC)
  └── azure/webapps-deploy@v3
```

**Deploy action:** `azure/webapps-deploy@v3` is used for all deployments. `az webapp deploy` is not used.

**No `environment:` block on deploy jobs** — an `environment:` block in the deploy job would change the OIDC subject format from `repo:org/repo:ref:refs/heads/<branch>` to `repo:org/repo:environment:<env-name>`, breaking the branch-scoped federated credentials.

---

## 17. Environments and Branch Strategy

```
Feature branches
     │
     ▼
develop ──► DEV (app-ngea-cr-dev-001 / api-ngea-cr-dev-001)
     │
     ▼ (PR / promote)
uat ─────► UAT (app-ngea-cr-uat-001 / api-ngea-cr-uat-001)
     │
     ▼ (PR / promote)
main ────► [Production — future]
```

| Branch | Environment | Purpose |
|---|---|---|
| `develop` | DEV | Active development, frequent deploys |
| `uat` | UAT | Manager and user acceptance testing |
| `main` | Stable / Production | Stable baseline; production target |

---

## 18. Scalability and Performance

### Web Mode

- **App Service Plan:** Windows, Basic B3 (2 cores, 3.5 GB RAM) — suitable for the expected number of concurrent internal users.
- **Scale-up:** The plan can be scaled to Standard or Premium tiers without re-deployment if concurrent usage grows.
- **Database:** Azure SQL Database is provisioned in the General Purpose tier. Query volume for this application is low; connection pooling in Entity Framework Core handles bursts efficiently.
- **Blob Storage:** Azure Blob Storage is inherently scalable; vessel file sizes are in the kilobyte to low-megabyte range.

### Desktop Mode

- Each user's SQLite database is local; there is no shared write contention between users.
- The composite primary key and WAL mode together ensure that save, load, and delete operations complete in < 50 ms even with hundreds of saved cases.

---

## 19. Key Deliverables — v2.0 → v2.1 (2026-05-18 → 2026-06-17)

| Feature | Description | Status |
|---|---|---|
| **Azure AD Login** | Auto-redirect SSO using MSAL v5. `AuthGuard` calls `loginRedirect()` on unauthenticated web load. Electron unaffected. | ✅ Complete |
| **User-based case saving** | Web cases saved to Azure SQL Database per logged-in user (`OsUsername` = Azure AD email). `ApiCaseService.ts` handles all CRUD. `Project.tsx` conditionally routes to Electron IPC or API. | ✅ Complete |
| **JWT Bearer API auth** | `CasesController` decorated with `[Authorize]`. `Microsoft.Identity.Web` validates Bearer tokens from Azure AD. Frontend acquires token silently via `msalInstance.ts`. | ✅ Complete |
| **Polar chart direction algorithm** | Head sea (Y=180°) correctly appears at top of chart. `dataLoader.ts` expands Y=0:180 → 0:360, applies Y1=180−Y transform. Chart rotates with mean wave direction. | ✅ Complete |
| **Control file parsing** | Reads fields by comment keyword OR line position. Works with or without comment headers. Pure comment lines (`!`) excluded from positional counting. | ✅ Complete |
| **Web scroll/space fix** | `content-area.web-scroll { overflow-y: auto }` in `MainLayout.css`. `project-container { flex: 1 0 auto }` in `Project.css`. Electron CSS untouched — uses `isElectronMode` class guard, not height media queries. | ✅ Complete |
| **Security vulnerabilities** | `npm audit` → 0 vulnerabilities. Fixed `react-router`, `vite`, replaced `electron-rebuild` with `@electron/rebuild`, and all transitive dependencies. | ✅ Complete |
| **CI/CD pipelines** | All 4 GitHub Actions workflows operational (DEV + UAT, frontend + API). Branch-scoped OIDC, self-hosted deploy runner, `npm ci --ignore-scripts`, `--base=/` build flag. | ✅ Complete |

## 20. Open Questions and Decisions

| ID | Question | Status | Resolution |
|---|---|---|---|
| Q1 | Final production Azure subscription and resource naming | Open | Pending infrastructure decision |
| Q2 | Authentication for web mode users (Azure AD SSO vs. local accounts) | **Resolved** | Azure AD SSO implemented using MSAL v5. Auto-redirect flow — no custom login page. Users sign in with their ABS `@eagle.org` account. App Registration: `ea-ngea-croll-nonprod`. JWT Bearer validation on the API via `Microsoft.Identity.Web`. |
| Q3 | Data retention policy for saved cases in web mode | Open | — |
| Q4 | Backup strategy for Azure SQL Database | Open | — |
| Q5 | Log aggregation platform (Application Insights vs. Log Analytics) | Open | — |
| Q6 | CDN / Front Door for web frontend access | Open | — |
| Q7 | Compliance classification of vessel data files | Open | — |
| Q8 | Multi-region requirements | Open | Not required for initial release |
| Q9 | Auto-scaling rules for App Service | Open | — |
| Q10 | OIDC vs. service principal for CI/CD authentication | **Resolved** | OIDC federated credentials implemented and operational for both DEV and UAT pipelines. No stored client secrets. Branch-scoped subjects enforce environment isolation. |
| Q11 | Windows installer packaging for desktop app | **Resolved** | Packaged with `electron-builder`. Produces a standard Windows NSIS installer (`.exe`). Code signing is planned for production release. |

---

## 21. Glossary

| Term | Definition |
|---|---|
| Electron | Cross-platform desktop framework that embeds Chromium + Node.js. Used to package the React SPA as a Windows desktop application. |
| IPC | Inter-Process Communication. Electron's mechanism for the renderer process (React) to call Node.js APIs in the main process via `ipcRenderer.invoke` / `ipcMain.handle`. |
| Context Bridge | Electron security feature that exposes a controlled API surface (`window.electronAPI`) from the main process to the renderer without enabling full Node.js access in the browser context. |
| WAL | Write-Ahead Logging. A SQLite journal mode that improves concurrent read performance and crash resilience by writing changes to a separate log file before applying them to the main database file. |
| Composite Primary Key | A primary key consisting of more than one column. Used in the `cases` table as `(id, data_file_path)` to scope case uniqueness to a specific vessel/project. |
| Private Endpoint | An Azure networking feature that gives a resource (App Service, Blob Storage, SQL Database, Key Vault) a private IP address within a VNet, disabling public internet access. |
| OIDC | OpenID Connect. A federated identity protocol used by GitHub Actions to obtain short-lived Azure access tokens without storing a client secret. |
| Federated Credential | An Azure App Registration configuration that trusts tokens issued by GitHub Actions for a specific repository and branch. |
| Self-Hosted Runner | A GitHub Actions runner process running on infrastructure the team controls (inside the Azure VNet) rather than on GitHub's shared compute. Used to reach private endpoints during deployment. |
| Azure Firewall | A managed network security service that inspects and filters all traffic traversing the VNet. The route table (`rt-ngea-cr-001`) directs all egress through the firewall; only explicitly permitted flows are allowed. |
| App Registration | An Azure AD application identity used for OIDC authentication from GitHub Actions. The registration `ea-ngea-croll-nonprod` covers both DEV and UAT environments. |
| Managed Identity | A system-assigned identity for an Azure resource (e.g., an App Service) that can authenticate to other Azure services (e.g., Key Vault) without storing credentials. |
| schema_version | A single-row SQLite table that tracks the highest applied database migration version, enabling incremental, idempotent schema upgrades. |
| projectKey | A React state value (`controlFilePath ?? electronFolder ?? ''`) that uniquely identifies the currently loaded vessel/project. Used to scope case saves, loads, and deletes so operations from one vessel dataset cannot affect another. |
| chartImageUrl | A base64 PNG data URL captured from the canvas at case-save time and stored with the case record. Used in the report modal to display the frozen polar diagram rather than a re-render of current input state. |
| NSIS | Nullsoft Scriptable Install System. The installer technology used by `electron-builder` to produce the Windows setup executable for the desktop app. |
