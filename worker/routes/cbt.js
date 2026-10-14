// Bank soal & ujian berbasis komputer (CBT)
import { json, error, audit, parseList, allowedClassIds, homeroomClassIds } from '../lib.js'
import { getSettings } from './calc.js'

const QUEST_WRITE = ['super_admin', 'kepala_mts', 'kepala_ma', 'guru', 'wali_kelas', 'operator']
const TEACHING = ['guru', 'wali_kelas']
const routes = []
const add = (method, path, handler, opts = {}) => routes.push({ method, path, handler, public: !!opts.public })

const norm = (v) => String(v == null ? '' : v).trim().toLowerCase()
export function gradeObjective(type, answer, key) {
  if (answer == null || norm(answer) === '') return 0
  if (type === 'essay') return null
  return norm(answer) === norm(key) ? 1 : 0
}
export function computeScores(questions, answers) {
  let objW = 0, objPts = 0, esW = 0, esScore = 0, essaysPending = 0, totalW = 0
  for (const q of questions) {
    totalW += Number(q.weight || 1)
    const a = answers.find((x) => x.question_id === q.question_id)
    if (q.type === 'essay') {
      esW += Number(q.weight || 1)
      if (!a || a.score == null) essaysPending++
      else esScore += Number(a.score) * Number(q.weight || 1)
    } else {
      objW += Number(q.weight || 1)
      if (a && a.is_correct) objPts += Number(q.weight || 1)
    }
  }
  const objective = objW ? Math.round((objPts / objW) * 1000) / 10 : null
  const essay = esW && essaysPending === 0 ? Math.round((esScore / esW) * 10) / 10 : null
  let final = null
  if (objective != null && essay != null) final = Math.round(((objective * objW + essay * esW) / (objW + esW)) * 10) / 10
  else if (objective != null && esW === 0) final = objective
  return { objective, essay, final, essaysPending, objective_weight: objW, essay_weight: esW, total_weight: totalW }
}

async function examWithQuestions(db, examId) {
  const exam = await db.prepare('SELECT * FROM exams WHERE id = ?').bind(examId).first()
  if (!exam) return null
  const questions = (await db.prepare(
    `SELECT eq.id AS exam_question_id, eq.order_no, eq.weight, q.* FROM exam_questions eq JOIN question_bank q ON q.id = eq.question_id
     WHERE eq.exam_id = ? ORDER BY eq.order_no`).bind(examId).all()).results
  return { exam, questions }
}
function publicQuestion(q) {
  return { exam_question_id: q.exam_question_id, question_id: q.id, order_no: q.order_no, weight: q.weight, type: q.type, question: q.question, options: q.options ? JSON.parse(q.options) : null, topic: q.topic }
}
async function canManageExam(c, exam) {
  if (['super_admin', 'kepala_mts', 'kepala_ma', 'operator'].includes(c.user.role)) {
    if (c.user.role === 'super_admin' || c.user.role === 'operator') return true
    return Number(exam.unit_id) === Number(c.user.unit_id)
  }
  if (TEACHING.includes(c.user.role) && Number(exam.teacher_id) === Number(c.user.teacher_id)) return true
  return false
}
async function studentCanTake(c, exam) {
  if (c.user.role !== 'siswa') return false
  if (Number(exam.class_id) !== Number(c.scope.classId)) return false
  if (exam.status !== 'published') return false
  const p = await c.db.prepare('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?').bind(exam.id, c.scope.studentId).first()
  if (!p) return false
  return true
}
const windowState = (exam, now = new Date()) => {
  const start = exam.start_at ? new Date(exam.start_at) : null
  const end = exam.end_at ? new Date(exam.end_at) : null
  if (start && now < start) return 'belum_mulai'
  if (end && now > end) return 'berakhir'
  return 'berlangsung'
}

