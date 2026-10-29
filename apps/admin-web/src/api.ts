import type { DatasetMeta, RunStatus, SourceInfo } from '@academia-nut/shared';
import { ref } from 'vue';

const TOKEN_KEY = 'academia-nut-admin-token';

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export const token = ref(readToken());

export function saveToken(value: string) {
  token.value = value;
  try {
    localStorage.setItem(TOKEN_KEY, value);
  } catch {
    // private mode etc. — token just won't persist
  }
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/admin-api${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token.value}`, ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export const adminApi = {
  config: () => adminFetch<{ publicApiUrl: string }>('/config'),
  sources: () => adminFetch<SourceInfo[]>('/sources'),
  datasets: () => adminFetch<DatasetMeta[]>('/datasets'),
  run: (sourceId: string) => adminFetch<RunStatus>(`/sources/${encodeURIComponent(sourceId)}/runs`, { method: 'POST' }),
  getRun: (runId: string) => adminFetch<RunStatus>(`/runs/${encodeURIComponent(runId)}`),
};
