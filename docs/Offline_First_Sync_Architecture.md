# PRoll Diagram App — Offline-First with Optional Sync
## Detailed Architecture Document

**Prepared by:** Development Team
**Date:** April 2026
**Application:** ABS PRoll Diagram App (Vite + Electron, Windows Desktop)

---

## Core Idea

The app works **fully offline at all times** using a local SQLite database embedded directly inside Electron. No local server, no localhost API, no extra process running.

When the user has an internet connection, the app pushes saved data to a remote backend server via a simple sync API call.

That's it. Two pieces:
1. **SQLite** — always available, lives inside the app
2. **Sync API** — called only when internet is detected

---

## Architecture Diagram

```
┌──────────────────────────────────────────────┐
│              User's Windows Machine           │
│                                               │
│   ┌─────────────────────────────────────┐    │
│   │          Electron App               │    │
│   │                                     │    │
│   │   ┌──────────────┐                  │    │
│   │   │  React UI    │                  │    │
│   │   │  (Renderer)  │                  │    │
│   │   └──────┬───────┘                  │    │
│   │          │  IPC                     │    │
│   │   ┌──────▼───────────────────────┐  │    │
│   │   │   Electron Main Process      │  │    │
│   │   │   (Node.js)                  │  │    │
│   │   │                              │  │    │
│   │   │   ┌──────────────────────┐   │  │    │
│   │   │   │  better-sqlite3      │   │  │    │
│   │   │   │  (local SQLite DB)   │   │  │    │
│   │   │   └──────────────────────┘   │  │    │
│   │   │                              │  │    │
│   │   │   ┌──────────────────────┐   │  │    │
│   │   │   │  Sync Service        │   │  │    │
│   │   │   │  (checks internet,   │   │  │    │
│   │   │   │   posts unsynced     │   │  │    │
│   │   │   │   records)           │   │  │    │
│   │   │   └──────────┬───────────┘   │  │    │
│   │   └──────────────┼───────────────┘  │    │
│   └──────────────────┼───────────────── ┘    │
└──────────────────────┼───────────────────────┘
                       │
             Internet available?
                       │
                       ▼
        ┌──────────────────────────┐
        │     Company Server       │
        │                          │
        │  ┌──────────────────┐    │
        │  │  .NET Core       │    │
        │  │  Sync API        │    │
        │  │  (POST /sync)    │    │
        │  └────────┬─────────┘    │
        │           │              │
        │  ┌────────▼─────────┐    │
        │  │  Central DB      │    │
        │  │  (SQL Server /   │    │
        │  │   PostgreSQL)    │    │
        │  └──────────────────┘    │
        └──────────────────────────┘
```

---

## How It Works — Step by Step

### Step 1 — App Opens (Always Works, No Internet Needed)
- Electron starts, SQLite database file opens from the user's app data folder
- All existing saved cases load instantly from local SQLite
- Zero network calls on startup

### Step 2 — Engineer Runs Calculation and Saves a Case
- User runs polar diagram analysis as normal
- Clicks "Save Case" — record written to **local SQLite immediately**
- Record is tagged `synced = false` in the database
- UI confirms save — done. No waiting for any server.

### Step 3 — Internet Check (Background, Silent)
- App checks for internet connectivity in the background (simple ping or connectivity check)
- If **no internet** → nothing happens, engineer continues working normally
- If **internet available** → Sync Service activates

### Step 4 — Sync Runs
- Sync Service reads all records where `synced = false` from local SQLite
- Posts them to the remote **Sync API** (`POST /api/sync`)
- Server receives the records, stores them in the central database
- Server responds with success
- App marks those records as `synced = true` in local SQLite
- A small indicator in the UI shows "Synced ✓" or "Pending sync"

### Step 5 — Management Views Central Data
- Management or admin logs into a web dashboard (separate from the desktop app)
- All synced records from all machines visible in one place
- Can filter by engineer, date, vessel, route, etc.

---

## What Gets Saved to SQLite (Local)

Each saved analysis case stores:

| Field | Description |
|---|---|
| `id` | Unique ID (UUID generated locally) |
| `created_at` | Timestamp of when case was saved |
| `username` | OS username of the engineer |
| `machine_name` | Computer hostname |
| `case_id` | User-entered case label |
| `vessel_name` | From vessel data |
| `draft_aft` | Input parameter |
| `draft_fore` | Input parameter |
| `gm` | Metacentric height input |
| `speed` | Vessel speed input |
| `heading` | Vessel heading input |
| `max_roll` | Maximum allowed roll angle |
| `wave_direction` | Sea state input |
| `hs` | Significant wave height |
| `wave_period` | Wave period (Tz/Tp/Tm) |
| `fitted_draft` | Closest matched draft from data files |
| `fitted_gm` | Closest matched GM from data files |
| `fitted_hs` | Closest matched Hs |
| `fitted_tz` | Closest matched Tz |
| `chart_image` | PNG snapshot of polar chart (base64) |
| `pdf_report` | PDF report bytes (base64) — optional |
| `synced` | `true` / `false` — has this been pushed to server |