// ------------------------------------------------------------- bank soal
add('GET', '/api/qbank', async (c) => {
  if (c.user.role === 'siswa') return error('Siswa tidak memiliki akses bank soal.', 403)
  const where = [], params = []
  if (c.scope.kind === 'unit') { where.push('q.unit_id = ?'); params.push(c.scope.unitId) }
  if (c.scope.kind === 'classes') { where.push('q.unit_id = ?'); params.push(c.user.unit_id) }
  const map = { unit_id: 'q.unit_id', subject_id: 'q.subject_id', class_level: 'q.class_level', type: 'q.type', difficulty: 'q.difficulty', status: 'q.status' }
  for (const [k, col] of Object.entries(map)) { const v = c.query.get(k); if (v) { where.push(`${col} = ?`); params.push(v) } }
  const q = c.query.get('q')
  if (q) { where.push('(q.question LIKE ? OR q.topic LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  const w = where.length ? where.join(' AND ') : '1=1'
  const rows = (await c.db.prepare(
    `SELECT q.*, s.name AS subject_name, u.code AS unit_code, t.name AS created_by_name FROM question_bank q
     LEFT JOIN subjects s ON s.id = q.subject_id LEFT JOIN units u ON u.id = q.unit_id LEFT JOIN teachers t ON t.id = q.created_by
     WHERE ${w} ORDER BY q.id DESC LIMIT 300`).bind(...params).all()).results
  return json({ data: rows.map((r) => ({ ...r, options: r.options ? JSON.parse(r.options) : null })) })
})

add('POST', '/api/qbank', async (c) => {
  if (!QUEST_WRITE.includes(c.user.role)) return error('Anda tidak berwenang menambah soal.', 403)
  const b = c.body || {}
  const problems = []
  if (!b.unit_id) problems.push('Unit pendidikan wajib dipilih.')
  if (!b.subject_id) problems.push('Mata pelajaran wajib dipilih.')
  if (!b.question || !String(b.question).trim()) problems.push('Pertanyaan wajib diisi.')
  if (!['multiple_choice', 'true_false', 'essay'].includes(b.type)) problems.push('Jenis soal tidak valid.')
  if (c.user.role !== 'super_admin' && Number(b.unit_id) !== Number(c.user.unit_id)) problems.push('Anda hanya dapat menambah soal pada unit Anda.')
  if (b.type === 'multiple_choice') {
    const opts = Array.isArray(b.options) ? b.options.map((o) => String(o).trim()).filter(Boolean) : []
    if (opts.length < 2) problems.push('Soal pilihan ganda memerlukan minimal dua pilihan.')
    if (!opts.includes(String(b.answer_key || '').trim())) problems.push('Kunci jawaban harus salah satu pilihan.')
  }
  if (b.type === 'true_false' && !['true', 'false'].includes(norm(b.answer_key))) problems.push('Kunci soal benar/salah harus Benar atau Salah.')
  if (b.type === 'essay' && !String(b.answer_key || '').trim()) problems.push('Kunci pembahasan soal uraian wajib diisi untuk membantu koreksi.')
  if (problems.length) return error(problems.join(' '), 422)
  const options = b.type === 'multiple_choice' ? JSON.stringify(b.options.map((o) => String(o).trim()).filter(Boolean)) : null
  const key = b.type === 'true_false' ? norm(b.answer_key) : String(b.answer_key).trim()
  const res = await c.db.prepare('INSERT INTO question_bank (unit_id, subject_id, class_level, topic, type, question, options, answer_key, explanation, weight, difficulty, status, created_by, created_at, is_demo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)')
    .bind(Number(b.unit_id), Number(b.subject_id), b.class_level ? Number(b.class_level) : null, b.topic || '', b.type, String(b.question).trim(), options, key,
      b.explanation || '', Number(b.weight || 1), b.difficulty || 'sedang', b.status === 'ready' ? 'ready' : 'draft', c.user.teacher_id || null, new Date().toISOString()).run()
  await audit(c.db, c.user, 'Membuat soal', 'question_bank', res.meta ? res.meta.last_row_id : null, `Soal baru (${b.type}) untuk mapel ${b.subject_id}.`, Number(b.unit_id))
  return json({ ok: true, id: res.meta ? res.meta.last_row_id : null }, 201)
})

add('PUT', '/api/qbank/:id', async (c) => {
  const q = await c.db.prepare('SELECT * FROM question_bank WHERE id = ?').bind(Number(c.params.id)).first()
  if (!q) return error('Soal tidak ditemukan.', 404)
  if (!QUEST_WRITE.includes(c.user.role)) return error('Anda tidak berwenang mengubah soal.', 403)
  if (c.user.role !== 'super_admin' && Number(q.unit_id) !== Number(c.user.unit_id)) return error('Soal berada di luar unit Anda.', 403)
  if (TEACHING.includes(c.user.role) && q.created_by && Number(q.created_by) !== Number(c.user.teacher_id)) return error('Soal ini dibuat oleh guru lain.', 403)
  const b = c.body || {}
  const fields = ['unit_id', 'subject_id', 'class_level', 'topic', 'type', 'question', 'answer_key', 'explanation', 'weight', 'difficulty', 'status']
  const cols = fields.filter((f) => f in b)
  if (typeof b.options !== 'undefined' && b.options) { b.options = JSON.stringify(b.options); cols.push('options') }
  if (!cols.length) return error('Tidak ada perubahan yang dikirim.', 422)
  await c.db.prepare(`UPDATE question_bank SET ${cols.map((f) => `${f} = ?`).join(', ')} WHERE id = ?`).bind(...cols.map((f) => b[f]), q.id).run()
  await audit(c.db, c.user, 'Mengubah soal', 'question_bank', q.id, `Soal #${q.id} diperbarui (${cols.join(', ')}).`, q.unit_id)
  return json({ ok: true })
})

add('DELETE', '/api/qbank/:id', async (c) => {
  const q = await c.db.prepare('SELECT q.*, (SELECT COUNT(*) FROM exam_questions e WHERE e.question_id = q.id) AS used FROM question_bank q WHERE q.id = ?').bind(Number(c.params.id)).first()
  if (!q) return error('Soal tidak ditemukan.', 404)
  if (!QUEST_WRITE.includes(c.user.role)) return error('Anda tidak berwenang menghapus soal.', 403)
  if (c.user.role !== 'super_admin' && Number(q.unit_id) !== Number(c.user.unit_id)) return error('Soal berada di luar unit Anda.', 403)
  if (q.used) {
    await c.db.prepare("UPDATE question_bank SET status = 'arsip' WHERE id = ?").bind(q.id).run()
    await audit(c.db, c.user, 'Mengarsipkan soal', 'question_bank', q.id, `Soal dipakai pada ${q.used} ujian sehingga diarsipkan, bukan dihapus.`, q.unit_id)
    return json({ ok: true, archived: true })
  }
  await c.db.prepare('DELETE FROM question_bank WHERE id = ?').bind(q.id).run()
  await audit(c.db, c.user, 'Menghapus soal', 'question_bank', q.id, 'Soal dihapus karena belum dipakai pada ujian.', q.unit_id)
  return json({ ok: true })
})

add('POST', '/api/qbank/import', async (c) => {
  if (!QUEST_WRITE.includes(c.user.role)) return error('Anda tidak berwenang mengimpor soal.', 403)
  const { unit_id, items } = c.body || {}
  if (!Array.isArray(items) || !items.length) return error('Format impor: { unit_id, items: [...] }. Tidak ada soal yang dikirim.', 422)
  if (items.length > 200) return error('Maksimal 200 soal per impor.', 422)
  const ok = [], failed = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const problems = []
    if (!it.question) problems.push('pertanyaan kosong')
    if (!['multiple_choice', 'true_false', 'essay'].includes(it.type)) problems.push('jenis soal tidak dikenal')
    let options = null
    if (it.type === 'multiple_choice') {
      const opts = Array.isArray(it.options) ? it.options.map((o) => String(o).trim()).filter(Boolean) : []
      if (opts.length < 2) problems.push('pilihan jawaban kurang dari dua')
      if (!opts.includes(String(it.answer_key || '').trim())) problems.push('kunci tidak ada pada pilihan')
      options = JSON.stringify(opts)
    }
    if (it.type === 'true_false' && !['true', 'false'].includes(norm(it.answer_key))) problems.push('kunci benar/salah tidak valid')
    if (it.type === 'essay' && !String(it.answer_key || '').trim()) problems.push('kunci pembahasan kosong')
    if (problems.length) { failed.push({ index: i + 1, question: it.question || '', problems }); continue }
    const subject = it.subject_id || (await c.db.prepare('SELECT id FROM subjects WHERE code = ? AND unit_id = ?').bind(it.subject_code || '', Number(unit_id)).first())
    if (!subject || !subject.id) { failed.push({ index: i + 1, question: it.question, problems: ['mata pelajaran tidak ditemukan'] }); continue }
    const res = await c.db.prepare('INSERT INTO question_bank (unit_id, subject_id, class_level, topic, type, question, options, answer_key, explanation, weight, difficulty, status, created_by, created_at, is_demo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)')
      .bind(Number(unit_id), subject.id, it.class_level ? Number(it.class_level) : null, it.topic || '', it.type, String(it.question).trim(), options,
        it.type === 'true_false' ? norm(it.answer_key) : String(it.answer_key).trim(), it.explanation || '', Number(it.weight || 1), it.difficulty || 'sedang',
        it.status === 'ready' ? 'ready' : 'draft', c.user.teacher_id || null, new Date().toISOString()).run()
    ok.push({ index: i + 1, id: res.meta ? res.meta.last_row_id : null })
  }
  await audit(c.db, c.user, 'Mengimpor soal', 'question_bank', '', `Impor bank soal: ${ok.length} berhasil, ${failed.length} gagal (format JSON).`, Number(unit_id))
  return json({ ok: true, imported: ok.length, failed })
})

// ------------------------------------------------------------- ujian
add('GET', '/api/exams', async (c) => {
  const where = [], params = []
  if (c.scope.kind === 'self') { where.push('e.class_id = ?'); params.push(c.scope.classId); where.push("e.status IN ('published','closed')") }
  else if (c.scope.kind === 'classes') { where.push(`e.class_id IN (${c.scope.classIds.length ? c.scope.classIds.map(() => '?').join(',') : 'NULL'})`); params.push(...c.scope.classIds) }
  else if (c.scope.kind === 'unit') { where.push('e.unit_id = ?'); params.push(c.scope.unitId) }
  for (const [k, col] of Object.entries({ class_id: 'e.class_id', subject_id: 'e.subject_id', status: 'e.status', unit_id: 'e.unit_id' })) {
    const v = c.query.get(k); if (v) { where.push(`${col} = ?`); params.push(v) }
  }
  const q = c.query.get('q'); if (q) { where.push('e.title LIKE ?'); params.push(`%${q}%`) }
  const w = where.length ? where.join(' AND ') : '1=1'
  const rows = (await c.db.prepare(
    `SELECT e.*, u.code AS unit_code, s.name AS subject_name, cl.name AS class_name, t.name AS teacher_name,
       (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id = e.id) AS question_count,
       (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id) AS participant_count,
       (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id AND p.status IN ('submitted','graded')) AS submitted_count,
       (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id AND p.status = 'graded') AS graded_count,
       (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id AND p.status = 'submitted') AS pending_count
     FROM exams e LEFT JOIN units u ON u.id = e.unit_id LEFT JOIN subjects s ON s.id = e.subject_id
     LEFT JOIN classes cl ON cl.id = e.class_id LEFT JOIN teachers t ON t.id = e.teacher_id
     WHERE ${w} ORDER BY e.start_at DESC LIMIT 200`).bind(...params).all()).results
  const now = new Date()
  const out = []
  for (const r of rows) {
    const item = { ...r, window_state: windowState(r, now) }
    if (c.scope.kind === 'self') {
      const p = await c.db.prepare('SELECT status, objective_score, essay_score, final_score, published, submitted_at FROM exam_participants WHERE exam_id = ? AND student_id = ?').bind(r.id, c.scope.studentId).first()
      item.my_status = p ? p.status : 'not_registered'
      item.my_score = p && p.published ? p.final_score : null
      item.can_start = p && p.status === 'not_started' && item.window_state === 'berlangsung'
      item.can_continue = p && p.status === 'in_progress' && item.window_state !== 'belum_mulai'
      item.show_result = r.show_result === 1
    }
    out.push(item)
  }
  return json({ data: out })
})

add('POST', '/api/exams', async (c) => {
  const b = c.body || {}
  if (!['super_admin', 'kepala_mts', 'kepala_ma', 'guru', 'wali_kelas'].includes(c.user.role)) return error('Anda tidak berwenang membuat ujian.', 403)
  const cls = await c.db.prepare('SELECT * FROM classes WHERE id = ?').bind(Number(b.class_id)).first()
  if (!cls) return error('Kelas tidak ditemukan.', 404)
  if (c.user.role !== 'super_admin' && Number(cls.unit_id) !== Number(c.user.unit_id)) return error('Anda hanya dapat membuat ujian pada unit Anda.', 403)
  if (TEACHING.includes(c.user.role)) {
    const owned = await c.db.prepare('SELECT id FROM class_subjects WHERE class_id = ? AND subject_id = ? AND teacher_id = ?').bind(cls.id, Number(b.subject_id), c.user.teacher_id).first()
    if (!owned) return error('Anda hanya dapat membuat ujian untuk kelas dan mata pelajaran yang Anda ampu.', 403)
  }
  const problems = []
  if (!b.title) problems.push('Judul ujian wajib diisi.')
  if (!b.subject_id) problems.push('Mata pelajaran wajib dipilih.')
  if (!b.start_at || !b.end_at) problems.push('Waktu mulai dan selesai wajib diisi.')
  if (b.start_at && b.end_at && new Date(b.start_at) >= new Date(b.end_at)) problems.push('Waktu selesai harus setelah waktu mulai.')
  const dur = Number(b.duration_minutes || 60)
  if (!(dur > 0) || dur > 480) problems.push('Durasi ujian harus antara 1 dan 480 menit.')
  const questions = Array.isArray(b.question_ids) ? b.question_ids : []
  if (b.status === 'published' && !questions.length) problems.push('Ujian belum memiliki soal sehingga belum dapat dipublikasikan.')
  if (problems.length) return error(problems.join(' '), 422)
  const sem = await c.db.prepare('SELECT * FROM semesters WHERE is_active = 1').first()
  const examDate = String(b.start_at).slice(0, 10)
  const res = await c.db.prepare('INSERT INTO exams (title, unit_id, subject_id, class_id, teacher_id, academic_year_id, semester_id, exam_date, start_at, end_at, duration_minutes, instructions, shuffle_questions, shuffle_options, status, show_result, created_at, is_demo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)')
    .bind(String(b.title).trim(), cls.unit_id, Number(b.subject_id), cls.id, c.user.teacher_id || b.teacher_id || null, sem.academic_year_id, sem.id, examDate, b.start_at, b.end_at, dur,
      b.instructions || '', b.shuffle_questions ? 1 : 0, b.shuffle_options ? 1 : 0, b.status === 'published' ? 'published' : 'draft', b.show_result === false ? 0 : 1, new Date().toISOString()).run()
  const examId = res.meta ? res.meta.last_row_id : null
  let order = 0
  for (const qid of questions) {
    const q = await c.db.prepare('SELECT id FROM question_bank WHERE id = ?').bind(Number(qid)).first()
    if (!q) continue
    order++
    await c.db.prepare('INSERT OR REPLACE INTO exam_questions (exam_id, question_id, order_no, weight) VALUES (?,?,?,?)').bind(examId, q.id, order, 1).run()
  }
  const students = (await c.db.prepare('SELECT id FROM students WHERE class_id = ? AND status = "aktif"').bind(cls.id).all()).results
  for (const s of students) await c.db.prepare("INSERT OR IGNORE INTO exam_participants (exam_id, student_id, status, published, is_demo) VALUES (?,?, 'not_started', 0, 1)").bind(examId, s.id).run()
  await audit(c.db, c.user, 'Membuat ujian', 'exams', examId, `Ujian "${b.title}" untuk kelas ${cls.name} dengan ${order} soal dan ${students.length} peserta.`, cls.unit_id)
  return json({ ok: true, id: examId, questions: order, participants: students.length }, 201)
})

add('PUT', '/api/exams/:id', async (c) => {
  const { exam } = (await examWithQuestions(c.db, Number(c.params.id))) || {}
  if (!exam) return error('Ujian tidak ditemukan.', 404)
  if (!(await canManageExam(c, exam))) return error('Anda tidak berwenang mengubah ujian ini.', 403)
  const b = c.body || {}
  const fields = ['title', 'instructions', 'start_at', 'end_at', 'duration_minutes', 'shuffle_questions', 'shuffle_options', 'status', 'show_result', 'subject_id']
  const cols = fields.filter((f) => f in b)
  if (b.start_at && b.end_at && new Date(b.start_at) >= new Date(b.end_at)) return error('Waktu selesai harus setelah waktu mulai.', 422)
  if (b.status === 'published') {
    const n = (await c.db.prepare('SELECT COUNT(*) AS n FROM exam_questions WHERE exam_id = ?').bind(exam.id).first()).n
    if (!n) return error('Ujian belum memiliki soal sehingga belum dapat dipublikasikan.', 422)
  }
  if (cols.length) {
    await c.db.prepare(`UPDATE exams SET ${cols.map((f) => `${f} = ?`).join(', ')}${b.start_at ? ', exam_date = ?' : ''} WHERE id = ?`)
      .bind(...cols.map((f) => ['shuffle_questions', 'shuffle_options', 'show_result'].includes(f) ? (b[f] ? 1 : 0) : b[f]), ...(b.start_at ? [String(b.start_at).slice(0, 10)] : []), exam.id).run()
  }
  if (Array.isArray(b.question_ids)) {
    await c.db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').bind(exam.id).run()
    let order = 0
    for (const qid of b.question_ids) {
      const q = await c.db.prepare('SELECT id FROM question_bank WHERE id = ?').bind(Number(qid)).first()
      if (!q) continue
      order++
      await c.db.prepare('INSERT OR REPLACE INTO exam_questions (exam_id, question_id, order_no, weight) VALUES (?,?,?,?)').bind(exam.id, q.id, order, 1).run()
    }
  }
  await audit(c.db, c.user, 'Mengubah ujian', 'exams', exam.id, `Ujian "${b.title || exam.title}" diperbarui.`, exam.unit_id)
  return json({ ok: true })
})

add('DELETE', '/api/exams/:id', async (c) => {
  const { exam } = (await examWithQuestions(c.db, Number(c.params.id))) || {}
  if (!exam) return error('Ujian tidak ditemukan.', 404)
  if (!(await canManageExam(c, exam))) return error('Anda tidak berwenang menghapus ujian ini.', 403)
  const done = (await c.db.prepare("SELECT COUNT(*) AS n FROM exam_participants WHERE exam_id = ? AND status IN ('submitted','graded')").bind(exam.id).first()).n
  if (done) return error('Ujian sudah memiliki jawaban siswa sehingga tidak dapat dihapus. Arsipkan dengan menutup ujian (status closed).', 422)
  await c.db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').bind(exam.id).run()
  await c.db.prepare('DELETE FROM exam_participants WHERE exam_id = ?').bind(exam.id).run()
  await c.db.prepare('DELETE FROM exams WHERE id = ?').bind(exam.id).run()
  await audit(c.db, c.user, 'Menghapus ujian', 'exams', exam.id, `Ujian "${exam.title}" dihapus (belum ada jawaban siswa).`, exam.unit_id)
  return json({ ok: true })
})

add('GET', '/api/exams/:id', async (c) => {
  const data = await examWithQuestions(c.db, Number(c.params.id))
  if (!data) return error('Ujian tidak ditemukan.', 404)
  const { exam, questions } = data
  const cls = await c.db.prepare('SELECT c.*, u.code AS unit_code FROM classes c LEFT JOIN units u ON u.id = c.unit_id WHERE c.id = ?').bind(exam.class_id).first()
  const subject = await c.db.prepare('SELECT * FROM subjects WHERE id = ?').bind(exam.subject_id).first()
  const teacher = await c.db.prepare('SELECT id, name FROM teachers WHERE id = ?').bind(exam.teacher_id).first()
  const base = { exam: { ...exam, window_state: windowState(exam), class_name: cls ? cls.name : null, unit_code: cls ? cls.unit_code : null, subject_name: subject ? subject.name : null, teacher_name: teacher ? teacher.name : null, question_count: questions.length } }
  if (c.user.role === 'siswa') {
    if (!(await studentCanTake(c, exam))) return error('Ujian ini tidak tersedia untuk Anda.', 403)
    const p = await c.db.prepare('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?').bind(exam.id, c.scope.studentId).first()
    const answers = (await c.db.prepare('SELECT question_id, answer, saved_at FROM exam_answers WHERE participant_id = ?').bind(p.id).all()).results
    return json({ ...base, participant: { id: p.id, status: p.status, started_at: p.started_at, submitted_at: p.submitted_at, final_score: p.published && exam.show_result ? p.final_score : null, published: p.published }, questions: questions.map(publicQuestion), answers })
  }
  if (!(await canManageExam(c, exam)) && !['super_admin', 'kepala_mts', 'kepala_ma', 'pengawas', 'operator'].includes(c.user.role)) return error('Anda tidak berwenang membuka ujian ini.', 403)
  const participants = (await c.db.prepare(
    `SELECT p.*, s.name AS student_name, s.nis FROM exam_participants p JOIN students s ON s.id = p.student_id WHERE p.exam_id = ? ORDER BY s.name`).bind(exam.id).all()).results
  return json({ ...base, questions: questions.map((q) => ({ ...publicQuestion(q), answer_key: q.answer_key, explanation: q.explanation })), participants })
})

// ------------------------------------------------------------- monitoring & jadwal ujian
add('GET', '/api/exam/schedule', async (c) => {
  const classIds = await allowedClassIds(c.db, c.user, c.scope)
  const where = [], params = []
  if (classIds !== null) { where.push(`e.class_id IN (${classIds.length ? classIds.map(() => '?').join(',') : 'NULL'})`); params.push(...classIds) }
  if (c.query.get('from')) { where.push('e.exam_date >= ?'); params.push(c.query.get('from')) }
  if (c.query.get('to')) { where.push('e.exam_date <= ?'); params.push(c.query.get('to')) }
  if (c.scope.kind === 'self') where.push("e.status IN ('published','closed')")
  const w = where.length ? where.join(' AND ') : '1=1'
  const rows = (await c.db.prepare(
    `SELECT e.id, e.title, e.exam_date, e.start_at, e.end_at, e.duration_minutes, e.status, cl.name AS class_name, u.code AS unit_code, s.name AS subject_name, t.name AS teacher_name,
       (SELECT COUNT(*) FROM exam_questions q WHERE q.exam_id = e.id) AS question_count,
       (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id) AS participants,
       (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id AND p.status = 'not_started') AS not_started,
       (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id AND p.status = 'in_progress') AS in_progress,
       (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id AND p.status IN ('submitted','graded')) AS finished,
       (SELECT COUNT(*) FROM exam_participants p WHERE p.exam_id = e.id AND p.status = 'graded') AS graded
     FROM exams e JOIN classes cl ON cl.id = e.class_id LEFT JOIN units u ON u.id = e.unit_id LEFT JOIN subjects s ON s.id = e.subject_id LEFT JOIN teachers t ON t.id = e.teacher_id
     WHERE ${w} ORDER BY e.start_at`).bind(...params).all()).results
  const conflicts = []
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j]
      if (a.class_id !== b.class_id) continue
      if (new Date(a.start_at) < new Date(b.end_at) && new Date(b.start_at) < new Date(a.end_at)) {
        conflicts.push({ class_name: a.class_name, exam_a: a.title, exam_b: b.title, date: a.exam_date })
      }
    }
  }
  const readiness = rows.map((r) => ({
    ...r, window_state: windowState(r),
    ready: r.question_count > 0 && r.participants > 0,
    ready_issues: [r.question_count === 0 ? 'belum memiliki soal' : null, r.participants === 0 ? 'belum ada peserta' : null].filter(Boolean),
  }))
  return json({ data: readiness, conflicts })
})

