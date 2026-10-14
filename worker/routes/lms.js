// LMS: materi, tugas, pengumpulan, koreksi, umpan balik
import { json, error, audit, parseList, allowedClassIds } from '../lib.js'
import { getSettings } from './calc.js'

const WRITE_ROLES = ['super_admin', 'kepala_mts', 'kepala_ma', 'operator']
const TEACHING_ROLES = ['guru', 'wali_kelas']
const routes = []
const add = (method, path, handler, opts = {}) => routes.push({ method, path, handler, public: !!opts.public })

async function canManageCs(c, classSubjectId) {
  const cs = await c.db.prepare('SELECT cs.*, cl.unit_id, cl.name AS class_name FROM class_subjects cs JOIN classes cl ON cl.id = cs.class_id WHERE cs.id = ?').bind(classSubjectId).first()
  if (!cs) return { ok: false, notFound: true }
  if (WRITE_ROLES.includes(c.user.role)) {
    if (c.user.role === 'super_admin') return { ok: true, cs }
    return { ok: Number(cs.unit_id) === Number(c.user.unit_id), cs }
  }
  if (TEACHING_ROLES.includes(c.user.role) && Number(cs.teacher_id) === Number(c.user.teacher_id)) return { ok: true, cs }
  return { ok: false, cs }
}

async function classScopeCheck(c, classId) {
  const ids = await allowedClassIds(c.db, c.user, c.scope)
  return ids === null || ids.includes(Number(classId))
}

add('GET', '/api/lms/overview', async (c) => {
  const semId = Number(c.query.get('semester_id')) || (await c.db.prepare('SELECT id FROM semesters WHERE is_active = 1').first()).id
  const classIds = await allowedClassIds(c.db, c.user, c.scope)
  const cf = classIds === null ? '' : ` AND a.class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`
  const cp = classIds === null ? [] : classIds
  const tf = classIds === null ? '' : ` AND m.class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`
  const materials = (await c.db.prepare(`SELECT COUNT(*) AS n FROM lms_materials m WHERE m.status = 'published'${tf}`).bind(...cp).first()).n
  const assignments = (await c.db.prepare(`SELECT COUNT(*) AS n, SUM(CASE WHEN a.due_date >= ? THEN 1 ELSE 0 END) AS active FROM lms_assignments a WHERE a.status = 'published'${cf}`).bind(new Date().toISOString(), ...cp).first())
  const stats = (await c.db.prepare(
    `SELECT COUNT(*) AS total_students,
       SUM(CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END) AS submitted,
       SUM(CASE WHEN s.id IS NULL THEN 1 ELSE 0 END) AS missing,
       SUM(CASE WHEN s.status = 'graded' THEN 1 ELSE 0 END) AS graded,
       SUM(CASE WHEN s.status = 'published' THEN 1 ELSE 0 END) AS published,
       SUM(CASE WHEN s.status = 'submitted' THEN 1 ELSE 0 END) AS ungraded
     FROM lms_assignments a JOIN students st ON st.class_id = a.class_id AND st.status = 'aktif'
     LEFT JOIN lms_submissions s ON s.assignment_id = a.id AND s.student_id = st.id
     WHERE a.status = 'published' AND a.semester_id = ?${cf}`).bind(semId, ...cp).first())
  const perClass = (await c.db.prepare(
    `SELECT cl.id, cl.name, u.code AS unit_code, COUNT(DISTINCT a.id) AS assignments, COUNT(DISTINCT st.id) AS students,
       COUNT(s.id) AS submitted, SUM(CASE WHEN s.status IN ('graded','published') THEN 1 ELSE 0 END) AS graded
     FROM classes cl LEFT JOIN units u ON u.id = cl.unit_id
     LEFT JOIN lms_assignments a ON a.class_id = cl.id AND a.status = 'published' AND a.semester_id = ?
     LEFT JOIN students st ON st.class_id = cl.id AND st.status = 'aktif'
     LEFT JOIN lms_submissions s ON s.assignment_id = a.id AND s.student_id = st.id
     WHERE 1=1${classIds === null ? '' : ` AND cl.id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`}
     GROUP BY cl.id ORDER BY u.code, cl.name`).bind(semId, ...cp).all()).results
  const expected = perClass.reduce((a, x) => a + x.assignments * x.students, 0)
  const submitted = perClass.reduce((a, x) => a + (x.submitted || 0), 0)
  const recent = (await c.db.prepare(
    `SELECT s.id, s.submitted_at, s.status, st.name AS student_name, a.title AS assignment_title, cl.name AS class_name
     FROM lms_submissions s JOIN students st ON st.id = s.student_id JOIN lms_assignments a ON a.id = s.assignment_id JOIN classes cl ON cl.id = a.class_id
     WHERE 1=1${cf} ORDER BY s.submitted_at DESC LIMIT 8`).bind(...cp).all()).results
  return json({
    semester_id: semId,
    materials, assignments_published: assignments.n, assignments_active: assignments.active || 0,
    students: stats.total_students || 0, submitted: stats.submitted || 0, missing: stats.missing || 0,
    graded: (stats.graded || 0) + (stats.published || 0), ungraded: stats.ungraded || 0,
    completion_percent: expected ? Math.round((submitted / expected) * 1000) / 10 : 0,
    per_class: perClass.map((x) => ({ ...x, completion_percent: x.assignments * x.students ? Math.round((x.submitted / (x.assignments * x.students)) * 1000) / 10 : 0 })),
    recent,
  })
})

