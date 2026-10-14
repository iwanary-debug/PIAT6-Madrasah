// PIAT 6 Madrasah Management System - Worker API
import { json, error, clean, currentUser, createSession, sessionCookie, clearCookie, isSameOrigin, scopeContext, scopeSql, allowedClassIds, ROLES, ROLE_LABELS, STAFF_ROLES, audit, parseList } from './lib.js'
import { verifyPassword, hashPassword, randomHex, DDL, seedAll, SCHEMA_VERSION, SEED_VERSION, DEFAULT_SETTINGS, DEMO_PASSWORD } from './schema.js'
import academicRoutes from './routes/academic.js'
import lmsRoutes from './routes/lms.js'
import cbtRoutes from './routes/cbt.js'
import reportRoutes from './routes/reports.js'

const UNIT_FULL = ['super_admin', 'kepala_mts', 'kepala_ma', 'operator']
export const CRUD = {
  units: { label: 'Unit Pendidikan', search: ['code', 'name'], write: ['super_admin'], read: STAFF_ROLES.concat('siswa'), unitCol: null,
    fields: ['code', 'name', 'level', 'address', 'head_teacher_id'], required: ['code', 'name', 'level'], list: 'SELECT units.* FROM units' },
  academic_years: { label: 'Tahun Ajaran', search: ['name'], write: ['super_admin'], read: STAFF_ROLES.concat('siswa'), unitCol: null,
    fields: ['name', 'start_date', 'end_date', 'is_active'], required: ['name'], list: 'SELECT academic_years.* FROM academic_years' },
  semesters: { label: 'Semester', search: ['name'], write: ['super_admin'], read: STAFF_ROLES.concat('siswa'), unitCol: null,
    fields: ['academic_year_id', 'name', 'term', 'start_date', 'end_date', 'is_active'], required: ['academic_year_id', 'name', 'term'],
    list: 'SELECT semesters.*, academic_years.name AS academic_year_name FROM semesters LEFT JOIN academic_years ON academic_years.id = semesters.academic_year_id' },
  teachers: { label: 'Guru & Tenaga Kependidikan', search: ['name', 'nip', 'position', 'email'], write: UNIT_FULL, read: STAFF_ROLES, unitCol: 'unit_id',
    fields: ['nip', 'name', 'gender', 'unit_id', 'position', 'status', 'email', 'phone'], required: ['name'],
    list: 'SELECT teachers.*, units.name AS unit_name FROM teachers LEFT JOIN units ON units.id = teachers.unit_id' },
  students: { label: 'Siswa/Santri', search: ['name', 'nis', 'nisn', 'parent_name'], write: UNIT_FULL, read: STAFF_ROLES, unitCol: 'unit_id', classCol: 'class_id',
    fields: ['nis', 'nisn', 'name', 'gender', 'unit_id', 'class_id', 'birth_place', 'birth_date', 'address', 'parent_name', 'parent_phone', 'status', 'entry_year'],
    required: ['name', 'unit_id', 'class_id'],
    list: 'SELECT students.*, classes.name AS class_name, classes.level AS class_level, units.name AS unit_name, units.code AS unit_code FROM students LEFT JOIN classes ON classes.id = students.class_id LEFT JOIN units ON units.id = students.unit_id' },
  classes: { label: 'Kelas & Rombongan Belajar', search: ['name'], write: UNIT_FULL, read: STAFF_ROLES, unitCol: 'unit_id', classCol: 'id',
    fields: ['name', 'level', 'unit_id', 'academic_year_id', 'homeroom_teacher_id', 'capacity'], required: ['name', 'unit_id', 'level'],
    list: 'SELECT classes.*, units.code AS unit_code, units.name AS unit_name, teachers.name AS homeroom_name, (SELECT COUNT(*) FROM students WHERE students.class_id = classes.id AND students.status = "aktif") AS student_count FROM classes LEFT JOIN units ON units.id = classes.unit_id LEFT JOIN teachers ON teachers.id = classes.homeroom_teacher_id' },
  subjects: { label: 'Mata Pelajaran', search: ['name', 'code'], write: UNIT_FULL, read: STAFF_ROLES, unitCol: 'unit_id',
    fields: ['code', 'name', 'unit_id', 'category'], required: ['code', 'name', 'unit_id'],
    list: 'SELECT subjects.*, units.code AS unit_code FROM subjects LEFT JOIN units ON units.id = subjects.unit_id' },
  class_subjects: { label: 'Penugasan Mata Pelajaran', search: ['subject'], write: UNIT_FULL, read: STAFF_ROLES, unitCol: null, classCol: 'class_id',
    fields: ['class_id', 'subject_id', 'teacher_id', 'academic_year_id', 'semester_id', 'kkm', 'hours'], required: ['class_id', 'subject_id', 'teacher_id', 'semester_id'],
    list: 'SELECT class_subjects.*, classes.name AS class_name, subjects.name AS subject_name, subjects.code AS subject_code, teachers.name AS teacher_name, classes.unit_id AS unit_id FROM class_subjects LEFT JOIN classes ON classes.id = class_subjects.class_id LEFT JOIN subjects ON subjects.id = class_subjects.subject_id LEFT JOIN teachers ON teachers.id = class_subjects.teacher_id' },
  schedules: { label: 'Jadwal Pelajaran', search: ['day', 'room'], write: UNIT_FULL, read: STAFF_ROLES, unitCol: null, classCol: 'class_id',
    fields: ['class_id', 'class_subject_id', 'day', 'period', 'start_time', 'end_time', 'room'], required: ['class_id', 'class_subject_id', 'day', 'period'],
    list: 'SELECT schedules.*, classes.name AS class_name, subjects.name AS subject_name, teachers.name AS teacher_name FROM schedules LEFT JOIN class_subjects ON class_subjects.id = schedules.class_subject_id LEFT JOIN classes ON classes.id = schedules.class_id LEFT JOIN subjects ON subjects.id = class_subjects.subject_id LEFT JOIN teachers ON teachers.id = class_subjects.teacher_id' },
  question_bank: { label: 'Bank Soal', search: ['question', 'topic'], write: ['super_admin', 'kepala_mts', 'kepala_ma', 'guru', 'wali_kelas', 'operator'], read: STAFF_ROLES, unitCol: 'unit_id',
    fields: ['unit_id', 'subject_id', 'class_level', 'topic', 'type', 'question', 'options', 'answer_key', 'explanation', 'weight', 'difficulty', 'status'], required: ['unit_id', 'subject_id', 'type', 'question'],
    list: 'SELECT question_bank.*, subjects.name AS subject_name, units.code AS unit_code FROM question_bank LEFT JOIN subjects ON subjects.id = question_bank.subject_id LEFT JOIN units ON units.id = question_bank.unit_id' },
  lms_materials: { label: 'Materi LMS', search: ['title'], write: ['super_admin', 'kepala_mts', 'kepala_ma', 'guru', 'wali_kelas'], read: STAFF_ROLES, unitCol: 'unit_id', classCol: 'class_id',
    fields: ['title', 'description', 'type', 'class_subject_id', 'class_id', 'unit_id', 'subject_id', 'teacher_id', 'content', 'url', 'status'], required: ['title', 'class_id'],
    list: 'SELECT lms_materials.*, classes.name AS class_name, subjects.name AS subject_name FROM lms_materials LEFT JOIN classes ON classes.id = lms_materials.class_id LEFT JOIN subjects ON subjects.id = lms_materials.subject_id' },
  lms_assignments: { label: 'Tugas LMS', search: ['title'], write: ['super_admin', 'kepala_mts', 'kepala_ma', 'guru', 'wali_kelas'], read: STAFF_ROLES, unitCol: 'unit_id', classCol: 'class_id',
    fields: ['title', 'instructions', 'class_subject_id', 'class_id', 'unit_id', 'subject_id', 'teacher_id', 'semester_id', 'due_date', 'max_score', 'weight', 'allow_late', 'status'], required: ['title', 'class_id'],
    list: 'SELECT lms_assignments.*, classes.name AS class_name, subjects.name AS subject_name FROM lms_assignments LEFT JOIN classes ON classes.id = lms_assignments.class_id LEFT JOIN subjects ON subjects.id = lms_assignments.subject_id' },
  users: { label: 'Pengguna', search: ['name', 'email'], write: ['super_admin'], read: ['super_admin'], unitCol: 'unit_id',
    fields: ['email', 'name', 'role', 'unit_id', 'teacher_id', 'student_id', 'is_active'], required: ['email', 'name', 'role'],
    list: 'SELECT users.id, users.email, users.name, users.role, users.unit_id, users.teacher_id, users.student_id, users.is_active, users.is_demo, users.created_at, users.last_login, units.name AS unit_name FROM users LEFT JOIN units ON units.id = users.unit_id' },
}

