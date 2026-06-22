import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { HashRouter, BrowserRouter } from 'react-router-dom';
import { ElectronProvider } from './context/ElectronContext';
import { UserDataProvider } from './context/UserDataContext';
import { UserEmailProvider } from './context/UserEmailContext';
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
    import('@azure/msal-browser').then(({ PublicClientApplication }) =>
        import('@azure/msal-react').then(({ MsalProvider }) =>
            import('./auth/msalConfig').then(({ msalConfig }) =>
                import('./auth/WebUserEmailProvider').then(({ WebUserEmailProvider }) => {
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
                })
            )
        )
    );
}
