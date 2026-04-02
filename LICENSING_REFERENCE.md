# 🔐 Licensing System - Quick Reference

## One-Minute Overview

Your PPROLL Electron app now has a complete licensing system:

```
┌─ User requests license → XML generated → Sent via email ─┐
│                                                           │
└─ Licensing team creates license → User installs → App runs ─┘
```

---

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| 🔧 Machine ID | `electron/services/machineIdentifier.ts` | Hardware identifier |
| 📋 License Manager | `electron/services/licenseManager.ts` | Core logic |
| 📧 Email Service | `electron/services/emailService.ts` | Email integration |
| 🎯 License Service | `src/services/licenseService.ts` | Frontend API |
| 🖼️ Dialog UI | `src/components/LicenseDialog.tsx` | User interface |
| ⚙️ Config | `src/config/licenseConfig.ts` | Settings |

---

## Common Operations

### Check if Licensed
```typescript
const status = await licenseService.checkLicenseStatus();
if (status.installed) {
  console.log(`Licensed! Expires ${status.expiresIn} days`);
}
```

### Generate Request
```typescript
const req = await licenseService.generateLicenseRequest(
  'user@company.com',
  'Acme Corp'
);
console.log('Request saved to:', req.filePath);
```

### Install License
```typescript
const fileData = await licenseService.selectLicenseFile();
if (fileData) {
  const result = await licenseService.installLicense(
    fileData.base64Content
  );
}
```

### Open License Dialog
```tsx
<button onClick={() => setLicenseOpen(true)}>
  🔐 Manage License
</button>
<LicenseDialog open={licenseOpen} onClose={() => setLicenseOpen(false)} />
```

---

## File Locations

### Windows AppData
```
%APPDATA%\proll_app\
├── licenses\
│   └── license.json          ← Active license
└── license-requests\
    └── license-request-*.xml  ← Request files
```

### Project Files
```
electron/services/             ← Backend services
src/services/                  ← Frontend services
src/components/                ← UI components
src/context/                   ← State management
src/config/                    ← Configuration
```

---

## Configuration

### Update App Version
```typescript
// src/config/licenseConfig.ts
appVersion: '1.0.0'  // ← CHANGE THIS

// Also update package.json
{
  "version": "1.0.0"
}
```

### Set License Secret
```bash
# .env.development
VITE_LICENSE_SECRET=dev-secret-key

# .env.production
VITE_LICENSE_SECRET=production-secret-key
```

### Change Licensing Email
```typescript
// src/config/licenseConfig.ts
licensingEmail: 'your-email@company.com'
```

---

## Development vs Production

### Development Mode
```
✓ License checks SKIPPED
✓ No enforcement
✓ Perfect for testing
✓ Run: npm run dev
```

### Production Mode
```
✓ License REQUIRED
✓ Validation enforced
✓ App blocks without license
✓ Run: npm run build
```

---

## Testing

### Quick Test
```bash
npm run dev
# Click "🔐 License" button → Dialog opens
# ✓ Dialog shows machine ID
# ✓ Can generate request
# ✓ Can install test license
```

### Test License File
```json
{
  "licenseKey": "TEST-KEY-123",
  "machineId": "YOUR_MACHINE_ID",
  "appName": "PPROLL",
  "appVersion": "1.0.0",
  "issuedDate": "2024-04-01T00:00:00Z",
  "expiryDate": "2099-12-31T23:59:59Z",
  "features": ["vessel-analysis", "polar-diagram"],
  "signature": "test-signature"
}
```

