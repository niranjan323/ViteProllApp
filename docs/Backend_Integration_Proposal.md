# PRoll Diagram App — Backend Integration Proposal

**Prepared by:** Development Team
**Date:** April 2026
**Application:** ABS PRoll Diagram App (Vite + Electron, Windows Desktop)

---

## Current State

The PRoll Diagram App is a **fully offline Windows desktop application**. All computation, data parsing, and report generation happens locally on the user's machine. There is no server, no database, and no network communication.

**Current limitations this proposal addresses:**
- Analysis cases are lost when the app is closed (stored in memory only)
- No audit trail of who ran what calculation and when
- No way to share or review results across engineers or machines
- No central visibility for management or compliance teams

---

## Option 1 — Embedded Local Backend (Fully Offline)

### Concept
A **.NET Core Web API** runs silently inside the app on the user's machine. The app talks to it locally. No internet required, ever.

```
┌─────────────────────────────────────────┐
│           User's Windows Machine        │
│                                         │
│  ┌─────────────┐      ┌──────────────┐  │
│  │ React UI    │─────▶│ .NET Core    │  │
│  │ (Electron)  │      │ API          │  │
│  └─────────────┘      │ (localhost)  │  │
│                       └──────┬───────┘  │
│                              │          │
│                       ┌──────▼───────┐  │
│                       │  SQLite DB   │  │
│                       │  (on disk)   │  │
│                       └──────────────┘  │
└─────────────────────────────────────────┘
```

### What it Enables
- Cases saved permanently to a local SQLite database — survive app restarts
- Full audit log on each machine (who ran what, when, with which parameters)
- PDF report history stored locally
- Standard .NET Core REST API — easy to extend later

### What Stays the Same
- App works with zero internet connection
- License check, file reading, polar calculations — all unchanged
- No change to how engineers use the app day-to-day

### Technical Notes
- .NET Core API starts automatically when the app opens, stops when it closes
- SQLite database is a single file on the user's machine (no SQL Server needed)
- The .NET runtime either bundled inside the installer (~150MB extra) or pre-installed on machine

### Pros
| | |
|---|---|
| ✅ | Fully offline — works everywhere |
| ✅ | Satisfies the .NET Core requirement |
| ✅ | Clean, industry-standard architecture |
| ✅ | Easy to upgrade to Option 2 later with no frontend changes |
| ✅ | Data persists across sessions |

### Cons
| | |
|---|---|
| ❌ | Data is isolated per machine — no central visibility |
| ❌ | Installer size increases (~150MB if .NET runtime bundled) |
| ❌ | No cross-machine reporting or management dashboard |

### Effort Estimate
**Medium** — 3 to 4 weeks

---

## Option 2 — Central Remote Backend (Online Required)

### Concept
A **.NET Core Web API** hosted on a company server. The app sends and receives data over the network. Internet or company VPN required to use the app.

```
┌──────────────────┐          ┌─────────────────────────┐
│  User's Machine  │          │    Company Server        │
│                  │          │                          │
│  ┌────────────┐  │  HTTPS   │  ┌────────────────────┐ │
│  │ React UI   │──┼─────────▶│  │  .NET Core Web API │ │
│  │ (Electron) │  │          │  └────────────┬───────┘ │
│  └────────────┘  │          │               │         │
│                  │          │  ┌────────────▼───────┐ │
└──────────────────┘          │  │  SQL Server / DB   │ │
                              │  └────────────────────┘ │
                              └─────────────────────────┘
```

### What it Enables
- All engineers' data stored in one central database
- Management dashboard — see all calculations, all users, all reports
- Full audit trail across the organization
- Reports accessible from any machine
- Role-based access (engineer vs reviewer vs admin)

### What Changes
- App **requires network connectivity** to function — cannot be used offline
- Authentication needed (login with ABS credentials or Active Directory)
- Company must provision and maintain a server

### Pros
| | |
|---|---|
| ✅ | Full organizational visibility |
| ✅ | Centralized audit and compliance reporting |
| ✅ | Management dashboard possible |
| ✅ | Data never lost even if user's machine fails |

### Cons
| | |
|---|---|
| ❌ | **Breaks offline requirement** — app fails without network |
| ❌ | Engineers on ships or remote sites cannot use the app |
| ❌ | Requires server provisioning, maintenance, backups |
| ❌ | Higher infrastructure cost |
| ❌ | Highest development effort |

### Effort Estimate
**High** — 6 to 10 weeks

---

## Option 3 — Offline-First with Optional Sync (Recommended)