add('GET', '/api/lms/materials', async (c) => {
  const classId = c.query.get('class_id'); const subjectId = c.query.get('subject_id')
  const where = [], params = []
  if (c.scope.kind === 'self') { where.push('m.class_id = ?'); params.push(c.scope.classId); where.push("m.status = 'published'") }
  else if (c.scope.kind === 'classes') { where.push(`m.class_id IN (${c.scope.classIds.length ? c.scope.classIds.map(() => '?').join(',') : 'NULL'})`); params.push(...c.scope.classIds) }
  else if (c.scope.kind === 'unit') { where.push('cl.unit_id = ?'); params.push(c.scope.unitId) }
  if (classId) { where.push('m.class_id = ?'); params.push(Number(classId)) }
  if (subjectId) { where.push('m.subject_id = ?'); params.push(Number(subjectId)) }
  if (c.query.get('status')) { where.push('m.status = ?'); params.push(c.query.get('status')) }
  const q = c.query.get('q')
  if (q) { where.push('(m.title LIKE ? OR m.description LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  const w = where.length ? where.join(' AND ') : '1=1'
  const rows = (await c.db.prepare(
    `SELECT m.*, cl.name AS class_name, cl.unit_id, s.name AS subject_name, s.code AS subject_code, t.name AS teacher_name
     FROM lms_materials m JOIN classes cl ON cl.id = m.class_id LEFT JOIN subjects s ON s.id = m.subject_id LEFT JOIN teachers t ON t.id = m.teacher_id
     WHERE ${w} ORDER BY m.created_at DESC LIMIT 200`).bind(...params).all()).results
  return json({ data: rows })
})

add('POST', '/api/lms/materials', async (c) => {
  const b = c.body || {}
  const check = await canManageCs(c, Number(b.class_subject_id))
  if (!check.ok) return error(check.notFound ? 'Penugasan mata pelajaran tidak ditemukan.' : 'Anda tidak berwenang membuat materi untuk kelas ini.', check.notFound ? 404 : 403)
  if (!b.title || !String(b.title).trim()) return error('Judul materi wajib diisi.', 422)
  if (b.type === 'link' && !b.url) return error('Tautan wajib diisi untuk materi bertipe tautan.', 422)
  const res = await c.db.prepare('INSERT INTO lms_materials (title, description, type, class_subject_id, class_id, unit_id, subject_id, teacher_id, content, url, status, created_at, is_demo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)')
    .bind(String(b.title).trim(), b.description || '', b.type || 'text', check.cs.id, check.cs.class_id, check.cs.unit_id, check.cs.subject_id, check.cs.teacher_id,
      b.content || '', b.url || '', b.status || 'published', new Date().toISOString()).run()
  await audit(c.db, c.user, 'Membuat materi LMS', 'lms_materials', res.meta ? res.meta.last_row_id : null, `Materi "${b.title}" untuk kelas ${check.cs.class_name}.`, check.cs.unit_id)
  return json({ ok: true, id: res.meta ? res.meta.last_row_id : null }, 201)
})

add('PUT', '/api/lms/materials/:id', async (c) => {
  const m = await c.db.prepare('SELECT * FROM lms_materials WHERE id = ?').bind(Number(c.params.id)).first()
  if (!m) return error('Materi tidak ditemukan.', 404)
  const check = await canManageCs(c, m.class_subject_id)
  if (!check.ok) return error('Anda tidak berwenang mengubah materi ini.', 403)
  const b = c.body || {}
  const fields = ['title', 'description', 'type', 'content', 'url', 'status']
  const cols = fields.filter((f) => f in b)
  if (!cols.length) return error('Tidak ada perubahan yang dikirim.', 422)
  await c.db.prepare(`UPDATE lms_materials SET ${cols.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).bind(...cols.map((f) => b[f]), m.id).run()
  await audit(c.db, c.user, 'Mengubah materi LMS', 'lms_materials', m.id, `Materi "${b.title || m.title}" diperbarui.`, m.unit_id)
  return json({ ok: true })
})

add('DELETE', '/api/lms/materials/:id', async (c) => {
  const m = await c.db.prepare('SELECT * FROM lms_materials WHERE id = ?').bind(Number(c.params.id)).first()
  if (!m) return error('Materi tidak ditemukan.', 404)
  const check = await canManageCs(c, m.class_subject_id)
  if (!check.ok) return error('Anda tidak berwenang menghapus materi ini.', 403)
  await c.db.prepare("UPDATE lms_materials SET status = 'arsip' WHERE id = ?").bind(m.id).run()
  await audit(c.db, c.user, 'Mengarsipkan materi LMS', 'lms_materials', m.id, `Materi "${m.title}" diarsipkan.`, m.unit_id)
  return json({ ok: true, archived: true })
})

add('GET', '/api/lms/assignments', async (c) => {
  const where = [], params = []
  if (c.scope.kind === 'self') { where.push('a.class_id = ?'); params.push(c.scope.classId); where.push("a.status = 'published'") }
  else if (c.scope.kind === 'classes') { where.push(`a.class_id IN (${c.scope.classIds.length ? c.scope.classIds.map(() => '?').join(',') : 'NULL'})`); params.push(...c.scope.classIds) }
  else if (c.scope.kind === 'unit') { where.push('cl.unit_id = ?'); params.push(c.scope.unitId) }
  const classId = c.query.get('class_id')
  if (classId) { where.push('a.class_id = ?'); params.push(Number(classId)) }
  if (c.query.get('status')) { where.push('a.status = ?'); params.push(c.query.get('status')) }
  const q = c.query.get('q')
  if (q) { where.push('a.title LIKE ?'); params.push(`%${q}%`) }
  const w = where.length ? where.join(' AND ') : '1=1'
  const rows = (await c.db.prepare(
    `SELECT a.*, cl.name AS class_name, cl.unit_id, s.name AS subject_name, t.name AS teacher_name,
       (SELECT COUNT(*) FROM students st WHERE st.class_id = a.class_id AND st.status = 'aktif') AS student_count,
       (SELECT COUNT(*) FROM lms_submissions su WHERE su.assignment_id = a.id) AS submitted_count,
       (SELECT COUNT(*) FROM lms_submissions su WHERE su.assignment_id = a.id AND su.status IN ('graded','published')) AS graded_count,
       (SELECT COUNT(*) FROM lms_submissions su WHERE su.assignment_id = a.id AND su.status = 'submitted') AS ungraded_count
     FROM lms_assignments a JOIN classes cl ON cl.id = a.class_id LEFT JOIN subjects s ON s.id = a.subject_id LEFT JOIN teachers t ON t.id = a.teacher_id
     WHERE ${w} ORDER BY a.due_date DESC LIMIT 200`).bind(...params).all()).results
  const out = rows.map((r) => ({ ...r, completion_percent: r.student_count ? Math.round((r.submitted_count / r.student_count) * 1000) / 10 : 0 }))
  if (c.scope.kind === 'self') {
    const subs = (await c.db.prepare('SELECT * FROM lms_submissions WHERE student_id = ?').bind(c.scope.studentId).all()).results
    const map = Object.fromEntries(subs.map((s) => [s.assignment_id, s]))
    return json({ data: out.map((r) => ({ ...r, my_submission: map[r.id] ? { status: map[r.id].status, submitted_at: map[r.id].submitted_at, score: map[r.id].status === 'published' ? map[r.id].score : null, feedback: map[r.id].status === 'published' ? map[r.id].feedback : null } : null })) })
  }
  return json({ data: out })
})

add('POST', '/api/lms/assignments', async (c) => {
  const b = c.body || {}
  const check = await canManageCs(c, Number(b.class_subject_id))
  if (!check.ok) return error(check.notFound ? 'Penugasan mata pelajaran tidak ditemukan.' : 'Anda tidak berwenang membuat tugas untuk kelas ini.', check.notFound ? 404 : 403)
  if (!b.title || !String(b.title).trim()) return error('Judul tugas wajib diisi.', 422)
  if (!b.due_date) return error('Tenggat pengumpulan wajib diisi.', 422)
  const weight = Number(b.weight || 20)
  if (!(weight > 0) || weight > 100) return error('Bobot tugas harus antara 1 dan 100.', 422)
  const maxScore = Number(b.max_score || 100)
  if (!(maxScore > 0) || maxScore > 1000) return error('Nilai maksimal tidak valid.', 422)
  const res = await c.db.prepare('INSERT INTO lms_assignments (title, instructions, class_subject_id, class_id, unit_id, subject_id, teacher_id, semester_id, due_date, max_score, weight, allow_late, status, created_at, is_demo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)')
    .bind(String(b.title).trim(), b.instructions || '', check.cs.id, check.cs.class_id, check.cs.unit_id, check.cs.subject_id, check.cs.teacher_id,
      check.cs.semester_id, b.due_date, maxScore, weight, b.allow_late ? 1 : 0, b.status === 'published' ? 'published' : 'draft', new Date().toISOString()).run()
  await audit(c.db, c.user, 'Membuat tugas LMS', 'lms_assignments', res.meta ? res.meta.last_row_id : null, `Tugas "${b.title}" untuk kelas ${check.cs.class_name} (tenggat ${b.due_date}).`, check.cs.unit_id)
  return json({ ok: true, id: res.meta ? res.meta.last_row_id : null }, 201)
})

add('PUT', '/api/lms/assignments/:id', async (c) => {
  const a = await c.db.prepare('SELECT * FROM lms_assignments WHERE id = ?').bind(Number(c.params.id)).first()
  if (!a) return error('Tugas tidak ditemukan.', 404)
  const check = await canManageCs(c, a.class_subject_id)
  if (!check.ok) return error('Anda tidak berwenang mengubah tugas ini.', 403)
  const b = c.body || {}
  const fields = ['title', 'instructions', 'due_date', 'max_score', 'weight', 'allow_late', 'status']
  const cols = fields.filter((f) => f in b)
  if (!cols.length) return error('Tidak ada perubahan yang dikirim.', 422)
  await c.db.prepare(`UPDATE lms_assignments SET ${cols.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).bind(...cols.map((f) => (f === 'allow_late' ? (b[f] ? 1 : 0) : b[f])), a.id).run()
  await audit(c.db, c.user, 'Mengubah tugas LMS', 'lms_assignments', a.id, `Tugas "${b.title || a.title}" diperbarui (${cols.join(', ')}).`, a.unit_id)
  return json({ ok: true })
})

add('DELETE', '/api/lms/assignments/:id', async (c) => {
  const a = await c.db.prepare('SELECT * FROM lms_assignments WHERE id = ?').bind(Number(c.params.id)).first()
  if (!a) return error('Tugas tidak ditemukan.', 404)
  const check = await canManageCs(c, a.class_subject_id)
  if (!check.ok) return error('Anda tidak berwenang menghapus tugas ini.', 403)
  await c.db.prepare("UPDATE lms_assignments SET status = 'arsip' WHERE id = ?").bind(a.id).run()
  await audit(c.db, c.user, 'Mengarsipkan tugas LMS', 'lms_assignments', a.id, `Tugas "${a.title}" diarsipkan.`, a.unit_id)
  return json({ ok: true, archived: true })
})

add('GET', '/api/lms/assignments/:id', async (c) => {
  const a = await c.db.prepare(
    `SELECT a.*, cl.name AS class_name, cl.unit_id, s.name AS subject_name, t.name AS teacher_name FROM lms_assignments a
     JOIN classes cl ON cl.id = a.class_id LEFT JOIN subjects s ON s.id = a.subject_id LEFT JOIN teachers t ON t.id = a.teacher_id WHERE a.id = ?`).bind(Number(c.params.id)).first()
  if (!a) return error('Tugas tidak ditemukan.', 404)
  if (c.scope.kind === 'self') {
    if (a.class_id !== c.scope.classId || a.status !== 'published') return error('Tugas tidak tersedia untuk Anda.', 403)
    const sub = await c.db.prepare('SELECT * FROM lms_submissions WHERE assignment_id = ? AND student_id = ?').bind(a.id, c.scope.studentId).first()
    return json({ assignment: a, my_submission: sub ? { id: sub.id, content: sub.content, file_name: sub.file_name, submitted_at: sub.submitted_at, status: sub.status, score: sub.status === 'published' ? sub.score : null, feedback: sub.status === 'published' ? sub.feedback : null } : null })
  }
  const check = await canManageCs(c, a.class_subject_id)
  const students = (await c.db.prepare('SELECT id, name, nis FROM students WHERE class_id = ? AND status = "aktif" ORDER BY name').bind(a.class_id).all()).results
  const subs = (await c.db.prepare('SELECT * FROM lms_submissions WHERE assignment_id = ?').bind(a.id).all()).results
  const map = Object.fromEntries(subs.map((s) => [s.student_id, s]))
  return json({
    assignment: a, can_grade: check.ok, can_edit: check.ok,
    records: students.map((s) => ({
      student_id: s.id, name: s.name, nis: s.nis,
      submission_id: map[s.id] ? map[s.id].id : null, status: map[s.id] ? map[s.id].status : 'missing',
      submitted_at: map[s.id] ? map[s.id].submitted_at : null, content: map[s.id] ? map[s.id].content : null,
      file_name: map[s.id] ? map[s.id].file_name : null, score: map[s.id] ? map[s.id].score : null, feedback: map[s.id] ? map[s.id].feedback : null,
    })),
  })
})

add('POST', '/api/lms/assignments/:id/submit', async (c) => {
  if (c.user.role !== 'siswa') return error('Hanya siswa yang dapat mengumpulkan tugas.', 403)
  const a = await c.db.prepare('SELECT * FROM lms_assignments WHERE id = ?').bind(Number(c.params.id)).first()
  if (!a) return error('Tugas tidak ditemukan.', 404)
  if (a.class_id !== c.scope.classId) return error('Tugas ini bukan untuk kelas Anda.', 403)
  if (a.status !== 'published') return error('Tugas belum dipublikasikan oleh guru.', 403)
  const content = (c.body || {}).content || ''
  const fileName = (c.body || {}).file_name || null
  if (!String(content).trim() && !fileName) return error('Jawaban atau nama berkas wajib diisi sebelum mengumpulkan.', 422)
  const settings = await getSettings(c.db)
  const now = new Date()
  const late = a.due_date && new Date(a.due_date) < now
  if (late && settings.lms_late_allowed !== '1' && !a.allow_late) return error(`Tenggat pengumpulan telah berakhir pada ${a.due_date}. Hubungi guru pengampu untuk pengumpulan susulan.`, 422)
  const existing = await c.db.prepare('SELECT * FROM lms_submissions WHERE assignment_id = ? AND student_id = ?').bind(a.id, c.scope.studentId).first()
  if (existing && ['graded', 'published'].includes(existing.status)) return error('Tugas sudah dinilai sehingga tidak dapat dikumpulkan ulang.', 422)
  const nowIso = now.toISOString()
  if (existing) {
    await c.db.prepare("UPDATE lms_submissions SET content = ?, file_name = ?, submitted_at = ?, status = 'submitted' WHERE id = ?")
      .bind(String(content), fileName, nowIso, existing.id).run()
  } else {
    await c.db.prepare('INSERT INTO lms_submissions (assignment_id, student_id, content, file_name, submitted_at, status, is_demo) VALUES (?,?,?,?,?,?,1)')
      .bind(a.id, c.scope.studentId, String(content), fileName, nowIso, 'submitted').run()
  }
  await audit(c.db, c.user, 'Mengumpulkan tugas', 'lms_submissions', a.id, `Siswa ${c.user.name} mengumpulkan tugas "${a.title}"${late ? ' (melewati tenggat)' : ''}.`, c.user.unit_id)
  return json({ ok: true, late: !!late })
})

add('POST', '/api/lms/submissions/:id/grade', async (c) => {
  const sub = await c.db.prepare(
    `SELECT s.*, a.title AS assignment_title, a.max_score, a.class_subject_id, a.unit_id, a.class_id FROM lms_submissions s JOIN lms_assignments a ON a.id = s.assignment_id WHERE s.id = ?`).bind(Number(c.params.id)).first()
  if (!sub) return error('Pengumpulan tugas tidak ditemukan.', 404)
  const check = await canManageCs(c, sub.class_subject_id)
  if (!check.ok) return error('Anda tidak berwenang menilai tugas ini.', 403)
  const { score, feedback, publish } = c.body || {}
  const maxScore = Number(sub.max_score || 100)
  if (score === '' || score == null) return error('Nilai wajib diisi.', 422)
  const v = Number(score)
  if (isNaN(v) || v < 0 || v > maxScore) return error(`Nilai harus berupa angka antara 0 dan ${maxScore}.`, 422)
  const status = publish ? 'published' : 'graded'
  await c.db.prepare('UPDATE lms_submissions SET score = ?, feedback = ?, status = ?, graded_by = ?, graded_at = ? WHERE id = ?')
    .bind(v, feedback || '', status, c.user.teacher_id || c.user.id, new Date().toISOString(), sub.id).run()
  await audit(c.db, c.user, publish ? 'Mempublikasikan nilai tugas' : 'Menilai tugas', 'lms_submissions', sub.id, `Nilai ${v}/${maxScore} untuk tugas "${sub.assignment_title}" (${publish ? 'dipublikasikan' : 'disimpan sebagai draft'}).`, sub.unit_id)
  return json({ ok: true, status })
})

add('GET', '/api/lms/student', async (c) => {
  if (c.user.role !== 'siswa') return error('Endpoint ini khusus untuk akun siswa.', 403)
  const classId = c.scope.classId
  const semId = (await c.db.prepare('SELECT id FROM semesters WHERE is_active = 1').first()).id
  const materials = (await c.db.prepare(
    `SELECT m.id, m.title, m.type, m.description, m.created_at, s.name AS subject_name, t.name AS teacher_name FROM lms_materials m
     LEFT JOIN subjects s ON s.id = m.subject_id LEFT JOIN teachers t ON t.id = m.teacher_id
     WHERE m.class_id = ? AND m.status = 'published' ORDER BY m.created_at DESC`).bind(classId).all()).results
  const assignments = (await c.db.prepare(
    `SELECT a.id, a.title, a.instructions, a.due_date, a.max_score, s.name AS subject_name, t.name AS teacher_name,
       su.status AS submission_status, su.submitted_at, su.score, su.feedback
     FROM lms_assignments a LEFT JOIN subjects s ON s.id = a.subject_id LEFT JOIN teachers t ON t.id = a.teacher_id
     LEFT JOIN lms_submissions su ON su.assignment_id = a.id AND su.student_id = ?
     WHERE a.class_id = ? AND a.status = 'published' AND a.semester_id = ? ORDER BY a.due_date`).bind(c.scope.studentId, classId, semId).all()).results
  const now = new Date().toISOString()
  const rows = assignments.map((a) => ({ ...a, overdue: a.due_date < now && !a.submission_status, score: a.submission_status === 'published' ? a.score : null, feedback: a.submission_status === 'published' ? a.feedback : null }))
  return json({
    materials, assignments: rows,
    summary: {
      materials: materials.length, assignments: rows.length,
      submitted: rows.filter((r) => r.submission_status).length,
      missing: rows.filter((r) => !r.submission_status).length,
      overdue: rows.filter((r) => r.overdue).length,
      graded: rows.filter((r) => ['graded', 'published'].includes(r.submission_status)).length,
      published: rows.filter((r) => r.submission_status === 'published').length,
    },
  })
})

export default routes