add('GET', '/api/exams/:id/monitor', async (c) => {
  if (c.user.role === 'siswa') return error('Siswa tidak memiliki akses monitoring ujian.', 403)
  const { exam } = (await examWithQuestions(c.db, Number(c.params.id))) || {}
  if (!exam) return error('Ujian tidak ditemukan.', 404)
  const cls = await c.db.prepare('SELECT c.*, u.code AS unit_code FROM classes c LEFT JOIN units u ON u.id = c.unit_id WHERE c.id = ?').bind(exam.class_id).first()
  if (c.scope.kind === 'unit' && Number(exam.unit_id) !== Number(c.scope.unitId)) return error('Ujian berada di luar unit Anda.', 403)
  if (c.scope.kind === 'classes' && !c.scope.classIds.includes(exam.class_id)) return error('Ujian berada di luar kelas yang Anda ampu.', 403)
  const participants = (await c.db.prepare(
    `SELECT p.*, s.name AS student_name, s.nis, (SELECT COUNT(*) FROM exam_answers a WHERE a.participant_id = p.id) AS answered
     FROM exam_participants p JOIN students s ON s.id = p.student_id WHERE p.exam_id = ? ORDER BY s.name`).bind(exam.id).all()).results
  const counts = { not_started: 0, in_progress: 0, submitted: 0, graded: 0 }
  for (const p of participants) counts[p.status] = (counts[p.status] || 0) + 1
  const answeredStats = participants.filter((p) => p.status !== 'not_started')
  const other = (await c.db.prepare(`SELECT id, title, start_at, end_at FROM exams WHERE class_id = ? AND id != ? AND date(start_at) = date(?)`).bind(exam.class_id, exam.id, exam.start_at).all()).results
  const conflicts = other.filter((o) => new Date(o.start_at) < new Date(exam.end_at) && new Date(exam.start_at) < new Date(o.end_at))
  return json({
    exam: { ...exam, window_state: windowState(exam), class_name: cls ? cls.name : null, unit_code: cls ? cls.unit_code : null },
    counts, participants, conflicts,
    progress: { total: participants.length, started: participants.length - counts.not_started, answered_any: answeredStats.length },
  })
})

