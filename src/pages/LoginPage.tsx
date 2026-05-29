import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { loginRequest } from '../auth/msalConfig';
import './LoginPage.css';
import logo from '../assets/ABS_Logo.png';

function MicrosoftLogo() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
            <rect x="1"  y="1"  width="9" height="9" fill="#F25022" />
            <rect x="11" y="1"  width="9" height="9" fill="#7FBA00" />
            <rect x="1"  y="11" width="9" height="9" fill="#00A4EF" />
            <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
        </svg>
    );
}

export function LoginPage() {
    const { instance } = useMsal();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        setError(null);
        setLoading(true);
        try {
            await instance.loginPopup(loginRequest);
        } catch (e: unknown) {
            if (e instanceof Error && e.message?.includes('popup_window_error')) {
                // Popup blocked — fall back to redirect
                await instance.loginRedirect(loginRequest);
            } else if (e instanceof Error && !e.message?.includes('user_cancelled')) {
                setError('Sign-in failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <img src={logo} alt="ABS" className="login-abs-logo" />

                <div className="login-divider" />

                <h1 className="login-title">Eagle CRoll</h1>
                <p className="login-subtitle">Container Carrier Roll Motion in Operation</p>

                <button
                    className="login-ms-btn"
                    onClick={handleLogin}
                    disabled={loading}
                >
                    <MicrosoftLogo />
                    {loading ? 'Signing in…' : 'Sign in with Microsoft'}
                </button>

                {error && <p className="login-error">{error}</p>}

                <p className="login-footer">
                    © {new Date().getFullYear()} American Bureau of Shipping. All rights reserved.
                </p>
            </div>
        </div>
    );
}