function scopedQuery(table, cfg, ctxObj, opts = {}) {
  const s = scopeSql(table, ctxObj, { unitCol: cfg.unitCol || 'unit_id', classCol: cfg.classCol || 'class_id' })
  const prefix = opts.prefix || ''
  const sql = prefix ? s.sql.replace(/\b(id|unit_id|class_id|student_id)\b/g, (m) => prefix + m) : s.sql
  return { sql, params: s.params }
}

function fieldsOf(cfg, body, { partialWrite = false } = {}) {
  const out = {}
  for (const f of cfg.fields) {
    if (partialWrite && !(f in body)) continue
    out[f] = clean(body[f])
  }
  if ('options' in out && out.options && typeof out.options === 'object') out.options = JSON.stringify(out.options)
  return out
}
const isBlank = (v) => v === undefined || v === null || v === ''

async function validateRow(db, table, cfg, data, id) {
  const problems = []
  const numFields = ['unit_id', 'class_id', 'teacher_id', 'student_id', 'subject_id', 'class_subject_id', 'academic_year_id', 'semester_id', 'level', 'kkm', 'hours', 'period', 'class_level', 'weight', 'max_score', 'capacity', 'homeroom_teacher_id']
  for (const f of numFields) if (f in data && !isBlank(data[f]) && isNaN(Number(data[f]))) problems.push(`Kolom ${f} harus berupa angka.`)
  if (table === 'students' && data.status && !['aktif', 'lulus', 'keluar', 'pindah', 'nonaktif'].includes(data.status)) problems.push('Status siswa tidak valid.')
  if (table === 'students' && data.gender && !['L', 'P'].includes(data.gender)) problems.push('Jenis kelamin harus L atau P.')
  if (table === 'users' && data.role && !ROLES.includes(data.role)) problems.push('Peran pengguna tidak dikenal.')
  if (table === 'question_bank' && data.type && !['multiple_choice', 'true_false', 'essay'].includes(data.type)) problems.push('Jenis soal tidak valid.')
  if (table === 'question_bank' && data.type === 'multiple_choice') {
    let opts = data.options
    try { opts = typeof opts === 'string' ? JSON.parse(opts) : opts } catch { opts = null }
    if (!Array.isArray(opts) || opts.length < 2) problems.push('Soal pilihan ganda memerlukan minimal dua pilihan jawaban.')
    else if (!data.answer_key || !opts.includes(data.answer_key)) problems.push('Kunci jawaban harus salah satu pilihan yang tersedia.')
  }
  if (table === 'question_bank' && data.type === 'true_false' && data.answer_key && !['true', 'false'].includes(String(data.answer_key))) problems.push('Kunci soal benar/salah harus true atau false.')
  if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(data.email))) problems.push('Format email tidak valid.')
  if (data.start_time && data.end_time && table === 'schedules' && String(data.start_time) >= String(data.end_time)) problems.push('Jam selesai harus setelah jam mulai.')
  const uniques = { students: ['nis', 'nisn'], teachers: ['nip'], subjects: ['code'], users: ['email'], units: ['code'], academic_years: ['name'] }
  for (const col of uniques[table] || []) {
    if (!data[col]) continue
    const row = await db.prepare(`SELECT id FROM ${table} WHERE ${col} = ? AND id != ?`).bind(data[col], id || 0).first()
    if (row) problems.push(`Data dengan ${col} "${data[col]}" sudah ada (duplikasi).`)
  }
  return problems
}