add('GET', '/api/exams/:id/grading', async (c) => {
  if (c.user.role === 'siswa') return error('Siswa tidak memiliki akses koreksi ujian.', 403)
  const data = await examWithQuestions(c.db, Number(c.params.id))
  if (!data) return error('Ujian tidak ditemukan.', 404)
  const { exam, questions } = data
  if (!(await canManageExam(c, exam)) && !['super_admin', 'pengawas'].includes(c.user.role)) return error('Anda tidak berwenang mengoreksi ujian ini.', 403)
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]))
  const participants = (await c.db.prepare(
    `SELECT p.*, s.name AS student_name, s.nis FROM exam_participants p JOIN students s ON s.id = p.student_id
     WHERE p.exam_id = ? AND p.status IN ('submitted','graded') ORDER BY s.name`).bind(exam.id).all()).results
  const result = []
  for (const p of participants) {
    const answers = (await c.db.prepare('SELECT * FROM exam_answers WHERE participant_id = ?').bind(p.id).all()).results
    const essays = answers.filter((a) => byId[a.question_id] && byId[a.question_id].type === 'essay').map((a) => ({
      answer_id: a.id, question_id: a.question_id, question: byId[a.question_id].question, answer: a.answer,
      answer_key: byId[a.question_id].answer_key, explanation: byId[a.question_id].explanation, score: a.score, feedback: a.feedback, weight: byId[a.question_id].weight,
    }))
    const objectiveAnswers = answers.filter((a) => byId[a.question_id] && byId[a.question_id].type !== 'essay')
    result.push({
      participant_id: p.id, student_name: p.student_name, nis: p.nis, status: p.status, submitted_at: p.submitted_at,
      objective_score: p.objective_score, essay_score: p.essay_score, final_score: p.final_score, published: p.published,
      objective_correct: objectiveAnswers.filter((a) => a.is_correct).length, objective_total: objectiveAnswers.length,
      essays, essays_pending: essays.filter((e) => e.score == null).length,
    })
  }
  return json({ exam, questions: questions.map((q) => ({ id: q.id, type: q.type, question: q.question, answer_key: q.answer_key, weight: q.weight })), participants: result })
})

