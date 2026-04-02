# POLAR APP - TECHNICAL DOCUMENTATION

---

## 1. EXECUTIVE SUMMARY

**Polar App** is a Windows offline desktop application for **vessel roll motion analysis** in polar coordinates. It helps marine operators assess vessel safety by visualizing roll angles under various sea conditions and vessel configurations.

### Key Features:
- ✅ **Real-time polar plot visualization** of vessel roll motion
- ✅ **Binary data file processing** (.bpolar format)
- ✅ **Dual display modes**: Continuous contour and Traffic light
- ✅ **Dual orientation modes**: North-up and Heads-up
- ✅ **Case management** for comparing multiple scenarios
- ✅ **PDF report generation** capability
- ✅ **Offline operation** - no internet required

### Technology Stack:
- **Frontend**: React + TypeScript + Vite
- **Desktop**: Electron (Windows)
- **Visualization**: HTML5 Canvas
- **UI Components**: Material UI (MUI v7) + Emotion
- **PDF Export**: jsPDF
- **Navigation**: React Router DOM
- **Charts**: Plotly.js (secondary charts)
- **Data Format**: Binary (.bpolar) with custom parser

---

## 2. APPLICATION OVERVIEW

### Purpose
The Polar App enables vessel operators and naval architects to:
1. **Assess vessel stability** under varying sea states
2. **Identify danger zones** (beam seas, rough conditions)
3. **Compare operating conditions** (different drafts, GM values, sea states)
4. **Generate compliance reports** for regulatory review

### User Workflow
```
1. Load Project Folder → 2. Load Control File → 3. Input Parameters →
4. View Polar Plot → 5. Save Case → 6. Generate Report
```

---

## 3. TECHNICAL ARCHITECTURE

### Directory Structure
```
proll_app/
├── src/
│   ├── App.tsx                           # Root app component
│   ├── main.tsx                          # React entry point
│   ├── Component/                        # Shared layout components
│   │   ├── Header.tsx                    # Frameless window title bar + controls
│   │   ├── Sidebar.tsx                   # Navigation sidebar
│   │   └── MainLayout.tsx               # App shell layout
│   ├── components/                       # Feature components
│   │   ├── CanvasPolarChart.tsx          # Main polar chart (HTML5 Canvas)
│   │   ├── ParameterInput.tsx            # User input form
│   │   ├── CaseManager.tsx               # Save/compare cases
│   │   ├── PolarChart.tsx                # Legacy polar chart
│   │   └── ProfessionalPolarChart.tsx    # Alternative chart variant
│   ├── services/
│   │   ├── dataLoader.ts                 # Binary file parser
│   │   ├── fileSystem.ts                 # File operations
│   │   ├── polarCalculations.ts          # Math utilities
│   │   ├── caseManager.ts               # Case save/load logic
│   │   └── parameterValidator.ts         # Input validation
│   ├── context/
│   │   ├── UserDataContext.tsx           # User input state
│   │   └── ElectronContext.tsx           # File system bridge
│   ├── types/
│   │   └── electron.d.ts                # Electron API type definitions
│   └── pages/
│       ├── Login.tsx                     # Authentication page
│       ├── Home.tsx                      # Landing page
│       └── Project.tsx                   # Main application
└── electron/
    ├── main.ts                           # Electron main process
    └── preload.ts                        # IPC bridge
```

### Data Flow Architecture
```
User Input → UserDataContext → DataLoader → Binary Parser →
Interpolation → CanvasPolarChart → Canvas Rendering → Display
```

---

## 4. FUNCTIONAL WORKFLOW

### Step 1: Project Initialization
**Action**: User selects project folder and control file

**Control File Format** (`.ctl`):
```
IMO=1234567
VesselName=Sample Vessel
GM_lower=0.5
GM_upper=5.0
Hs_lower=3.0
Hs_upper=12.0
Tz_lower=5.0
Tz_upper=18.0
Ts=10.5
Td=10.0
Ti=10.2
```
> Note: `Ts` = Scantling draft, `Td` = Design draft, `Ti` = Intermediate draft