const routes = []
const add = (method, path, handler, opts = {}) => routes.push({ method, path, handler, public: !!opts.public })

export function publicUser(u) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, roleLabel: ROLE_LABELS[u.role] || u.role, unit_id: u.unit_id, teacher_id: u.teacher_id, student_id: u.student_id, is_demo: u.is_demo }
}

add('GET', '/api/health', async (c) => json({ ok: true, app: 'PIAT 6 Madrasah Management System', schema: SCHEMA_VERSION, seed: SEED_VERSION, time: new Date().toISOString() }), { public: true })
add('POST', '/api/system/init', async (c) => json(await ensureInit(c.db, true)), { public: true })
add('GET', '/api/system/status', async (c) => {
  const meta = await c.db.prepare('SELECT key, value FROM meta').all()
  const counts = {}
  for (const t of ['units', 'students', 'teachers', 'classes', 'exams', 'users', 'question_bank', 'lms_assignments']) {
    const r = await c.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first()
    counts[t] = r ? r.n : 0
  }
  return json({ meta: Object.fromEntries(meta.results.map((m) => [m.key, m.value])), counts, roles: ROLE_LABELS })
}, { public: true })

add('POST', '/api/auth/login', async (c) => {
  const { email, password } = c.body || {}
  if (!email || !password) return error('Email dan kata sandi wajib diisi.', 400)
  const user = await c.db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').bind(String(email).trim()).first()
  if (!user || !user.is_active) return error('Akun tidak ditemukan atau tidak aktif.', 401)
  const ok = await verifyPassword(String(password), user.password_hash)
  if (!ok) { await audit(c.db, null, 'Login gagal', 'users', user.id, `Percobaan login gagal untuk ${user.email}`, user.unit_id); return error('Email atau kata sandi salah.', 401) }
  await c.db.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(new Date().toISOString(), user.id).run()
  const token = await createSession(c.db, user)
  await audit(c.db, user, 'Login', 'users', user.id, `Login berhasil sebagai ${ROLE_LABELS[user.role] || user.role}`, user.unit_id)
  const scope = await scopeContext(c.db, user)
  return json({ user: publicUser(user), scope }, 200, { 'set-cookie': sessionCookie(token, c.request) })
}, { public: true })