add('POST', '/api/exam/answers/:id/grade', async (c) => {
  const a = await c.db.prepare('SELECT a.*, p.exam_id, e.teacher_id, e.unit_id FROM exam_answers a JOIN exam_participants p ON p.id = a.participant_id JOIN exams e ON e.id = p.exam_id WHERE a.id = ?').bind(Number(c.params.id)).first()
  if (!a) return error('Jawaban tidak ditemukan.', 404)
  const exam = await c.db.prepare('SELECT * FROM exams WHERE id = ?').bind(a.exam_id).first()
  if (!(await canManageExam(c, exam))) return error('Anda tidak berwenang menilai jawaban ini.', 403)
  const q = await c.db.prepare('SELECT * FROM question_bank WHERE id = ?').bind(a.question_id).first()
  if (!q || q.type !== 'essay') return error('Hanya jawaban uraian yang dapat dinilai manual.', 422)
  const { score, feedback } = c.body || {}
  const v = Number(score)
  if (score === '' || score == null || isNaN(v) || v < 0 || v > 100) return error('Nilai uraian harus berupa angka antara 0 dan 100.', 422)
  await c.db.prepare('UPDATE exam_answers SET score = ?, feedback = ?, graded_by = ?, graded_at = ? WHERE id = ?')
    .bind(v, feedback || '', c.user.teacher_id || c.user.id, new Date().toISOString(), a.id).run()
  await recomputeParticipant(c.db, a.participant_id)
  await audit(c.db, c.user, 'Menilai jawaban uraian', 'exam_answers', a.id, `Nilai uraian ${v} untuk jawaban peserta ${a.participant_id}.`, a.unit_id)
  return json({ ok: true })
})

