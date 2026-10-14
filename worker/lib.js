// PIAT 6 Madrasah - helper autentikasi, RBAC, dan cakupan data
import { bytesToHex, hexToBytes } from './schema.js'

export const ROLES = ['super_admin', 'pimpinan', 'kepala_mts', 'kepala_ma', 'operator', 'guru', 'wali_kelas', 'pengawas', 'siswa']
export const ROLE_LABELS = {
  super_admin: 'Super Admin', pimpinan: 'Pimpinan/Yayasan', kepala_mts: 'Kepala MTs', kepala_ma: 'Kepala MA',
  operator: 'Operator Akademik', guru: 'Guru', wali_kelas: 'Wali Kelas', pengawas: 'Pengawas/Tim Mutu', siswa: 'Siswa',
}
export const CROSS_UNIT_ROLES = ['super_admin', 'pimpinan', 'pengawas']
export const UNIT_ROLES = ['kepala_mts', 'kepala_ma', 'operator']
export const STAFF_ROLES = ['super_admin', 'pimpinan', 'kepala_mts', 'kepala_ma', 'operator', 'guru', 'wali_kelas', 'pengawas']
export const READ_ALL_ROLES = ['super_admin', 'pimpinan', 'pengawas']
// hak tulis sesuai PRD: kepala madrasah mengelola unitnya, operator mengelola data induk unitnya
export const WRITE_UNIT_ROLES = ['super_admin', 'kepala_mts', 'kepala_ma', 'operator']

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } })
}
export function error(message, status = 400, extra = {}) { return json({ error: message, ...extra }, status) }
export function clean(v) {
  if (v === undefined || v === null) return null
  if (typeof v === 'string') { const t = v.trim(); return t === '' ? null : t }
  return v
}

// --------------------------------------------------------------- session
const COOKIE = 'piat6_session'
const SESSION_HOURS = 12

export async function getSecret(db) {
  const row = await db.prepare("SELECT value FROM meta WHERE key = 'session_secret'").first()
  if (row && row.value) return row.value
  const secret = bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
  await db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('session_secret', ?)").bind(secret).run()
  return secret
}
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return bytesToHex(new Uint8Array(sig))
}
function b64url(str) { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
function fromB64url(str) { return decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/')))) }

export async function createSession(db, user) {
  const secret = await getSecret(db)
  const payload = b64url(JSON.stringify({ uid: user.id, exp: Date.now() + SESSION_HOURS * 3600 * 1000 }))
  const sig = await hmac(secret, payload)
  return `${payload}.${sig}`
}
export function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}${secure}`
}
export function clearCookie() { return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` }

export function readCookie(request, name = COOKIE) {
  const raw = request.headers.get('Cookie') || ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return null
}

export async function currentUser(db, request) {
  const token = readCookie(request)
  if (!token || !token.includes('.')) return null
  const [payload, sig] = token.split('.')
  const secret = await getSecret(db)
  const expected = await hmac(secret, payload)
  if (expected !== sig) return null
  let data
  try { data = JSON.parse(fromB64url(payload)) } catch { return null }
  if (!data.exp || data.exp < Date.now()) return null
  const user = await db.prepare('SELECT id, email, name, role, unit_id, teacher_id, student_id, is_active, is_demo FROM users WHERE id = ?').bind(data.uid).first()
  if (!user || !user.is_active) return null
  return user
}

export function isSameOrigin(request) {
  const origin = request.headers.get('Origin')
  if (!origin) return true // permintaan non-browser (uji CLI) tanpa Origin
  try { return new URL(origin).host === new URL(request.url).host } catch { return false }
}

// --------------------------------------------------------------- cakupan data
export async function scopeContext(db, user) {
  if (user.role === 'siswa') {
    const st = user.student_id ? await db.prepare('SELECT id, class_id, unit_id, name FROM students WHERE id = ?').bind(user.student_id).first() : null
    return { kind: 'self', studentId: user.student_id, classId: st ? st.class_id : null, unitId: st ? st.unit_id : user.unit_id, student: st }
  }
  if (CROSS_UNIT_ROLES.includes(user.role)) return { kind: 'all', unitId: null }
  if (UNIT_ROLES.includes(user.role)) return { kind: 'unit', unitId: user.unit_id }
  const classIds = await teacherClassIds(db, user.teacher_id, user.role)
  return { kind: 'classes', unitId: user.unit_id, classIds, teacherId: user.teacher_id }
}

export async function teacherClassIds(db, teacherId, role) {
  const ids = new Set()
  if (teacherId) {
    const r = await db.prepare('SELECT DISTINCT class_id FROM class_subjects WHERE teacher_id = ?').bind(teacherId).all()
    for (const x of r.results) ids.add(x.class_id)
    const s = await db.prepare('SELECT DISTINCT sc.class_id FROM schedules sc JOIN class_subjects c ON c.id = sc.class_subject_id WHERE c.teacher_id = ?').bind(teacherId).all()
    for (const x of s.results) ids.add(x.class_id)
  }
  if (role === 'wali_kelas' && teacherId) {
    const h = await db.prepare('SELECT id FROM classes WHERE homeroom_teacher_id = ?').bind(teacherId).all()
    for (const x of h.results) ids.add(x.id)
  }
  return [...ids]
}
export async function homeroomClassIds(db, teacherId) {
  const r = await db.prepare('SELECT id FROM classes WHERE homeroom_teacher_id = ?').bind(teacherId).all()
  return r.results.map((x) => x.id)
}