add('POST', '/api/auth/logout', async (c) => {
  if (c.user) await audit(c.db, c.user, 'Logout', 'users', c.user.id, 'Pengguna keluar dari aplikasi', c.user.unit_id)
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() })
}, { public: true })

add('GET', '/api/auth/me', async (c) => {
  if (!c.user) return error('Belum masuk.', 401)
  const scope = await scopeContext(c.db, c.user)
  const extra = {}
  if (c.user.role === 'siswa' && c.user.student_id) {
    extra.student = await c.db.prepare('SELECT s.*, c.name AS class_name, u.name AS unit_name, u.code AS unit_code FROM students s LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN units u ON u.id = s.unit_id WHERE s.id = ?').bind(c.user.student_id).first()
  }
  if (c.user.teacher_id) {
    extra.teacher = await c.db.prepare('SELECT * FROM teachers WHERE id = ?').bind(c.user.teacher_id).first()
    const cls = await c.db.prepare('SELECT c.id, c.name, u.code AS unit_code FROM classes c LEFT JOIN units u ON u.id = c.unit_id WHERE c.homeroom_teacher_id = ?').bind(c.user.teacher_id).all()
    extra.homeroomClasses = cls.results
  }
  return json({ user: publicUser(c.user), scope, ...extra })
}, { public: true })

add('GET', '/api/roles', async (c) => json({ roles: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })) }), { public: true })

