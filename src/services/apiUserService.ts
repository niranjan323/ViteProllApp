const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

export const ApiUserService = {
    async ensureUser(absUserId: string, userName: string, userEmail?: string): Promise<void> {
        const response = await fetch(`${API_BASE}/api/users/ensure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ absUserId, userName, userEmail }),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to ensure user: ${response.status} ${text}`);
        }
    },
};
