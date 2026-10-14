// Presensi siswa & guru, penilaian, rapor, kenaikan kelas, beban kerja guru
import { json, error, audit, parseList, allowedClassIds, homeroomClassIds } from '../lib.js'
import { classGradeMatrix, attendanceSummary, attendanceForClass, getSettings, semesterRange, attendancePercent, rankStudents, gradePredicate, GRADE_TYPES } from './calc.js'

const WRITE_ROLES = ['super_admin', 'kepala_mts', 'kepala_ma', 'operator']
const TEACHING_ROLES = ['guru', 'wali_kelas']
const ATT_STATUS = ['hadir', 'sakit', 'izin', 'alpa', 'terlambat']
const TEACHER_STATUS = ['hadir', 'sakit', 'izin', 'dinas_luar', 'tugas_luar', 'cuti']

async function classAllowed(c, classId) {
  const ids = await allowedClassIds(c.db, c.user, c.scope)
  if (ids === null) return true
  return ids.includes(Number(classId))
}
function canManageClass(c, classId) {
  if (WRITE_ROLES.includes(c.user.role)) return true
  if (TEACHING_ROLES.includes(c.user.role)) return c.scope.classIds.includes(Number(classId))
  return false
}

const routes = []
const add = (method, path, handler, opts = {}) => routes.push({ method, path, handler, public: !!opts.public })

// ------------------------------------------------------------- presensi siswa
add('GET', '/api/attendance/students', async (c) => {
  const classId = Number(c.query.get('class_id'))
  const date = c.query.get('date') || new Date().toISOString().slice(0, 10)
  const scheduleId = Number(c.query.get('schedule_id') || 0)
  if (!classId) return error('Parameter class_id wajib diisi.', 422)
  if (!(await classAllowed(c, classId))) return error('Kelas berada di luar kewenangan Anda.', 403)
  const cls = await c.db.prepare('SELECT c.*, u.code AS unit_code FROM classes c LEFT JOIN units u ON u.id = c.unit_id WHERE c.id = ?').bind(classId).first()
  const students = (await c.db.prepare('SELECT id, name, nis, gender FROM students WHERE class_id = ? AND status = "aktif" ORDER BY name').bind(classId).all()).results
  const recs = (await c.db.prepare('SELECT student_id, status, note FROM attendance_students WHERE class_id = ? AND date = ? AND schedule_id = ?').bind(classId, date, scheduleId).all()).results
  const map = Object.fromEntries(recs.map((r) => [r.student_id, r]))
  const schedules = (await c.db.prepare('SELECT sc.id, sc.day, sc.period, sc.start_time, sc.end_time, s.name AS subject_name, t.name AS teacher_name FROM schedules sc LEFT JOIN class_subjects cs ON cs.id = sc.class_subject_id LEFT JOIN subjects s ON s.id = cs.subject_id LEFT JOIN teachers t ON t.id = cs.teacher_id WHERE sc.class_id = ? ORDER BY sc.period').bind(classId).all()).results
  return json({
    class: cls, date, schedule_id: scheduleId, schedules,
    records: students.map((s) => ({ student_id: s.id, name: s.name, nis: s.nis, status: map[s.id] ? map[s.id].status : null, note: map[s.id] ? map[s.id].note : '' })),
    filled: recs.length,
  })
})

add('POST', '/api/attendance/students/bulk', async (c) => {
  const { class_id, date, records, schedule_id = 0, note } = c.body || {}
  const classId = Number(class_id)
  if (!classId || !date || !Array.isArray(records) || !records.length) return error('class_id, date, dan records wajib diisi.', 422)
  if (!canManageClass(c, classId)) return error('Anda tidak berwenang mencatat presensi kelas ini.', 403)
  const validIds = (await c.db.prepare('SELECT id FROM students WHERE class_id = ?').bind(classId).all()).results.map((r) => r.id)
  for (const r of records) {
    if (!validIds.includes(Number(r.student_id))) return error(`Siswa ${r.student_id} tidak terdaftar pada kelas ini.`, 422)
    if (!ATT_STATUS.includes(r.status)) return error(`Status presensi "${r.status}" tidak valid.`, 422)
  }
  const existing = {}
  for (const r of (await c.db.prepare('SELECT student_id, status FROM attendance_students WHERE class_id = ? AND date = ? AND schedule_id = ?').bind(classId, date, Number(schedule_id)).all()).results) existing[r.student_id] = r.status
  const correction = Object.entries(existing).filter(([sid, st]) => { const n = records.find((x) => Number(x.student_id) === Number(sid)); return n && n.status !== st }).length
  const now = new Date().toISOString()
  const stmts = records.map((r) => c.db.prepare(
    `INSERT INTO attendance_students (student_id, class_id, date, schedule_id, status, note, recorded_by, updated_at, is_demo) VALUES (?,?,?,?,?,?,?,?,1)
     ON CONFLICT(student_id, date, schedule_id) DO UPDATE SET status = excluded.status, note = excluded.note, recorded_by = excluded.recorded_by, updated_at = excluded.updated_at`)
    .bind(Number(r.student_id), classId, date, Number(schedule_id), r.status, r.note || '', c.user.teacher_id || c.user.id, now))
  await c.db.batch(stmts)
  await audit(c.db, c.user, correction ? 'Koreksi presensi' : 'Menyimpan presensi', 'attendance_students', `${classId}-${date}`,
    `Presensi kelas ${classId} tanggal ${date}: ${records.length} siswa disimpan${correction ? `, ${correction} perubahan status (koreksi)` : ''}. ${note || ''}`, c.user.unit_id)
  return json({ ok: true, saved: records.length, corrections: correction })
})

add('GET', '/api/attendance/students/recap', async (c) => {
  const classId = Number(c.query.get('class_id'))
  const from = c.query.get('from'); const to = c.query.get('to')
  if (!classId) return error('Parameter class_id wajib diisi.', 422)
  if (!(await classAllowed(c, classId))) return error('Kelas berada di luar kewenangan Anda.', 403)
  const students = (await c.db.prepare('SELECT id, name, nis FROM students WHERE class_id = ? AND status = "aktif" ORDER BY name').bind(classId).all()).results
  const summary = await attendanceSummary(c.db, students.map((s) => s.id), from || '2000-01-01', to || '2099-12-31')
  const settings = await getSettings(c.db)
  const alertPct = Number(settings.attendance_alert_percent || 90)
  const rows = students.map((s) => ({ student_id: s.id, ...s, ...summary[s.id], percent: attendancePercent(summary[s.id]), alert: attendancePercent(summary[s.id]) < alertPct }))
  return json({ data: rows, from, to, alert_percent: alertPct, class_id: classId })
})