add('GET', '/api/options', async (c) => {
  const scope = c.scope
  const units = (await c.db.prepare('SELECT id, code, name, level FROM units ORDER BY id').all()).results
  const years = (await c.db.prepare('SELECT id, name, is_active FROM academic_years ORDER BY id DESC').all()).results
  const semesters = (await c.db.prepare('SELECT s.id, s.name, s.term, s.academic_year_id, s.is_active, a.name AS academic_year_name FROM semesters s LEFT JOIN academic_years a ON a.id = s.academic_year_id ORDER BY s.id DESC').all()).results
  const classIds = await allowedClassIds(c.db, c.user, scope)
  let classes = (await c.db.prepare('SELECT c.id, c.name, c.level, c.unit_id, c.homeroom_teacher_id, u.code AS unit_code, t.name AS homeroom_name FROM classes c LEFT JOIN units u ON u.id = c.unit_id LEFT JOIN teachers t ON t.id = c.homeroom_teacher_id ORDER BY c.unit_id, c.level, c.name').all()).results
  if (scope.kind === 'self') classes = classes.filter((x) => x.id === scope.classId)
  else if (classIds) classes = classes.filter((x) => classIds.includes(x.id))
  const visibleUnits = scope.kind === 'all' ? units : units.filter((u) => u.id === scope.unitId)
  const allowedUnits = visibleUnits.map((u) => u.id)
  const inUnits = allowedUnits.length ? allowedUnits.map(() => '?').join(',') : 'NULL'
  const teachers = (await c.db.prepare(`SELECT id, name, unit_id, position FROM teachers WHERE unit_id IS NULL OR unit_id IN (${inUnits}) ORDER BY name`).bind(...allowedUnits).all()).results
  const subjects = (await c.db.prepare(`SELECT id, code, name, unit_id, category FROM subjects WHERE unit_id IN (${inUnits}) ORDER BY name`).bind(...allowedUnits).all()).results
  let classSubjects = (await c.db.prepare('SELECT cs.id, cs.class_id, cs.subject_id, cs.teacher_id, cs.kkm, c.name AS class_name, s.name AS subject_name FROM class_subjects cs JOIN classes c ON c.id = cs.class_id JOIN subjects s ON s.id = cs.subject_id ORDER BY c.name, s.name').all()).results
  if (scope.kind === 'self') classSubjects = classSubjects.filter((x) => x.class_id === scope.classId)
  else if (classIds) classSubjects = classSubjects.filter((x) => classIds.includes(x.class_id))
  let students = (await c.db.prepare('SELECT s.id, s.name, s.nis, s.class_id, s.unit_id, s.status, c.name AS class_name FROM students s LEFT JOIN classes c ON c.id = s.class_id ORDER BY s.name').all()).results
  students = students.filter((s) => scope.kind === 'all' ? true : scope.kind === 'unit' ? s.unit_id === scope.unitId : scope.kind === 'self' ? s.id === scope.studentId : (classIds || []).includes(s.class_id))
  return json({
    units: visibleUnits, allUnits: units, academicYears: years, semesters, classes, teachers, subjects, classSubjects, students,
    roles: ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
    demo: { mode: true, password: DEMO_PASSWORD, notice: 'Aplikasi ini berisi DATA DEMO (nama dan nilai fiktif) untuk pengujian. Jangan digunakan untuk data resmi tanpa penyesuaian.' },
    scope: { kind: scope.kind, unitId: scope.unitId, classIds: scope.classIds || null, studentId: scope.studentId || null },
  })
})

