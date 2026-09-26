export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message)
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    signal: options.signal ?? AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new APIError(
      body?.error?.message ?? 'Сервер временно недоступен',
      response.status,
      body?.error?.code ?? 'unknown',
    )
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>)
}
export const send = <T>(path: string, method: string, body?: unknown) =>
  api<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
