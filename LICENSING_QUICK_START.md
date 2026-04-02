# PPROLL Licensing System - Quick Start

## 🚀 Quick Integration (5 minutes)

### 1. Install Dependencies (Already Done)
All required dependencies are included in package.json:
- `crypto` (built-in Node.js)
- `os` (built-in Node.js)
- `electron` (already installed)
- `@mui/material` (for UI)

### 2. Add License Dialog to Your App

Open `src/App.tsx` and add:

```tsx
import { useState } from 'react';
import LicenseDialog from './components/LicenseDialog';

function App() {
  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);

  return (
    <div>
      {/* Your existing app */}
      
      {/* Add this button somewhere in your header */}
      <button onClick={() => setLicenseDialogOpen(true)}>
        🔐 License
      </button>
      
      {/* Add this component */}
      <LicenseDialog 
        open={licenseDialogOpen}
        onClose={() => setLicenseDialogOpen(false)}
      />
    </div>
  );
}

export default App;
```

### 3. Test It

```bash
# Development mode (skip license check):
npm run dev

# Production mode (requires valid license):
npm run build
npm run electron
```

---

## 📋 File Summary

| File | Purpose | Type |
|------|---------|------|
| `electron/services/licenseManager.ts` | Core licensing logic | Backend |
| `electron/services/machineIdentifier.ts` | Machine ID generation | Backend |
| `electron/services/emailService.ts` | Email integration | Backend |
| `src/services/licenseService.ts` | Frontend API wrapper | Frontend |
| `src/services/licenseStartupHandler.ts` | Startup enforcement | Frontend |
| `src/components/LicenseDialog.tsx` | UI for licenses | Frontend |
| `src/context/LicenseContext.tsx` | Global state (optional) | Frontend |
| `src/config/licenseConfig.ts` | Configuration | Config |
| `LICENSING_GUIDE.md` | Full documentation | Docs |

---

## 🔧 Configuration

Edit `src/config/licenseConfig.ts`:

```typescript
export const licenseConfig = {
  appName: 'PPROLL',
  appVersion: '1.0.0',  // ← Update this
  licensingEmail: 'svcEnggAppsAdminTest@eagle.org',
  // ... other settings
};
```

---

## 📧 Email Setup

### Option 1: User's Default Email Client (Recommended)
No setup required! The system opens the user's email client automatically.

### Option 2: SMTP (For Server-Side Sending)
1. Install optional package:
```bash
npm install nodemailer @types/nodemailer
```

2. Set environment variables:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

3. Enable in config: `licenseConfig.smtp.enabled = true`

---

## 🔐 Security Setup

### Development
```bash
# Create .env.development
VITE_LICENSE_SECRET=dev-secret-key-12345
```

### Production
```bash
# Set in environment (CI/CD, Docker, etc)
export VITE_LICENSE_SECRET=your-secure-production-key
```

⚠️ **Never commit secrets to Git!**

---

## ✅ Testing Checklist

- [ ] Run `npm run dev` - should not check license
- [ ] Click "🔐 License" button - should open dialog
- [ ] Click "Request License" - should generate XML
- [ ] Machine ID displays - should be consistent
- [ ] Email button opens email client
- [ ] Folder button opens file explorer
- [ ] XML is valid (can be parsed)

### Test License Installation

```bash
# Create a test license file (license.json) in %APPDATA%/proll_app/licenses/

{
  "licenseKey": "TEST-KEY-123456",
  "machineId": "YOUR_MACHINE_ID_HERE",
  "appName": "PPROLL",
  "appVersion": "1.0.0",
  "issuedDate": "2024-04-01T10:00:00Z",
  "expiryDate": "2099-12-31T23:59:59Z",
  "features": ["vessel-analysis", "polar-diagram", "report-generation"],
  "signature": "test-signature"
}
```

---

## 🎯 Common Tasks

### Get Machine ID
```typescript
import { generateMachineId } from './electron/services/machineIdentifier';

const machineId = generateMachineId();
console.log(machineId);  // e.g., "ABC123DEF456"
```

### Check License Status
```typescript
const status = await licenseService.checkLicenseStatus();
console.log(status.installed);   // true/false
console.log(status.expiresIn);   // days remaining
console.log(status.machineId);   // unique device ID
```

### Programmatically Generate & Send

```typescript
// Generate request
const { xmlContent, filePath } = 
  await licenseService.generateLicenseRequest(
    'user@company.com',
    'Acme Corp'
  );

// Send email
await licenseService.openEmailClient('licensing@company.com');

// Or with SMTP
await sendViaSmtp(smtpConfig, {
  to: 'licensing@company.com',
  subject: 'PPROLL License Request',
  text: 'See attachment',
  attachments: [{ path: filePath }]
});
```

### Remove License
```typescript
const removed = await licenseService.removeLicense();
// License file deleted from AppData
```

---

## 📍 File Locations

All license files are stored in AppData:

```
Windows:
  C:\Users\[USER]\AppData\Roaming\proll_app\
  ├── licenses/
  │   └── license.json          (active license)
  └── license-requests/
      ├── license-request-[timestamp].xml
      └── ...
```

---

## 🐛 Troubleshooting

### License Not Showing
1. Check console for errors: `F12` → Console tab
2. Verify Electron is imported: `require('electron')`
3. Rebuild: `npm run build:electron`

### Can't Open Email
- Windows may block shell.openExternal()
- Try opening folder and attaching manually

### Machine ID Not Matching
- Hardware changed? License is machine-specific
- Requests a new license with updated machine ID

### License File Not Found
- Check `%APPDATA%\proll_app\licenses\`
- Verify Windows permissions (read/write allowed)
- Try removing and reinstalling

### Strange Error Messages?
```bash
# Clear and rebuild everything
rm -r dist-electron node_modules
npm install
npm run build:electron
npm run dev
```

---

## 🚀 Next Steps

### For Testing
1. Install on dev machine
2. Request license
3. Create test license (see Testing section)
4. Install and verify

### For Production
1. Set up licensing server
2. Configure environment secrets
3. Enable license enforcement in config
4. Test thoroughly
5. Distribute to users

### For Distribution
1. Package app: `npm run build`
2. Users extract and run executable
3. First run prompts for license
4. License stored in AppData (persists)

---

## 📞 Support

**Email to Request Licenses:**
svcEnggAppsAdminTest@eagle.org

**License Request Folder:**
%APPDATA%/proll_app/license-requests/

**Debug Info:**
Open DevTools: `View → Developer → Toggle Developer Tools`

---

## 📚 Learn More

See `LICENSING_GUIDE.md` for:
- System architecture
- Security details
- Advanced configuration
- Server-side implementation
- Future improvements

---

**Status**: ✅ Ready for Development
**Last Updated**: April 2024
**Version**: 1.0.0