// ---------------------------------------------------- CRUD generik data induk
for (const [table, cfg] of Object.entries(CRUD)) {
  add('GET', `/api/rt/${table}`, async (c) => {
    if (!cfg.read.includes(c.user.role)) return error('Anda tidak memiliki hak membaca data ini.', 403)
    const { q, page, limit, sort, dir, filters } = parseList(c.url)
    const where = [], params = []
    const sc = scopedQuery(table, cfg, c.scope, { prefix: table + '.' })
    where.push(sc.sql); params.push(...sc.params)
    if (q && cfg.search.length) {
      where.push('(' + cfg.search.map((f) => `${table}.${f} LIKE ?`).join(' OR ') + ')')
      cfg.search.forEach(() => params.push(`%${q}%`))
    }
    for (const [k, v] of Object.entries(filters)) {
      if (v === '' || v == null) continue
      const col = k.replace(/^filter_/, '')
      if (!cfg.fields.includes(col) && !['academic_year_id', 'semester_id', 'class_id', 'unit_id', 'subject_id', 'teacher_id', 'student_id', 'status', 'role', 'type', 'level'].includes(col)) continue
      where.push(`${table}.${col} = ?`)
      params.push(v)
    }
    const sortCol = cfg.fields.includes(sort) || ['id', 'name', 'created_at'].includes(sort) ? `${table}.${sort}` : `${table}.id`
    const total = (await c.db.prepare(`SELECT COUNT(*) AS n FROM (${cfg.list}) ${table} WHERE ${where.join(' AND ')}`).bind(...params).first()).n
    const rows = (await c.db.prepare(`SELECT * FROM (${cfg.list}) ${table} WHERE ${where.join(' AND ')} ORDER BY ${sortCol} ${dir} LIMIT ? OFFSET ?`).bind(...params, limit, (page - 1) * limit).all()).results
    return json({ data: rows, total, page, limit })
  })
  add('GET', `/api/rt/${table}/:id`, async (c) => {
    if (!cfg.read.includes(c.user.role)) return error('Anda tidak memiliki hak membaca data ini.', 403)
    const sc = scopedQuery(table, cfg, c.scope, { prefix: 'tbl.' })
    const row = await c.db.prepare(`SELECT * FROM (${cfg.list}) tbl WHERE tbl.id = ? AND ${sc.sql}`).bind(c.params.id, ...sc.params).first()
    if (!row) return error('Data tidak ditemukan atau berada di luar kewenangan Anda.', 404)
    return json({ data: row })
  })
  add('POST', `/api/rt/${table}`, async (c) => {
    if (!cfg.write.includes(c.user.role)) return error('Anda tidak memiliki hak menambah data ini.', 403)
    const data = fieldsOf(cfg, c.body || {})
    for (const r of cfg.required || []) if (isBlank(data[r])) return error(`Kolom ${r} wajib diisi.`, 422)
    if (cfg.unitCol && data[cfg.unitCol] && c.user.role !== 'super_admin' && Number(data[cfg.unitCol]) !== Number(c.user.unit_id)) return error('Anda hanya dapat menambah data pada unit pendidikan Anda.', 403)
    const problems = await validateRow(c.db, table, cfg, data, null)
    if (problems.length) return error(problems.join(' '), 422)
    const cols = Object.keys(data)
    const res = await c.db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).bind(...cols.map((k) => data[k])).run()
    const id = res.meta ? res.meta.last_row_id : null
    await audit(c.db, c.user, 'Menambah data', table, id, `Menambah ${cfg.label} baru`, data.unit_id || c.user.unit_id)
    return json({ data: { id, ...data } }, 201)
  })
  add('PUT', `/api/rt/${table}/:id`, async (c) => {
    if (!cfg.write.includes(c.user.role)) return error('Anda tidak memiliki hak mengubah data ini.', 403)
    const sc = scopedQuery(table, cfg, c.scope)
    const existing = await c.db.prepare(`SELECT * FROM (${cfg.list}) tbl WHERE tbl.id = ? AND ${sc.sql}`).bind(c.params.id, ...sc.params).first()
    if (!existing) return error('Data tidak ditemukan atau berada di luar kewenangan Anda.', 404)
    const data = fieldsOf(cfg, c.body || {}, { partialWrite: true })
    delete data.id
    if (cfg.unitCol && data[cfg.unitCol] && c.user.role !== 'super_admin' && Number(data[cfg.unitCol]) !== Number(c.user.unit_id)) return error('Anda hanya dapat mengubah data pada unit pendidikan Anda.', 403)
    const problems = await validateRow(c.db, table, cfg, data, c.params.id)
    if (problems.length) return error(problems.join(' '), 422)
    const cols = Object.keys(data)
    if (cols.length) await c.db.prepare(`UPDATE ${table} SET ${cols.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...cols.map((k) => data[k]), c.params.id).run()
    if (table === 'users' && c.body.password) {
      const hash = await hashPassword(String(c.body.password), randomHex(16))
      await c.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, c.params.id).run()
      await audit(c.db, c.user, 'Reset kata sandi', 'users', c.params.id, `Kata sandi akun ${existing.email} direset (nilai tidak dicatat pada log)`, existing.unit_id)
    }
    await audit(c.db, c.user, 'Mengubah data', table, c.params.id, `Mengubah ${cfg.label}: ${cols.join(', ') || 'tanpa perubahan kolom'}`, existing.unit_id || c.user.unit_id)
    return json({ data: { id: Number(c.params.id), ...data } })
  })
  add('DELETE', `/api/rt/${table}/:id`, async (c) => {
    if (!cfg.write.includes(c.user.role)) return error('Anda tidak memiliki hak menghapus data ini.', 403)
    const sc = scopedQuery(table, cfg, c.scope)
    const existing = await c.db.prepare(`SELECT * FROM (${cfg.list}) tbl WHERE tbl.id = ? AND ${sc.sql}`).bind(c.params.id, ...sc.params).first()
    if (!existing) return error('Data tidak ditemukan atau berada di luar kewenangan Anda.', 404)
    if (table === 'users') {
      if (Number(c.params.id) === Number(c.user.id)) return error('Tidak dapat menonaktifkan akun yang sedang digunakan.', 422)
      await c.db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind(c.params.id).run()
      await audit(c.db, c.user, 'Menonaktifkan pengguna', 'users', c.params.id, `Akun ${existing.email} dinonaktifkan (arsip, bukan hapus permanen)`, existing.unit_id)
      return json({ ok: true, archived: true })
    }
    if (table === 'students') {
      await c.db.prepare('UPDATE students SET status = "nonaktif" WHERE id = ?').bind(c.params.id).run()
      await audit(c.db, c.user, 'Mengarsipkan siswa', 'students', c.params.id, `Siswa ${existing.name} diarsipkan (status menjadi nonaktif)`, existing.unit_id)
      return json({ ok: true, archived: true })
    }
    await c.db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(c.params.id).run()
    await audit(c.db, c.user, 'Menghapus data', table, c.params.id, `Menghapus ${cfg.label}`, existing.unit_id || c.user.unit_id)
    return json({ ok: true })
  })
}

add('GET', '/api/audit', async (c) => {
  if (!['super_admin', 'pimpinan', 'pengawas', 'kepala_mts', 'kepala_ma'].includes(c.user.role)) return error('Anda tidak memiliki hak membaca audit log.', 403)
  const { q, page, limit } = parseList(c.url)
  const where = [], params = []
  if (c.scope.kind === 'unit') { where.push('unit_id = ?'); params.push(c.scope.unitId) }
  if (c.user.role === 'super_admin' && c.url.searchParams.get('unit_id')) { where.push('unit_id = ?'); params.push(c.url.searchParams.get('unit_id')) }
  if (c.url.searchParams.get('entity')) { where.push('entity = ?'); params.push(c.url.searchParams.get('entity')) }
  if (q) { where.push('(action LIKE ? OR detail LIKE ? OR actor_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  const w = where.length ? where.join(' AND ') : '1=1'
  const total = (await c.db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE ${w}`).bind(...params).first()).n
  const rows = (await c.db.prepare(`SELECT * FROM audit_logs WHERE ${w} ORDER BY id DESC LIMIT ? OFFSET ?`).bind(...params, limit, (page - 1) * limit).all()).results
  return json({ data: rows, total, page, limit })
})