---

## The Sync API (Remote — .NET Core)

This is the **only backend needed**. One endpoint, simple and clean.

### Endpoint
```
POST /api/sync
Content-Type: application/json
Authorization: Bearer <token>   (if auth is required)
```

### Request Body
```json
{
  "machine_id": "DESKTOP-AB12CD",
  "username": "niranjan",
  "records": [
    {
      "id": "uuid-here",
      "created_at": "2026-04-09T10:30:00Z",
      "case_id": "CASE-001",
      "draft_aft": 11.5,
      "draft_fore": 10.8,
      "gm": 1.5,
      "speed": 14.0,
      "heading": 180,
      "max_roll": 20.0,
      "hs": 4.5,
      "wave_period": 10.5,
      "wave_direction": 270,
      "fitted_draft": 11.0,
      "fitted_gm": 1.5,
      "fitted_hs": 4.5,
      "fitted_tz": 10.5
    }
  ]
}
```

### Response
```json
{
  "synced_ids": ["uuid-here"],
  "failed_ids": []
}
```

App marks `synced = true` for all IDs in `synced_ids`.

---

## Technology Choices

### Local SQLite (Inside Electron)
- **Library:** `better-sqlite3`
- **Why:** Synchronous, fast, no separate process, works natively in Electron/Node.js
- **DB file location:** `C:\Users\<username>\AppData\Roaming\PRollDiagramApp\cases.db`
- **No Java, no localhost server, no extra process**

### Remote Sync API
- **Framework:** .NET Core Web API (as management requested)
- **Database:** SQL Server or PostgreSQL on the company server
- **Deployment:** Company's internal server or cloud (Azure, AWS)
- **Auth:** API key or JWT token (simple, no user login needed on desktop side)

---

## Sync Trigger Options

Management can choose how sync is triggered:

| Mode | Behavior | Recommended? |
|---|---|---|
| **On app start** | Syncs automatically when app opens and internet is detected | ✅ Yes |
| **On case save** | Tries to sync immediately after every save | ✅ Yes (simple) |
| **Manual button** | Engineer clicks "Sync Now" button | Optional (fallback) |
| **Scheduled** | Syncs every 30 minutes if internet available | Optional |

**Recommended:** Sync on case save + sync on app start. Engineer never has to think about it.

---

## What Happens in Each Scenario

| Scenario | Behavior |
|---|---|
| No internet, save case | Saved to SQLite locally. Syncs later automatically. |
| Internet available, save case | Saved to SQLite + immediately synced to server. |
| Internet drops mid-session | Already-synced records stay synced. New saves queue locally. |
| Internet restored | App detects connection, pushes all pending records. |
| Engineer changes machine | Previous machine's data already synced. New machine starts fresh local DB. |
| Server is down | App works normally offline. Syncs when server is back. |

---

## What Does NOT Change in the App

| Feature | Impact |
|---|---|
| Polar diagram calculation | No change |
| .bpolar file reading | No change |
| PDF generation + watermark | No change |
| License check | No change |
| Chart visualization | No change |
| App startup speed | No change (SQLite opens in milliseconds) |

---

## Comparison: Old vs New

| | Current App | With This Architecture |
|---|---|---|
| Case storage | In-memory (lost on close) | SQLite (permanent) |
| Case history | None | Full local history |
| Cross-machine visibility | None | Via sync to central server |
| Offline capability | ✅ Full | ✅ Full (unchanged) |
| Extra process needed | None | None |
| Local server needed | No | **No** |
| Internet required | No | No (sync is optional) |

---

## Implementation Phases

### Phase 1 — Local SQLite (2 to 3 weeks)
- Add `better-sqlite3` to Electron
- Create local DB schema and IPC handlers
- Replace in-memory `CaseManager` with SQLite reads/writes
- Cases now persist across sessions
- Engineers immediately benefit — no server needed yet

### Phase 2 — Remote Sync API (3 to 4 weeks)
- Build .NET Core Web API with `POST /api/sync` endpoint
- Deploy on company server
- Add Sync Service to Electron (connectivity check + POST)
- Add sync status indicator to UI
- Management can now see all synced data

### Phase 3 — Management Dashboard (Optional, separate effort)
- Web-based dashboard reading from central DB
- Filter by user, machine, date, vessel
- Export reports centrally

---

## Decision Required from Management

| Question | Why It Matters |
|---|---|
| Is a company server available? | Required for the sync API in Phase 2 |
| Should sync require authentication? | Determines if API key or user login needed |
| What data should management see in the dashboard? | Shapes the central DB schema |
| Is Phase 1 (local SQLite only) acceptable as first delivery? | Allows faster first release |
| Should chart images and PDFs also sync, or just case data? | Affects payload size and storage on server |

---

## Summary

> The app stays 100% offline. SQLite lives inside Electron — no localhost server, no extra process.
> When internet is available, one API call pushes unsynced records to the company server.
> Management sees everything centrally. Engineers are never blocked.

This is the simplest possible path to both offline reliability and central visibility.

---

*Document prepared for internal review.*
