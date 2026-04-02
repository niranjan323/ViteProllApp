# Complete Licensing System Implementation Guide

## Overview

This guide explains how to integrate and use the complete licensing system for your PPROLL Electron application.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELECTRON MAIN PROCESS                        │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│ │ Machine ID       │  │ License Manager  │  │ Email Service  │ │
│ │ Generator        │  │ (Validation,     │  │ (Open mailto,  │ │
│ │                  │  │  Storage, etc)   │  │  SMTP support) │ │
│ └──────────────────┘  └──────────────────┘  └────────────────┘ │
│            ↕                   ↕                      ↕          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │              IPC Handlers (license:*)                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                         IPC Channel
                               │
┌──────────────────────────────┴──────────────────────────────────┐
│                      REACT COMPONENTS                           │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────┤
│ │  LicenseDialog.tsx                                           │
│ │  - UI for license management                                │
│ │  - Request generation workflow                              │
│ │  - License installation                                     │
│ └──────────────────────────────────────────────────────────────┤
│            ↕                                                    │
│ ┌──────────────────────────────────────────────────────────────┤
│ │  licenseService.ts                                           │
│ │  - Wrapper around IPC APIs                                  │
│ │  - Error handling                                           │
│ │  - Data transformation                                      │
│ └──────────────────────────────────────────────────────────────┤
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
electron/
├── services/
│   ├── licenseManager.ts      ← License generation, validation, storage
│   ├── machineIdentifier.ts   ← Machine ID generation
│   └── emailService.ts        ← Email integration
└── main.ts                    ← IPC handlers

src/
├── services/
│   └── licenseService.ts      ← Frontend wrapper for IPC
├── components/
│   └── LicenseDialog.tsx       ← License management UI
└── config/
    └── licenseConfig.ts        ← Configuration file
```

## Integration Steps

### Step 1: Import License Config

In `src/config/licenseConfig.ts`:

```typescript
export const licenseConfig = {
  appName: 'PPROLL',
  appVersion: '1.0.0',
  // ... other config
};
```

### Step 2: Add License Service to Your App

In your main App component:

```tsx
import LicenseDialog from './components/LicenseDialog';
import { useState, useEffect } from 'react';
import { licenseService } from './services/licenseService';

function App() {
  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);
  const [isLicensed, setIsLicensed] = useState(true);

  useEffect(() => {
    checkLicense();
  }, []);

  const checkLicense = async () => {
    try {
      const status = await licenseService.checkLicenseStatus();
      setIsLicensed(status.installed);
      
      if (!status.installed) {
        // Show warning or open license dialog
        setLicenseDialogOpen(true);
      }
    } catch (error) {
      console.error('License check failed:', error);
    }
  };

  return (
    <div>
      {/* Your app content */}
      
      {/* License Management Dialog */}
      <LicenseDialog 
        open={licenseDialogOpen} 
        onClose={() => setLicenseDialogOpen(false)}
      />
      
      {/* License Status Badge */}
      <button onClick={() => setLicenseDialogOpen(true)}>
        {isLicensed ? '✓ Licensed' : '⚠ No License'}
      </button>
    </div>
  );
}

export default App;
```

### Step 3: Update Environment Variables

Create `.env` files:

**`.env.development`**
```
VITE_LICENSE_SECRET=dev-secret-key
```

**`.env.production`**
```
VITE_LICENSE_SECRET=<SECURE_PRODUCTION_SECRET>
LICENSE_ENABLED=true
```

### Step 4: Update package.json Version

```json
{
  "version": "1.0.0",
  "name": "proll_app"
}
```

## How It Works

### 1. License Request Generation

```
1. User clicks "Request License"
2. App generates machine ID (based on hardware)
3. Creates XML request file with:
   - Machine ID
   - App name & version
   - Contact email
   - Organization name
   - Timestamp
4. Saves to: %APPDATA%/proll_app/license-requests/
5. User opens email client and attaches file
6. Sends to: svcEnggAppsAdminTest@eagle.org
```

### 2. License Installation

```
1. Licensing team generates license file
2. User receives license file
3. Opens LicenseDialog → "Install License" tab
4. Selects license file
5. App validates:
   - Machine binding ✓
   - Expiry date ✓
   - Signature ✓
6. Saves to: %APPDATA%/proll_app/licenses/license.json
7. License is now active
```

### 3. License Validation

```
Validation checks:

✓ Installed: License file exists
✓ Machine Binding: License tied to this machine
✓ Expiry Date: License not expired
✓ Signature: Cryptographic verification
✓ App Version: Version compatibility check
```

## Security Best Practices

### 1. Signature Verification

```typescript
// Uses HMAC-SHA256 for tamper detection
// Shared secret between app and licensing server
const signature = crypto
  .createHmac('sha256', secretKey)
  .update(signatureData)
  .digest('hex');