add('GET', '/api/settings', async (c) => {
  const rows = (await c.db.prepare('SELECT * FROM settings ORDER BY key').all()).results
  if (c.user.role !== 'super_admin') {
    const allowed = ['app_name', 'kkm_default', 'attendance_alert_percent', 'promotion_min_average', 'promotion_max_absence_percent', 'report_require_complete']
    return json({ data: rows.filter((r) => allowed.includes(r.key)) })
  }
  return json({ data: rows })
})

add('PUT', '/api/settings', async (c) => {
  if (c.user.role !== 'super_admin') return error('Hanya Super Admin yang dapat mengubah pengaturan aplikasi.', 403)
  const body = c.body || {}
  const changed = []
  for (const [k, v] of Object.entries(body)) {
    if (!DEFAULT_SETTINGS.some((s) => s[0] === k)) continue
    await c.db.prepare('INSERT OR REPLACE INTO settings (key, value, description) VALUES (?, ?, COALESCE((SELECT description FROM settings WHERE key = ?), ?))').bind(k, String(v), k, '').run()
    changed.push(k)
  }
  await audit(c.db, c.user, 'Mengubah pengaturan', 'settings', '', `Perubahan pengaturan: ${changed.join(', ')}`)
  return json({ ok: true, changed })
})

add('POST', '/api/system/reseed', async (c) => {
  if (c.user.role !== 'super_admin') return error('Hanya Super Admin yang dapat mengisi ulang data demo.', 403)
  const summary = await seedAll(c.db)
  await audit(c.db, c.user, 'Mengisi ulang data demo', 'system', '', 'Seluruh data demo dibangun ulang dari skema')
  return json({ ok: true, summary })
})