Save to: `%APPDATA%\proll_app\licenses\license.json`

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Dialog doesn't open | Import `LicenseDialog` component |
| Machine ID not showing | Check browser Console (F12) |
| Can't send email | Try "Open Folder" instead |
| License not found | Check `%APPDATA%\proll_app\licenses\` |
| Validation failed | License may be for different hardware |

---

## IPC API Reference

### Available Methods
```typescript
window.electronAPI.license.getStatus()           // Check license
window.electronAPI.license.getMachineInfo()      // Get machine ID
window.electronAPI.license.generateRequest()     // Create request
window.electronAPI.license.validate()            // Validate license
window.electronAPI.license.install(base64)       // Install license
window.electronAPI.license.remove()              // Remove license
window.electronAPI.license.openEmail()           // Open email
window.electronAPI.license.selectFile()          // Pick license file
window.electronAPI.license.getHistory()          // See all requests
```

---

## License Validation Checks

✅ **Machine Binding**: Licensed device = current device  
✅ **Expiry Date**: License not expired  
✅ **Signature**: File not tampered with  
✅ **App Version**: Version compatibility  
✅ **File Exists**: License.json present  

All must pass for validation.

---

## Database Locations

### License Storage
```
Windows:  C:\Users\[USER]\AppData\Roaming\proll_app\licenses\
Mac:      ~/Library/Application Support/proll_app/licenses/
Linux:    ~/.config/proll_app/licenses/
```

### License Requests
```
Windows:  C:\Users\[USER]\AppData\Roaming\proll_app\license-requests\
(Same pattern for Mac/Linux)
```

---

## Key Security Features

🔒 **Machine Binding** - License tied to hardware  
🔒 **Signature Checking** - Detects tampering  
🔒 **Expiry Validation** - Time-based licenses  
🔒 **Read-Only Storage** - Prevents accidental modification  
🔒 **Context Isolation** - Secure Electron IPC  

---

## Licensing Workflow

```
1. USER REQUESTS
   ↓
2. App generates Machine ID (based on hardware)
   ↓
3. App creates XML request with:
   - Machine ID
   - App version
   - Email
   - Organization
   ↓
4. File saved to: %APPDATA%/.../license-requests/
   ↓
5. User opens email and attaches XML file
   ↓
6. Sends to: svcEnggAppsAdminTest@eagle.org
   ↓
7. LICENSING TEAM PROCESSES
   ↓
8. Team verifies request
   ↓
9. Team generates license.json with:
   - Machine ID (from request)
   - Expiry date
   - Signature
   ↓
10. Team sends license.json back to user
    ↓
11. USER INSTALLS
    ↓
12. User opens app → License Dialog
    ↓
13. User clicks "Install License"
    ↓
14. User selects license.json file
    ↓
15. App validates:
    - Machine binding ✓
    - Signature ✓
    - Not expired ✓
    ↓
16. File saved to: %APPDATA%/.../licenses/license.json
    ↓
✅ APP NOW LICENSED AND RUNS!
```

---

## Environment Variables

### Development
```bash
VITE_LICENSE_SECRET=dev-key-12345
```

### Production
```bash
VITE_LICENSE_SECRET=<secure-key-here>
LICENSE_SECRET=<secure-key-here>
```

Use `openssl rand -hex 32` to generate secure key.

---

## Documentation

| File | Read This For |
|------|-------------|
| `LICENSING_QUICK_START.md` | 5-minute setup |
| `LICENSING_GUIDE.md` | Complete reference |
| `IMPLEMENTATION_SUMMARY.md` | What was built |
| `.env.example` | Environment setup |
| Code comments | Implementation details |

---

## Getting Help

1. **Read**: `LICENSING_QUICK_START.md`
2. **Reference**: `LICENSING_GUIDE.md`
3. **Check**: Console (F12 in app)
4. **Verify**: Environment variables
5. **Test**: Local license installation

---

## Quick Checklist

```
☐ License config updated
☐ App version set correctly
☐ Environment secrets configured
☐ License dialog imported
☐ Test with npm run dev
☐ Generate test request
☐ Create test license file
☐ Verify installation works
☐ Check AppData folder
☐ Review documentation
```

---

## Command Reference

```bash
# Development
npm run dev

# Build
npm run build
npm run build:electron

# Test licensing
npm run dev
# Then click License button

# Rebuild Electron
npm run build:electron

# Rebuild frontend
npm run build:web
```

---

## TypeScript Types

```typescript
// Check status
type LicenseStatus = {
  installed: boolean;
  expiresIn?: number;
  machineId: string;
};

// Machine info
type MachineInfo = {
  machineId: string;
  hostname: string;
  platform: string;
};

// License file
type License = {
  licenseKey: string;
  machineId: string;
  appName: string;
  appVersion: string;
  issuedDate: string;
  expiryDate: string;
  features: string[];
  signature: string;
};
```

---

## Production Deployment

```bash
# Before release:
1. Update version in package.json
2. Set LICENSE_SECRET in CI/CD
3. Test license flow
4. Document for users
5. Build: npm run build
6. Test executable
7. Release to users
```

---

**Ready to go!** 🚀

Questions? See the full docs or check the code comments.