add('GET', '/api/attendance/students/daily', async (c) => {
  const date = c.query.get('date') || new Date().toISOString().slice(0, 10)
  const cls = c.query.get('class_id'); const unitId = c.query.get('unit_id')
  const where = ['a.date = ?', "a.status != 'hadir'"], params = [date]
  if (cls) { where.push('a.class_id = ?'); params.push(Number(cls)) }
  if (unitId) { where.push('c.unit_id = ?'); params.push(Number(unitId)) }
  if (c.scope.kind === 'unit') { where.push('c.unit_id = ?'); params.push(c.scope.unitId) }
  if (c.scope.kind === 'classes') { where.push(`a.class_id IN (${c.scope.classIds.length ? c.scope.classIds.map(() => '?').join(',') : 'NULL'})`); params.push(...c.scope.classIds) }
  if (c.scope.kind === 'self') { where.push('a.student_id = ?'); params.push(c.scope.studentId) }
  const rows = (await c.db.prepare(
    `SELECT a.date, a.status, a.note, s.name AS student_name, s.nis, cl.name AS class_name, u.code AS unit_code
     FROM attendance_students a JOIN students s ON s.id = a.student_id JOIN classes cl ON cl.id = a.class_id JOIN units u ON u.id = cl.unit_id
     WHERE ${where.join(' AND ')} ORDER BY cl.name, s.name LIMIT 300`).bind(...params).all()).results
  return json({ data: rows, date })
})

// ------------------------------------------------------------- presensi guru
add('GET', '/api/attendance/teachers', async (c) => {
  if (c.user.role === 'siswa') return error('Siswa tidak memiliki akses presensi guru.', 403)
  const date = c.query.get('date') || new Date().toISOString().slice(0, 10)
  const where = ['t.status = "aktif"'], params = []
  if (c.scope.kind === 'unit') { where.push('t.unit_id = ?'); params.push(c.scope.unitId) }
  if (c.query.get('unit_id') && c.scope.kind === 'all') { where.push('t.unit_id = ?'); params.push(Number(c.query.get('unit_id'))) }
  if (c.scope.kind === 'classes') { where.push('t.unit_id = ?'); params.push(c.user.unit_id) }
  const rows = (await c.db.prepare(
    `SELECT t.id AS teacher_id, t.name, t.nip, t.position, t.unit_id, u.code AS unit_code, a.status, a.note, a.updated_at
     FROM teachers t LEFT JOIN units u ON u.id = t.unit_id
     LEFT JOIN attendance_teachers a ON a.teacher_id = t.id AND a.date = ?
     WHERE ${where.join(' AND ')} ORDER BY u.code, t.name`).bind(date, ...params).all()).results
  return json({ data: rows, date })
})

add('POST', '/api/attendance/teachers/bulk', async (c) => {
  if (!['super_admin', 'kepala_mts', 'kepala_ma', 'operator'].includes(c.user.role)) return error('Anda tidak berwenang mencatat presensi guru.', 403)
  const { date, records } = c.body || {}
  if (!date || !Array.isArray(records) || !records.length) return error('date dan records wajib diisi.', 422)
  for (const r of records) if (!TEACHER_STATUS.includes(r.status)) return error(`Status "${r.status}" tidak valid.`, 422)
  const teachers = (await c.db.prepare('SELECT id, unit_id FROM teachers').all()).results
  const map = Object.fromEntries(teachers.map((t) => [t.id, t.unit_id]))
  for (const r of records) {
    if (map[Number(r.teacher_id)] === undefined) return error(`Guru ${r.teacher_id} tidak ditemukan.`, 422)
    if (c.scope.kind === 'unit' && Number(map[Number(r.teacher_id)]) !== Number(c.scope.unitId)) return error('Anda hanya dapat mencatat presensi guru pada unit Anda.', 403)
  }
  const now = new Date().toISOString()
  await c.db.batch(records.map((r) => c.db.prepare(
    `INSERT INTO attendance_teachers (teacher_id, unit_id, date, status, note, recorded_by, updated_at, is_demo) VALUES (?,?,?,?,?,?,?,1)
     ON CONFLICT(teacher_id, date) DO UPDATE SET status = excluded.status, note = excluded.note, recorded_by = excluded.recorded_by, updated_at = excluded.updated_at`)
    .bind(Number(r.teacher_id), map[Number(r.teacher_id)] || null, date, r.status, r.note || '', c.user.teacher_id || c.user.id, now)))
  await audit(c.db, c.user, 'Menyimpan presensi guru', 'attendance_teachers', date, `Presensi guru tanggal ${date} untuk ${records.length} guru.`, c.user.unit_id)
  return json({ ok: true, saved: records.length })
})

add('GET', '/api/attendance/teachers/recap', async (c) => {
  if (c.user.role === 'siswa') return error('Siswa tidak memiliki akses presensi guru.', 403)
  const from = c.query.get('from') || '2000-01-01'; const to = c.query.get('to') || '2099-12-31'
  const where = [], params = [from, to]
  if (c.scope.kind === 'unit') { where.push('t.unit_id = ?'); params.push(c.scope.unitId) }
  if (c.query.get('unit_id') && c.scope.kind === 'all') { where.push('t.unit_id = ?'); params.push(Number(c.query.get('unit_id'))) }
  if (c.query.get('teacher_id')) { where.push('t.id = ?'); params.push(Number(c.query.get('teacher_id'))) }
  const w = where.length ? ' AND ' + where.join(' AND ') : ''
  const rows = (await c.db.prepare(
    `SELECT t.id AS teacher_id, t.name, t.position, u.code AS unit_code,
       SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) AS hadir,
       SUM(CASE WHEN a.status = 'sakit' THEN 1 ELSE 0 END) AS sakit,
       SUM(CASE WHEN a.status = 'izin' THEN 1 ELSE 0 END) AS izin,
       SUM(CASE WHEN a.status IN ('tugas_luar','dinas_luar') THEN 1 ELSE 0 END) AS tugas_luar,
       SUM(CASE WHEN a.status = 'cuti' THEN 1 ELSE 0 END) AS cuti,
       COUNT(a.id) AS total
     FROM teachers t LEFT JOIN attendance_teachers a ON a.teacher_id = t.id AND a.date >= ? AND a.date <= ?
     LEFT JOIN units u ON u.id = t.unit_id WHERE t.status = 'aktif'${w} GROUP BY t.id ORDER BY u.code, t.name`).bind(...params).all()).results
  return json({ data: rows.map((r) => ({ ...r, percent: r.total ? Math.round((r.hadir / r.total) * 1000) / 10 : 0 })), from, to })
})

