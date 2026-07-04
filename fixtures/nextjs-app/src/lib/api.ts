/** Typed JSON fetch with error handling — use this for all API calls. */
export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    body: string,
  ) {
    super(`API ${status}: ${body.slice(0, 200)}`);
  }
}
