// Uji UI end-to-end: aplikasi React dijalankan di jsdom terhadap Worker dev (via proxy Vite).
// Menjalankan: node tests/ui-test.mjs   (butuh http://127.0.0.1:3000 dan http://127.0.0.1:8787 aktif)
import { JSDOM } from '/tmp/harness/node_modules/jsdom/lib/api.js'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const BASE = process.env.UI_BASE || 'http://127.0.0.1:3000'
const require = createRequire(import.meta.url)
const realFetch = globalThis.fetch

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  LULUS  ${name}`) }
  else { fail++; console.log(`  GAGAL  ${name} ${extra ? ':: ' + extra : ''}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------- jsdom + fetch
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: BASE, pretendToBeVisual: true })
const { window } = dom
const cookies = new Map()
const consoleErrors = []
const netlog = []
window.console = window.console || console

for (const k of ['window', 'document', 'navigator', 'location', 'history', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement',
  'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'CustomEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
  'MessageChannel', 'MutationObserver', 'localStorage', 'sessionStorage', 'CSS', 'FormData', 'Blob', 'File', 'DOMRect', 'SVGElement']) {
  if (window[k] === undefined) continue
  try { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }) } catch {}
}
globalThis.self = window

// jsdom tidak menyediakan ResizeObserver; recharts (ResponsiveContainer) membutuhkannya.
class ResizeObserverStub {
  constructor(cb) { this.cb = cb }
  observe(el) { try { this.cb([{ target: el, contentRect: { width: 720, height: 260 } }], this) } catch {} }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = window.ResizeObserver = ResizeObserverStub
window.Element.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, width: 720, height: 260, top: 0, left: 0, right: 720, bottom: 260, toJSON() {} }
}
window.addEventListener('error', (e) => consoleErrors.push('window.error: ' + (e.message || e.error)))

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, BASE)
  const headers = new Headers(init.headers || {})
  headers.set('Origin', BASE)
  headers.set('Referer', BASE + '/')
  if (cookies.size && !headers.has('Cookie')) headers.set('Cookie', [...cookies].map(([k, v]) => `${k}=${v}`).join('; '))
  const res = await realFetch(url, { ...init, headers, redirect: 'manual' })
  netlog.push(`${init.method || 'GET'} ${url.pathname}${url.search} -> ${res.status}`)
  const setc = res.headers.getSetCookie ? res.headers.getSetCookie() : []
  for (const c of setc) {
    const pair = c.split(';')[0]
    const i = pair.indexOf('=')
    const name = pair.slice(0, i).trim(), val = pair.slice(i + 1).trim()
    if (val === '' || /Expires=Thu, 01 Jan 1970/.test(c)) cookies.delete(name)
    else cookies.set(name, val)
  }
  return res
}