**What Happens**:
- App validates project folder structure
- Parses control file to extract vessel parameters
- Sets parameter bounds for validation
- Displays representative draft values

---

### Step 2: User Data Input

**Vessel Operation Conditions**:
| Parameter | Description | Unit | Range | Effect on Roll |
|-----------|-------------|------|-------|----------------|
| **Draft Aft Peak** | Aft draft | meters | 0-40 | Higher draft = more inertia = less roll |
| **Draft Fore Peak** | Forward draft | meters | 0-40 | Affects trim and pitch coupling |
| **GM** | Metacentric Height | meters | 0.5-5.0 | **LOW GM = HIGH ROLL** (most critical) |
| **Heading** | Vessel direction | degrees | 0-360 | 0°=North, clockwise |
| **Speed** | Vessel speed | knots | 0-30 | Higher speed = more dynamic motion |
| **Max Allowed Roll** | Safety limit | degrees | 0-35 | Threshold for danger zones |

**Sea State Conditions**:
| Parameter | Description | Unit | Range | Effect on Roll |
|-----------|-------------|------|-------|----------------|
| **Significant Wave Height (Hs)** | Average wave height | meters | 3-12 | **HIGH Hs = HIGH ROLL** |
| **Mean Wave Period (Tz)** | Wave period | seconds | 5-18 | Affects resonance frequency |
| **Mean Wave Direction** | Wave incoming direction | degrees | 0-360 | Meteorological convention |

---

### Step 3: Database Search

**Search Algorithm** (3-level hierarchy):

```
1st Level: Draft Type
   └─ /design/ OR /intermediate/ OR /scantling/

2nd Level: GM (Metacentric Height)
   └─ Find closest folder: GM=1.0m, GM=1.5m, GM=2.0m, etc.

3rd Level: Hs & Tz (Sea State)
   └─ Find closest file: MAXROLL_H5.5_T10.0.bpolar
      Using Euclidean distance: √[(Hs₁-Hs₂)² + (Tz₁-Tz₂)²]
```

**Example**:
```
User Input: Draft=Design, GM=1.8m, Hs=7.5m, Tz=10.5s

Search Result:
  /design/GM=2.0m/bin/MAXROLL_H7.5_T10.5.bpolar

Fitted Parameters: GM=2.0m, Hs=7.5m, Tz=10.5s
```

---

### Step 4: Binary Data Reading

**Binary File Format** (`.bpolar`):
```
[ASCII Header (0x1F 0x21 prefix)]
[Metadata - 19 bytes]
[int32] numSpeeds         (e.g., 5)
[int32] numHeadings       (e.g., 13)
[float64[]] speeds        (e.g., [7.5, 10, 12.5, 15, 17.5])
[float64[]] headings      (e.g., [0, 30, 60, ..., 360])
[float64[][]] rollMatrix  (2D array: speeds × headings)
```

**Parser Implementation**:
```typescript
1. Skip ASCII headers (0x1F 0x21 pattern)
2. Find binary header (int32 pattern validation)
3. Read dimensions: numSpeeds, numHeadings
4. Skip 19 bytes metadata
5. Read speeds array (numSpeeds × float64)
6. Read headings array (numHeadings × float64)
7. Read roll matrix (numSpeeds × numHeadings × float64)
```

---

### Step 5: Data Interpolation

**Bilinear Interpolation Algorithm**:

Given:
- **Data points**: 5 speeds × 13 headings = 65 data points
- **Target**: Smooth contour with 60 speeds × 180 headings = 10,800 cells

