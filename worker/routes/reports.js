// Dashboard role-aware + laporan dan analitik (semua angka dihitung dari data tersimpan)
import { json, error, allowedClassIds, scopeSql } from '../lib.js'
import { getSettings, classGradeMatrix } from './calc.js'

const routes = []
const add = (method, path, handler, opts = {}) => routes.push({ method, path, handler, public: !!opts.public })

export async function activeSemester(db, semesterId) {
  if (semesterId) return db.prepare('SELECT s.*, a.name AS academic_year_name FROM semesters s LEFT JOIN academic_years a ON a.id = s.academic_year_id WHERE s.id = ?').bind(Number(semesterId)).first()
  return db.prepare('SELECT s.*, a.name AS academic_year_name FROM semesters s LEFT JOIN academic_years a ON a.id = s.academic_year_id WHERE s.is_active = 1').first()
}

/** Nilai akhir agregat (cepat) untuk seluruh kelas pada satu semester. */
export async function aggFinals(db, semesterId, classIds = null) {
  const cl = classIds === null ? '' : ` AND cs.class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`
  const params = [semesterId]
  if (classIds !== null) params.push(...classIds)
  return (await db.prepare(
    `WITH comp AS (SELECT id, class_subject_id, weight FROM assessment_components WHERE semester_id = ?),
     fin AS (
       SELECT sc.student_id, cs.id AS class_subject_id, cs.class_id, cs.subject_id, cs.kkm,
              SUM(sc.score * comp.weight) / SUM(comp.weight) AS final, COUNT(sc.id) AS entered
       FROM scores sc JOIN comp ON comp.id = sc.component_id JOIN class_subjects cs ON cs.id = comp.class_subject_id
       WHERE 1=1${cl}
       GROUP BY sc.student_id, cs.id
     )
     SELECT fin.*, s.name AS student_name, s.unit_id, cl.name AS class_name, u.code AS unit_code, sub.name AS subject_name, sub.code AS subject_code
     FROM fin JOIN students s ON s.id = fin.student_id JOIN classes cl ON cl.id = fin.class_id
     JOIN units u ON u.id = cl.unit_id JOIN subjects sub ON sub.id = fin.subject_id`).bind(...params).all()).results
    .map((r) => ({ ...r, final: Math.round(Number(r.final) * 10) / 10 }))
}

export async function attendanceAgg(db, { from, to, classIds = null, unitIds = null }) {
  const where = ['a.date >= ?', 'a.date <= ?'], params = [from, to]
  if (classIds !== null) { where.push(`a.class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`); params.push(...classIds) }
  if (unitIds !== null) { where.push(`cl.unit_id IN (${unitIds.length ? unitIds.map(() => '?').join(',') : 'NULL'})`); params.push(...unitIds) }
  return (await db.prepare(
    `SELECT cl.unit_id, u.code AS unit_code, cl.id AS class_id, cl.name AS class_name, a.date, a.status, COUNT(*) AS n
     FROM attendance_students a JOIN classes cl ON cl.id = a.class_id JOIN units u ON u.id = cl.unit_id
     WHERE ${where.join(' AND ')} GROUP BY cl.unit_id, cl.id, a.date, a.status`).bind(...params).all()).results
}

export function percentOf(rows, statuses = ['hadir']) {
  const total = rows.reduce((a, r) => a + r.n, 0)
  const good = rows.filter((r) => statuses.includes(r.status)).reduce((a, r) => a + r.n, 0)
  return { percent: total ? Math.round((good / total) * 1000) / 10 : null, hadir: good, total }
}

async function scopedClassIds(db, c) {
  const ids = await allowedClassIds(db, c.user, c.scope)
  return ids
}