add('POST', '/api/exams/:id/publish', async (c) => {
  const exam = await c.db.prepare('SELECT * FROM exams WHERE id = ?').bind(Number(c.params.id)).first()
  if (!exam) return error('Ujian tidak ditemukan.', 404)
  if (!(await canManageExam(c, exam)) && c.user.role !== 'super_admin') return error('Anda tidak berwenang mempublikasikan hasil ujian ini.', 403)
  const mode = (c.body || {}).mode === 'all' ? 'all' : 'graded'
  const where = mode === 'all' ? "status IN ('submitted','graded')" : "status = 'graded'"
  const info = await c.db.prepare(`UPDATE exam_participants SET published = 1 WHERE exam_id = ? AND ${where}`).bind(exam.id).run()
  const n = info.meta ? info.meta.changes : 0
  if (exam.status === 'published') await c.db.prepare("UPDATE exams SET status = 'closed' WHERE id = ?").bind(exam.id).run()
  await audit(c.db, c.user, 'Mempublikasikan hasil ujian', 'exams', exam.id, `Hasil ujian "${exam.title}" dipublikasikan untuk ${n} peserta (mode ${mode}).`, exam.unit_id)
  return json({ ok: true, published: n })
})

// ------------------------------------------------------------- pengerjaan ujian oleh siswa
add('POST', '/api/exam/:id/start', async (c) => {
  if (c.user.role !== 'siswa') return error('Hanya siswa yang dapat memulai ujian.', 403)
  const data = await examWithQuestions(c.db, Number(c.params.id))
  if (!data) return error('Ujian tidak ditemukan.', 404)
  const { exam, questions } = data
  if (!(await studentCanTake(c, exam))) return error('Ujian ini tidak tersedia untuk Anda.', 403)
  if (!questions.length) return error('Ujian belum memiliki soal.', 422)
  const state = windowState(exam)
  if (state === 'belum_mulai') return error(`Ujian baru dimulai pada ${exam.start_at}.`, 422)
  if (state === 'berakhir') return error('Waktu ujian telah berakhir.', 422)
  const p = await c.db.prepare('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?').bind(exam.id, c.scope.studentId).first()
  if (['submitted', 'graded'].includes(p.status)) return error('Anda sudah mengirim jawaban ujian ini.', 422)
  if (p.status === 'not_started') {
    await c.db.prepare("UPDATE exam_participants SET status = 'in_progress', started_at = ? WHERE id = ?").bind(new Date().toISOString(), p.id).run()
    await audit(c.db, c.user, 'Memulai ujian', 'exam_participants', p.id, `Siswa ${c.user.name} memulai ujian "${exam.title}".`, c.user.unit_id)
  }
  const answers = (await c.db.prepare('SELECT question_id, answer, saved_at FROM exam_answers WHERE participant_id = ?').bind(p.id).all()).results
  const deadline = new Date(Math.min(new Date(exam.end_at).getTime(), new Date(p.started_at || Date.now()).getTime() + Number(exam.duration_minutes) * 60000)).toISOString()
  return json({ exam: { ...exam, class_name: null, question_count: questions.length }, questions: questions.map(publicQuestion), answers, deadline, participant_id: p.id })
})