**Formula**:
```
For target (speed_t, heading_t):

1. Find bracketing indices:
   speed_i0 ≤ speed_t ≤ speed_i1
   heading_j0 ≤ heading_t ≤ heading_j1

2. Calculate interpolation factors:
   s = (speed_t - speed_i0) / (speed_i1 - speed_i0)
   h = (heading_t - heading_j0) / (heading_j1 - heading_j0)

3. Bilinear interpolation:
   r00 = rollMatrix[i0][j0]
   r01 = rollMatrix[i0][j1]
   r10 = rollMatrix[i1][j0]
   r11 = rollMatrix[i1][j1]

   r0 = r00 × (1-h) + r01 × h
   r1 = r10 × (1-h) + r11 × h
   roll = r0 × (1-s) + r1 × s
```

---

## 5. WAVE DIRECTION CONVENTION

### Meteorological Convention (Used in this app)

**Wave Direction** = Direction waves are **COMING FROM**

```
        0° (North)
          ↓
          Waves coming FROM North

    270° ← ⬤ → 90°
    (West)  (East)

          180° (South)
```

### Coordinate Systems

#### 1. **User Input (Meteorological)**
- **Vessel Heading (α)**: Clockwise from North to vessel bow
- **Wave Direction (θ)**: Clockwise from North (incoming direction)

#### 2. **Data File (Vessel Coordinates)**
- **Relative Angle (β)**: Counter-clockwise from vessel bow
- Stored in binary file

#### 3. **Display Calculations**

**North-Up Mode**:
```
Display Angle = 180° + (α - β)
If angle < 0: add 360°
If angle ≥ 360°: subtract 360°
```

**Heads-Up Mode**:
```
Display Angle = 180° - β
If angle < 0: add 360°
If angle ≥ 360°: subtract 360°
```

### Example Calculation

**Given**:
- Vessel Heading (α) = 45° (Northeast)
- Data file angle (β) = 90° (Starboard beam in vessel coords)
- Wave Direction (user input) = 135° (Southeast)

**North-Up Display**:
```
Angle = 180° + (45° - 90°) = 135°
Wave arrow points FROM 135° (Southeast)
```

**Heads-Up Display**:
```
Angle = 180° - 90° = 90°
Wave arrow at 90° relative to vessel (starboard beam)
```

---

## 6. DISPLAY MODES

### 6.1 Continuous Mode

**Purpose**: Show detailed roll magnitude variation using color gradient

**Color Mapping** (Based on absolute roll values):
```
Roll Angle  │  Color          │  RGB Value
────────────┼─────────────────┼──────────────────────
0-3°        │  Deep Blue      │  rgb(0, 50, 180) → rgb(30, 150, 255)
3-5°        │  Blue → Cyan    │  rgb(30, 150, 255) → rgb(40, 250, 255)
5-7°        │  Cyan → Green   │  rgb(40, 250, 255) → rgb(60, 255, 100)
7-9°        │  Green → Yellow │  rgb(60, 255, 100) → rgb(180, 255, 0)
9-11°       │  Yellow         │  rgb(180, 255, 0) → rgb(255, 255, 0)
11-14°      │  Orange         │  rgb(255, 255, 0) → rgb(255, 155, 0)
14-maxRoll  │  Red            │  rgb(255, 155, 0) → rgb(255, 50, 50)
>maxRoll    │  Deep Red       │  rgb(255, 65, 50) → rgb(220, 0, 85)
```

**Use Cases**:
- Detailed analysis of roll distribution
- Identifying gradual transitions
- Research and development
- Optimization studies

---

### 6.2 Traffic Light Mode

**Purpose**: Quick visual safety assessment using 3 distinct zones

**Color Zones**:
```
Zone    │  Condition          │  Roll Range        │  Color      │  RGB
────────┼────────────────────┼───────────────────┼─────────────┼──────────
GREEN   │  Safe Operation     │  0° to (maxRoll-5°) │  Bright Green │  #00DD00
YELLOW  │  Caution Zone       │  (maxRoll-5°) to maxRoll │  Bright Yellow │  #FFDD00
RED     │  Danger Zone        │  > maxRoll         │  Red/Magenta │  #DD0055
```