add('GET', '/api/dashboard', async (c) => {
  const sem = await activeSemester(c.db, c.query.get('semester_id'))
  const classIds = await scopedClassIds(c.db, c)
  const unitIds = c.scope.kind === 'all' ? null : [c.scope.unitId]
  const clsWhere = classIds === null ? '' : ` AND id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`
  const clsParams = classIds === null ? [] : classIds
  const units = (await c.db.prepare('SELECT * FROM units ORDER BY id').all()).results
  const visibleUnits = c.scope.kind === 'all' ? units : units.filter((u) => u.id === c.scope.unitId)

  const studentCounts = (await c.db.prepare(
    `SELECT unit_id, COUNT(*) AS total, SUM(CASE WHEN status = 'aktif' THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN gender = 'L' THEN 1 ELSE 0 END) AS male, SUM(CASE WHEN gender = 'P' THEN 1 ELSE 0 END) AS female
     FROM students WHERE 1=1${classIds === null ? '' : ` AND class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`} GROUP BY unit_id`).bind(...clsParams).all()).results
  const teacherCounts = (await c.db.prepare('SELECT unit_id, COUNT(*) AS total FROM teachers WHERE status = "aktif" GROUP BY unit_id').all()).results
  const classCounts = (await c.db.prepare(`SELECT unit_id, COUNT(*) AS total, SUM(capacity) AS capacity FROM classes WHERE 1=1${clsWhere} GROUP BY unit_id`).bind(...clsParams).all()).results
  const subjectCounts = (await c.db.prepare('SELECT unit_id, COUNT(*) AS total FROM subjects GROUP BY unit_id').all()).results

  const range = sem ? { from: sem.start_date, to: sem.end_date } : { from: '2000-01-01', to: '2099-12-31' }
  const att = await attendanceAgg(c.db, { from: range.from, to: range.to, classIds, unitIds })
  const attByUnit = visibleUnits.map((u) => ({ unit_id: u.id, unit_code: u.code, unit_name: u.name, ...percentOf(att.filter((a) => a.unit_id === u.id)) }))
  const last14 = {}
  const dayKeys = [...new Set(att.map((a) => a.date))].sort().slice(-14)
  for (const d of dayKeys) last14[d] = percentOf(att.filter((a) => a.date === d))
  const attTrend = dayKeys.map((d) => ({ date: d, percent: last14[d].percent }))
  const attByClass = [...new Set(att.map((a) => a.class_id))].map((cid) => {
    const rows = att.filter((a) => a.class_id === cid)
    return { class_id: cid, class_name: rows[0].class_name, unit_code: rows[0].unit_code, ...percentOf(rows) }
  }).sort((a, b) => (a.percent || 0) - (b.percent || 0))

  // presensi guru
  const tWhere = ['a.date >= ?', 'a.date <= ?'], tParams = [range.from, range.to]
  if (unitIds) { tWhere.push(`t.unit_id IN (${unitIds.map(() => '?').join(',')})`); tParams.push(...unitIds) }
  const tatt = (await c.db.prepare(
    `SELECT t.unit_id, a.status, COUNT(*) AS n FROM attendance_teachers a JOIN teachers t ON t.id = a.teacher_id WHERE ${tWhere.join(' AND ')} GROUP BY t.unit_id, a.status`).bind(...tParams).all()).results
  const teacherAttByUnit = visibleUnits.map((u) => ({ unit_id: u.id, unit_code: u.code, ...percentOf(tatt.filter((x) => x.unit_id === u.id)) }))

  const finals = await aggFinals(c.db, sem ? sem.id : 0, classIds)
  const avgOf = (rows) => (rows.length ? Math.round((rows.reduce((a, r) => a + r.final, 0) / rows.length) * 10) / 10 : null)
  const academicByUnit = visibleUnits.map((u) => ({ unit_id: u.id, unit_code: u.code, average: avgOf(finals.filter((f) => f.unit_id === u.id)), samples: finals.filter((f) => f.unit_id === u.id).length }))
  const academicByClass = [...new Set(finals.map((f) => f.class_id))].map((cid) => {
    const rows = finals.filter((f) => f.class_id === cid)
    return { class_id: cid, class_name: rows[0].class_name, unit_code: rows[0].unit_code, average: avgOf(rows), students: new Set(rows.map((r) => r.student_id)).size, samples: rows.length }
  })
  const subjectAvg = {}
  for (const f of finals) { (subjectAvg[`${f.unit_code}|${f.subject_name}`] = subjectAvg[`${f.unit_code}|${f.subject_name}`] || []).push(f.final) }
  const subjectRows = Object.entries(subjectAvg).map(([k, vals]) => {
    const [unit_code, subject_name] = k.split('|')
    return { unit_code, subject_name, average: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, samples: vals.length }
  }).sort((a, b) => a.average - b.average)

  // siswa berisiko: nilai di bawah KKM pada >= 2 mapel atau kehadiran rendah
  const attByStudent = {}
  for (const a of att) {
    const k = a.class_id
    void k
  }
  const perStudent = {}
  for (const f of finals) {
    const k = f.student_id
    perStudent[k] = perStudent[k] || { student_id: f.student_id, name: f.student_name, class_name: f.class_name, unit_code: f.unit_code, below: 0, subjects: 0, sum: 0 }
    perStudent[k].subjects++
    perStudent[k].sum += f.final
    if (f.final < f.kkm) perStudent[k].below++
  }
  const studentAttRows = (await c.db.prepare(
    `SELECT a.student_id, SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) AS hadir, COUNT(*) AS total
     FROM attendance_students a JOIN classes cl ON cl.id = a.class_id
     WHERE a.date >= ? AND a.date <= ?${classIds === null ? '' : ` AND a.class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`}
     GROUP BY a.student_id`).bind(range.from, range.to, ...clsParams).all()).results
  const attMap = Object.fromEntries(studentAttRows.map((r) => [r.student_id, r.total ? Math.round((r.hadir / r.total) * 1000) / 10 : null]))
  const settings = await getSettings(c.db)
  const alertPct = Number(settings.attendance_alert_percent || 90)
  const atRisk = Object.values(perStudent).map((s) => ({
    ...s, average: Math.round((s.sum / s.subjects) * 10) / 10, attendance_percent: attMap[s.student_id] != null ? attMap[s.student_id] : null,
  })).filter((s) => s.below >= 2 || (s.attendance_percent != null && s.attendance_percent < alertPct))
    .sort((a, b) => (b.below - a.below) || (a.average - b.average)).slice(0, 12)

  // LMS & tugas
  const lmsWhere = [], lmsParams = []
  if (classIds !== null) { lmsWhere.push(`a.class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`); lmsParams.push(...classIds) }
  const lmsW = lmsWhere.length ? ' AND ' + lmsWhere.join(' AND ') : ''
  const lms = (await c.db.prepare(
    `SELECT COUNT(*) AS total_students, SUM(CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END) AS submitted,
       SUM(CASE WHEN s.id IS NULL THEN 1 ELSE 0 END) AS missing, SUM(CASE WHEN s.status = 'submitted' THEN 1 ELSE 0 END) AS ungraded
     FROM lms_assignments a JOIN students st ON st.class_id = a.class_id AND st.status = 'aktif'
     LEFT JOIN lms_submissions s ON s.assignment_id = a.id AND s.student_id = st.id
     WHERE a.status = 'published'${lmsW}`).bind(...lmsParams).first())
  const materials = (await c.db.prepare(`SELECT COUNT(*) AS n FROM lms_materials m WHERE m.status = 'published'${classIds === null ? '' : ` AND m.class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`}`).bind(...clsParams).first()).n

  // ujian
  const nowIso = new Date().toISOString()
  const examWhere = [], examParams = []
  if (unitIds) { examWhere.push(`e.unit_id IN (${unitIds.map(() => '?').join(',')})`); examParams.push(...unitIds) }
  if (classIds !== null) { examWhere.push(`e.class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`); examParams.push(...classIds) }
  const examW = examWhere.length ? 'WHERE ' + examWhere.join(' AND ') : ''
  const upcoming = (await c.db.prepare(
    `SELECT e.id, e.title, e.start_at, e.end_at, e.exam_date, e.status, cl.name AS class_name, u.code AS unit_code, s.name AS subject_name,
       (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id = e.id) AS question_count,
       (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id) AS participants
     FROM exams e JOIN classes cl ON cl.id = e.class_id LEFT JOIN units u ON u.id = e.unit_id LEFT JOIN subjects s ON s.id = e.subject_id
     ${examW ? examW + ' AND' : 'WHERE'} e.end_at >= ? ORDER BY e.start_at LIMIT 6`).bind(...examParams, nowIso).all()).results
  const recentExams = (await c.db.prepare(
    `SELECT e.id, e.title, e.exam_date, cl.name AS class_name, s.name AS subject_name,
       (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id AND p.final_score IS NOT NULL) AS graded,
       (SELECT AVG(p.final_score) FROM exam_participants p WHERE p.exam_id = e.id AND p.final_score IS NOT NULL) AS avg_score,
       (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id AND p.final_score >= 75) AS passed
     FROM exams e JOIN classes cl ON cl.id = e.class_id LEFT JOIN subjects s ON s.id = e.subject_id
     ${examW ? examW + ' AND' : 'WHERE'} e.end_at < ? ORDER BY e.end_at DESC LIMIT 6`).bind(...examParams, nowIso).all()).results
  const pendingExamGrading = (await c.db.prepare(
    `SELECT COUNT(*) AS n FROM exam_participants p JOIN exams e ON e.id = p.exam_id ${examW ? examW.replace('WHERE', 'WHERE') + ' AND' : 'WHERE'} p.status = 'submitted'`).bind(...examParams).all()).results[0]

  const notifications = []
  for (const a of attByClass.filter((x) => x.percent != null && x.percent < alertPct).slice(0, 4)) notifications.push({ level: 'peringatan', text: `Kehadiran kelas ${a.class_name} (${a.unit_code}) ${a.percent}% - di bawah ambang ${alertPct}%.`, link: '/presensi-siswa' })
  if ((lms.ungraded || 0) > 0) notifications.push({ level: 'tugas', text: `${lms.ungraded} pengumpulan tugas belum dinilai.`, link: '/koreksi' })
  if ((lms.missing || 0) > 0) notifications.push({ level: 'info', text: `${lms.missing} tugas belum dikumpulkan siswa.`, link: '/lms/tugas' })
  if (pendingExamGrading.n > 0) notifications.push({ level: 'ujian', text: `${pendingExamGrading.n} jawaban ujian CBT menunggu koreksi uraian.`, link: '/cbt/koreksi' })
  for (const r of atRisk.slice(0, 3)) notifications.push({ level: 'akademik', text: `${r.name} (${r.class_name}) memiliki ${r.below} mata pelajaran di bawah KKM.`, link: '/laporan' })

  return json({
    role: c.user.role, semester: sem, scope: { kind: c.scope.kind, unit_id: c.scope.unitId, units: visibleUnits },
    cards: {
      students_total: studentCounts.reduce((a, s) => a + s.total, 0), students_active: studentCounts.reduce((a, s) => a + (s.active || 0), 0),
      students_by_unit: visibleUnits.map((u) => ({ unit_code: u.code, total: (studentCounts.find((s) => s.unit_id === u.id) || {}).total || 0, active: (studentCounts.find((s) => s.unit_id === u.id) || {}).active || 0, male: (studentCounts.find((s) => s.unit_id === u.id) || {}).male || 0, female: (studentCounts.find((s) => s.unit_id === u.id) || {}).female || 0 })),
      teachers: teacherCounts.reduce((a, s) => a + s.total, 0), teachers_by_unit: visibleUnits.map((u) => ({ unit_code: u.code, total: (teacherCounts.find((t) => t.unit_id === u.id) || {}).total || 0 })),
      classes: classCounts.reduce((a, s) => a + s.total, 0), subjects: subjectCounts.reduce((a, s) => a + s.total, 0),
      attendance_percent: percentOf(att).percent, teacher_attendance_percent: percentOf(tatt).percent,
      average_score: avgOf(finals), at_risk: atRisk.length,
    },
    attendance: { by_unit: attByUnit, by_class: attByClass, trend: attTrend, teacher_by_unit: teacherAttByUnit },
    academic: { by_unit: academicByUnit, by_class: academicByClass, subjects: subjectRows, lowest: subjectRows.slice(0, 5), highest: subjectRows.slice(-5).reverse() },
    at_risk: atRisk,
    tasks: {
      assignments_published: null, materials, students: lms.total_students || 0, submitted: lms.submitted || 0, missing: lms.missing || 0, ungraded: lms.ungraded || 0,
      completion_percent: lms.total_students ? Math.round((lms.submitted / lms.total_students) * 1000) / 10 : 0,
    },
    exams: { upcoming, recent: recentExams.map((e) => ({ ...e, avg_score: e.avg_score != null ? Math.round(Number(e.avg_score) * 10) / 10 : null, pass_rate: e.graded ? Math.round((e.passed / e.graded) * 1000) / 10 : null })), pending_review: pendingExamGrading.n },
    unit_comparison: visibleUnits.map((u) => {
      const a = attByUnit.find((x) => x.unit_id === u.id) || {}
      const t = teacherAttByUnit.find((x) => x.unit_id === u.id) || {}
      const ac = academicByUnit.find((x) => x.unit_id === u.id) || {}
      const sc = studentCounts.find((x) => x.unit_id === u.id) || {}
      return {
        unit_code: u.code, unit_name: u.name, students: sc.total || 0, teachers: (teacherCounts.find((x) => x.unit_id === u.id) || {}).total || 0,
        classes: (classCounts.find((x) => x.unit_id === u.id) || {}).total || 0, attendance_percent: a.percent ?? null,
        teacher_attendance_percent: t.percent ?? null, average_score: ac.average ?? null,
      }
    }),
    notifications,
    demo_notice: 'Data pada aplikasi ini adalah DATA DEMO (nama, nilai, dan jadwal fiktif) untuk pengujian fitur.',
  })
})

