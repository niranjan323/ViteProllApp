import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { HashRouter as BrowserRouter } from 'react-router-dom';
import { ElectronProvider } from './context/ElectronContext';
import { UserDataProvider } from './context/UserDataContext';

const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
const root = createRoot(document.getElementById('root')!);

if (isElectron) {
    root.render(
        <StrictMode>
            <ElectronProvider>
                <UserDataProvider>
                    <BrowserRouter>
                        <App />
                    </BrowserRouter>
                </UserDataProvider>
            </ElectronProvider>
        </StrictMode>
    );
} else {
    // Dynamically import MSAL so it's excluded from the Electron bundle path
    import('@azure/msal-browser').then(({ PublicClientApplication }) =>
        import('@azure/msal-react').then(({ MsalProvider }) =>
            import('./auth/msalConfig').then(({ msalConfig }) => {
                const msalInstance = new PublicClientApplication(msalConfig);
                root.render(
                    <StrictMode>
                        <MsalProvider instance={msalInstance}>
                            <ElectronProvider>
                                <UserDataProvider>
                                    <BrowserRouter>
                                        <App />
                                    </BrowserRouter>
                                </UserDataProvider>
                            </ElectronProvider>
                        </MsalProvider>
                    </StrictMode>
                );
            })
        )
    );
}
