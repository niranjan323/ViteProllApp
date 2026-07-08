import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { HashRouter, BrowserRouter } from 'react-router-dom';
import { ElectronProvider } from './context/ElectronContext';
import { UserDataProvider } from './context/UserDataContext';
import { UserEmailProvider } from './context/UserEmailContext';
import { WebUserEmailProvider } from './auth/WebUserEmailProvider';
import { setMsalInstance } from './auth/msalInstance';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
const root = createRoot(document.getElementById('root')!);

if (isElectron) {
    root.render(
        <StrictMode>
            <UserEmailProvider value="">
                <ElectronProvider>
                    <UserDataProvider>
                        <HashRouter>
                            <App />
                        </HashRouter>
                    </UserDataProvider>
                </ElectronProvider>
            </UserEmailProvider>
        </StrictMode>
    );
} else {
    Promise.all([
        import('@azure/msal-browser'),
        import('@azure/msal-react'),
        import('./auth/msalConfig'),
    ]).then(([
        { PublicClientApplication },
        { MsalProvider },
        { msalConfig },
    ]) => {
        const msalInstance = new PublicClientApplication(msalConfig);
        setMsalInstance(msalInstance);
        root.render(
            <StrictMode>
                <MsalProvider instance={msalInstance}>
                    <WebUserEmailProvider>
                        <ElectronProvider>
                            <UserDataProvider>
                                <BrowserRouter>
                                    <App />
                                </BrowserRouter>
                            </UserDataProvider>
                        </ElectronProvider>
                    </WebUserEmailProvider>
                </MsalProvider>
            </StrictMode>
        );
    }).catch((err) => {
        console.error('Auth bootstrap failed:', err);
        root.render(
            <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#b00020' }}>
                <h2>Sign-in error</h2>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{String(err?.message ?? err)}</pre>
            </div>
        );
    });
}