const REPORTS = [
  { kind: 'students', label: 'Rekap Siswa per Unit & Kelas' },
  { kind: 'attendance-students', label: 'Rekap Presensi Siswa' },
  { kind: 'attendance-teachers', label: 'Rekap Presensi Guru' },
  { kind: 'grades', label: 'Rekap Nilai per Siswa' },
  { kind: 'subject-analysis', label: 'Analisis Mata Pelajaran' },
  { kind: 'below-kkm', label: 'Siswa di Bawah KKM' },
  { kind: 'high-absence', label: 'Siswa dengan Ketidakhadiran Tinggi' },
  { kind: 'assignments', label: 'Rekap Pengumpulan Tugas' },
  { kind: 'cbt', label: 'Rekap Hasil Ujian CBT' },
  { kind: 'completeness', label: 'Kelengkapan Nilai & Rapor' },
  { kind: 'unit-comparison', label: 'Perbandingan MTs & MA' },
  { kind: 'trends', label: 'Tren Capaian Antarperiode' },
  { kind: 'follow-up', label: 'Daftar Tindak Lanjut' },
]

add('GET', '/api/reports', async (c) => {
  const allowed = c.user.role === 'siswa' ? [] : (c.scope.kind === 'all' ? REPORTS : REPORTS.filter((r) => r.kind !== 'unit-comparison'))
  return json({ data: allowed, canView: c.user.role !== 'siswa' })
})

