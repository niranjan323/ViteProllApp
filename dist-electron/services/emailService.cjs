"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openEmailClientWithLicense = openEmailClientWithLicense;
exports.openLicenseRequestFolder = openLicenseRequestFolder;
exports.sendViaSmtp = sendViaSmtp;
exports.copyLicenseRequestToClipboard = copyLicenseRequestToClipboard;
exports.getEmailTemplate = getEmailTemplate;
const electron_1 = require("electron");
const fs = require("fs");
const path = require("path");
const DEFAULT_RECIPIENT = 'svcEnggAppsAdminTest@eagle.org';
/**
 * Opens the user's default email client with the license request
 * Note: Native mailto protocol has limitations with attachments on Windows
 * For reliable attachment sending, users should manually attach the file
 */
function openEmailClientWithLicense(licenseRequestPath, recipient = DEFAULT_RECIPIENT) {
    return new Promise((resolve) => {
        try {
            if (!fs.existsSync(licenseRequestPath)) {
                console.error('License request file not found');
                resolve(false);
                return;
            }
            const subject = encodeURIComponent('PPROLL Application - License Request');
            const body = encodeURIComponent(`Hello,\n\n` +
                `I am requesting a license for the PPROLL application.\n\n` +
                `Please find the license request details in the attached XML file.\n\n` +
                `Machine ID: [See attached file]\n` +
                `Timestamp: ${new Date().toISOString()}\n\n` +
                `Thank you,\n` +
                `User`);
            // Note: Mailto protocol doesn't reliably support attachments
            // The file path would need to be manually attached by the user
            const mailtoLink = `mailto:${recipient}?subject=${subject}&body=${body}`;
            // Open the email client
            electron_1.shell.openExternal(mailtoLink).then(() => {
                console.log('Email client opened. Please attach the license request file.');
                resolve(true);
            });
        }
        catch (error) {
            console.error('Failed to open email client:', error);
            resolve(false);
        }
    });
}
/**
 * Gets the license request file location for manual attachment
 * Windows Explorer will open to the directory
 */
function openLicenseRequestFolder(folderPath) {
    return new Promise((resolve) => {
        try {
            if (!fs.existsSync(folderPath)) {
                console.error('Folder not found');
                resolve(false);
                return;
            }
            electron_1.shell.openPath(folderPath).then((error) => {
                if (error) {
                    console.error('Failed to open folder:', error);
                    resolve(false);
                }
                else {
                    console.log('License request folder opened');
                    resolve(true);
                }
            });
        }
        catch (error) {
            console.error('Error:', error);
            resolve(false);
        }
    });
}
/**
 * Send email via SMTP (Requires nodemailer)
 * This is optional - uncomment and install nodemailer if needed
 */
async function sendViaSmtp(smtpConfig, emailOptions) {
    try {
        // Dynamically import nodemailer (optional dependency)
        let nodemailer;
        try {
            // @ts-ignore - nodemailer is optional
            nodemailer = await Promise.resolve().then(() => require('nodemailer'));
        }
        catch (e) {
            return {
                success: false,
                error: 'nodemailer not installed. Run: npm install nodemailer',
            };
        }
        const transporter = nodemailer.createTransport(smtpConfig);
        // Verify connection
        const verified = await transporter.verify();
        if (!verified) {
            return {
                success: false,
                error: 'SMTP credentials are invalid',
            };
        }
        // Send email
        const info = await transporter.sendMail({
            from: emailOptions.from || smtpConfig.auth.user,
            to: emailOptions.to,
            subject: emailOptions.subject,
            text: emailOptions.text,
            html: emailOptions.html,
            attachments: emailOptions.attachments,
        });
        console.log('Email sent:', info.messageId);
        return {
            success: true,
            messageId: info.messageId,
        };
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('SMTP Error:', error);
        return {
            success: false,
            error: errorMsg,
        };
    }
}
/**
 * Copies license request file to clipboard (Windows)
 * User can then paste the content into an email
 */
function copyLicenseRequestToClipboard(filePath) {
    return new Promise((resolve) => {
        try {
            if (!fs.existsSync(filePath)) {
                resolve(false);
                return;
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            // Copy to clipboard using Windows clip command
            try {
                if (process.platform === 'win32') {
                    // Windows: use clip.exe
                    const { execSync } = require('child_process');
                    execSync(`echo "${content.replace(/"/g, '\\"')}" | clip.exe`);
                    console.log('License request copied to clipboard');
                    resolve(true);
                }
                else {
                    console.log('Clipboard copy only supported on Windows');
                    resolve(true);
                }
            }
            catch (e) {
                console.log('Could not copy to clipboard, but operation completed');
                resolve(true);
            }
        }
        catch (error) {
            console.error('Failed to copy to clipboard:', error);
            resolve(false);
        }
    });
}
/**
 * Gets a user-friendly email template
 */
function getEmailTemplate(licenseRequestPath) {
    const filename = path.basename(licenseRequestPath);
    return `Subject: PPROLL Application - License Request

Dear Licensing Team,

I am requesting a license for the PPROLL (PRoll Diagram Application) software.

Please find the machine-specific license request details in the attached XML file (${filename}).

This file contains:
- Machine ID (hardware-bound)
- Application version
- System information
- Request timestamp

Instructions:
1. Please review the attached license request file
2. Generate and return a valid license file
3. I will install the license in the application

Thank you for your assistance.

Best regards,
[Your Name]
[Your Organization]`;
}
