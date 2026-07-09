import { getAccessToken } from '../auth/msalInstance';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

/**
 * Case shape — matches the SQL Server Cases table and the Electron SQLite schema.
 * Keep in sync with CRoll.API/Models/Case.cs.
 */
export interface ApiCase {
  id: string;
  createdAt: number;           // unix timestamp ms
  userId: string;
  color: string;               // 'green' | 'pink'
  draftAft?: number;
  draftFore?: number;
  gm?: number;
  heading?: number;
  speed?: number;
  maxRoll?: number;
  hs?: number;
  tz?: number;
  waveDirection?: number;
  dataFilePath?: string;
  fittedDraft?: number;
  fittedGm?: number;
  fittedHs?: number;
  fittedTz?: number;
  chartMode?: string;
  chartOrientation?: string;
  chartImage?: string;
  synced: number;
  projectId?: string;          // blob storage project folder name
  updatedAt?: string;          // ISO date string from server
}

async function buildHeaders(includeContentType = true): Promise<Record<string, string>> {
    const h: Record<string, string> = {};
    if (includeContentType) h['Content-Type'] = 'application/json';
    const token = await getAccessToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
}

/**
 * HTTP client for /api/cases.
 * Mirrors the Electron IPC calls in electron/main.ts:
 *   db-save-case          → createCase / updateCase
 *   db-load-cases         → getAllCases
 *   db-update-chart-image → updateChartImage
 *   db-delete-case        → deleteCase
 */
export const ApiCaseService = {

  async getAllCases(userId: string, projectId?: string): Promise<ApiCase[]> {
    const h = await buildHeaders(false);
    let url = `${API_BASE}/api/cases?userId=${encodeURIComponent(userId)}`;
    if (projectId) url += `&projectId=${encodeURIComponent(projectId)}`;
    const response = await fetch(url, { headers: h });
    if (!response.ok)
      throw new Error(`Failed to load cases: ${response.status} ${response.statusText}`);
    return response.json();
  },

  async getCaseById(id: string): Promise<ApiCase | null> {
    const h = await buildHeaders(false);
    const response = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(id)}`, { headers: h });
    if (response.status === 404) return null;
    if (!response.ok)
      throw new Error(`Failed to get case ${id}: ${response.status}`);
    return response.json();
  },

  async createCase(caseItem: ApiCase): Promise<ApiCase> {
    const h = await buildHeaders();
    const response = await fetch(`${API_BASE}/api/cases`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify(caseItem),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create case: ${response.status} ${text}`);
    }
    return response.json();
  },

  async updateCase(caseItem: ApiCase): Promise<ApiCase> {
    const h = await buildHeaders();
    const response = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(caseItem.id)}`, {
      method: 'PUT',
      headers: h,
      body: JSON.stringify(caseItem),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to update case: ${response.status} ${text}`);
    }
    return response.json();
  },

  /** Save or update — checks if case exists first, then calls create or update. */
  async saveCase(caseItem: ApiCase): Promise<ApiCase> {
    const existing = await ApiCaseService.getCaseById(caseItem.id);
    return existing
      ? ApiCaseService.updateCase(caseItem)
      : ApiCaseService.createCase(caseItem);
  },

  async updateChartImage(id: string, chartImage: string): Promise<void> {
    const h = await buildHeaders();
    const response = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(id)}/chart`, {
      method: 'PATCH',
      headers: h,
      body: JSON.stringify({ chartImage }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to update chart image: ${response.status} ${text}`);
    }
  },

  async deleteCase(id: string): Promise<void> {
    const h = await buildHeaders(false);
    const response = await fetch(`${API_BASE}/api/cases/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: h,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to delete case: ${response.status} ${text}`);
    }
  },
};