// ------------------------------------------------------------- penilaian
add('GET', '/api/grades/components', async (c) => {
  const csId = Number(c.query.get('class_subject_id'))
  const semesterId = Number(c.query.get('semester_id'))
  if (!csId) return error('class_subject_id wajib diisi.', 422)
  const cs = await c.db.prepare('SELECT cs.*, cl.name AS class_name, cl.unit_id, s.name AS subject_name, t.name AS teacher_name FROM class_subjects cs JOIN classes cl ON cl.id = cs.class_id JOIN subjects s ON s.id = cs.subject_id LEFT JOIN teachers t ON t.id = cs.teacher_id WHERE cs.id = ?').bind(csId).first()
  if (!cs) return error('Penugasan mata pelajaran tidak ditemukan.', 404)
  if (!(await classAllowed(c, cs.class_id))) return error('Kelas berada di luar kewenangan Anda.', 403)
  const rows = (await c.db.prepare('SELECT * FROM assessment_components WHERE class_subject_id = ? AND (? = 0 OR semester_id = ?) ORDER BY id').bind(csId, semesterId, semesterId).all()).results
  return json({ data: rows, class_subject: cs, types: Object.entries(GRADE_TYPES).map(([value, label]) => ({ value, label })) })
})

add('POST', '/api/grades/components', async (c) => {
  const { class_subject_id, name, type, weight, semester_id } = c.body || {}
  const csId = Number(class_subject_id)
  const cs = await c.db.prepare('SELECT * FROM class_subjects WHERE id = ?').bind(csId).first()
  if (!cs) return error('Penugasan mata pelajaran tidak ditemukan.', 404)
  if (!canManageClass(c, cs.class_id)) return error('Anda tidak berwenang mengubah komponen nilai kelas ini.', 403)
  if (!name || !type) return error('Nama komponen dan jenis wajib diisi.', 422)
  if (!(type in GRADE_TYPES)) return error('Jenis komponen tidak valid.', 422)
  const w = Number(weight)
  if (!(w > 0) || w > 100) return error('Bobot harus antara 1 dan 100.', 422)
  const used = (await c.db.prepare('SELECT COALESCE(SUM(weight),0) AS s FROM assessment_components WHERE class_subject_id = ? AND semester_id = ?').bind(csId, cs.semester_id).first()).s
  if (Number(used) + w > 100) return error(`Total bobot tidak boleh melebihi 100%. Bobot terpakai saat ini ${used}%.`, 422)
  const res = await c.db.prepare('INSERT INTO assessment_components (class_subject_id, name, type, weight, semester_id, academic_year_id, is_demo) VALUES (?,?,?,?,?,?,1)')
    .bind(csId, String(name).trim(), type, w, cs.semester_id, cs.academic_year_id).run()
  await audit(c.db, c.user, 'Menambah komponen nilai', 'assessment_components', res.meta ? res.meta.last_row_id : null, `Komponen ${name} (${GRADE_TYPES[type]}) bobot ${w}% untuk penugasan ${csId}`, c.user.unit_id)
  return json({ ok: true, id: res.meta ? res.meta.last_row_id : null }, 201)
})

add('DELETE', '/api/grades/components/:id', async (c) => {
  const comp = await c.db.prepare('SELECT c.*, cs.class_id FROM assessment_components c JOIN class_subjects cs ON cs.id = c.class_subject_id WHERE c.id = ?').bind(c.params.id).first()
  if (!comp) return error('Komponen tidak ditemukan.', 404)
  if (!canManageClass(c, comp.class_id)) return error('Anda tidak berwenang menghapus komponen nilai kelas ini.', 403)
  await c.db.prepare('DELETE FROM scores WHERE component_id = ?').bind(comp.id).run()
  await c.db.prepare('DELETE FROM assessment_components WHERE id = ?').bind(comp.id).run()
  await audit(c.db, c.user, 'Menghapus komponen nilai', 'assessment_components', comp.id, `Komponen ${comp.name} beserta nilai terkait dihapus`, c.user.unit_id)
  return json({ ok: true })
})

add('GET', '/api/grades/matrix', async (c) => {
  const compId = Number(c.query.get('component_id'))
  const comp = await c.db.prepare('SELECT c.*, cs.class_id, cs.subject_id, s.name AS subject_name, cl.name AS class_name FROM assessment_components c JOIN class_subjects cs ON cs.id = c.class_subject_id JOIN subjects s ON s.id = cs.subject_id JOIN classes cl ON cl.id = cs.class_id WHERE c.id = ?').bind(compId).first()
  if (!comp) return error('Komponen nilai tidak ditemukan.', 404)
  if (!(await classAllowed(c, comp.class_id))) return error('Kelas berada di luar kewenangan Anda.', 403)
  const students = (await c.db.prepare('SELECT id, name, nis FROM students WHERE class_id = ? AND status = "aktif" ORDER BY name').bind(comp.class_id).all()).results
  const scores = (await c.db.prepare('SELECT student_id, score FROM scores WHERE component_id = ?').bind(compId).all()).results
  const map = Object.fromEntries(scores.map((s) => [s.student_id, s.score]))
  return json({ component: comp, records: students.map((s) => ({ student_id: s.id, name: s.name, nis: s.nis, score: map[s.id] == null ? null : map[s.id] })), filled: scores.length })
})

