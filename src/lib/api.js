// Klien API sederhana dengan penanganan error dan sesi berbasis cookie
const BASE = '/api'
export class ApiError extends Error {
  constructor(message, status, detail) { super(message); this.status = status; this.detail = detail }
}
export async function api(path, { method = 'GET', body, timeout = 30000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      signal: controller.signal,
    })
    let data = null
    try { data = await res.json() } catch { data = null }
    if (!res.ok) throw new ApiError((data && data.error) || `Permintaan gagal (${res.status})`, res.status, data && data.detail)
    return data
  } catch (e) {
    if (e instanceof ApiError) throw e
    if (e.name === 'AbortError') throw new ApiError('Permintaan melebihi batas waktu. Coba lagi.', 408)
    throw new ApiError('Tidak dapat menghubungi server. Periksa koneksi Anda.', 0)
  } finally { clearTimeout(timer) }
}
export const get = (p) => api(p)
export const post = (p, body) => api(p, { method: 'POST', body })
export const put = (p, body) => api(p, { method: 'PUT', body })
export const del = (p) => api(p, { method: 'DELETE' })