// ---------------------------------------------------------------- helper DOM
const body = () => window.document.body.textContent || ''
const $ = (sel) => window.document.querySelector(sel)
const $$ = (sel) => [...window.document.querySelectorAll(sel)]
async function waitFor(fn, { timeout = 6000, label = 'kondisi' } = {}) {
  const t0 = Date.now()
  for (;;) {
    let r = false
    try { r = fn() } catch { r = false }
    if (r) return true
    if (Date.now() - t0 > timeout) throw new Error(`timeout menunggu ${label}`)
    await sleep(40)
  }
}
const waitText = (needle, opts) => waitFor(() => body().includes(needle), { label: `teks "${needle}"`, ...opts })
const linkHref = (href) => $(`a[href="${href}"]`)
async function openUrl(href) {
  window.history.pushState({}, '', href)
  window.dispatchEvent(new window.PopStateEvent('popstate'))
  await sleep(300)
}
async function go(href) {
  const a = linkHref(href)
  if (!a) throw new Error(`tautan navigasi ${href} tidak ada di sidebar`)
  a.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  await sleep(250)
}
function setValue(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
  el.dispatchEvent(new window.Event('input', { bubbles: true }))
}
function clickText(text, sel = 'button') {
  const el = $$(sel).find((b) => (b.textContent || '').includes(text))
  if (!el) throw new Error(`tombol "${text}" tidak ditemukan`)
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  return el
}
async function loginDemo(label) {
  // Tunggu daftar akun demo benar-benar dirender. Pada hasil deploy, latensi jaringan
  // membuat halaman masuk sesekali belum tergambar saat fungsi ini dipanggil.
  let el = null
  try {
    await waitFor(() => {
      el = $$('button.demo-item').find((b) => (b.textContent || '').includes(label))
      return !!el
    }, { timeout: 10000, label: `akun demo "${label}"` })
  } catch (e) {
    console.log('    DEBUG loginDemo: halaman =', body().replace(/\s+/g, ' ').slice(0, 200))
    throw e
  }
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  try {
    await waitFor(() => !!$('.sidebar') && !body().includes('Akun demo'), { timeout: 12000, label: 'sidebar setelah masuk' })
  } catch (e) {
    console.log('--- DEBUG login gagal ---')
    console.log('isi halaman:', body().slice(0, 500))
    console.log('permintaan:', netlog.slice(-8).join(' | '))
    console.log('konsol:', consoleErrors.slice(-5).join(' | '))
    throw e
  }
  await sleep(500)
}
async function logout() {
  const mb = $('button[aria-label="Menu pengguna"]')
  if (!mb) throw new Error('tombol menu pengguna tidak ada')
  mb.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  await sleep(250)
  clickText('Keluar')
  try {
    await waitText('Akun demo', { timeout: 10000 })
  } catch (e) {
    console.log('    DEBUG logout: halaman =', body().replace(/\s+/g, ' ').slice(0, 200))
    console.log('    DEBUG logout: permintaan =', netlog.slice(-6).join(' | '))
    throw e
  }
  await sleep(200)
}
async function reloadApp() {
  if (mountRoot && mountRoot.unmount) mountRoot.unmount()
  await sleep(100)
  mountRoot = mod.mount()
  await sleep(800)
}

// ---------------------------------------------------------------- data referensi dari API
// Dipakai agar asersi membandingkan dengan data nyata dari server (lokal atau hasil deploy).
const sample = {}
{
  // Jar terpisah agar tidak mengganggu sesi yang diuji pada aplikasi.
  let refCookie = ''
  const refFetch = async (path, opts = {}) => {
    const headers = new Headers(opts.headers || {})
    headers.set('Origin', BASE)
    if (refCookie) headers.set('Cookie', refCookie)
    const r = await realFetch(new URL(path, BASE), { ...opts, headers })
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : []
    if (sc.length) refCookie = sc[0].split(';')[0]
    return r
  }
  const res = await refFetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'superadmin@piat6.sch.id', password: 'piat6demo' }) })
  if (!res.ok) throw new Error(`gagal masuk sebagai super admin untuk data referensi (${res.status})`)
  const st = await (await refFetch('/api/rt/students?limit=1000')).json()
  sample.mts = st.data.filter((s) => s.unit_name.includes('MTs')).map((s) => s.name)
  sample.ma = st.data.filter((s) => s.unit_name.includes('MA')).map((s) => s.name)
  sample.total = st.data.length
  sample.maStudentId = st.data.find((s) => s.unit_name.includes('MA')).id
}

// ---------------------------------------------------------------- muat aplikasi
globalThis.IS_REACT_ACT_ENVIRONMENT = false
const modNs = await import('./ui-entry.bundle.cjs')
const mod = (modNs && typeof modNs.mount === 'function') ? modNs : (modNs.default || modNs)
let mountRoot = mod.mount()
await waitText('Akun demo', { timeout: 15000 })

console.log('\n[1] Halaman masuk')
ok('halaman masuk memuat judul aplikasi', body().includes('PIAT 6 Madrasah Management System'))
ok('daftar akun demo tampil', $$('button.demo-item').length >= 10, `${$$('button.demo-item').length} akun`)