**Example** (maxRoll = 15°):
```
GREEN:  0° - 10° roll  → Safe for operation
YELLOW: 10° - 15° roll → Approach with caution
RED:    > 15° roll     → Avoid operation
```

**Use Cases**:
- Quick operational decisions
- Real-time vessel routing
- Crew safety briefings
- Regulatory compliance checks

---

## 7. ORIENTATION MODES

### 7.1 North-Up Mode

**Behavior**:
- **Compass fixed**: N/E/S/W labels stay in geographic positions
- **Vessel rotates**: Vessel icon moves according to heading
- **Wave direction**: Shows absolute geographic direction

**Visual**:
```
        N (Fixed)
         ↑

    W ← [Plot] → E

         ↓
        S (Fixed)

Vessel at heading 45°: icon at NE position (45° clockwise from N)
Waves from 90°: arrow from E position
```

**Use Cases**:
- Navigation planning
- Chart correlation
- Geographic analysis
- Multiple vessel coordination

---

### 7.2 Heads-Up Mode

**Behavior**:
- **Vessel fixed**: Vessel icon always points UP (12 o'clock)
- **Compass rotates**: N/E/S/W labels rotate with vessel heading
- **Wave direction**: Shows relative to vessel bow

**Visual**:
```
    Vessel Bow ↑ (Always Up)
         ⛵


If vessel heading = 45°:
  N label appears at 45° position (NE on plot)
  E label appears at 135° position (SE on plot)

Waves from 90° (East) appear at:
  90° - 45° = 45° position (relative to vessel)
```

**Use Cases**:
- Onboard bridge display
- Helmsman situational awareness
- Vessel-centric decision making
- Intuitive operator interface

---

## 8. PARAMETER EFFECTS

### 8.1 GM (Metacentric Height)

**Effect**: **MOST CRITICAL PARAMETER** for roll magnitude

```
┌─────────────┬────────────────┬──────────────────────────────┐
│ GM Value    │ Stability      │ Expected Roll (Beam Seas)    │
├─────────────┼────────────────┼──────────────────────────────┤
│ 0.5 - 1.0m  │ LOW            │ 20-30° (DANGER)              │
│ 1.0 - 2.0m  │ MODERATE-LOW   │ 12-20° (High risk)           │
│ 2.0 - 3.0m  │ MODERATE       │ 8-15° (Moderate risk)        │
│ 3.0 - 4.0m  │ GOOD           │ 5-10° (Safe)                 │
│ > 4.0m      │ HIGH           │ 3-7° (Very safe, but stiff)  │
└─────────────┴────────────────┴──────────────────────────────┘
```

**Relationship**: Roll ∝ 1/GM (inverse relationship)

---

### 8.2 Significant Wave Height (Hs)

**Effect**: Wave energy and forcing magnitude

```
┌─────────────┬────────────────┬──────────────────────────────┐
│ Hs Value    │ Sea State      │ Effect on Roll               │
├─────────────┼────────────────┼──────────────────────────────┤
│ 0 - 2m      │ Calm to Slight │ Minimal roll (<5°)           │
│ 2 - 4m      │ Moderate       │ Moderate roll (5-10°)        │
│ 4 - 6m      │ Rough          │ Significant roll (10-15°)    │
│ 6 - 9m      │ Very Rough     │ High roll (15-20°)           │
│ > 9m        │ High/Phenomenal│ Extreme roll (>20°)          │
└─────────────┴────────────────┴──────────────────────────────┘
```

**Relationship**: Roll ∝ Hs (linear to slightly exponential)

---

### 8.3 Wave Period (Tz)

**Effect**: Resonance and dynamic amplification

```
Natural Roll Period = 2π × √(k/GM)  [k = radius of gyration]

When Tz ≈ Natural Period:
  → RESONANCE → Roll amplification up to 3-5×

When Tz << Natural Period:
  → Vessel doesn't have time to respond → Lower roll

When Tz >> Natural Period:
  → Slow forcing → Quasi-static → Moderate roll
```

**Typical Vessel Natural Periods**:
- **Small vessels**: 5-8 seconds
- **Medium vessels**: 8-12 seconds
- **Large vessels**: 12-18 seconds

---

### 8.4 Vessel Speed

**Effect**: Dynamic coupling and encounter frequency

```
Encounter Frequency = Wave Frequency ± (Speed/Wavelength) × cos(heading)

Higher Speed:
  ✓ Changes encounter frequency
  ✓ Increases hydrodynamic forces
  ✓ May hit resonance at different wave periods
  ✗ Generally INCREASES roll (5-15% per 5 knots)
```

---

### 8.5 Wave Direction

**Critical Directions**:

```
Direction       │ Angle  │ Condition    │ Roll Magnitude │ Safety
────────────────┼────────┼──────────────┼────────────────┼────────
Head Seas       │ 0°     │ SAFE         │ ★☆☆☆☆ (Minimal)│ ✓
Bow Quartering  │ 45°    │ MODERATE     │ ★★☆☆☆          │ ✓
Beam Seas       │ 90°    │ DANGER       │ ★★★★★ (MAX)    │ ✗
Stern Quarter   │ 135°   │ MODERATE     │ ★★★☆☆          │ ~
Following Seas  │ 180°   │ SAFE-MODERATE│ ★★☆☆☆          │ ✓
Beam Seas       │ 270°   │ DANGER       │ ★★★★★ (MAX)    │ ✗
```

**Rule of Thumb**: **AVOID BEAM SEAS (80-100°, 260-280°)**

---

## 9. COLOR CODING SYSTEM

### 9.1 Color Legend Interpretation

**Continuous Mode Scale** (Left sidebar):
```
│ 20.0 │ ← Maximum roll (user input)
│  ▓   │
│  ▓   │ Red/Magenta = DANGER (>maxRoll)
│  █   │
│  █   │ Orange = Approaching limit
│  █   │
│  █   │ Yellow = Moderate-high
│  █   │
│  █   │ Yellow-Green = Moderate
│  █   │
│  ░   │ Green = Low roll
│  ░   │
│  ░   │ Cyan = Very low roll
│  ░   │
│ 0.0  │ Blue = Minimal roll (safest)
```

---

### 9.2 Typical Color Distributions

**Example 1: Safe Conditions** (GM=3m, Hs=5m)
```
Plot appearance:
  - Large BLUE/CYAN areas at head/stern
  - GREEN bands at quartering angles
  - Small YELLOW patches
  - Minimal/no RED zones

Interpretation: Safe for operation in all directions
```

**Example 2: Marginal Conditions** (GM=2m, Hs=8m)
```
Plot appearance:
  - CYAN/GREEN at head/stern
  - YELLOW at quartering angles
  - ORANGE approaching beam seas
  - RED zones at 90°/270° (beam seas)

Interpretation: Avoid beam seas; head/quartering seas acceptable
```

**Example 3: Dangerous Conditions** (GM=1.5m, Hs=10m)
```
Plot appearance:
  - GREEN only in narrow head/stern sectors
  - YELLOW dominates most angles
  - Large RED zones at beam and quartering seas

Interpretation: Seek shelter; only head/stern seas marginally safe
```

---

## 10. TEST CASES & EXAMPLES

### Test Case 1: Safe Operation (Baseline)

**Input Parameters**:
```
Draft Type: Design
GM: 3.0 m
Heading: 0° (North)
Speed: 12 kn
Max Allowed Roll: 15°

Hs: 5.0 m
Tz: 10.0 s
Wave Direction: 90° (From East)
```

**Expected Output**:
```
Traffic Light Mode:
  - Large GREEN zones: 0°, 180° ± 60° (head/stern seas)
  - Small YELLOW bands: 60°, 120°, 240°, 300° (quartering)
  - RED zones: 90° ± 15°, 270° ± 15° (beam seas)

Continuous Mode:
  - BLUE/CYAN: 0°, 180° (3-5° roll)
  - GREEN: 30°, 150°, 210°, 330° (6-8° roll)
  - YELLOW: 60°, 120°, 240°, 300° (9-12° roll)
  - ORANGE/RED: 90°, 270° (15-18° roll)

Roll Values:
  - Head seas (0°): ~4°
  - Quartering (45°): ~9°
  - Beam seas (90°): ~16°
  - Stern seas (180°): ~5°
```

**Operational Decision**: ✓ SAFE - Avoid beam seas; all other directions acceptable

---

### Test Case 2: High Seas (Critical Conditions)

**Input Parameters**:
```
Draft Type: Design
GM: 1.5 m  ← LOW STABILITY
Heading: 45° (Northeast)
Speed: 15 kn
Max Allowed Roll: 15°

Hs: 9.0 m  ← ROUGH SEAS
Tz: 11.0 s
Wave Direction: 90° (From East)
```

**Expected Output**:
```
Traffic Light Mode:
  - Small GREEN zones: ~0° ± 20°, 180° ± 20° only
  - YELLOW zones: 30°, 60°, 150°, 210°, 240°, 330°
  - Large RED zones: 90° ± 45°, 270° ± 45° (expanded danger)

Continuous Mode:
  - CYAN: 0°, 180° only (7-9° roll)
  - GREEN: 20°, 160°, 200°, 340° (10-12° roll)
  - YELLOW: Dominates (13-16° roll)
  - ORANGE/RED: 60°-120°, 240°-300° (18-25° roll)

Roll Values:
  - Head seas (0°): ~8°
  - Quartering (45°): ~14°
  - Beam seas (90°): ~22° ← EXCEEDS LIMIT
  - Stern seas (180°): ~9°
```

**Operational Decision**: ⚠️ CAUTION - Seek shelter; maintain heading 0° or 180° only

---

### Test Case 3: Draft Type Comparison

**Constant Parameters**:
```
GM: 2.0 m
Heading: 0°
Speed: 14 kn
Max Allowed Roll: 20°
Hs: 6.0 m
Tz: 10.0 s
Wave Direction: 135° (From Southeast)
```

**Varying Parameter**: Draft Type

**Expected Results**:
```
┌──────────────┬──────────────┬────────────────┬──────────────┐
│ Draft Type   │ Draft Value  │ Beam Roll (90°)│ Assessment   │
├──────────────┼──────────────┼────────────────┼──────────────┤
│ Scantling    │ 10.5 m       │ 14-16°         │ Moderate     │
│ Design       │ 10.0 m       │ 15-17°         │ Moderate-High│
│ Intermediate │ 10.2 m       │ 14.5-16.5°     │ Moderate     │
└──────────────┴──────────────┴────────────────┴──────────────┘

Interpretation:
  - Higher draft (Scantling) = slightly more inertia = marginally less roll
  - Differences are typically < 2° for similar conditions
  - GM and Hs have much stronger effects than draft
```

---

### Test Case 4: Orientation Mode Comparison

**Input Parameters**:
```
GM: 2.5 m
Heading: 45° (Northeast)
Speed: 12 kn
Max Allowed Roll: 15°
Hs: 6.0 m
Tz: 10.0 s
Wave Direction: 90° (From East)
```

**North-Up Mode**:
```
Visual:
  - Vessel icon at 45° position (NE)
  - Wave arrow from 90° position (E)
  - N label at top (12 o'clock)
  - Danger zone appears at E and W (geographic)

Use for: Navigation, chart correlation
```

**Heads-Up Mode**:
```
Visual:
  - Vessel icon at top (12 o'clock), pointing up
  - Wave arrow from 45° position (relative: 90° - 45° = 45°)
  - N label at 45° position (rotated with vessel)
  - Danger zone appears at 45° and 225° (vessel-relative)

Use for: Bridge display, helmsman awareness
```

**Data**: Both modes show identical roll values, only orientation differs

---

### Test Case 5: Wave Period Resonance

**Constant Parameters**:
```
GM: 2.0 m (Natural period ≈ 10 seconds)
Heading: 0°
Speed: 12 kn
Hs: 7.0 m
Wave Direction: 90°
```

**Varying Parameter**: Tz (Wave Period)

**Expected Results**:
```
┌────────┬─────────────────┬────────────────┬──────────────┐
│ Tz (s) │ Resonance       │ Beam Roll (90°)│ Effect       │
├────────┼─────────────────┼────────────────┼──────────────┤
│ 6.0    │ Below resonance │ 12-14°         │ Moderate     │
│ 8.0    │ Approaching     │ 15-18°         │ High         │
│ 10.0   │ RESONANCE       │ 22-25°         │ CRITICAL ⚠️  │
│ 12.0   │ Above resonance │ 16-19°         │ High         │
│ 14.0   │ Well above      │ 13-16°         │ Moderate-High│
└────────┴─────────────────┴────────────────┴──────────────┘

Interpretation:
  - Peak roll occurs near natural period (Tz ≈ 10s)
  - Avoid operating at resonance if possible
  - If unavoidable, reduce speed or alter heading
```

---

### Test Case 6: Speed Effect

**Constant Parameters**:
```
GM: 2.5 m
Heading: 0°
Hs: 6.0 m
Tz: 10.0 s
Wave Direction: 135° (Quartering seas)
Max Allowed Roll: 15°
```

**Varying Parameter**: Speed

**Expected Results**:
```
┌─────────────┬──────────────────┬──────────────┬────────────┐
│ Speed (kn)  │ Encounter Period │ Roll (135°)  │ Safety     │
├─────────────┼──────────────────┼──────────────┼────────────┤
│ 0 (Drifting)│ 10.0 s          │ 10-12°       │ SAFE ✓     │
│ 8           │ 9.2 s           │ 11-13°       │ SAFE ✓     │
│ 12          │ 8.7 s           │ 12-14°       │ SAFE ✓     │
│ 16          │ 8.1 s           │ 13-15.5°     │ MARGINAL ~ │
│ 20          │ 7.5 s           │ 14-16°       │ CAUTION ⚠️ │
└─────────────┴──────────────────┴──────────────┴────────────┘

Interpretation:
  - Higher speed generally increases roll (5-10%)
  - Speed also changes encounter frequency
  - For this case: Keep speed ≤ 16 kn to stay below limit
```

---

## 11. DATA FILE STRUCTURE

### Directory Organization

```
C:\PolarData\
│
├── proll_updated_for_PROLL_App.ctl    # Control file
│
├── design\                             # Design draft condition
│   ├── GM=1.0m\
│   │   ├── bin\                        # Binary data files
│   │   │   ├── MAXROLL_H5.5_T7.5.bpolar
│   │   │   ├── MAXROLL_H5.5_T8.0.bpolar
│   │   │   └── ... (multiple Hs/Tz combinations)
│   │   └── plots\                      # Reference plots (PNG)
│   │       ├── POLAR_ROLL_H5.5_T7.5_polarplot.png
│   │       └── ...
│   ├── GM=1.5m\
│   │   └── ... (same structure)
│   └── GM=2.0m\
│       └── ...
│
├── intermediate\                       # Intermediate draft
│   └── ... (same structure as design)
│
└── scantling\                          # Scantling draft
    └── ... (same structure as design)
```

### File Naming Convention

**Binary Files**: `MAXROLL_H{Hs}_T{Tz}.bpolar`

Examples:
- `MAXROLL_H5.5_T10.0.bpolar` → Hs=5.5m, Tz=10.0s
- `MAXROLL_H8.0_T12.5.bpolar` → Hs=8.0m, Tz=12.5s

**Plot Files**: `POLAR_ROLL_H{Hs}_T{Tz}_polarplot.png`

---