add('POST', '/api/exam/:id/answer', async (c) => {
  if (c.user.role !== 'siswa') return error('Hanya siswa yang dapat menyimpan jawaban.', 403)
  const exam = await c.db.prepare('SELECT * FROM exams WHERE id = ?').bind(Number(c.params.id)).first()
  if (!exam) return error('Ujian tidak ditemukan.', 404)
  if (!(await studentCanTake(c, exam))) return error('Ujian ini tidak tersedia untuk Anda.', 403)
  const p = await c.db.prepare('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?').bind(exam.id, c.scope.studentId).first()
  if (!p) return error('Anda tidak terdaftar sebagai peserta ujian ini.', 403)
  if (p.status === 'not_started') return error('Mulai ujian terlebih dahulu.', 422)
  if (['submitted', 'graded'].includes(p.status)) return error('Jawaban sudah dikirim dan tidak dapat diubah.', 422)
  if (new Date(exam.end_at) < new Date()) { await autoSubmit(c.db, exam, p); return error('Waktu ujian telah berakhir. Jawaban Anda otomatis dikirim.', 422) }
  const deadline = new Date(new Date(p.started_at || Date.now()).getTime() + Number(exam.duration_minutes) * 60000)
  if (deadline < new Date() && new Date(exam.end_at) > new Date()) { await autoSubmit(c.db, exam, p); return error('Durasi ujian telah habis. Jawaban Anda otomatis dikirim.', 422) }
  const { question_id, answer } = c.body || {}
  const q = await c.db.prepare('SELECT * FROM question_bank WHERE id = ?').bind(Number(question_id)).first()
  if (!q) return error('Soal tidak ditemukan.', 404)
  const inExam = await c.db.prepare('SELECT id FROM exam_questions WHERE exam_id = ? AND question_id = ?').bind(exam.id, q.id).first()
  if (!inExam) return error('Soal tidak termasuk dalam ujian ini.', 422)
  const existing = await c.db.prepare('SELECT * FROM exam_answers WHERE participant_id = ? AND question_id = ?').bind(p.id, q.id).first()
  const correct = q.type === 'essay' ? null : gradeObjective(q.type, answer, q.answer_key)
  const nowIso = new Date().toISOString()
  if (existing) {
    await c.db.prepare('UPDATE exam_answers SET answer = ?, is_correct = ?, score = ?, saved_at = ? WHERE id = ?')
      .bind(answer == null ? null : String(answer), correct, correct, nowIso, existing.id).run()
  } else {
    await c.db.prepare('INSERT INTO exam_answers (participant_id, question_id, answer, is_correct, score, saved_at, is_demo) VALUES (?,?,?,?,?,?,1)')
      .bind(p.id, q.id, answer == null ? null : String(answer), correct, correct, nowIso).run()
  }
  return json({ ok: true, saved_at: nowIso })
})

add('POST', '/api/exam/:id/submit', async (c) => {
  if (c.user.role !== 'siswa') return error('Hanya siswa yang dapat mengirim jawaban.', 403)
  const exam = await c.db.prepare('SELECT * FROM exams WHERE id = ?').bind(Number(c.params.id)).first()
  if (!exam) return error('Ujian tidak ditemukan.', 404)
  const p = await c.db.prepare('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?').bind(exam.id, c.scope.studentId).first()
  if (!p) return error('Anda tidak terdaftar sebagai peserta ujian ini.', 403)
  if (['submitted', 'graded'].includes(p.status)) return error('Jawaban sudah pernah dikirim.', 422)
  const res = await autoSubmit(c.db, exam, p)
  await audit(c.db, c.user, 'Mengirim jawaban ujian', 'exam_participants', p.id, `Siswa ${c.user.name} mengirim jawaban ujian "${exam.title}".`, c.user.unit_id)
  return json({ ok: true, ...res })
})

async function recomputeParticipant(db, participantId) {
  const p = await db.prepare('SELECT * FROM exam_participants WHERE id = ?').bind(participantId).first()
  if (!p) return null
  const questions = (await db.prepare('SELECT eq.weight, q.id AS question_id, q.type FROM exam_questions eq JOIN question_bank q ON q.id = eq.question_id WHERE eq.exam_id = ?').bind(p.exam_id).all()).results
  const answers = (await db.prepare('SELECT * FROM exam_answers WHERE participant_id = ?').bind(participantId).all()).results
  const s = computeScores(questions, answers)
  const status = ['submitted', 'graded'].includes(p.status) ? (s.essaysPending > 0 || s.final == null ? 'submitted' : 'graded') : p.status
  await db.prepare('UPDATE exam_participants SET objective_score = ?, essay_score = ?, final_score = ?, status = ? WHERE id = ?')
    .bind(s.objective, s.essay, s.final, status, participantId).run()
  return s
}

