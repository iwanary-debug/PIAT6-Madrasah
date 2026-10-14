// Perhitungan akademik terpusat (nilai akhir, presensi, ketuntasan)
export const GRADE_TYPES = { tugas: 'Tugas', harian: 'Nilai Harian', uts: 'PTS/UTS', uas: 'PAS/UAS', praktik: 'Praktik/Proyek', proyek: 'Proyek' }

export async function getSettings(db) {
  const rows = (await db.prepare('SELECT key, value FROM settings').all()).results
  const m = {}
  for (const r of rows) m[r.key] = r.value
  return m
}

/** Nilai akhir per mata pelajaran untuk satu kelas & semester. */
export async function classGradeMatrix(db, classId, semesterId, { studentIds = null } = {}) {
  const subjects = (await db.prepare(
    `SELECT cs.id AS class_subject_id, cs.subject_id, cs.kkm, cs.teacher_id, s.name AS subject_name, s.code AS subject_code, t.name AS teacher_name
     FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id LEFT JOIN teachers t ON t.id = cs.teacher_id
     WHERE cs.class_id = ? AND cs.semester_id = ? ORDER BY s.name`).bind(classId, semesterId).all()).results
  const components = (await db.prepare(
    `SELECT c.id, c.class_subject_id, c.name, c.type, c.weight FROM assessment_components c
     JOIN class_subjects cs ON cs.id = c.class_subject_id WHERE cs.class_id = ? AND c.semester_id = ? ORDER BY c.id`).bind(classId, semesterId).all()).results
  const scores = (await db.prepare(
    `SELECT sc.component_id, sc.student_id, sc.score FROM scores sc
     JOIN assessment_components c ON c.id = sc.component_id JOIN class_subjects cs ON cs.id = c.class_subject_id
     WHERE cs.class_id = ? AND c.semester_id = ?`).bind(classId, semesterId).all()).results
  const students = studentIds
    ? (await db.prepare(`SELECT id, name, nis FROM students WHERE class_id = ? ORDER BY name`).bind(classId).all()).results.filter((s) => studentIds.includes(s.id))
    : (await db.prepare('SELECT id, name, nis FROM students WHERE class_id = ? ORDER BY name').bind(classId).all()).results
  const scoreMap = {}
  for (const s of scores) scoreMap[`${s.component_id}|${s.student_id}`] = s.score
  const compsOf = {}
  for (const c of components) (compsOf[c.class_subject_id] = compsOf[c.class_subject_id] || []).push(c)
  const out = []
  for (const sub of subjects) {
    const comps = compsOf[sub.class_subject_id] || []
    const totalWeight = comps.reduce((a, c) => a + Number(c.weight || 0), 0)
    const perStudent = {}, detail = {}
    let enteredAll = 0
    for (const st of students) {
      let wsum = 0, wEntered = 0, missing = []
      const ds = []
      for (const c of comps) {
        const v = scoreMap[`${c.id}|${st.id}`]
        if (v == null || v === '') missing.push(c.name)
        else { wsum += Number(v) * Number(c.weight || 0); wEntered += Number(c.weight || 0) }
        ds.push({ component_id: c.id, name: c.name, type: c.type, weight: c.weight, score: v == null ? null : Number(v) })
      }
      const fin = wEntered > 0 ? Math.round((wsum / wEntered) * 10) / 10 : null
      perStudent[st.id] = fin
      detail[st.id] = { scores: ds, missing, final: fin, complete: missing.length === 0 && comps.length > 0, kkm: sub.kkm, tuntas: fin != null ? fin >= sub.kkm : null }
      if (missing.length === 0 && comps.length > 0) enteredAll++
    }
    const vals = Object.values(perStudent).filter((v) => v != null)
    out.push({
      class_subject_id: sub.class_subject_id, subject_id: sub.subject_id, subject_name: sub.subject_name, subject_code: sub.subject_code,
      teacher_name: sub.teacher_name, teacher_id: sub.teacher_id, kkm: sub.kkm, component_count: comps.length, totalWeight,
      finals: perStudent, detail, avg: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
      min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null,
      complete_students: enteredAll, total_students: students.length,
      complete: students.length > 0 && enteredAll === students.length,
      below_kkm: students.filter((s) => perStudent[s.id] != null && perStudent[s.id] < sub.kkm).map((s) => ({ id: s.id, name: s.name, nis: s.nis, final: perStudent[s.id] })),
    })
  }
  const studentAvg = {}
  for (const st of students) {
    const vals = out.map((s) => s.finals[st.id]).filter((v) => v != null)
    studentAvg[st.id] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null
  }
  return { subjects: out, students, studentAvg }
}