add('POST', '/api/grades/scores', async (c) => {
  const { component_id, entries } = c.body || {}
  const comp = await c.db.prepare('SELECT c.*, cs.class_id FROM assessment_components c JOIN class_subjects cs ON cs.id = c.class_subject_id WHERE c.id = ?').bind(Number(component_id)).first()
  if (!comp) return error('Komponen nilai tidak ditemukan.', 404)
  if (!canManageClass(c, comp.class_id)) return error('Anda tidak berwenang mengisi nilai kelas ini.', 403)
  if (!Array.isArray(entries) || !entries.length) return error('entries wajib diisi.', 422)
  const validIds = (await c.db.prepare('SELECT id FROM students WHERE class_id = ?').bind(comp.class_id).all()).results.map((r) => r.id)
  for (const e of entries) {
    if (!validIds.includes(Number(e.student_id))) return error(`Siswa ${e.student_id} tidak terdaftar pada kelas ini.`, 422)
    if (e.score === '' || e.score == null) continue
    const v = Number(e.score)
    if (isNaN(v) || v < 0 || v > 100) return error('Nilai harus berupa angka antara 0 dan 100.', 422)
  }
  const now = new Date().toISOString()
  const stmts = []
  for (const e of entries) {
    if (e.score === '' || e.score == null) { stmts.push(c.db.prepare('DELETE FROM scores WHERE component_id = ? AND student_id = ?').bind(comp.id, Number(e.student_id))); continue }
    stmts.push(c.db.prepare(
      `INSERT INTO scores (component_id, student_id, score, updated_by, updated_at, is_demo) VALUES (?,?,?,?,?,1)
       ON CONFLICT(component_id, student_id) DO UPDATE SET score = excluded.score, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
      .bind(comp.id, Number(e.student_id), Number(e.score), c.user.teacher_id || c.user.id, now))
  }
  await c.db.batch(stmts)
  await audit(c.db, c.user, 'Menyimpan nilai', 'scores', comp.id, `Nilai komponen ${comp.name} (${entries.length} siswa) disimpan pada kelas ${comp.class_id}.`, c.user.unit_id)
  return json({ ok: true, saved: entries.filter((e) => e.score !== '' && e.score != null).length })
})

add('GET', '/api/grades/class', async (c) => {
  const classId = Number(c.query.get('class_id'))
  const semesterId = Number(c.query.get('semester_id'))
  if (!classId || !semesterId) return error('class_id dan semester_id wajib diisi.', 422)
  if (!(await classAllowed(c, classId))) return error('Kelas berada di luar kewenangan Anda.', 403)
  const matrix = await classGradeMatrix(c.db, classId, semesterId)
  const cls = await c.db.prepare('SELECT c.*, u.code AS unit_code, t.name AS homeroom_name FROM classes c LEFT JOIN units u ON u.id = c.unit_id LEFT JOIN teachers t ON t.id = c.homeroom_teacher_id WHERE c.id = ?').bind(classId).first()
  let subjects = matrix.subjects
  let limited = false
  if (c.scope.kind === 'classes') {
    const homerooms = c.user.teacher_id ? await homeroomClassIds(c.db, c.user.teacher_id) : []
    if (!homerooms.includes(classId)) { subjects = subjects.filter((s) => Number(s.teacher_id) === Number(c.user.teacher_id)); limited = true }
  }
  return json({ class: cls, semester_id: semesterId, subjects, students: matrix.students, student_avg: matrix.studentAvg, limited_to_own_subjects: limited })
})

add('GET', '/api/grades/student/:id', async (c) => {
  const studentId = Number(c.params.id)
  const semesterId = Number(c.query.get('semester_id'))
  if (c.scope.kind === 'self' && Number(c.scope.studentId) !== studentId) return error('Anda hanya dapat melihat nilai Anda sendiri.', 403)
  const st = await c.db.prepare('SELECT s.*, cl.name AS class_name, cl.unit_id, u.code AS unit_code FROM students s LEFT JOIN classes cl ON cl.id = s.class_id LEFT JOIN units u ON u.id = cl.unit_id WHERE s.id = ?').bind(studentId).first()
  if (!st) return error('Siswa tidak ditemukan.', 404)
  if (!(await classAllowed(c, st.class_id))) return error('Data siswa berada di luar kewenangan Anda.', 403)
  const matrix = await classGradeMatrix(c.db, st.class_id, semesterId, { studentIds: [studentId] })
  const sem = await c.db.prepare('SELECT s.*, a.name AS academic_year_name FROM semesters s LEFT JOIN academic_years a ON a.id = s.academic_year_id WHERE s.id = ?').bind(semesterId).first()
  const range = semesterRange(sem)
  const att = (await attendanceSummary(c.db, [studentId], range.from, range.to))[studentId]
  const homeroomIds = c.user.teacher_id ? await homeroomClassIds(c.db, c.user.teacher_id) : []
  const ownOnly = c.scope.kind === 'classes' && !homeroomIds.includes(st.class_id)
  const list = ownOnly ? matrix.subjects.filter((s) => Number(s.teacher_id) === Number(c.user.teacher_id)) : matrix.subjects
  const subjects = list.map((s) => ({ subject_id: s.subject_id, subject_name: s.subject_name, subject_code: s.subject_code, kkm: s.kkm, teacher_name: s.teacher_name, final: s.finals[studentId], detail: s.detail[studentId], complete: s.detail[studentId] ? s.detail[studentId].complete : false }))
  return json({ student: st, semester: sem, subjects, average: matrix.studentAvg[studentId], attendance: { ...att, percent: attendancePercent(att) } })
})

// ------------------------------------------------------------- rapor
const RC_STATUS = ['draft', 'reviewed', 'approved', 'published']
const RC_LABEL = { draft: 'Draft', reviewed: 'Diperiksa wali kelas', approved: 'Disetujui', published: 'Diterbitkan' }

async function reportCardPayload(c, studentId, semesterId) {
  const st = await c.db.prepare('SELECT s.*, cl.name AS class_name, cl.id AS class_id, cl.unit_id, cl.homeroom_teacher_id, u.code AS unit_code, u.name AS unit_name, t.name AS homeroom_name FROM students s LEFT JOIN classes cl ON cl.id = s.class_id LEFT JOIN units u ON u.id = cl.unit_id LEFT JOIN teachers t ON t.id = cl.homeroom_teacher_id WHERE s.id = ?').bind(studentId).first()
  if (!st) return null
  const sem = await c.db.prepare('SELECT s.*, a.name AS academic_year_name FROM semesters s LEFT JOIN academic_years a ON a.id = s.academic_year_id WHERE s.id = ?').bind(semesterId).first()
  const matrix = await classGradeMatrix(c.db, st.class_id, semesterId)
  const range = semesterRange(sem)
  const att = await attendanceSummary(c.db, [studentId], range.from, range.to)
  const card = await c.db.prepare('SELECT * FROM report_cards WHERE student_id = ? AND semester_id = ?').bind(studentId, semesterId).first()
  const ranked = rankStudents(matrix.students, matrix.studentAvg, await attendanceSummary(c.db, matrix.students.map((s) => s.id), range.from, range.to))
  const me = ranked.find((r) => r.id === studentId)
  const subjects = matrix.subjects.map((s) => ({
    subject_id: s.subject_id, subject_name: s.subject_name, kkm: s.kkm, teacher_name: s.teacher_name,
    final: s.finals[studentId], complete: s.detail[studentId] ? s.detail[studentId].complete : false,
    tuntas: s.finals[studentId] != null ? s.finals[studentId] >= s.kkm : null,
  }))
  const incomplete = subjects.filter((s) => s.final == null).map((s) => s.subject_name)
  return {
    student: st, semester: sem, subjects, average: matrix.studentAvg[studentId], rank: me ? me.rank : null, class_size: matrix.students.length,
    attendance: { ...att[studentId], percent: attendancePercent(att[studentId]) },
    card: card || { status: 'draft', homeroom_note: '' }, status_label: RC_LABEL[card ? card.status : 'draft'],
    incomplete_subjects: incomplete, complete: incomplete.length === 0 && subjects.length > 0,
  }
}

add('GET', '/api/report-cards', async (c) => {
  const classId = Number(c.query.get('class_id'))
  const semesterId = Number(c.query.get('semester_id'))
  if (!classId || !semesterId) return error('class_id dan semester_id wajib diisi.', 422)
  if (!(await classAllowed(c, classId))) return error('Kelas berada di luar kewenangan Anda.', 403)
  if (c.scope.kind === 'classes') {
    const homerooms = c.user.teacher_id ? await homeroomClassIds(c.db, c.user.teacher_id) : []
    if (!homerooms.includes(classId)) return error('Rekap rapor kelas hanya dapat dibuka oleh wali kelas atau pejabat berwenang.', 403)
  }
  const matrix = await classGradeMatrix(c.db, classId, semesterId)
  const sem = await c.db.prepare('SELECT * FROM semesters WHERE id = ?').bind(semesterId).first()
  const range = semesterRange(sem)
  const att = await attendanceForClass(c.db, classId, range.from, range.to)
  const cards = (await c.db.prepare('SELECT * FROM report_cards WHERE class_id = ? AND semester_id = ?').bind(classId, semesterId).all()).results
  const cardMap = Object.fromEntries(cards.map((r) => [r.student_id, r]))
  const ranked = rankStudents(matrix.students, matrix.studentAvg, att)
  const rows = ranked.map((r) => {
    const card = cardMap[r.id]
    const subjFinals = matrix.subjects.map((s) => s.finals[r.id]).filter((v) => v != null)
    return {
      student_id: r.id, name: r.name, nis: r.nis, average: r.average, rank: r.rank,
      incomplete_subjects: matrix.subjects.filter((s) => s.finals[r.id] == null).length,
      below_kkm: matrix.subjects.filter((s) => s.finals[r.id] != null && s.finals[r.id] < s.kkm).length,
      attendance_percent: r.attendance, subjects_scored: subjFinals.length, subjects_total: matrix.subjects.length,
      has_card: !!card, status: card ? card.status : 'draft', status_label: RC_LABEL[card ? card.status : 'draft'],
      homeroom_note: card ? card.homeroom_note : '', published_at: card ? card.published_at : null,
      complete: matrix.subjects.length > 0 && subjFinals.length === matrix.subjects.length,
    }
  })
  const settings = await getSettings(c.db)
  return json({ data: rows, class_id: classId, semester_id: semesterId, require_complete: settings.report_require_complete === '1', status_labels: RC_LABEL })
})

add('GET', '/api/report-cards/:studentId', async (c) => {
  const studentId = Number(c.params.studentId)
  const semesterId = Number(c.query.get('semester_id'))
  if (c.scope.kind === 'self' && Number(c.scope.studentId) !== studentId) return error('Anda hanya dapat melihat rapor Anda sendiri.', 403)
  const payload = await reportCardPayload(c, studentId, semesterId)
  if (!payload) return error('Rapor tidak ditemukan.', 404)
  if (!(await classAllowed(c, payload.student.class_id))) return error('Data berada di luar kewenangan Anda.', 403)
  if (c.scope.kind === 'self' && payload.card.status !== 'published') return error('Rapor belum diterbitkan oleh madrasah.', 403)
  return json({ data: payload })
})

add('POST', '/api/report-cards/generate', async (c) => {
  if (!WRITE_ROLES.includes(c.user.role)) return error('Anda tidak berwenang membuat rekap rapor.', 403)
  const { class_id, semester_id } = c.body || {}
  const classId = Number(class_id); const semesterId = Number(semester_id)
  if (!classId || !semesterId) return error('class_id dan semester_id wajib diisi.', 422)
  if (!(await classAllowed(c, classId))) return error('Kelas berada di luar kewenangan Anda.', 403)
  const cls = await c.db.prepare('SELECT * FROM classes WHERE id = ?').bind(classId).first()
  const sem = await c.db.prepare('SELECT * FROM semesters WHERE id = ?').bind(semesterId).first()
  const matrix = await classGradeMatrix(c.db, classId, semesterId)
  const now = new Date().toISOString()
  let created = 0, updated = 0
  for (const s of matrix.students) {
    const existing = await c.db.prepare('SELECT id, status FROM report_cards WHERE student_id = ? AND semester_id = ?').bind(s.id, semesterId).first()
    const avg = matrix.studentAvg[s.id]
    if (existing) {
      if (existing.status !== 'published') { await c.db.prepare('UPDATE report_cards SET average = ?, updated_at = ? WHERE id = ?').bind(avg, now, existing.id).run(); updated++ }
    } else {
      await c.db.prepare('INSERT INTO report_cards (student_id, class_id, unit_id, semester_id, academic_year_id, average, homeroom_note, status, updated_at, is_demo) VALUES (?,?,?,?,?,?,?,?,?,1)')
        .bind(s.id, classId, cls.unit_id, semesterId, sem.academic_year_id, avg, '', 'draft', now).run()
      created++
    }
  }
  await audit(c.db, c.user, 'Menyiapkan rekap rapor', 'report_cards', `${classId}-${semesterId}`, `Rekap rapor kelas ${cls.name} semester ${sem.name}: ${created} dibuat, ${updated} diperbarui.`, cls.unit_id)
  return json({ ok: true, created, updated, students: matrix.students.length })
})

add('PUT', '/api/report-cards/:studentId/note', async (c) => {
  const studentId = Number(c.params.studentId)
  const semesterId = Number((c.body || {}).semester_id)
  const note = (c.body || {}).homeroom_note || ''
  const payload = await reportCardPayload(c, studentId, semesterId)
  if (!payload) return error('Data rapor tidak ditemukan.', 404)
  const isHomeroom = c.user.teacher_id && Number(payload.student.homeroom_teacher_id) === Number(c.user.teacher_id)
  if (!WRITE_ROLES.includes(c.user.role) && !isHomeroom) return error('Hanya wali kelas atau operator berwenang yang dapat mengisi catatan wali kelas.', 403)
  if (payload.card.status === 'published') return error('Rapor sudah diterbitkan dan tidak dapat diubah tanpa pembatalan penerbitan.', 422)
  let id = payload.card.id
  if (!id) {
    const sem = await c.db.prepare('SELECT * FROM semesters WHERE id = ?').bind(semesterId).first()
    const res = await c.db.prepare('INSERT INTO report_cards (student_id, class_id, unit_id, semester_id, academic_year_id, average, homeroom_note, status, updated_at, is_demo) VALUES (?,?,?,?,?,?,?,?,?,1)')
      .bind(studentId, payload.student.class_id, payload.student.unit_id, semesterId, sem.academic_year_id, payload.average, note, 'draft', new Date().toISOString()).run()
    id = res.meta ? res.meta.last_row_id : null
  } else {
    await c.db.prepare('UPDATE report_cards SET homeroom_note = ?, updated_at = ? WHERE id = ?').bind(note, new Date().toISOString(), id).run()
  }
  await audit(c.db, c.user, 'Mengisi catatan wali kelas', 'report_cards', id, `Catatan wali kelas siswa ${payload.student.name} diperbarui.`, payload.student.unit_id)
  return json({ ok: true })
})

add('POST', '/api/report-cards/:studentId/status', async (c) => {
  const studentId = Number(c.params.studentId)
  const { status, semester_id } = c.body || {}
  if (!RC_STATUS.includes(status)) return error('Status rapor tidak valid.', 422)
  const payload = await reportCardPayload(c, studentId, Number(semester_id))
  if (!payload) return error('Data rapor tidak ditemukan.', 404)
  if (!(await classAllowed(c, payload.student.class_id))) return error('Data berada di luar kewenangan Anda.', 403)
  const isHomeroom = c.user.teacher_id && Number(payload.student.homeroom_teacher_id) === Number(c.user.teacher_id)
  const isUnitHead = ['kepala_mts', 'kepala_ma', 'super_admin'].includes(c.user.role)
  if (status === 'reviewed' && !(isHomeroom || WRITE_ROLES.includes(c.user.role))) return error('Hanya wali kelas atau operator yang dapat menandai rapor telah diperiksa.', 403)
  if ((status === 'approved' || status === 'published') && !isUnitHead) return error('Persetujuan dan penerbitan rapor hanya dapat dilakukan oleh kepala madrasah atau super admin.', 403)
  if (status === 'published') {
    const settings = await getSettings(c.db)
    if (settings.report_require_complete === '1' && !payload.complete) return error(`Rapor belum dapat diterbitkan. Nilai belum lengkap pada: ${payload.incomplete_subjects.join(', ') || 'beberapa mata pelajaran'}.`, 422)
  }
  const id = payload.card.id
  if (!id) return error('Rekap rapor belum dibuat. Jalankan penyiapan rekap rapor terlebih dahulu.', 422)
  const now = new Date().toISOString()
  await c.db.prepare('UPDATE report_cards SET status = ?, published_at = ?, updated_at = ?, average = ? WHERE id = ?')
    .bind(status, status === 'published' ? now : null, now, payload.average, id).run()
  await audit(c.db, c.user, `Rapor: ${RC_LABEL[status]}`, 'report_cards', id, `Status rapor siswa ${payload.student.name} (${payload.student.class_name}) menjadi ${RC_LABEL[status]}.`, payload.student.unit_id)
  return json({ ok: true, status })
})

// ------------------------------------------------------------- kenaikan kelas & kelulusan
add('GET', '/api/promotion/candidates', async (c) => {
  const classId = Number(c.query.get('class_id'))
  const academicYearId = Number(c.query.get('academic_year_id'))
  const semesterId = Number(c.query.get('semester_id'))
  if (!classId || !semesterId) return error('class_id dan semester_id wajib diisi.', 422)
  if (!(await classAllowed(c, classId))) return error('Kelas berada di luar kewenangan Anda.', 403)
  const cls = await c.db.prepare('SELECT c.*, u.code AS unit_code FROM classes c LEFT JOIN units u ON u.id = c.unit_id WHERE c.id = ?').bind(classId).first()
  const sem = await c.db.prepare('SELECT * FROM semesters WHERE id = ?').bind(semesterId).first()
  const ayId = academicYearId || sem.academic_year_id
  const matrix = await classGradeMatrix(c.db, classId, semesterId)
  const range = semesterRange(sem)
  const att = await attendanceForClass(c.db, classId, range.from, range.to)
  const settings = await getSettings(c.db)
  const decisions = (await c.db.prepare('SELECT * FROM promotion_decisions WHERE class_id = ? AND academic_year_id = ?').bind(classId, ayId).all()).results
  const decMap = Object.fromEntries(decisions.map((d) => [d.student_id, d]))
  const nextClasses = (await c.db.prepare('SELECT id, name, level FROM classes WHERE unit_id = ? AND level = ? ORDER BY name').bind(cls.unit_id, cls.level + 1).all()).results
  const rows = matrix.students.map((s) => {
    const subjFinals = matrix.subjects.map((x) => x.finals[s.id])
    const incomplete = matrix.subjects.filter((x) => x.finals[s.id] == null).map((x) => x.subject_name)
    const avg = matrix.studentAvg[s.id]
    const pct = attendancePercent(att[s.id])
    const pred = gradePredicate(pct, avg, 75, settings)
    const d = decMap[s.id]
    return {
      student_id: s.id, name: s.name, nis: s.nis, average: avg, attendance_percent: pct,
      subjects_scored: subjFinals.filter((v) => v != null).length, subjects_total: matrix.subjects.length,
      below_kkm: matrix.subjects.filter((x) => x.finals[s.id] != null && x.finals[s.id] < x.kkm).map((x) => x.subject_name),
      incomplete_subjects: incomplete,
      recommendation: pred.recommendation, recommendation_reason: pred.reason,
      decision: d ? d.decision : null, to_class_id: d ? d.to_class_id : null, decided_at: d ? d.decided_at : null, note: d ? d.note : '',
    }
  })
  return json({ data: rows, class: cls, academic_year_id: ayId, semester: sem, next_classes: nextClasses,
    criteria: { min_average: settings.promotion_min_average, max_absence_percent: settings.promotion_max_absence_percent, require_scores: settings.promotion_require_scores === '1' } })
})

add('POST', '/api/promotion/decide', async (c) => {
  if (!['super_admin', 'kepala_mts', 'kepala_ma'].includes(c.user.role)) return error('Keputusan kenaikan kelas hanya dapat ditetapkan oleh kepala madrasah atau super admin.', 403)
  const { student_id, academic_year_id, decision, to_class_id, note, semester_id } = c.body || {}
  if (!['naik', 'tidak_naik', 'mengulang', 'lulus', 'tidak_lulus', 'pertimbangan'].includes(decision)) return error('Keputusan tidak valid.', 422)
  const st = await c.db.prepare('SELECT s.*, cl.unit_id, cl.academic_year_id FROM students s JOIN classes cl ON cl.id = s.class_id WHERE s.id = ?').bind(Number(student_id)).first()
  if (!st) return error('Siswa tidak ditemukan.', 404)
  if (c.user.role !== 'super_admin' && Number(st.unit_id) !== Number(c.user.unit_id)) return error('Anda hanya dapat menetapkan keputusan untuk siswa pada unit Anda.', 403)
  if (decision === 'naik' && !to_class_id) return error('Kelas tujuan wajib dipilih untuk keputusan naik kelas.', 422)
  const now = new Date().toISOString()
  await c.db.prepare(
    `INSERT INTO promotion_decisions (student_id, class_id, academic_year_id, to_class_id, decision, note, decided_by, decided_at, is_demo) VALUES (?,?,?,?,?,?,?,?,1)
     ON CONFLICT(student_id, academic_year_id) DO UPDATE SET decision = excluded.decision, to_class_id = excluded.to_class_id, note = excluded.note, decided_by = excluded.decided_by, decided_at = excluded.decided_at`)
    .bind(Number(student_id), st.class_id, Number(academic_year_id || st.academic_year_id), to_class_id ? Number(to_class_id) : null, decision, note || '', c.user.teacher_id || c.user.id, now).run()
  await audit(c.db, c.user, 'Menetapkan keputusan akademik', 'promotion_decisions', student_id, `Keputusan "${decision}" untuk siswa ${st.name} (semester ${semester_id || '-'}).`, st.unit_id)
  return json({ ok: true, decision })
})

add('GET', '/api/promotion/history', async (c) => {
  if (c.user.role === 'siswa') return error('Siswa tidak memiliki akses riwayat keputusan.', 403)
  const ayId = c.query.get('academic_year_id'); const classId = c.query.get('class_id')
  const where = [], params = []
  if (ayId) { where.push('p.academic_year_id = ?'); params.push(Number(ayId)) }
  if (classId) { where.push('p.class_id = ?'); params.push(Number(classId)) }
  if (c.scope.kind === 'unit') { where.push('cl.unit_id = ?'); params.push(c.scope.unitId) }
  if (c.scope.kind === 'classes') { where.push(`p.class_id IN (${c.scope.classIds.length ? c.scope.classIds.map(() => '?').join(',') : 'NULL'})`); params.push(...c.scope.classIds) }
  const w = where.length ? where.join(' AND ') : '1=1'
  const rows = (await c.db.prepare(
    `SELECT p.*, s.name AS student_name, s.nis, cl.name AS class_name, u.code AS unit_code, t.name AS decided_by_name, ay.name AS academic_year_name, tc.name AS to_class_name
     FROM promotion_decisions p JOIN students s ON s.id = p.student_id JOIN classes cl ON cl.id = p.class_id
     LEFT JOIN units u ON u.id = cl.unit_id LEFT JOIN teachers t ON t.id = p.decided_by LEFT JOIN academic_years ay ON ay.id = p.academic_year_id
     LEFT JOIN classes tc ON tc.id = p.to_class_id WHERE ${w} ORDER BY p.decided_at DESC LIMIT 200`).bind(...params).all()).results
  return json({ data: rows })
})

// ------------------------------------------------------------- manajemen guru & wali kelas
add('GET', '/api/teachers/overview', async (c) => {
  if (c.user.role === 'siswa') return error('Siswa tidak memiliki akses data guru.', 403)
  const unitId = c.query.get('unit_id')
  const where = ["t.status = 'aktif'"], params = []
  if (c.scope.kind === 'unit') { where.push('t.unit_id = ?'); params.push(c.scope.unitId) }
  else if (unitId) { where.push('t.unit_id = ?'); params.push(Number(unitId)) }
  const teachers = (await c.db.prepare(`SELECT t.*, u.code AS unit_code FROM teachers t LEFT JOIN units u ON u.id = t.unit_id WHERE ${where.join(' AND ')} ORDER BY t.name`).bind(...params).all()).results
  const semesterId = Number(c.query.get('semester_id'))
  const sem = semesterId
    ? await c.db.prepare('SELECT s.*, a.name AS academic_year_name FROM semesters s LEFT JOIN academic_years a ON a.id = s.academic_year_id WHERE s.id = ?').bind(semesterId).first()
    : await c.db.prepare('SELECT s.*, a.name AS academic_year_name FROM semesters s LEFT JOIN academic_years a ON a.id = s.academic_year_id WHERE s.is_active = 1').first()
  const sid = sem ? sem.id : 0
  const cs = (await c.db.prepare('SELECT id, class_id, subject_id, teacher_id, kkm FROM class_subjects WHERE semester_id = ?').bind(sid).all()).results
  const comps = (await c.db.prepare('SELECT id, class_subject_id FROM assessment_components WHERE semester_id = ?').bind(sid).all()).results
  const scores = (await c.db.prepare('SELECT sc.component_id, sc.student_id FROM scores sc JOIN assessment_components c ON c.id = sc.component_id WHERE c.semester_id = ?').bind(sid).all()).results
  const scoreKey = new Set(scores.map((s) => `${s.component_id}|${s.student_id}`))
  const compOfCs = {}
  for (const cp of comps) (compOfCs[cp.class_subject_id] = compOfCs[cp.class_subject_id] || []).push(cp.id)
  const studentsByClass = {}
  for (const s of (await c.db.prepare('SELECT id, class_id FROM students WHERE status = "aktif"').all()).results) (studentsByClass[s.class_id] = studentsByClass[s.class_id] || []).push(s.id)
  const attFill = {}
  for (const r of (await c.db.prepare('SELECT class_id, COUNT(DISTINCT date) AS d FROM attendance_students GROUP BY class_id').all()).results) attFill[r.class_id] = r.d
  const rows = teachers.map((t) => {
    const mine = cs.filter((x) => x.teacher_id === t.id)
    const classIds = [...new Set(mine.map((x) => x.class_id))]
    let expected = 0, filled = 0, missing = 0
    for (const x of mine) {
      const compIds = compOfCs[x.id] || []
      const studs = studentsByClass[x.class_id] || []
      const exp = compIds.length * studs.length
      expected += exp
      const got = compIds.reduce((a, cid) => a + studs.filter((st) => scoreKey.has(`${cid}|${st}`)).length, 0)
      filled += got
      if (exp > 0 && got < exp) missing++
    }
    return {
      id: t.id, name: t.name, nip: t.nip, position: t.position, unit_id: t.unit_id, unit_code: t.unit_code, email: t.email, phone: t.phone,
      subjects: mine.length, classes: classIds.length, class_ids: classIds,
      grade_completeness: expected ? Math.round((filled / expected) * 1000) / 10 : null,
      grade_missing_components: missing,
      attendance_days_filled: classIds.reduce((a, cid) => a + (attFill[cid] || 0), 0),
      homeroom: null, lms_assignments: 0, lms_materials: 0, pending_submissions: 0, pending_exam_grading: 0, pending_total: 0,
    }
  })
  const homerooms = (await c.db.prepare('SELECT id, name, homeroom_teacher_id FROM classes').all()).results
  for (const r of rows) { const h = homerooms.find((x) => x.homeroom_teacher_id === r.id); if (h) r.homeroom = h.name }
  const agg = async (sql) => Object.fromEntries((await c.db.prepare(sql).all()).results.map((x) => [x.teacher_id, x.n]))
  const mM = await agg("SELECT teacher_id, COUNT(*) AS n FROM lms_assignments WHERE status = 'published' GROUP BY teacher_id")
  const mM2 = await agg('SELECT teacher_id, COUNT(*) AS n FROM lms_materials GROUP BY teacher_id')
  const pM = await agg("SELECT cs.teacher_id, COUNT(*) AS n FROM lms_submissions s JOIN lms_assignments a ON a.id = s.assignment_id JOIN class_subjects cs ON cs.id = a.class_subject_id WHERE s.status = 'submitted' GROUP BY cs.teacher_id")
  const eM = await agg("SELECT e.teacher_id, COUNT(*) AS n FROM exam_participants p JOIN exams e ON e.id = p.exam_id WHERE p.status = 'submitted' GROUP BY e.teacher_id")
  for (const r of rows) {
    r.lms_assignments = mM[r.id] || 0
    r.lms_materials = mM2[r.id] || 0
    r.pending_submissions = pM[r.id] || 0
    r.pending_exam_grading = eM[r.id] || 0
    r.pending_total = r.pending_submissions + r.pending_exam_grading
  }
  return json({ data: rows, semester: sem })
})

add('GET', '/api/teachers/:id/workload', async (c) => {
  const teacherId = Number(c.params.id)
  if (c.user.role === 'siswa') return error('Siswa tidak memiliki akses data guru.', 403)
  if (['guru', 'wali_kelas'].includes(c.user.role) && Number(c.user.teacher_id) !== teacherId) return error('Anda hanya dapat melihat data tugas Anda sendiri.', 403)
  const t = await c.db.prepare('SELECT t.*, u.code AS unit_code FROM teachers t LEFT JOIN units u ON u.id = t.unit_id WHERE t.id = ?').bind(teacherId).first()
  if (!t) return error('Guru tidak ditemukan.', 404)
  if (c.scope.kind === 'unit' && Number(t.unit_id) !== Number(c.scope.unitId)) return error('Data guru berada di luar unit Anda.', 403)
  const cs = (await c.db.prepare(
    `SELECT cs.id, cs.kkm, cs.class_id, cl.name AS class_name, cl.level, s.name AS subject_name, s.code AS subject_code FROM class_subjects cs
     JOIN classes cl ON cl.id = cs.class_id JOIN subjects s ON s.id = cs.subject_id WHERE cs.teacher_id = ? ORDER BY cl.level, cl.name, s.name`).bind(teacherId).all()).results
  const schedules = (await c.db.prepare(
    `SELECT sc.day, sc.period, sc.start_time, sc.end_time, sc.room, cl.name AS class_name, s.name AS subject_name FROM schedules sc
     JOIN class_subjects cs ON cs.id = sc.class_subject_id JOIN classes cl ON cl.id = sc.class_id JOIN subjects s ON s.id = cs.subject_id
     WHERE cs.teacher_id = ? ORDER BY sc.period`).bind(teacherId).all()).results
  const homeroom = (await c.db.prepare('SELECT id, name FROM classes WHERE homeroom_teacher_id = ?').bind(teacherId).all()).results
  const att = (await c.db.prepare('SELECT COUNT(DISTINCT date) AS d FROM attendance_teachers WHERE teacher_id = ?').bind(teacherId).first()).d
  const assignments = (await c.db.prepare('SELECT COUNT(*) AS n FROM lms_assignments WHERE teacher_id = ?').bind(teacherId).first()).n
  const exams = (await c.db.prepare('SELECT COUNT(*) AS n FROM exams WHERE teacher_id = ?').bind(teacherId).first()).n
  const pending = (await c.db.prepare("SELECT COUNT(*) AS n FROM lms_submissions s JOIN lms_assignments a ON a.id = s.assignment_id WHERE a.teacher_id = ? AND s.status = 'submitted'").bind(teacherId).first()).n
  const examPending = (await c.db.prepare("SELECT COUNT(*) AS n FROM exam_participants p JOIN exams e ON e.id = p.exam_id WHERE e.teacher_id = ? AND p.status = 'submitted'").bind(teacherId).first()).n
  return json({ teacher: t, class_subjects: cs, schedules, homeroom, attendance_days: att, lms_assignments: assignments, exams, pending_submissions: pending, pending_exam_grading: examPending })
})

add('GET', '/api/academic/completeness', async (c) => {
  if (c.user.role === 'siswa') return error('Siswa tidak memiliki akses ringkasan ini.', 403)
  const semesterId = Number(c.query.get('semester_id'))
  const sem = semesterId
    ? await c.db.prepare('SELECT s.*, a.name AS academic_year_name FROM semesters s LEFT JOIN academic_years a ON a.id = s.academic_year_id WHERE s.id = ?').bind(semesterId).first()
    : await c.db.prepare('SELECT s.*, a.name AS academic_year_name FROM semesters s LEFT JOIN academic_years a ON a.id = s.academic_year_id WHERE s.is_active = 1').first()
  const classIds = await allowedClassIds(c.db, c.user, c.scope)
  const classes = (await c.db.prepare('SELECT c.id, c.name, c.unit_id, u.code AS unit_code FROM classes c LEFT JOIN units u ON u.id = c.unit_id ORDER BY c.unit_id, c.level, c.name').all()).results
    .filter((x) => classIds === null || classIds.includes(x.id))
  const rows = []
  for (const cl of classes) {
    const matrix = await classGradeMatrix(c.db, cl.id, sem.id)
    const completeSubjects = matrix.subjects.filter((s) => s.complete).length
    const cards = (await c.db.prepare('SELECT status, COUNT(*) AS n FROM report_cards WHERE class_id = ? AND semester_id = ? GROUP BY status').bind(cl.id, sem.id).all()).results
    const cardMap = Object.fromEntries(cards.map((x) => [x.status, x.n]))
    const attDays = (await c.db.prepare('SELECT COUNT(DISTINCT date) AS d FROM attendance_students WHERE class_id = ?').bind(cl.id).first()).d
    const published = (await c.db.prepare('SELECT COUNT(*) AS n FROM lms_assignments WHERE class_id = ? AND status = "published"').bind(cl.id).first()).n
    const pendingSubs = (await c.db.prepare("SELECT COUNT(*) AS n FROM lms_submissions s JOIN lms_assignments a ON a.id = s.assignment_id WHERE a.class_id = ? AND s.status = 'submitted'").bind(cl.id).first()).n
    rows.push({
      class_id: cl.id, class_name: cl.name, unit_code: cl.unit_code, students: matrix.students.length,
      subjects: matrix.subjects.length, subjects_complete: completeSubjects,
      score_completeness: matrix.subjects.length ? Math.round((completeSubjects / matrix.subjects.length) * 1000) / 10 : 0,
      report_cards: { total: cards.reduce((a, b) => a + b.n, 0), draft: cardMap.draft || 0, reviewed: cardMap.reviewed || 0, approved: cardMap.approved || 0, published: cardMap.published || 0 },
      attendance_days: attDays, assignments: published, pending_submissions: pendingSubs,
    })
  }
  return json({ data: rows, semester: sem })
})

export default routes