async function autoSubmit(db, exam, participant) {
  const questions = (await db.prepare('SELECT eq.weight, q.id AS question_id, q.type, q.answer_key FROM exam_questions eq JOIN question_bank q ON q.id = eq.question_id WHERE eq.exam_id = ?').bind(exam.id).all()).results
  const answers = (await db.prepare('SELECT * FROM exam_answers WHERE participant_id = ?').bind(participant.id).all()).results
  for (const q of questions) {
    if (q.type === 'essay') continue
    const a = answers.find((x) => x.question_id === q.question_id)
    const correct = a ? gradeObjective(q.type, a.answer, q.answer_key) : 0
    if (a) await db.prepare('UPDATE exam_answers SET is_correct = ?, score = ? WHERE id = ?').bind(correct, correct, a.id).run()
    else await db.prepare('INSERT INTO exam_answers (participant_id, question_id, answer, is_correct, score, saved_at, is_demo) VALUES (?,?,?,?,?,?,1)').bind(participant.id, q.question_id, null, 0, 0, new Date().toISOString()).run()
  }
  const s = await recomputeParticipant(db, participant.id)
  const fresh = await db.prepare('SELECT status FROM exam_participants WHERE id = ?').bind(participant.id).first()
  if (['submitted', 'graded'].includes(fresh.status) === false) {
    await db.prepare("UPDATE exam_participants SET status = 'submitted', submitted_at = ? WHERE id = ?").bind(new Date().toISOString(), participant.id).run()
  } else {
    await db.prepare('UPDATE exam_participants SET submitted_at = ? WHERE id = ? AND submitted_at IS NULL').bind(new Date().toISOString(), participant.id).run()
  }
  return { objective_score: s.objective, essay_score: s.essay, final_score: s.final, essays_pending: s.essaysPending, status: fresh.status }
}

add('GET', '/api/exam/:id/attempt', async (c) => {
  const exam = await c.db.prepare('SELECT * FROM exams WHERE id = ?').bind(Number(c.params.id)).first()
  if (!exam) return error('Ujian tidak ditemukan.', 404)
  if (c.user.role !== 'siswa') {
    if (!(await canManageExam(c, exam)) && !['super_admin', 'pengawas'].includes(c.user.role)) return error('Anda tidak berwenang membuka hasil ujian ini.', 403)
  }
  const studentId = c.user.role === 'siswa' ? c.scope.studentId : Number(c.query.get('student_id'))
  const p = await c.db.prepare('SELECT * FROM exam_participants WHERE exam_id = ? AND student_id = ?').bind(exam.id, studentId).first()
  if (!p) return error('Data pengerjaan tidak ditemukan.', 404)
  const questions = (await c.db.prepare(
    `SELECT eq.order_no, eq.weight, q.id AS question_id, q.type, q.question, q.options, q.answer_key, q.explanation FROM exam_questions eq JOIN question_bank q ON q.id = eq.question_id WHERE eq.exam_id = ? ORDER BY eq.order_no`).bind(exam.id).all()).results
  const answers = (await c.db.prepare('SELECT * FROM exam_answers WHERE participant_id = ?').bind(p.id).all()).results
  const showKeys = c.user.role !== 'siswa'
  const showResult = c.user.role !== 'siswa' || (exam.show_result === 1 && p.published === 1)
  return json({
    exam: { id: exam.id, title: exam.title, duration_minutes: exam.duration_minutes, show_result: exam.show_result },
    participant: { id: p.id, status: p.status, started_at: p.started_at, submitted_at: p.submitted_at, objective_score: showResult ? p.objective_score : null, essay_score: showResult ? p.essay_score : null, final_score: showResult ? p.final_score : null, published: p.published },
    questions: questions.map((q) => {
      const a = answers.find((x) => x.question_id === q.question_id)
      return {
        ...q, options: q.options ? JSON.parse(q.options) : null,
        answer: a ? a.answer : null, is_correct: showResult ? (a ? a.is_correct : 0) : null,
        score: showResult ? (a ? a.score : null) : null, feedback: showResult && a ? a.feedback : null,
        answer_key: showKeys ? q.answer_key : null, explanation: showKeys ? q.explanation : null,
      }
    }),
    result_visible: showResult,
  })
})

add('GET', '/api/exam/results', async (c) => {
  const examId = Number(c.query.get('exam_id'))
  const exam = await c.db.prepare('SELECT * FROM exams WHERE id = ?').bind(examId).first()
  if (!exam) return error('Ujian tidak ditemukan.', 404)
  if (c.user.role === 'siswa') return error('Gunakan halaman hasil ujian siswa untuk melihat nilai Anda.', 403)
  if (c.scope.kind === 'unit' && Number(exam.unit_id) !== Number(c.scope.unitId)) return error('Ujian berada di luar unit Anda.', 403)
  const rows = (await c.db.prepare(
    `SELECT p.*, s.name AS student_name, s.nis FROM exam_participants p JOIN students s ON s.id = p.student_id WHERE p.exam_id = ? ORDER BY s.name`).bind(examId).all()).results
  const scores = rows.filter((r) => r.final_score != null).map((r) => Number(r.final_score))
  const buckets = { '<60': 0, '60-69': 0, '70-79': 0, '80-89': 0, '90-100': 0 }
  for (const s of scores) buckets[s < 60 ? '<60' : s < 70 ? '60-69' : s < 80 ? '70-79' : s < 90 ? '80-89' : '90-100']++
  return json({
    exam: { id: exam.id, title: exam.title, status: exam.status, duration_minutes: exam.duration_minutes, show_result: exam.show_result },
    summary: {
      participants: rows.length, submitted: rows.filter((r) => ['submitted', 'graded'].includes(r.status)).length,
      graded: rows.filter((r) => r.status === 'graded').length, pending_review: rows.filter((r) => r.status === 'submitted').length,
      published: rows.filter((r) => r.published).length,
      average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
      highest: scores.length ? Math.max(...scores) : null, lowest: scores.length ? Math.min(...scores) : null,
      pass_rate: scores.length ? Math.round((scores.filter((s) => s >= 75).length / scores.length) * 1000) / 10 : null,
      buckets,
    },
    data: rows,
  })
})

export default routes
