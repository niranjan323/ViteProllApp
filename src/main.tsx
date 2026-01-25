import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { ElectronProvider } from './context/ElectronContext';
import { UserDataProvider } from './context/UserDataContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ElectronProvider>
      <UserDataProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </UserDataProvider>
    </ElectronProvider>
  </StrictMode>,
);