### Concept
Best of both worlds. The app always works offline using a **local SQLite database** (like Option 1). When the user has internet, they can **sync their data to a central server** with one click — or automatically in the background.

```
┌────────────────────────────────────────────┐
│             User's Windows Machine          │
│                                             │
│  ┌──────────────┐      ┌─────────────────┐  │
│  │  React UI    │─────▶│  .NET Core API  │  │
│  │  (Electron)  │      │  (localhost)    │  │
│  └──────────────┘      └────────┬────────┘  │
│                                 │            │
│                        ┌────────▼────────┐  │
│                        │  SQLite (local) │  │
│                        └────────┬────────┘  │
└─────────────────────────────────┼───────────┘
                                  │
                    Internet available?
                         │
              ┌──────────▼──────────────┐
              │    Company Server        │
              │  ┌─────────────────────┐ │
              │  │  .NET Core Web API  │ │
              │  └──────────┬──────────┘ │
              │             │            │
              │  ┌──────────▼──────────┐ │
              │  │  Central Database   │ │
              │  └─────────────────────┘ │
              └──────────────────────────┘
```

### How It Works — Step by Step

1. **Engineer opens the app** — works immediately, no internet check
2. **Engineer runs calculations, saves cases** — all saved to local SQLite
3. **App checks for internet connection** in the background
4. **If connected** — a "Sync to Server" button appears (or auto-syncs silently)
5. **Data pushed to central server** — marked as synced in local DB
6. **If offline** — data stays local, syncs next time connection is available
7. **Management views central dashboard** — sees all synced data from all machines

### Sync Logic
- Each record has a `synced` flag (true/false) in local SQLite
- On sync: only unsynced records are pushed to server
- Conflict resolution: local data always wins (offline-first principle)
- Sync can be manual (button) or automatic (on app start / every N minutes)

### What it Enables
| Feature | Offline | After Sync |
|---|---|---|
| Save cases | ✅ | ✅ |
| View own history | ✅ | ✅ |
| Generate PDF reports | ✅ | ✅ |
| Audit trail | Local only | Central + visible to management |
| Cross-machine visibility | ❌ | ✅ |
| Management dashboard | ❌ | ✅ |

### Pros
| | |
|---|---|
| ✅ | **App always works offline** — no dependency on network |
| ✅ | Engineers on ships/remote sites are not blocked |
| ✅ | Central visibility for management when synced |
| ✅ | Gradual rollout — start with Option 1, add sync later |
| ✅ | Proven pattern used by major enterprise apps (Jira, Salesforce offline mode) |

### Cons
| | |
|---|---|
| ❌ | Most complex to build (two backends — local + remote) |
| ❌ | Sync conflict handling needs careful design |
| ❌ | Requires both local .NET runtime and server infrastructure |

### Effort Estimate
**High** — 8 to 12 weeks (but can be phased — deliver Option 1 first, add sync in Phase 2)

---

## Side-by-Side Comparison

| Criteria | Option 1 — Local Only | Option 2 — Remote Only | Option 3 — Offline + Sync |
|---|---|---|---|
| Works offline | ✅ Always | ❌ Never | ✅ Always |
| Data persists | ✅ Local | ✅ Central | ✅ Both |
| Management visibility | ❌ None | ✅ Full | ✅ After sync |
| Audit trail | Local only | Central | Both |
| Server required | ❌ No | ✅ Yes | ✅ Yes (optional) |
| .NET Core used | ✅ Yes | ✅ Yes | ✅ Yes (both) |
| Risk to existing app | Low | High | Medium |
| Development effort | Medium | High | High |
| Recommended for | Quick win | Future state | **Best long-term** |

---

## Recommendation

**Start with Option 1, build toward Option 3.**

- **Phase 1** (Option 1): Deliver the embedded local backend with SQLite. Engineers get persistent storage and local audit trails immediately. Low risk, medium effort.
- **Phase 2** (Option 3 Sync): Add the central server and sync capability. Management gets organizational visibility without disrupting engineers.

This phased approach means the team delivers value quickly while building toward the full vision management is asking for.

---

## Decision Required from Management

Before development begins, the following decisions are needed:

| Question | Why It Matters |
|---|---|
| Should the app work without internet? | Determines if Option 2 is viable at all |
| Is a company server available to host the API? | Required for Options 2 and 3 |
| Should the .NET runtime be bundled in the installer? | Affects installer size and IT deployment requirements |
| Is a phased delivery acceptable (local first, sync later)? | Determines timeline and scope |
| Who needs access to the central dashboard — and what do they need to see? | Shapes the server-side data model |

---

*Document prepared for internal review. All options use .NET Core Web API as the backend framework as requested.*