add('GET', '/api/reports/:kind', async (c) => {
  if (c.user.role === 'siswa') return error('Siswa tidak memiliki akses laporan agregat.', 403)
  const kind = c.params.kind
  const sem = await activeSemester(c.db, c.query.get('semester_id'))
  const classIds = await scopedClassIds(c.db, c)
  const unitIds = c.scope.kind === 'all' ? null : [c.scope.unitId]
  if (kind === 'unit-comparison' && c.scope.kind !== 'all') return error('Perbandingan lintas unit hanya untuk pimpinan yang berwenang.', 403)
  const range = { from: c.query.get('from') || (sem ? sem.start_date : '2000-01-01'), to: c.query.get('to') || (sem ? sem.end_date : '2099-12-31') }
  const meta = { semester: sem, from: range.from, to: range.to, scope: c.scope.kind, labels: {}, generated_at: new Date().toISOString() }

  if (kind === 'students') {
    const where = [], params = []
    if (classIds !== null) { where.push(`s.class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`); params.push(...classIds) }
    if (c.query.get('class_id')) { where.push('s.class_id = ?'); params.push(Number(c.query.get('class_id'))) }
    if (c.query.get('status')) { where.push('s.status = ?'); params.push(c.query.get('status')) }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const rows = (await c.db.prepare(
      `SELECT s.id, s.nis, s.name, s.gender, s.status, cl.name AS class_name, cl.level, u.code AS unit_code, u.name AS unit_name,
         (SELECT COUNT(*) FROM attendance_students a WHERE a.student_id = s.id) AS attendance_records
       FROM students s LEFT JOIN classes cl ON cl.id = s.class_id LEFT JOIN units u ON u.id = s.unit_id ${w} ORDER BY u.code, cl.level, s.name LIMIT 500`).bind(...params).all()).results
    const byClass = {}
    for (const r of rows) { const k = `${r.unit_code} - ${r.class_name}`; byClass[k] = (byClass[k] || 0) + 1 }
    const byUnit = {}
    for (const r of rows) byUnit[r.unit_code] = (byUnit[r.unit_code] || 0) + 1
    return json({ kind, meta: { ...meta, labels: { title: 'Rekap Siswa', columns: ['NIS', 'Nama', 'Kelas', 'Unit', 'Status'] } }, data: rows, summary: { total: rows.length, by_class: byClass, by_unit: byUnit, active: rows.filter((r) => r.status === 'aktif').length } })
  }

  if (kind === 'attendance-students' || kind === 'high-absence') {
    const att = await attendanceAgg(c.db, { from: range.from, to: range.to, classIds, unitIds })
    if (kind === 'attendance-students') {
      const perClass = [...new Set(att.map((a) => a.class_id))].map((cid) => {
        const rows = att.filter((a) => a.class_id === cid)
        return { class_id: cid, class_name: rows[0].class_name, unit_code: rows[0].unit_code, ...percentOf(rows) }
      }).sort((a, b) => (a.percent || 0) - (b.percent || 0))
      const perDay = [...new Set(att.map((a) => a.date))].sort().map((d) => ({ date: d, ...percentOf(att.filter((a) => a.date === d)) }))
      return json({ kind, meta: { ...meta, labels: { title: 'Rekap Presensi Siswa' } }, data: perClass, days: perDay, summary: percentOf(att) })
    }
    const where = ['a.date >= ?', 'a.date <= ?'], params = [range.from, range.to]
    if (classIds !== null) { where.push(`a.class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`); params.push(...classIds) }
    const rows = (await c.db.prepare(
      `SELECT s.id, s.name, s.nis, cl.name AS class_name, u.code AS unit_code,
         SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) AS hadir, SUM(CASE WHEN a.status = 'sakit' THEN 1 ELSE 0 END) AS sakit,
         SUM(CASE WHEN a.status = 'izin' THEN 1 ELSE 0 END) AS izin, SUM(CASE WHEN a.status = 'alpa' THEN 1 ELSE 0 END) AS alpa, COUNT(*) AS total
       FROM attendance_students a JOIN students s ON s.id = a.student_id JOIN classes cl ON cl.id = a.class_id JOIN units u ON u.id = cl.unit_id
       WHERE ${where.join(' AND ')} GROUP BY s.id ORDER BY (SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) ASC LIMIT 200`).bind(...params).all()).results
    const settings = await getSettings(c.db)
    const alert = Number(settings.attendance_alert_percent || 90)
    const data = rows.map((r) => ({ ...r, percent: r.total ? Math.round((r.hadir / r.total) * 1000) / 10 : 0, absence_percent: r.total ? Math.round(((r.total - r.hadir) / r.total) * 1000) / 10 : 0 })).filter((r) => r.percent < alert)
    return json({ kind, meta: { ...meta, alert_percent: alert, labels: { title: 'Siswa dengan Ketidakhadiran Tinggi' } }, data, summary: { flagged: data.length } })
  }

  if (kind === 'attendance-teachers') {
    const tWhere = ['a.date >= ?', 'a.date <= ?'], tParams = [range.from, range.to]
    if (unitIds) { tWhere.push(`t.unit_id IN (${unitIds.map(() => '?').join(',')})`); tParams.push(...unitIds) }
    const rows = (await c.db.prepare(
      `SELECT t.id, t.name, t.nip, t.position, u.code AS unit_code,
         SUM(CASE WHEN a.status = 'hadir' THEN 1 ELSE 0 END) AS hadir, SUM(CASE WHEN a.status = 'sakit' THEN 1 ELSE 0 END) AS sakit,
         SUM(CASE WHEN a.status = 'izin' THEN 1 ELSE 0 END) AS izin, SUM(CASE WHEN a.status IN ('tugas_luar','dinas_luar') THEN 1 ELSE 0 END) AS tugas_luar,
         SUM(CASE WHEN a.status = 'cuti' THEN 1 ELSE 0 END) AS cuti, COUNT(a.id) AS total
       FROM teachers t LEFT JOIN attendance_teachers a ON a.teacher_id = t.id AND a.date >= ? AND a.date <= ?
       LEFT JOIN units u ON u.id = t.unit_id WHERE t.status = 'aktif'${unitIds ? ' AND t.unit_id IN (' + unitIds.map(() => '?').join(',') + ')' : ''}
       GROUP BY t.id ORDER BY u.code, t.name`).bind(...tParams).all()).results
    return json({ kind, meta: { ...meta, labels: { title: 'Rekap Presensi Guru & Tenaga Kependidikan' } }, data: rows.map((r) => ({ ...r, percent: r.total ? Math.round((r.hadir / r.total) * 1000) / 10 : null })) })
  }

  if (kind === 'grades' || kind === 'subject-analysis' || kind === 'below-kkm') {
    const finals = await aggFinals(c.db, sem ? sem.id : 0, classIds)
    if (kind === 'grades') {
      const perStudent = {}
      for (const f of finals) {
        const k = f.student_id
        perStudent[k] = perStudent[k] || { student_id: f.student_id, name: f.student_name, class_name: f.class_name, unit_code: f.unit_code, subjects: 0, sum: 0, below: 0 }
        perStudent[k].subjects++; perStudent[k].sum += f.final; if (f.final < f.kkm) perStudent[k].below++
      }
      const classFilter = c.query.get('class_id') ? Number(c.query.get('class_id')) : null
      const data = Object.values(perStudent).map((s) => ({ ...s, average: Math.round((s.sum / s.subjects) * 10) / 10, complete_subjects: s.subjects }))
        .filter((s) => !classFilter || finals.some((f) => f.student_id === s.student_id && f.class_id === classFilter))
        .sort((a, b) => b.average - a.average)
      return json({ kind, meta: { ...meta, labels: { title: 'Rekap Nilai Akhir per Siswa' } }, data })
    }
    if (kind === 'subject-analysis') {
      const perSubject = {}
      for (const f of finals) {
        const k = `${f.class_id}|${f.subject_id}`
        perSubject[k] = perSubject[k] || { subjects: [], class_name: f.class_name, unit_code: f.unit_code, subject_name: f.subject_name }
        perSubject[k].subjects.push(f)
      }
      const data = Object.values(perSubject).map((s) => {
        const vals = s.subjects.map((x) => x.final)
        const kkm = s.subjects[0].kkm
        return {
          class_name: s.class_name, unit_code: s.unit_code, subject_name: s.subject_name, kkm, students: vals.length,
          average: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, highest: Math.max(...vals), lowest: Math.min(...vals),
          below_kkm: vals.filter((v) => v < kkm).length, below_kkm_percent: Math.round((vals.filter((v) => v < kkm).length / vals.length) * 1000) / 10,
        }
      }).sort((a, b) => a.average - b.average)
      return json({ kind, meta: { ...meta, labels: { title: 'Analisis Hasil Belajar per Mata Pelajaran' } }, data, summary: { subjects: data.length, lowest_average: data.length ? data[0].average : null } })
    }
    const data = finals.filter((f) => f.final < f.kkm).map((f) => ({ student_id: f.student_id, name: f.student_name, class_name: f.class_name, unit_code: f.unit_code, subject_name: f.subject_name, final: f.final, kkm: f.kkm, gap: Math.round((f.kkm - f.final) * 10) / 10 }))
      .sort((a, b) => b.gap - a.gap)
    const students = new Set(data.map((d) => d.student_id)).size
    return json({ kind, meta: { ...meta, labels: { title: 'Siswa dengan Nilai di Bawah KKM (perlu remedial)' } }, data, summary: { rows: data.length, students, per_student: students ? Math.round((data.length / students) * 10) / 10 : 0 } })
  }

  if (kind === 'assignments') {
    const where = ["a.status = 'published'"], params = []
    if (classIds !== null) { where.push(`a.class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`); params.push(...classIds) }
    const classId = c.query.get('class_id'); if (classId) { where.push('a.class_id = ?'); params.push(Number(classId)) }
    const rows = (await c.db.prepare(
      `SELECT a.id, a.title, a.due_date, a.class_id, cl.name AS class_name, u.code AS unit_code, s.name AS subject_name, t.name AS teacher_name,
         (SELECT COUNT(*) FROM students st WHERE st.class_id = a.class_id AND st.status = 'aktif') AS students,
         (SELECT COUNT(*) FROM lms_submissions su WHERE su.assignment_id = a.id) AS submitted,
         (SELECT COUNT(*) FROM lms_submissions su WHERE su.assignment_id = a.id AND su.status IN ('graded','published')) AS graded,
         (SELECT COUNT(*) FROM lms_submissions su WHERE su.assignment_id = a.id AND su.status = 'submitted') AS ungraded
       FROM lms_assignments a JOIN classes cl ON cl.id = a.class_id LEFT JOIN units u ON u.id = a.unit_id LEFT JOIN subjects s ON s.id = a.subject_id LEFT JOIN teachers t ON t.id = a.teacher_id
       WHERE ${where.join(' AND ')} ORDER BY a.due_date DESC LIMIT 200`).bind(...params).all()).results
    const data = rows.map((r) => ({ ...r, missing: r.students - r.submitted, completion_percent: r.students ? Math.round((r.submitted / r.students) * 1000) / 10 : 0 }))
    const expected = data.reduce((a, r) => a + r.students, 0)
    const submitted = data.reduce((a, r) => a + r.submitted, 0)
    return json({ kind, meta: { ...meta, labels: { title: 'Rekap Pengumpulan Tugas' } }, data, summary: { expected, submitted, missing: expected - submitted, completion_percent: expected ? Math.round((submitted / expected) * 1000) / 10 : 0, ungraded: data.reduce((a, r) => a + r.ungraded, 0) } })
  }

  if (kind === 'cbt') {
    const where = [], params = []
    if (unitIds) { where.push(`e.unit_id IN (${unitIds.map(() => '?').join(',')})`); params.push(...unitIds) }
    if (classIds !== null) { where.push(`e.class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`); params.push(...classIds) }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const rows = (await c.db.prepare(
      `SELECT e.id, e.title, e.exam_date, e.status, cl.name AS class_name, u.code AS unit_code, s.name AS subject_name, t.name AS teacher_name,
         (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id) AS participants,
         (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id AND p.status IN ('submitted','graded')) AS submitted,
         (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id AND p.status = 'submitted') AS pending_review,
         (SELECT AVG(p.final_score) FROM exam_participants p WHERE p.exam_id = e.id AND p.final_score IS NOT NULL) AS average,
         (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id AND p.final_score >= 75) AS passed,
         (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id AND p.final_score IS NOT NULL) AS scored
       FROM exams e JOIN classes cl ON cl.id = e.class_id LEFT JOIN units u ON u.id = e.unit_id LEFT JOIN subjects s ON s.id = e.subject_id LEFT JOIN teachers t ON t.id = e.teacher_id
       ${w} ORDER BY e.exam_date DESC LIMIT 100`).bind(...params).all()).results
    const data = rows.map((r) => ({ ...r, average: r.average != null ? Math.round(Number(r.average) * 10) / 10 : null, pass_rate: r.scored ? Math.round((r.passed / r.scored) * 1000) / 10 : null, completion_percent: r.participants ? Math.round((r.submitted / r.participants) * 1000) / 10 : 0 }))
    return json({ kind, meta: { ...meta, labels: { title: 'Rekap Hasil Ujian CBT' } }, data, summary: { exams: data.length, pending_review: data.reduce((a, r) => a + r.pending_review, 0) } })
  }

  if (kind === 'completeness') {
    const comp = await completenessRows(c, sem, classIds)
    return json({ kind, meta: { ...meta, labels: { title: 'Kelengkapan Nilai, Presensi, dan Rapor' } }, data: comp })
  }

  if (kind === 'unit-comparison') {
    const unitsAll = (await c.db.prepare('SELECT * FROM units ORDER BY id').all()).results
    const finals = await aggFinals(c.db, sem ? sem.id : 0, null)
    const att = await attendanceAgg(c.db, { from: range.from, to: range.to, classIds: null, unitIds: null })
    const data = []
    for (const u of unitsAll) {
      const sc = await c.db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status='aktif' THEN 1 ELSE 0 END) AS active FROM students WHERE unit_id = ?").bind(u.id).first()
      const tc = (await c.db.prepare("SELECT COUNT(*) AS n FROM teachers WHERE unit_id = ? AND status='aktif'").bind(u.id).first()).n
      const cc = (await c.db.prepare('SELECT COUNT(*) AS n FROM classes WHERE unit_id = ?').bind(u.id).first()).n
      const uf = finals.filter((f) => f.unit_id === u.id)
      const ua = percentOf(att.filter((a) => a.unit_id === u.id))
      const lmsRow = await c.db.prepare(
        `SELECT COUNT(*) AS expected, SUM(CASE WHEN s.id IS NOT NULL THEN 1 ELSE 0 END) AS submitted
         FROM lms_assignments a JOIN students st ON st.class_id = a.class_id AND st.status='aktif'
         LEFT JOIN lms_submissions s ON s.assignment_id = a.id AND s.student_id = st.id WHERE a.status='published' AND a.unit_id = ?`).bind(u.id).first()
      const ue = await c.db.prepare('SELECT AVG(p.final_score) AS avg, COUNT(p.id) AS n FROM exam_participants p JOIN exams e ON e.id = p.exam_id WHERE e.unit_id = ? AND p.final_score IS NOT NULL').bind(u.id).first()
      data.push({
        unit_code: u.code, unit_name: u.name, students: sc.total, active_students: sc.active, teachers: tc, classes: cc,
        average_score: uf.length ? Math.round((uf.reduce((a, f) => a + f.final, 0) / uf.length) * 10) / 10 : null,
        attendance_percent: ua.percent, task_completion: lmsRow.expected ? Math.round((lmsRow.submitted / lmsRow.expected) * 1000) / 10 : null,
        cbt_average: ue && ue.avg != null ? Math.round(Number(ue.avg) * 10) / 10 : null, cbt_participants: ue ? ue.n : 0,
      })
    }
    return json({ kind, meta: { ...meta, labels: { title: 'Perbandingan Performa MTs dan MA' } }, data })
  }

  if (kind === 'trends') {
    const semList = (await c.db.prepare('SELECT s.*, a.name AS academic_year_name FROM semesters s LEFT JOIN academic_years a ON a.id = s.academic_year_id ORDER BY s.academic_year_id, s.term').all()).results
    const series = []
    for (const s of semList) {
      const f = await aggFinals(c.db, s.id, classIds)
      if (!f.length) continue
      const byUnit = {}
      for (const x of f) { (byUnit[x.unit_code] = byUnit[x.unit_code] || []).push(x.final) }
      series.push({
        semester_id: s.id, label: `${s.academic_year_name} ${s.name}`, is_active: s.is_active,
        overall: f.length ? Math.round((f.reduce((a, x) => a + x.final, 0) / f.length) * 10) / 10 : null,
        by_unit: Object.entries(byUnit).map(([code, vals]) => ({ unit_code: code, average: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, samples: vals.length })),
      })
    }
    const deltas = []
    for (let i = 1; i < series.length; i++) {
      if (series[i].overall != null && series[i - 1].overall != null) deltas.push({ from: series[i - 1].label, to: series[i].label, delta: Math.round((series[i].overall - series[i - 1].overall) * 10) / 10 })
    }
    return json({ kind, meta: { ...meta, labels: { title: 'Tren Capaian Akademik Antarperiode' } }, data: series, deltas, note: 'Tren dihitung dari nilai akhir tersimpan pada setiap semester.' })
  }

  if (kind === 'follow-up') {
    const finals = await aggFinals(c.db, sem ? sem.id : 0, classIds)
    const att = await attendanceAgg(c.db, { from: range.from, to: range.to, classIds, unitIds })
    const settings = await getSettings(c.db)
    const alert = Number(settings.attendance_alert_percent || 90)
    const items = []
    const perClass = {}
    for (const f of finals) { (perClass[`${f.class_id}`] = perClass[`${f.class_id}`] || { class_name: f.class_name, unit_code: f.unit_code, vals: [] }).vals.push(f.final) }
    for (const [cid, x] of Object.entries(perClass)) {
      const avg = Math.round((x.vals.reduce((a, b) => a + b, 0) / x.vals.length) * 10) / 10
      if (avg < 75) items.push({ priority: 'tinggi', category: 'Kelas', subject: `${x.unit_code} - ${x.class_name}`, finding: `Rata-rata nilai kelas ${avg} (< 75)`, action: 'Lakukan analisis butir soal dan program remedial terarah bagi kelas ini.', ref: { class_id: Number(cid) } })
    }
    const lowAtt = [...new Set(att.map((a) => a.class_id))].map((cid) => ({ class_id: cid, ...percentOf(att.filter((a) => a.class_id === cid)), class_name: att.find((a) => a.class_id === cid).class_name, unit_code: att.find((a) => a.class_id === cid).unit_code })).filter((x) => x.percent != null && x.percent < alert)
    for (const x of lowAtt) items.push({ priority: 'tinggi', category: 'Presensi', subject: `${x.unit_code} - ${x.class_name}`, finding: `Kehadiran ${x.percent}% (< ${alert}%)`, action: 'Hubungi wali kelas dan orang tua siswa dengan ketidakhadiran terbanyak.', ref: { class_id: x.class_id } })
    const comp = await completenessRows(c, sem, classIds)
    for (const x of comp.filter((r) => r.score_completeness < 100).slice(0, 8)) {
      items.push({ priority: 'penting', category: 'Administrasi nilai', subject: `${x.unit_code} - ${x.class_name}`, finding: `Kelengkapan nilai ${x.score_completeness}% (${x.subjects_complete}/${x.subjects} mapel lengkap)`, action: 'Ingatkan guru pengampu untuk melengkapi komponen nilai yang belum terisi.', ref: { class_id: x.class_id } })
    }
    for (const x of comp.filter((r) => r.report_cards.total > 0 && r.report_cards.published < r.students).slice(0, 6)) {
      items.push({ priority: 'penting', category: 'Rapor', subject: `${x.unit_code} - ${x.class_name}`, finding: `${x.report_cards.published}/${x.students} rapor sudah diterbitkan`, action: 'Selesaikan pemeriksaan dan penerbitan rapor sesuai alur status.', ref: { class_id: x.class_id } })
    }
    const pending = (await c.db.prepare("SELECT COUNT(*) AS n FROM lms_submissions WHERE status = 'submitted'").first()).n
    if (pending) items.push({ priority: 'penting', category: 'Koreksi tugas', subject: 'LMS', finding: `${pending} pengumpulan tugas belum dinilai`, action: 'Guru pengampu melakukan koreksi dan publikasi nilai tugas.', ref: {} })
    const examPending = (await c.db.prepare("SELECT COUNT(*) AS n FROM exam_participants WHERE status = 'submitted'").first()).n
    if (examPending) items.push({ priority: 'penting', category: 'Koreksi ujian', subject: 'CBT', finding: `${examPending} peserta dengan jawaban uraian belum dikoreksi`, action: 'Koreksi jawaban uraian lalu publikasikan hasil ujian.', ref: {} })
    const staff = (await c.db.prepare(
      `SELECT t.name, u.code AS unit_code, COUNT(cs.id) AS subjects,
         SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM assessment_components c JOIN scores sc ON sc.component_id = c.id WHERE c.class_subject_id = cs.id) THEN 1 ELSE 0 END) AS no_scores
       FROM teachers t JOIN class_subjects cs ON cs.teacher_id = t.id LEFT JOIN units u ON u.id = t.unit_id
       WHERE t.status = 'aktif' GROUP BY t.id HAVING no_scores > 0 ORDER BY no_scores DESC LIMIT 5`).all()).results
    for (const s of staff) items.push({ priority: 'penting', category: 'Administrasi guru', subject: `${s.unit_code} - ${s.name}`, finding: `${s.no_scores} dari ${s.subjects} penugasan belum memiliki nilai terisi`, action: 'Konfirmasi kepada guru terkait kelengkapan administrasi penilaian.', ref: {} })
    const order = { tinggi: 0, penting: 1, info: 2 }
    items.sort((a, b) => order[a.priority] - order[b.priority])
    return json({ kind, meta: { ...meta, labels: { title: 'Daftar Tindak Lanjut' }, note: 'Poin di bawah ini merupakan rekomendasi sistem yang dihitung dari data tersimpan, bukan keputusan otomatis.' }, data: items, summary: { total: items.length, high: items.filter((i) => i.priority === 'tinggi').length } })
  }

  return error('Jenis laporan tidak dikenal.', 404)
})