// ---------------------------------------------------- router
const allRoutes = routes.concat(academicRoutes, lmsRoutes, cbtRoutes, reportRoutes)

function matchRoute(method, pathname) {
  for (const r of allRoutes) {
    if (r.method !== method) continue
    const parts = r.path.split('/')
    const target = pathname.split('/')
    if (parts.length !== target.length) continue
    const params = {}
    let ok = true
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(':')) params[parts[i].slice(1)] = decodeURIComponent(target[i])
      else if (parts[i] !== target[i]) { ok = false; break }
    }
    if (ok) return { route: r, params }
  }
  return null
}

// Pemeriksaan skema disimpan per isolate. Skrip DDL sebelumnya dieksekusi pada SETIAP permintaan API,
// yang membuang CPU/latensi dan memperbesar pemakaian kuota D1 tanpa manfaat. Sekarang DDL dijalankan
// sekali per isolate (cold start), sementara permintaan berikutnya memakai hasil yang sudah tersimpan di memori.
// Bila DDL atau pembuatan data demo gagal, penanda tidak dipasang sehingga permintaan berikutnya mencoba lagi.
let initPromise = null
let dbInitialized = false

export async function ensureInit(db, force = false) {
  if (force) {
    dbInitialized = false
    initPromise = null
  } else {
    if (dbInitialized) return { initialized: true, seeded: false, fromCache: true }
    if (initPromise) return initPromise
  }
  const run = async () => {
    const started = Date.now()
    await db.exec(DDL)
    const seeded = await db.prepare("SELECT value FROM meta WHERE key = 'seed_version'").first()
    const needSeed = force || !seeded || seeded.value !== SEED_VERSION
    const summary = needSeed ? await seedAll(db) : null
    dbInitialized = true
    return { initialized: true, seeded: needSeed, summary, ms: Date.now() - started }
  }
  initPromise = run()
  try { return await initPromise } finally { initPromise = null }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) {
      if (env.ASSETS) return env.ASSETS.fetch(request)
      return new Response('Endpoint tidak ditemukan', { status: 404 })
    }
    try {
      await ensureInit(env.DB)
      const match = matchRoute(request.method, url.pathname)
      if (!match) return error('Endpoint tidak ditemukan.', 404)
      let body = null
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        try { body = await request.json() } catch { body = null }
      }
      const user = await currentUser(env.DB, request)
      if (!match.route.public && !user) return error('Sesi tidak ditemukan. Silakan masuk kembali.', 401)
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) && !isSameOrigin(request)) return error('Permintaan ditolak: origin tidak sesuai.', 403)
      const scope = user ? await scopeContext(env.DB, user) : { kind: 'all' }
      const c = { request, env, db: env.DB, url, user, body, params: match.params, scope, query: url.searchParams }
      return await match.route.handler(c)
    } catch (e) {
      console.error('API error:', e && e.stack ? e.stack : String(e))
      const msg = e && e.message ? e.message : String(e)
      return json({ error: 'Terjadi kesalahan pada server.', detail: msg }, 500)
    }
  },
}
