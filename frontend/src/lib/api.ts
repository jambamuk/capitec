export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
export async function apiResponse(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers)
  if (init.method && !['GET', 'HEAD'].includes(init.method.toUpperCase())) {
    const csrfResponse = await fetch('/api/csrf', {
      credentials: 'same-origin',
    })
    const csrf = (await csrfResponse.json()) as {
      token: string
      headerName: string
    }
    headers.set(csrf.headerName, csrf.token)
  }
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'same-origin',
  })
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event('session-expired'))
    const error = (await response.json().catch(() => ({}))) as {
      detail?: string
    }
    throw new ApiError(
      response.status,
      error.detail ??
        (response.status === 401
          ? 'Sign in to continue.'
          : 'The request could not be completed. Please try again.'),
    )
  }
  return response
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiResponse(path, init)
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>)
}
export function params(values: Record<string, string | undefined>) {
  return new URLSearchParams(
    Object.entries(values).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString()
}
export function money(value: string) {
  const negative = value.startsWith('-')
  const [whole, fraction = '00'] = value.replace('-', '').split('.')
  return `${negative ? '−' : ''}R ${new Intl.NumberFormat('en-ZA').format(BigInt(whole))}.${fraction.padEnd(2, '0')}`
}
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
