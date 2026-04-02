/**
 * License Configuration
 * This file contains all license-related configuration
 * Update these values for production use
 */

export const licenseConfig = {
  // Application Information
  appName: 'PPROLL',
  appVersion: '1.0.0', // Update this to match package.json version
  appDescription: 'PRoll Diagram Application',

  // Licensing Parameters
  licensingEnabled: process.env.NODE_ENV === 'production',
  licenseValidityDays: 365,

  // Email Configuration
  licensingEmail: 'svcEnggAppsAdminTest@eagle.org',
  licensingEmailSubject: 'PPROLL Application - License Request',

  // License Secret (for HMAC signatures)
  // In production, load this from environment variables or a secure config
  licenseSecret: process.env.VITE_LICENSE_SECRET || 'change-this-secret-in-production',

  // SMTP Configuration (optional, for automated email sending)
  // Only needed if you want to send emails programmatically
  smtp: {
    enabled: false, // Set to true to enable SMTP
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASSWORD || '',
    },
  },

  // License Expiry Warning (days before expiry)
  expiryWarningDays: 30,

  // Feature Flags
  features: {
    vesselAnalysis: true,
    polarDiagram: true,
    reportGeneration: true,
  },
};

/**
 * Get the license secret from environment
 * This should be loaded securely in production
 */
export function getLicenseSecret(): string {
  const secret = process.env.VITE_LICENSE_SECRET || process.env.LICENSE_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    console.warn('WARNING: License secret not configured. Using default (insecure) value.');
  }
  return secret || licenseConfig.licenseSecret;
}

/**
 * Check if licensing should be enforced
 */
export function isLicensingRequired(): boolean {
  return licenseConfig.licensingEnabled;
}

/**
 * Get app version from package.json (fallback)
 * In production, this should come from package.json
 */
export function getAppVersion(): string {
  return licenseConfig.appVersion;
}
