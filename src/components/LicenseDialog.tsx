import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  Box,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import EmailIcon from '@mui/icons-material/Email';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { licenseService } from '../services/licenseService';

interface LicenseDialogProps {
  open: boolean;
  onClose: () => void;
}

type DialogStep = 'status' | 'request' | 'install' | 'success';

const LicenseDialog: React.FC<LicenseDialogProps> = ({ open, onClose }) => {
  const [currentStep, setCurrentStep] = useState<DialogStep>('status');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Status step state
  const [licenseStatus, setLicenseStatus] = useState({
    installed: false,
    expiresIn: 0,
    machineId: '',
  });

  // Request step state
  const [contactEmail, setContactEmail] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [requestData, setRequestData] = useState<{ xml?: string; path?: string; machineId?: string } | null>(null);

  // Install step state
  const [installFileName, setInstallFileName] = useState('');

  // Machine info
  const [machineInfo, setMachineInfo] = useState<{ machineId: string; hostname: string; platform: string } | null>(
    null
  );

  // Load initial status
  useEffect(() => {
    if (open) {
      loadLicenseStatus();
    }
  }, [open]);

  const loadLicenseStatus = async () => {
    try {
      setLoading(true);
      const status = await licenseService.checkLicenseStatus();
      const info = await licenseService.getMachineInfo();
      setLicenseStatus(status);
      setMachineInfo(info);
      setCurrentStep('status');
      setMessage(null);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load license status',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRequest = async () => {
    if (!contactEmail || !organizationName) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    try {
      setLoading(true);
      const result = await licenseService.generateLicenseRequest(contactEmail, organizationName);
      setRequestData(result);
      setCurrentStep('request');
      setMessage({
        type: 'success',
        text: 'License request generated successfully',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to generate request',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEmail = async () => {
    try {
      setLoading(true);
      const result = await licenseService.openEmailClient('svcEnggAppsAdminTest@eagle.org');
      setMessage({
        type: 'success',
        text: result.message,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to open email client',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      setLoading(true);
      const success = await licenseService.openRequestFolder();
      if (success) {
        setMessage({
          type: 'success',
          text: 'License request folder opened',
        });
      } else {
        setMessage({
          type: 'error',
          text: 'Failed to open folder',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLicenseFile = async () => {
    try {
      setLoading(true);
      const fileData = await licenseService.selectLicenseFile();
      if (fileData) {
        const result = await licenseService.installLicense(fileData.base64Content);
        setInstallFileName(fileData.fileName);

        if (result.success) {
          setMessage({
            type: 'success',
            text: `License installed successfully! Expires in ${result.expiresIn || '?'} days`,
          });
          setCurrentStep('success');
          // Reload status
          setTimeout(() => loadLicenseStatus(), 2000);
        } else {
          setMessage({
            type: 'error',
            text: result.message,
          });
        }
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to install license',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (requestData?.xml) {
      navigator.clipboard.writeText(requestData.xml);
      setMessage({
        type: 'success',
        text: 'License request copied to clipboard',
      });
    }
  };

  const renderStatusStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        License Status
      </Typography>

      {machineInfo && (
        <Card sx={{ mb: 2, bgcolor: '#f5f5f5' }}>
          <CardContent>
            <Typography variant="subtitle2" color="textSecondary">
              Machine ID:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                mb: 1,
              }}
            >
              {machineInfo.machineId}
            </Typography>
            <Typography variant="subtitle2" color="textSecondary">
              System:
            </Typography>
            <Typography variant="body2">
              {machineInfo.hostname} ({machineInfo.platform})
            </Typography>
          </CardContent>
        </Card>
      )}

      {licenseStatus.installed ? (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>License Installed</strong>
            <br />
            Expires in {licenseStatus.expiresIn} days
          </Typography>
        </Alert>
      ) : (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>No License Installed</strong>
            <br />
            Please request a license to use this application
          </Typography>
        </Alert>
      )}

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle1" gutterBottom>
        Next Steps:
      </Typography>
      <Typography variant="body2" color="textSecondary">
        {licenseStatus.installed
          ? 'Your application is licensed and ready to use.'
          : '1. Generate a license request\n2. Send it to svcEnggAppsAdminTest@eagle.org\n3. Install the returned license file'}
      </Typography>
    </Box>
  );

  const renderRequestStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Generate License Request
      </Typography>

      <TextField
        fullWidth
        label="Contact Email"
        value={contactEmail}
        onChange={(e) => setContactEmail(e.target.value)}
        margin="normal"
        type="email"
        disabled={loading}
      />

      <TextField
        fullWidth
        label="Organization Name"
        value={organizationName}
        onChange={(e) => setOrganizationName(e.target.value)}
        margin="normal"
        disabled={loading}
      />

      {requestData && requestData.xml ? (
        <Box sx={{ mt: 2 }}>
          <Alert severity="success" sx={{ mb: 2 }}>
            Request generated successfully
          </Alert>

          <Typography variant="subtitle2" gutterBottom>
            License Request File:
          </Typography>
          <Card sx={{ bgcolor: '#f5f5f5', mb: 2 }}>
            <CardContent>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                {requestData.path}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Button
                  size="small"
                  startIcon={<FileCopyIcon />}
                  onClick={handleCopyToClipboard}
                  disabled={loading}
                >
                  Copy XML
                </Button>
                <Button
                  size="small"
                  startIcon={<FolderIcon />}
                  onClick={handleOpenFolder}
                  disabled={loading}
                >
                  Open Folder
                </Button>
                <Button
                  size="small"
                  startIcon={<EmailIcon />}
                  color="primary"
                  onClick={handleOpenEmail}
                  disabled={loading}
                >
                  Send Email
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Typography variant="body2" color="textSecondary">
            Send the license request file to:
            <br />
            <strong>svcEnggAppsAdminTest@eagle.org</strong>
          </Typography>
        </Box>
      ) : (
        <Box />
      )}
    </Box>
  );

  const renderInstallStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Install License
      </Typography>

      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        Once you receive the license file from the licensing team, select and install it here.
      </Typography>

      <Button
        variant="contained"
        color="primary"
        fullWidth
        onClick={handleSelectLicenseFile}
        disabled={loading}
        sx={{ mb: 2 }}
      >
        Select License File
      </Button>

      {installFileName && (
        <Alert severity="success">
          <Typography variant="body2">Installed: {installFileName}</Typography>
        </Alert>
      )}
    </Box>
  );

  const renderSuccessStep = () => (
    <Box sx={{ textAlign: 'center' }}>
      <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        License Installed Successfully!
      </Typography>
      <Typography variant="body2" color="textSecondary">
        Your application is now licensed and ready to use.
      </Typography>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>License Management</DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {message && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && (
          <>
            {currentStep === 'status' && renderStatusStep()}
            {currentStep === 'request' && renderRequestStep()}
            {currentStep === 'install' && renderInstallStep()}
            {currentStep === 'success' && renderSuccessStep()}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        {currentStep === 'status' && (
          <>
            <Button onClick={onClose}>Close</Button>
            {!licenseStatus.installed && (
              <Button
                variant="contained"
                onClick={() => setCurrentStep('request')}
                disabled={loading}
              >
                Request License
              </Button>
            )}
          </>
        )}

        {currentStep === 'request' && (
          <>
            <Button onClick={() => setCurrentStep('status')} disabled={loading}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleGenerateRequest}
              disabled={loading || !contactEmail || !organizationName}
            >
              {requestData ? 'Generate New' : 'Generate Request'}
            </Button>
            {requestData && (
              <Button variant="contained" color="success" onClick={() => setCurrentStep('install')} disabled={loading}>
                Next: Install License
              </Button>
            )}
          </>
        )}

        {currentStep === 'install' && (
          <>
            <Button onClick={() => setCurrentStep('request')} disabled={loading}>
              Back
            </Button>
            <Button onClick={onClose} disabled={loading}>
              Close
            </Button>
          </>
        )}

        {currentStep === 'success' && (
          <Button onClick={onClose} variant="contained" fullWidth>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default LicenseDialog;
