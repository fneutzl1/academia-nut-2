export interface HttpJsonOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
}

/** GET a JSON document; rejects on non-2xx, timeout, or unparseable body. */
export async function getJson<T>(url: string, { headers = {}, timeoutMs = 30_000 }: HttpJsonOptions = {}): Promise<T> {
  const { host, pathname } = new URL(url);
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`GET ${host}${pathname} returned HTTP ${res.status}`);

  // Curricunet has been known to embed BEL control chars in text fields
  // eslint-disable-next-line no-control-regex
  const text = (await res.text()).replace(/\u0007/g, '');
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(`Invalid JSON from ${host}${pathname}: ${(err as Error).message}`);
  }
}