console.log('\n[2] Validasi masuk salah')
setValue($('input[type="email"]'), 'kamad.mts@piat6.sch.id')
setValue($('input[type="password"]'), 'salah-sekali')
clickText('Masuk')
await waitFor(() => $('[role="alert"]'), { label: 'pesan galat login' })
ok('kata sandi salah ditolak dengan pesan', ($('[role="alert"]').textContent || '').length > 5, $('[role="alert"]').textContent)
ok('tidak diarahkan ke dashboard saat gagal', !linkHref('/siswa'))

console.log('\n[3] Masuk sebagai Kepala MTs')
await loginDemo('Kepala MTs')
await waitFor(() => $('.sidebar'), { label: 'sidebar' })
ok('dashboard memuat identitas pengguna MTs', body().includes('PIAT 6 Madrasah') && body().includes('MTs') && body().includes('Dashboard'), '')
ok('sidebar menampilkan menu presensi', !!linkHref('/presensi-siswa') && !!linkHref('/presensi-guru'))
ok('kamad MTs tidak melihat menu khusus super admin', !linkHref('/pengguna') && !linkHref('/pengaturan'))
ok('kamad MTs tidak melihat menu khusus siswa', !linkHref('/cbt/ujian-saya'))
ok('sidebar kamad MTs menampilkan menu presensi & rapor', !!linkHref('/presensi-siswa') && !!linkHref('/rapor'))

console.log('\n[4] Data induk siswa terisolasi per unit (MTs)')
await go('/siswa')
await waitText('Data Siswa')
await waitFor(() => body().includes(sample.mts[0]), { label: 'nama siswa MTs' })
ok('tabel siswa MTs memuat siswa MTs', body().includes(sample.mts[0]), sample.mts[0])
ok('tidak menampilkan siswa MA pada daftar MTs', !body().includes(sample.ma[0]), sample.ma[0])

console.log('\n[5] Presensi, nilai, rapor, laporan')
await go('/presensi-siswa'); await waitText('Presensi Siswa', { timeout: 8000 })
await sleep(700)
const main5 = (($('.main') || {}).textContent || '').replace(/\s+/g, ' ')
ok('halaman presensi memuat daftar siswa dan pilihan status', /Hadir/.test(main5) && /siswa sudah diisi/.test(main5), main5.slice(0, 200))
await go('/nilai'); await waitText('Penilaian Akademik', { timeout: 8000 })
ok('halaman penilaian memuat istilah komponen nilai', body().includes('Nilai') && /KKM|Ketuntasan/i.test(body()))
await go('/rapor'); await waitText('Rapor Siswa', { timeout: 8000 })
ok('halaman rapor memuat status kelengkapan', /Rapor|Kelengkapan/i.test(body()))
await go('/laporan'); await waitText('Laporan', { timeout: 8000 })
ok('halaman laporan memuat ringkasan unit MTs', body().includes('MTs'))