const inList = (ids) => (ids.length ? ids.map(() => '?').join(',') : 'NULL')

/** Filter SQL untuk tabel yang memiliki kolom unit_id dan/atau class_id. */
export function scopeSql(table, ctx, { unitCol = 'unit_id', classCol = 'class_id', userIdCol = 'student_id' } = {}) {
  const hasUnit = ['students', 'teachers', 'classes', 'subjects', 'report_cards', 'lms_materials', 'lms_assignments', 'exams', 'question_bank', 'attendance_teachers', 'promotion_decisions', 'users'].includes(table)
  if (ctx.kind === 'all') return { sql: '1=1', params: [] }
  if (ctx.kind === 'unit') return { sql: `${table === 'classes' ? 'id' : unitCol} = ?`, params: [ctx.unitId] }
  if (ctx.kind === 'self') {
    if (table === 'students') return { sql: 'id = ?', params: [ctx.studentId] }
    if (table === 'classes') return { sql: 'id = ?', params: [ctx.classId] }
    if (['lms_materials', 'lms_assignments', 'exams', 'report_cards', 'class_subjects', 'schedules'].includes(table)) return { sql: `${classCol} = ?`, params: [ctx.classId] }
    return { sql: `${userIdCol} = ?`, params: [ctx.studentId] }
  }
  // guru / wali kelas
  if (table === 'class_subjects' || table === 'schedules') {
    if (ctx.classIds.length && ctx.teacherId) return { sql: `teacher_id = ?`, params: [ctx.teacherId] }
    return { sql: `${classCol} IN (${inList(ctx.classIds)})`, params: [...ctx.classIds] }
  }
  if (['students', 'lms_materials', 'lms_assignments', 'exams', 'report_cards', 'attendance_students'].includes(table)) {
    return { sql: `${classCol} IN (${inList(ctx.classIds)})`, params: [...ctx.classIds] }
  }
  if (table === 'classes') return { sql: `id IN (${inList(ctx.classIds)})`, params: [...ctx.classIds] }
  if (hasUnit) return { sql: `${unitCol} = ?`, params: [ctx.unitId] }
  return { sql: `1=1`, params: [] }
}

/** Daftar kelas yang boleh diakses pengguna. */
export async function allowedClassIds(db, user, ctx) {
  if (ctx.kind === 'all') return null
  if (ctx.kind === 'unit') {
    const r = await db.prepare('SELECT id FROM classes WHERE unit_id = ? ORDER BY level, name').bind(ctx.unitId).all()
    return r.results.map((x) => x.id)
  }
  if (ctx.kind === 'classes') return ctx.classIds
  return ctx.classId ? [ctx.classId] : []
}

/** Kelas yang boleh DIKELOLA guru (diampu atau wali kelas). */
export async function managedClassIds(db, user, ctx) {
  if (ctx.kind === 'all' || ctx.kind === 'unit') return null
  if (ctx.kind === 'classes') return ctx.classIds
  return []
}

export function canWrite(user) { return WRITE_UNIT_ROLES.includes(user.role) }
export function canWriteUnit(user, unitId) {
  if (user.role === 'super_admin') return true
  if (WRITE_UNIT_ROLES.includes(user.role)) return Number(user.unit_id) === Number(unitId)
  return false
}

// --------------------------------------------------------------- audit
export async function audit(db, user, action, entity, entityId, detail, unitId = null) {
  try {
    await db.prepare('INSERT INTO audit_logs (actor_user_id, actor_name, role, unit_id, action, entity, entity_id, detail, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(user ? user.id : null, user ? user.name : 'Sistem', user ? user.role : 'system', unitId != null ? unitId : (user ? user.unit_id : null), action, entity, String(entityId == null ? '' : entityId), detail || '', new Date().toISOString()).run()
  } catch (e) { void e }
}

// --------------------------------------------------------------- query umum
export function parseList(url) {
  const sp = url.searchParams
  return {
    q: clean(sp.get('q')),
    page: Math.max(1, parseInt(sp.get('page') || '1', 10) || 1),
    limit: Math.min(200, Math.max(1, parseInt(sp.get('limit') || '25', 10) || 25)),
    sort: clean(sp.get('sort')),
    dir: (sp.get('dir') || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC',
    filters: Object.fromEntries([...sp.entries()].filter(([k]) => !['q', 'page', 'limit', 'sort', 'dir'].includes(k))),
  }
}

export function settingsMap(rows) { const m = {}; for (const r of rows) m[r.key] = r.value; return m }

export function todayStr() { return new Date().toISOString().slice(0, 10) }
export function nowStr() { return new Date().toISOString() }