/** Rekap presensi siswa untuk sekumpulan siswa pada rentang tanggal. */
export async function attendanceSummary(db, studentIds, from, to) {
  const out = {}
  for (const id of studentIds) out[id] = { hadir: 0, sakit: 0, izin: 0, alpa: 0, total: 0, percent: 0 }
  if (!studentIds.length) return out
  const chunks = []
  for (let i = 0; i < studentIds.length; i += 80) chunks.push(studentIds.slice(i, i + 80))
  for (const ch of chunks) {
    const rows = (await db.prepare(
      `SELECT student_id, status, COUNT(*) AS n FROM attendance_students
       WHERE student_id IN (${ch.map(() => '?').join(',')}) AND date >= ? AND date <= ? GROUP BY student_id, status`)
      .bind(...ch, from, to).all()).results
    for (const r of rows) {
      const o = out[r.student_id]
      if (!o) continue
      if (r.status in o) o[r.status] = r.n
      o.total += r.n
    }
  }
  for (const id of Object.keys(out)) {
    const o = out[id]
    o.percent = o.total ? Math.round((o.hadir / o.total) * 1000) / 10 : 0
  }
  return out
}

export async function attendanceForClass(db, classId, from, to) {
  const rows = (await db.prepare('SELECT id FROM students WHERE class_id = ? AND status = "aktif"').bind(classId).all()).results
  return attendanceSummary(db, rows.map((r) => r.id), from, to)
}

export function semesterRange(semester) {
  if (!semester) return { from: '2000-01-01', to: '2099-12-31' }
  return { from: semester.start_date || '2000-01-01', to: semester.end_date || '2099-12-31' }
}

export function attendancePercent(a) { return a && a.total ? Math.round((a.hadir / a.total) * 1000) / 10 : 0 }

export function rankStudents(students, studentAvg, attendance) {
  const list = students.map((s) => ({ id: s.id, name: s.name, nis: s.nis, average: studentAvg[s.id], attendance: attendance[s.id] ? attendance[s.id].percent : null }))
  list.sort((a, b) => (b.average || 0) - (a.average || 0))
  let rank = 0, prev = null
  list.forEach((row, i) => {
    if (row.average !== prev) { rank = i + 1; prev = row.average }
    row.rank = row.average == null ? null : rank
  })
  return list
}

export function gradePredicate(pct, avg, kkm, settings) {
  const minAvg = Number(settings.promotion_min_average || 70)
  const maxAbsence = Number(settings.promotion_max_absence_percent || 15)
  const absence = pct == null ? null : Math.round((100 - pct) * 10) / 10
  if (avg == null) return { recommendation: 'data_belum_lengkap', reason: 'Nilai akhir belum lengkap sehingga rekomendasi belum dapat dihitung.' }
  const problems = []
  if (avg < minAvg) problems.push(`rata-rata ${avg} di bawah batas ${minAvg}`)
  if (absence != null && absence > maxAbsence) problems.push(`ketidakhadiran ${absence}% melebihi batas ${maxAbsence}%`)
  if (!problems.length) return { recommendation: 'naik', reason: `Rata-rata ${avg} dan kehadiran memenuhi kriteria yang dikonfigurasi.` }
  return { recommendation: avg < minAvg && absence > maxAbsence ? 'tidak_naik' : 'pertimbangan', reason: 'Perlu pertimbangan: ' + problems.join('; ') + '.' }
}