async function completenessRows(c, sem, classIds) {
  const classes = (await c.db.prepare('SELECT c.id, c.name, c.unit_id, u.code AS unit_code FROM classes c LEFT JOIN units u ON u.id = c.unit_id ORDER BY c.unit_id, c.level, c.name').all()).results
    .filter((x) => classIds === null || classIds.includes(x.id))
  const rows = []
  for (const cl of classes) {
    const m = await classGradeMatrix(c.db, cl.id, sem ? sem.id : 0)
    const cards = (await c.db.prepare('SELECT status, COUNT(*) AS n FROM report_cards WHERE class_id = ? AND semester_id = ? GROUP BY status').bind(cl.id, sem ? sem.id : 0).all()).results
    const cm = Object.fromEntries(cards.map((x) => [x.status, x.n]))
    rows.push({
      class_id: cl.id, class_name: cl.name, unit_code: cl.unit_code, students: m.students.length,
      subjects: m.subjects.length, subjects_complete: m.subjects.filter((s) => s.complete).length,
      score_completeness: m.subjects.length ? Math.round((m.subjects.filter((s) => s.complete).length / m.subjects.length) * 1000) / 10 : 0,
      students_with_complete_scores: m.students.filter((s) => m.subjects.every((x) => x.finals[s.id] != null)).length,
      report_cards: { total: cards.reduce((a, b) => a + b.n, 0), draft: cm.draft || 0, reviewed: cm.reviewed || 0, approved: cm.approved || 0, published: cm.published || 0 },
      average: m.subjects.length ? Math.round((Object.values(m.studentAvg).filter((v) => v != null).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(m.studentAvg).filter((v) => v != null).length)) * 10) / 10 : null,
    })
  }
  return rows
}

export default routes