```

### 2. Machine Binding

```typescript
// Based on:
// - Hostname
// - CPU Model
// - Total Memory
// - MAC Address
// Non-reversible SHA256 hash: 12345678ABCDEF00
```

### 3. Secure Storage

```
- License file stored in AppData (Windows-standard location)
- Read-only file permissions (0o400)
- JSON format (can add encryption if needed)
```

### 4. Environment Secrets

```
Never commit secrets to Git:
- Use .env files (add to .gitignore)
- Environment variables in CI/CD
- Secure vaults for production
```

## Usage Examples

### Example 1: Check if Licensed

```typescript
const status = await licenseService.checkLicenseStatus();
if (status.installed) {
  console.log(`Licensed until ${status.expiresIn} days`);
} else {
  console.log('No license installed');
}
```

### Example 2: Generate Request

```typescript
const request = await licenseService.generateLicenseRequest(
  'user@company.com',
  'Acme Corp'
);
console.log('Machine ID:', request.machineId);
console.log('Request saved to:', request.filePath);
```

### Example 3: Install License

```typescript
// Get license file content (base64)
const fileData = await licenseService.selectLicenseFile();

// Install it
if (fileData) {
  const result = await licenseService.installLicense(
    fileData.base64Content
  );
  
  if (result.success) {
    console.log('License installed!');
    console.log(`Expires in ${result.expiresIn} days`);
  }
}
```

## License File Format

The license file is a JSON file saved locally:

```json
{
  "licenseKey": "KEY-ABC123DEF456",
  "machineId": "HARDWARE_ID_HERE",
  "appName": "PPROLL",
  "appVersion": "1.0.0",
  "issuedDate": "2024-04-01T10:00:00Z",
  "expiryDate": "2025-04-01T10:00:00Z",
  "features": [
    "vessel-analysis",
    "polar-diagram",
    "report-generation"
  ],
  "signature": "hash_signature_here",
  "metadata": {}
}
```

## License Request Format

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LicenseRequest>
  <RequestId>ABC123DEF456</RequestId>
  <Timestamp>2024-04-01T10:00:00.000Z</Timestamp>
  <Application>
    <Name>PPROLL</Name>
    <Version>1.0.0</Version>
  </Application>
  <Machine>
    <MachineId>HARDWARE_ID_HERE</MachineId>
    <Hostname>USER-LAPTOP</Hostname>
    <Platform>win32</Platform>
  </Machine>
  <Contact>
    <Email>user@company.com</Email>
    <Organization>Acme Corp</Organization>
  </Contact>
</LicenseRequest>
```

## Troubleshooting

### License Not Detected

```typescript
// Check license status
const history = await licenseService.getLicenseHistory();
console.log('License dir:', history.licenseDir);
console.log('Files:', history.licenses);
```

### Validation Failed

Possible reasons:
- **Machine Binding**: Hardware changed (SSD replaced, etc.)
- **Expired**: Renewal needed
- **Signature**: File corrupted or tampered
- **Version**: App version mismatch

### License Secret Issues

```typescript
// The licenseSecret must be the SAME on:
// 1. Licensing server
// 2. Electron main process
// 3. Validation code

const secret = process.env.LICENSE_SECRET;
if (!secret) {
  console.warn('License secret not configured!');
}
```

## Production Deployment

### Checklist

- [ ] Set proper `LICENSE_SECRET` in production environment
- [ ] Update app version in `package.json`
- [ ] Test license request generation
- [ ] Test license installation
- [ ] Configure email address (`svcEnggAppsAdminTest@eagle.org`)
- [ ] Set up licensing server (if creating licenses dynamically)
- [ ] Enable license checking in production (`licensingEnabled: true`)
- [ ] Test license expiry workflow
- [ ] Backup license database/server

### Creating Licenses on Server Side

Example Node.js/Express endpoint:

```typescript
import { createLicenseFromServerData } from './services/licenseManager';

app.post('/api/license/create', (req, res) => {
  const { machineId, appVersion, expiryDays, features } = req.body;
  
  const license = createLicenseFromServerData(
    {
      machineId,
      appVersion,
      expiryDate: new Date(
        Date.now() + expiryDays * 24 * 60 * 60 * 1000
      ).toISOString(),
      features: features || ['vessel-analysis', 'polar-diagram'],
    },
    process.env.LICENSE_SECRET!
  );
  
  // Save license or return to client
  res.json({ license });
});
```

## Future Improvements

1. **Encryption**: Encrypt license files at rest
2. **Database**: Build licensing management dashboard
3. **Versioning**: Implement semantic version checking
4. **Features**: Tie features to specific license types
5. **Online Validation**: Optional periodic license verification
6. **Floating Licenses**: Support multi-device usage
7. **Trial Licenses**: Auto-generate time-limited trial
8. **License Analytics**: Track usage and license compliance

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review console logs in DevTools
3. Verify environment variables
4. Check file permissions in AppData folder

---

**Last Updated**: April 2024
**Version**: 1.0.0