console.log('\n[5b] Guru/kamad menyimpan presensi lalu hasilnya terbaca kembali')
await go('/presensi-siswa'); await waitText('Presensi Siswa', { timeout: 8000 }); await sleep(900)
const classSel = $$('select')[0]
const dateInput = $('input[type="date"]')
const classId = classSel ? classSel.value : ''
const attDate = dateInput ? dateInput.value : ''
ok('kelas dan tanggal presensi terisi otomatis', !!classId && !!attDate, `kelas=${classId} tanggal=${attDate}`)
clickText('Tandai semua hadir')
await sleep(300) // biarkan React menyelesaikan pembaruan status sebelum menyimpan
clickText('Simpan presensi')
try {
  await waitFor(() => $('.main [role="status"]'), { timeout: 12000, label: 'pesan simpan presensi' })
} catch (e) {
  console.log('    isi halaman:', (($('.main') || {}).textContent || '').replace(/\s+/g, ' ').slice(0, 300))
  throw e
}
ok('pesan sukses penyimpanan presensi tampil', /disimpan|berhasil|tersimpan/i.test($('.main [role="status"]').textContent), $('.main [role="status"]').textContent)
const after = await (await fetch(`/api/attendance/students?class_id=${classId}&date=${attDate}`)).json()
ok('presensi hasil simpan terbaca dari API (semua hadir)', Array.isArray(after.records) && after.records.length > 0 && after.records.every((r) => r.status === 'hadir'), JSON.stringify((after.records || []).filter((r) => r.status !== 'hadir')))
clickText('Rekap kelas')
await sleep(900)
const rekap = ($('.main') || {}).textContent || ''
ok('rekap kehadiran menampilkan persentase dari data tersimpan', /%/.test(rekap) || /\d+\s*\//.test(rekap), rekap.replace(/\s+/g, ' ').slice(0, 200))
const audit = await (await fetch('/api/audit?limit=5')).json()
const auditRows = audit.data || []
ok('aktivitas penyimpanan presensi tercatat pada audit log', auditRows.some((a) => /presensi/i.test(a.action + ' ' + (a.detail || ''))), JSON.stringify(auditRows.slice(0, 2)))

console.log('\n[6] Hak akses halaman (kamad MTs)')
await openUrl('/pengguna')
await waitFor(() => body().includes('Akses ditolak') || body().includes('Dashboard'), { timeout: 8000, label: 'hasil akses /pengguna' })
ok('kamad MTs tidak dapat membuka halaman pengguna', body().includes('Akses ditolak'))

console.log('\n[7] Masuk sebagai Kepala MA')
await logout()
await loginDemo('Kepala MA')
await go('/siswa')
await waitFor(() => body().includes(sample.ma[0]), { label: 'nama siswa MA' })
ok('tabel siswa MA memuat siswa MA', body().includes(sample.ma[0]), sample.ma[0])
ok('tidak menampilkan siswa MTs pada daftar MA', !body().includes(sample.mts[0]))

console.log('\n[8] Masuk sebagai siswa')
await logout()
await loginDemo('Siswa MTs')
await waitFor(() => $('.sidebar'), { label: 'sidebar siswa' })
ok('siswa hanya melihat menu terbatas (tanpa data induk)', !linkHref('/siswa') && !linkHref('/pengguna'))
ok('siswa memperoleh menu pembelajaran & ujian', !!linkHref('/lms/materi') && !!linkHref('/cbt/ujian-saya'), '')
await go('/cbt/ujian-saya'); await waitText('Ujian', { timeout: 8000 })
ok('halaman ujian siswa termuat', body().includes('Ujian'))
await go('/lms/tugas'); await waitText('Tugas', { timeout: 8000 })
ok('halaman tugas siswa termuat', /Tugas/.test(body()))
await openUrl('/pengguna')
await waitFor(() => body().includes('Akses ditolak') || body().includes('Ujian'), { timeout: 8000, label: 'hasil akses /pengguna siswa' })
ok('siswa tidak dapat membuka halaman pengguna', body().includes('Akses ditolak'))

console.log('\n[9] Sesi bertahan setelah halaman dimuat ulang')
await reloadApp()
await sleep(600)
ok('sesi tetap aktif setelah reload', !body().includes('Akun demo') && !!linkHref('/dasbor'), 'masih di halaman masuk')
await go('/dasbor'); await waitText('Dashboard', { timeout: 8000 })
ok('data tetap konsisten setelah reload', !body().includes('Terjadi kesalahan'))

const hardErrors = consoleErrors.filter((e) => !/ResizeObserver|Not implemented/.test(e))
ok('tidak ada error runtime di konsol peramban', hardErrors.length === 0, hardErrors.slice(0, 3).join(' | '))

console.log(`\nRingkasan uji UI: ${pass} lulus, ${fail} gagal`)
process.exit(fail ? 1 : 0)
