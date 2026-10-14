// PIAT 6 Madrasah Management System - skema database & data demo
export const SCHEMA_VERSION = '1.0.0'
export const SEED_VERSION = 'demo-2026.1'

export const DDL = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS units (id INTEGER PRIMARY KEY, code TEXT UNIQUE, name TEXT, level TEXT, address TEXT, head_teacher_id INTEGER, is_demo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS academic_years (id INTEGER PRIMARY KEY, name TEXT UNIQUE, start_date TEXT, end_date TEXT, is_active INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS semesters (id INTEGER PRIMARY KEY, academic_year_id INTEGER, name TEXT, term INTEGER, start_date TEXT, end_date TEXT, is_active INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS teachers (id INTEGER PRIMARY KEY, nip TEXT UNIQUE, name TEXT, gender TEXT, unit_id INTEGER, position TEXT, status TEXT DEFAULT 'aktif', email TEXT, phone TEXT, is_demo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, name TEXT, password_hash TEXT, role TEXT, unit_id INTEGER, teacher_id INTEGER, student_id INTEGER, is_active INTEGER DEFAULT 1, is_demo INTEGER DEFAULT 1, created_at TEXT, last_login TEXT);
CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY, name TEXT, level INTEGER, unit_id INTEGER, academic_year_id INTEGER, homeroom_teacher_id INTEGER, capacity INTEGER DEFAULT 32, is_demo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY, nis TEXT UNIQUE, nisn TEXT, name TEXT, gender TEXT, unit_id INTEGER, class_id INTEGER, birth_place TEXT, birth_date TEXT, address TEXT, parent_name TEXT, parent_phone TEXT, status TEXT DEFAULT 'aktif', entry_year TEXT, is_demo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY, code TEXT UNIQUE, name TEXT, unit_id INTEGER, category TEXT, is_demo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS class_subjects (id INTEGER PRIMARY KEY, class_id INTEGER, subject_id INTEGER, teacher_id INTEGER, academic_year_id INTEGER, semester_id INTEGER, kkm INTEGER DEFAULT 75, hours INTEGER DEFAULT 2, is_demo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS schedules (id INTEGER PRIMARY KEY, class_id INTEGER, class_subject_id INTEGER, day TEXT, period INTEGER, start_time TEXT, end_time TEXT, room TEXT, is_demo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS attendance_students (id INTEGER PRIMARY KEY, student_id INTEGER, class_id INTEGER, date TEXT, schedule_id INTEGER DEFAULT 0, status TEXT, note TEXT, recorded_by INTEGER, updated_at TEXT, is_demo INTEGER DEFAULT 1, UNIQUE(student_id, date, schedule_id));
CREATE TABLE IF NOT EXISTS attendance_teachers (id INTEGER PRIMARY KEY, teacher_id INTEGER, unit_id INTEGER, date TEXT, status TEXT, note TEXT, recorded_by INTEGER, updated_at TEXT, is_demo INTEGER DEFAULT 1, UNIQUE(teacher_id, date));
CREATE TABLE IF NOT EXISTS assessment_components (id INTEGER PRIMARY KEY, class_subject_id INTEGER, name TEXT, type TEXT, weight INTEGER, semester_id INTEGER, academic_year_id INTEGER, is_demo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS scores (id INTEGER PRIMARY KEY, component_id INTEGER, student_id INTEGER, score REAL, updated_by INTEGER, updated_at TEXT, is_demo INTEGER DEFAULT 1, UNIQUE(component_id, student_id));
CREATE TABLE IF NOT EXISTS report_cards (id INTEGER PRIMARY KEY, student_id INTEGER, class_id INTEGER, unit_id INTEGER, semester_id INTEGER, academic_year_id INTEGER, average REAL, homeroom_note TEXT, status TEXT DEFAULT 'draft', published_at TEXT, updated_at TEXT, is_demo INTEGER DEFAULT 1, UNIQUE(student_id, semester_id));
CREATE TABLE IF NOT EXISTS promotion_decisions (id INTEGER PRIMARY KEY, student_id INTEGER, class_id INTEGER, academic_year_id INTEGER, to_class_id INTEGER, decision TEXT, note TEXT, decided_by INTEGER, decided_at TEXT, is_demo INTEGER DEFAULT 1, UNIQUE(student_id, academic_year_id));
CREATE TABLE IF NOT EXISTS lms_materials (id INTEGER PRIMARY KEY, title TEXT, description TEXT, type TEXT, class_subject_id INTEGER, class_id INTEGER, unit_id INTEGER, subject_id INTEGER, teacher_id INTEGER, content TEXT, url TEXT, status TEXT DEFAULT 'published', created_at TEXT, is_demo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS lms_assignments (id INTEGER PRIMARY KEY, title TEXT, instructions TEXT, class_subject_id INTEGER, class_id INTEGER, unit_id INTEGER, subject_id INTEGER, teacher_id INTEGER, semester_id INTEGER, due_date TEXT, max_score REAL DEFAULT 100, weight INTEGER DEFAULT 20, allow_late INTEGER DEFAULT 0, status TEXT DEFAULT 'draft', created_at TEXT, is_demo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS lms_submissions (id INTEGER PRIMARY KEY, assignment_id INTEGER, student_id INTEGER, content TEXT, file_name TEXT, submitted_at TEXT, status TEXT DEFAULT 'submitted', score REAL, feedback TEXT, graded_by INTEGER, graded_at TEXT, is_demo INTEGER DEFAULT 1, UNIQUE(assignment_id, student_id));
CREATE TABLE IF NOT EXISTS question_bank (id INTEGER PRIMARY KEY, unit_id INTEGER, subject_id INTEGER, class_level INTEGER, topic TEXT, type TEXT, question TEXT, options TEXT, answer_key TEXT, explanation TEXT, weight REAL DEFAULT 1, difficulty TEXT, status TEXT DEFAULT 'draft', created_by INTEGER, created_at TEXT, is_demo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS exams (id INTEGER PRIMARY KEY, title TEXT, unit_id INTEGER, subject_id INTEGER, class_id INTEGER, teacher_id INTEGER, academic_year_id INTEGER, semester_id INTEGER, exam_date TEXT, start_at TEXT, end_at TEXT, duration_minutes INTEGER, instructions TEXT, shuffle_questions INTEGER DEFAULT 0, shuffle_options INTEGER DEFAULT 0, status TEXT DEFAULT 'draft', show_result INTEGER DEFAULT 1, created_at TEXT, is_demo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS exam_questions (id INTEGER PRIMARY KEY, exam_id INTEGER, question_id INTEGER, order_no INTEGER, weight REAL DEFAULT 1, UNIQUE(exam_id, question_id));
CREATE TABLE IF NOT EXISTS exam_participants (id INTEGER PRIMARY KEY, exam_id INTEGER, student_id INTEGER, status TEXT DEFAULT 'not_started', started_at TEXT, submitted_at TEXT, objective_score REAL, essay_score REAL, final_score REAL, published INTEGER DEFAULT 0, is_demo INTEGER DEFAULT 1, UNIQUE(exam_id, student_id));
CREATE TABLE IF NOT EXISTS exam_answers (id INTEGER PRIMARY KEY, participant_id INTEGER, question_id INTEGER, answer TEXT, is_correct INTEGER, score REAL, feedback TEXT, graded_by INTEGER, graded_at TEXT, saved_at TEXT, is_demo INTEGER DEFAULT 1, UNIQUE(participant_id, question_id));
CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY, actor_user_id INTEGER, actor_name TEXT, role TEXT, unit_id INTEGER, action TEXT, entity TEXT, entity_id TEXT, detail TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, description TEXT);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_cs_class ON class_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_cs_teacher ON class_subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_att_student ON attendance_students(student_id, date);
CREATE INDEX IF NOT EXISTS idx_att_date ON attendance_students(date);
CREATE INDEX IF NOT EXISTS idx_scores_student ON scores(student_id);
CREATE INDEX IF NOT EXISTS idx_comp_cs ON assessment_components(class_subject_id);
CREATE INDEX IF NOT EXISTS idx_part_exam ON exam_participants(exam_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
`

export const DEFAULT_SETTINGS = [
  ['app_name', 'PIAT 6 Madrasah Management System', 'Nama aplikasi'],
  ['kkm_default', '75', 'Nilai KKM default (Ketuntasan Minimal)'],
  ['attendance_alert_percent', '90', 'Ambang batas persentase kehadiran untuk peringatan'],
  ['promotion_min_average', '70', 'Rata-rata nilai minimal untuk rekomendasi naik kelas'],
  ['promotion_max_absence_percent', '15', 'Maksimal persentase ketidakhadiran untuk rekomendasi naik kelas'],
  ['promotion_require_scores', '1', 'Wajib lengkap nilai sebelum keputusan kenaikan kelas (1/0)'],
  ['report_require_complete', '1', 'Rapor hanya dapat diterbitkan bila nilai lengkap (1/0)'],
  ['lms_late_allowed', '0', 'Izinkan pengumpulan tugas melewati tenggat (1/0)'],
  ['demo_mode', '1', 'Tandai bahwa aplikasi berisi data demo (1/0)'],
]

export const DEMO_PASSWORD = 'piat6demo'

export const MTs_SUBJECTS = [
  ['QH', "Al-Qur'an Hadis", 'PAI'], ['FIQ', 'Fikih', 'PAI'], ['AQA', 'Akidah Akhlak', 'PAI'],
  ['SKI', 'Sejarah Kebudayaan Islam', 'PAI'], ['BAR', 'Bahasa Arab', 'Bahasa'],
  ['PPKN', 'Pendidikan Pancasila', 'Umum'], ['BIN', 'Bahasa Indonesia', 'Umum'],
  ['MAT', 'Matematika', 'Umum'], ['IPA', 'Ilmu Pengetahuan Alam', 'Umum'],
  ['IPS', 'Ilmu Pengetahuan Sosial', 'Umum'], ['BIG', 'Bahasa Inggris', 'Umum'],
  ['PJOK', 'PJOK', 'Umum'], ['INF', 'Informatika', 'Umum'], ['BJW', 'Bahasa Jawa', 'Muatan Lokal'],
]
export const MA_SUBJECTS = [
  ['MAQH', "Al-Qur'an Hadis", 'PAI'], ['MAFIQ', 'Fikih', 'PAI'], ['MAAQA', 'Akidah Akhlak', 'PAI'],
  ['MASK', 'Sejarah Kebudayaan Islam', 'PAI'], ['MABAR', 'Bahasa Arab', 'Bahasa'],
  ['MAPPKN', 'Pendidikan Pancasila', 'Umum'], ['MABIN', 'Bahasa Indonesia', 'Umum'],
  ['MAMAT', 'Matematika', 'Umum'], ['MABIG', 'Bahasa Inggris', 'Umum'],
  ['MAFIS', 'Fisika', 'Peminatan'], ['MAKIM', 'Kimia', 'Peminatan'], ['MABIO', 'Biologi', 'Peminatan'],
  ['MAEKO', 'Ekonomi', 'Peminatan'], ['MASEJ', 'Sejarah Indonesia', 'Umum'], ['MAGEO', 'Geografi', 'Peminatan'],
  ['MAPJOK', 'PJOK', 'Umum'], ['MAINF', 'Informatika', 'Umum'], ['MASBD', 'Seni Budaya', 'Umum'],
]

export const TEACHERS = [
  ['19820312', 'Ust. Ahmad Fauzi, S.Pd.I', 'L', 1, 'Kepala Madrasah MTs'],
  ['19870415', 'Ust. Zainal Abidin, S.Pd', 'L', 1, 'Guru Matematika'],
  ['19900120', 'Ustzh. Nur Hidayah, S.Pd', 'P', 1, 'Guru Bahasa Indonesia'],
  ['19880905', 'Ust. Ridwan Hakim, S.Ag', 'L', 1, 'Guru Fikih'],
  ['19920311', 'Ustzh. Siti Maryam, S.Pd.I', 'P', 1, "Guru Al-Qur'an Hadis"],
  ['19910722', 'Ust. Fahmi Idris, S.Pd', 'L', 1, 'Guru IPA'],
  ['19891130', 'Ust. Bambang Setyo, S.Pd', 'L', 1, 'Guru IPS'],
  ['19940618', 'Ustzh. Laila Nurjanah, S.Pd', 'P', 1, 'Guru Bahasa Inggris'],
  ['19870504', 'Ust. Syamsul Arifin, S.Pd.I', 'L', 1, 'Guru SKI'],
  ['19900825', 'Ust. Hendra Gunawan, S.Pd', 'L', 1, 'Guru PJOK'],
  ['19950914', 'Ustzh. Rina Kartika, S.Kom', 'P', 1, 'Guru Informatika'],
  ['19860217', 'Ust. Yusuf Mansur, S.Hum', 'L', 1, 'Guru Bahasa Arab'],
  ['19780521', 'Drs. H. Abdul Karim, M.Pd', 'L', 2, 'Kepala Madrasah MA'],
  ['19860719', 'Ust. Muhammad Iqbal, S.Pd', 'L', 2, 'Guru Matematika'],
  ['19910305', 'Ustzh. Aisyah Rahma, S.Pd', 'P', 2, 'Guru Bahasa Indonesia'],
  ['19841122', 'Ust. Nur Kholis, M.Ag', 'L', 2, 'Guru Fikih'],
  ['19890928', 'Ust. Ali Mustofa, S.Pd', 'L', 2, 'Guru Fisika'],
  ['19920711', 'Ustzh. Halimah Sadiyah, S.Si', 'P', 2, 'Guru Kimia'],
  ['19880308', 'Ust. Bagus Prasetyo, S.Pd', 'L', 2, 'Guru Biologi'],
  ['19930226', 'Ustzh. Endang Wulandari, S.Pd', 'P', 2, 'Guru Bahasa Inggris'],
  ['19870613', 'Ust. Taufik Hidayat, S.E', 'L', 2, 'Guru Ekonomi'],
  ['19911209', 'Ust. Robi Setiawan, S.Pd', 'L', 2, 'Guru Sejarah dan Geografi'],
  ['19960108', 'Ust. Dimas Prayoga, S.Kom', 'L', 1, 'Operator Akademik MTs'],
  ['19970417', 'Ustzh. Nabila Zahra, S.Pd', 'P', 2, 'Operator Akademik MA'],
  ['19750903', 'Drs. Suryadi, M.Pd', 'L', 0, 'Pengawas Mutu (Lintas Unit)'],
]

export const CLASSES = [
  [1, 'VII A', 7, 1, 3], [2, 'VII B', 7, 1, 5], [3, 'VIII A', 8, 1, 6], [4, 'VIII B', 8, 1, 8], [5, 'IX A', 9, 1, 10],
  [6, 'X IPA', 10, 2, 15], [7, 'X IPS', 10, 2, 21], [8, 'XI IPA', 11, 2, 18], [9, 'XI IPS', 11, 2, 22], [10, 'XII IPA', 12, 2, 20],
]
const MTs_MAP = { QH: 5, FIQ: 4, AQA: 9, SKI: 9, BAR: 12, PPKN: 7, BIN: 3, MAT: 2, IPA: 6, IPS: 7, BIG: 8, PJOK: 10, INF: 11, BJW: 3 }
const MA_MAP = { MAQH: 16, MAFIQ: 16, MAAQA: 16, MASK: 22, MABAR: 16, MAPPKN: 22, MABIN: 15, MAMAT: 14, MABIG: 20, MAFIS: 17, MAKIM: 18, MABIO: 19, MAEKO: 21, MASEJ: 22, MAGEO: 22, MAPJOK: 17, MAINF: 14, MASBD: 15 }

const FIRST_L = ['Ahmad', 'Muhammad', 'Abdul', 'Rizki', 'Fauzan', 'Hafiz', 'Ilham', 'Salman', 'Umar', 'Yusuf', 'Ibrahim', 'Ismail', 'Bilal', 'Zaid', 'Farhan', 'Rafif']
const FIRST_P = ['Nur', 'Siti', 'Fatimah', 'Aisyah', 'Zahra', 'Khadijah', 'Maryam', 'Hafsah', 'Rahma', 'Dewi', 'Putri', 'Ayu', 'Salma', 'Alifa', 'Nadia', 'Kamila']
const LAST = ['Ramadhan', 'Hidayat', 'Safitri', 'Maulana', 'Firdaus', 'Azzahra', 'Wibowo', 'Santoso', 'Kurniawan', 'Pratama', 'Nabila', 'Jannah', 'Mubarok', 'Rahmawati', 'Salsabila', 'Hakim', 'Zaki', 'Fahri']
const PARENT_F = ['Bpk. Sukirman', 'Bpk. Sutrisno', 'Bpk. Hariyanto', 'Bpk. Muhammad Yasin', 'Bpk. Abdul Ghofur', 'Bpk. Syaiful Anwar', 'Bpk. Edi Susanto', 'Bpk. Agus Salim']
const CITIES = ['Bondowoso', 'Jember', 'Situbondo', 'Banyuwangi', 'Probolinggo', 'Malang']
const VILLAGES = ['Sumberwringin', 'Tengaran', 'Wringin', 'Sukosari', 'Tegalampel', 'Klabang', 'Curahdami']

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function iso(d) { return new Date(d).toISOString().slice(0, 10) }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export function isSunday(d) { return new Date(d).getDay() === 0 }

export function bytesToHex(bytes) { return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('') }
export function hexToBytes(hex) { const out = new Uint8Array(hex.length / 2); for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16); return out }
export function randomHex(n) { const b = new Uint8Array(n); crypto.getRandomValues(b); return bytesToHex(b) }

export async function hashPassword(password, saltHex = randomHex(16), iterations = 100000) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' }, key, 256)
  return `pbkdf2$${iterations}$${saltHex}$${bytesToHex(new Uint8Array(bits))}`
}

export async function verifyPassword(password, stored) {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1]) || 100000
  const salt = parts[2]
  const expected = parts[3]
  const calc = await hashPassword(password, salt, iterations)
  return calc.split('$')[3] === expected
}

export async function bulkInsert(db, table, cols, rows, maxParams = 90) {
  if (!rows.length) return 0
  const chunk = Math.max(1, Math.floor(maxParams / cols.length))
  const stmts = []
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk)
    const ph = part.map(() => `(${cols.map(() => '?').join(',')})`).join(',')
    stmts.push(db.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES ${ph}`).bind(...part.flat()))
  }
  // Batch besar mengurangi jumlah perjalanan ke D1 saat seeding pertama kali
  // (penting pada D1 jarak jauh / produksi). Tetap di bawah batas 100 parameter per pernyataan.
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100))
  return rows.length
}

export const SEED_TABLES = ['units', 'academic_years', 'semesters', 'teachers', 'users', 'classes', 'students', 'subjects', 'class_subjects', 'schedules',
  'attendance_students', 'attendance_teachers', 'assessment_components', 'scores', 'report_cards', 'promotion_decisions',
  'lms_materials', 'lms_assignments', 'lms_submissions', 'question_bank', 'exams', 'exam_questions', 'exam_participants', 'exam_answers', 'audit_logs', 'settings']

// ---------------------------------------------------------------- data demo
export async function seedDemo(db) {
  const rand = mulberry32(20261013)
  const today = new Date()
  const now = new Date().toISOString()
  const summary = {}

  for (const t of SEED_TABLES) { try { await db.prepare(`DELETE FROM ${t}`).run() } catch (e) { void e } }

  // ---- unit pendidikan, tahun ajaran, semester
  await bulkInsert(db, 'units', ['id', 'code', 'name', 'level', 'address', 'head_teacher_id', 'is_demo'], [
    [1, 'MTS', 'MTs PIAT 6 Bondowoso', 'MTs', 'Jl. Raya Tengaran, Bondowoso', 1, 1],
    [2, 'MA', 'MA PIAT 6 Bondowoso', 'MA', 'Jl. Raya Tengaran, Bondowoso', 13, 1],
  ])
  await bulkInsert(db, 'academic_years', ['id', 'name', 'start_date', 'end_date', 'is_active'], [
    [1, '2025/2026', '2025-07-01', '2026-06-30', 0],
    [2, '2026/2027', '2026-07-01', '2027-06-30', 1],
  ])
  await bulkInsert(db, 'semesters', ['id', 'academic_year_id', 'name', 'term', 'start_date', 'end_date', 'is_active'], [
    [1, 1, 'Ganjil', 1, '2025-07-01', '2025-12-31', 0],
    [2, 1, 'Genap', 2, '2026-01-01', '2026-06-30', 0],
    [3, 2, 'Ganjil', 1, '2026-07-01', '2026-12-31', 1],
    [4, 2, 'Genap', 2, '2027-01-01', '2027-06-30', 0],
  ])
  await bulkInsert(db, 'settings', ['key', 'value', 'description'], DEFAULT_SETTINGS)

  // ---- guru & tenaga kependidikan
  const teacherRows = TEACHERS.map((t, i) => [i + 1, t[0], t[1], t[2], t[3] || null, t[4], 'aktif', `guru${i + 1}@piat6.sch.id`, `0813${String(30000000 + i * 137).slice(0, 8)}`, 1])
  summary.teachers = await bulkInsert(db, 'teachers', ['id', 'nip', 'name', 'gender', 'unit_id', 'position', 'status', 'email', 'phone', 'is_demo'], teacherRows)

  // ---- mata pelajaran
  const subjectRows = []
  MTs_SUBJECTS.forEach((s, i) => subjectRows.push([i + 1, s[0], s[1], 1, s[2], 1]))
  MA_SUBJECTS.forEach((s, i) => subjectRows.push([20 + i, s[0], s[1], 2, s[2], 1]))
  await bulkInsert(db, 'subjects', ['id', 'code', 'name', 'unit_id', 'category', 'is_demo'], subjectRows)

  // ---- kelas
  await bulkInsert(db, 'classes', ['id', 'name', 'level', 'unit_id', 'academic_year_id', 'homeroom_teacher_id', 'capacity', 'is_demo'],
    CLASSES.map((c) => [c[0], c[1], c[2], c[3], 2, c[4], 32, 1]))

  // ---- siswa
  const studentRows = []
  const classStudents = {}
  let sid = 0
  for (const c of CLASSES) {
    const [cid, , level, unitId] = c
    classStudents[cid] = []
    for (let i = 0; i < 16; i++) {
      sid++
      const female = rand() < 0.48
      const first = female ? FIRST_P[Math.floor(rand() * FIRST_P.length)] : FIRST_L[Math.floor(rand() * FIRST_L.length)]
      const name = `${first} ${LAST[Math.floor(rand() * LAST.length)]}`
      const bd = addDays(new Date(level <= 9 ? 2013 : 2009, Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)), 0)
      studentRows.push([sid, `${unitId === 1 ? 'MTS' : 'MA'}-2026-${String(sid).padStart(4, '0')}`, `00${String(10000000 + sid * 7).slice(0, 8)}`, name,
        female ? 'P' : 'L', unitId, cid, CITIES[Math.floor(rand() * CITIES.length)], iso(bd),
        `Dusun ${VILLAGES[Math.floor(rand() * VILLAGES.length)]}, Kec. Tengaran, Kab. Bondowoso`,
        PARENT_F[Math.floor(rand() * PARENT_F.length)], `0813${String(40000000 + sid * 31).slice(0, 8)}`, 'aktif', '2026/2027', 1])
      classStudents[cid].push(sid)
    }
  }
  summary.students = await bulkInsert(db, 'students', ['id', 'nis', 'nisn', 'name', 'gender', 'unit_id', 'class_id', 'birth_place', 'birth_date', 'address', 'parent_name', 'parent_phone', 'status', 'entry_year', 'is_demo'], studentRows)

  // ---- penugasan mata pelajaran per kelas (guru pengampu)
  const csRows = []
  const csByClass = {}
  let csid = 0
  for (const c of CLASSES) {
    const [cid, , , unitId] = c
    csByClass[cid] = []
    const list = unitId === 1 ? MTs_SUBJECTS.slice(0, 13).map((s) => s[0])
      : (cid === 6 || cid === 8 || cid === 10 ? ['MAQH', 'MAFIQ', 'MAAQA', 'MASK', 'MABAR', 'MAPPKN', 'MABIN', 'MAMAT', 'MABIG', 'MAFIS', 'MAKIM', 'MABIO']
        : ['MAQH', 'MAFIQ', 'MAAQA', 'MASK', 'MABAR', 'MAPPKN', 'MABIN', 'MAMAT', 'MABIG', 'MAEKO', 'MASEJ', 'MAGEO'])
    for (const code of list) {
      const subj = subjectRows.find((s) => s[1] === code)
      csid++
      csByClass[cid].push(csid)
      csRows.push([csid, cid, subj[0], unitId === 1 ? MTs_MAP[code] : MA_MAP[code], 2, 3, 75, 2, 1])
    }
  }
  summary.classSubjects = await bulkInsert(db, 'class_subjects', ['id', 'class_id', 'subject_id', 'teacher_id', 'academic_year_id', 'semester_id', 'kkm', 'hours', 'is_demo'], csRows)
  const csOf = (classId, code) => {
    const subj = subjectRows.find((s) => s[1] === code)
    return csRows.find((x) => x[1] === classId && x[2] === subj[0])
  }

  // ---- jadwal pelajaran
  const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const SLOTS = [['07:00', '08:20'], ['08:20', '09:40'], ['10:00', '11:20'], ['12:40', '14:00']]
  const schRows = []
  let schid = 0
  for (const c of CLASSES) {
    csByClass[c[0]].forEach((cs, i) => {
      const slot = Math.floor(i / DAYS.length) % SLOTS.length
      schid++
      schRows.push([schid, c[0], cs, DAYS[i % DAYS.length], slot + 1, SLOTS[slot][0], SLOTS[slot][1], `R-${c[0]}`, 1])
    })
  }
  summary.schedules = await bulkInsert(db, 'schedules', ['id', 'class_id', 'class_subject_id', 'day', 'period', 'start_time', 'end_time', 'room', 'is_demo'], schRows)

  // ---- presensi siswa (20 hari sekolah terakhir)
  const schoolDays = []
  let cursor = new Date(today)
  while (schoolDays.length < 20) { if (!isSunday(cursor)) schoolDays.push(iso(cursor)); cursor = addDays(cursor, -1) }
  schoolDays.reverse()
  const attRows = []
  let attid = 0
  for (const d of schoolDays) {
    for (const s of studentRows) {
      const r = rand()
      const status = r < 0.885 ? 'hadir' : r < 0.94 ? 'sakit' : r < 0.975 ? 'izin' : 'alpa'
      attid++
      attRows.push([attid, s[0], s[6], d, 0, status, '', 0, `${d}T07:30:00Z`, 1])
    }
  }
  summary.attendanceStudents = await bulkInsert(db, 'attendance_students', ['id', 'student_id', 'class_id', 'date', 'schedule_id', 'status', 'note', 'recorded_by', 'updated_at', 'is_demo'], attRows, 80)

  const tattRows = []
  let taid = 0
  for (const d of schoolDays) {
    for (const t of teacherRows) {
      const r = rand()
      const status = r < 0.9 ? 'hadir' : r < 0.945 ? 'izin' : r < 0.98 ? 'sakit' : 'tugas_luar'
      taid++
      tattRows.push([taid, t[0], t[4] || 1, d, status, '', 0, `${d}T07:00:00Z`, 1])
    }
  }
  summary.attendanceTeachers = await bulkInsert(db, 'attendance_teachers', ['id', 'teacher_id', 'unit_id', 'date', 'status', 'note', 'recorded_by', 'updated_at', 'is_demo'], tattRows, 80)

  // ---- komponen penilaian & nilai (semester berjalan + satu semester historis)
  const ability = {}
  for (const s of studentRows) ability[s[0]] = 58 + rand() * 38
  const COMPONENTS = { 3: [['Tugas', 'tugas', 20], ['Nilai Harian', 'harian', 30], ['PTS', 'uts', 25], ['PAS', 'uas', 25]], 2: [['Tugas', 'tugas', 25], ['Nilai Harian', 'harian', 25], ['UAS', 'uas', 50]] }
  const compRows = [], scoreRows = [], subjectScores = {}
  let compid = 0, scoreId = 0
  for (const cs of csRows) {
    const [id, classId, subjectId, teacherId] = cs
    for (const sem of [2, 3]) {
      const comps = COMPONENTS[sem].map(([name, type, weight]) => { compid++; compRows.push([compid, id, name, type, weight, sem, sem === 3 ? 2 : 1, 1]); return { id: compid, weight } })
      const bias = (subjectId % 7) * 1.8 - 6
      for (const studentId of classStudents[classId]) {
        let weighted = 0
        for (const c of comps) {
          const sc = Math.max(38, Math.min(100, Math.round(ability[studentId] + bias + (rand() * 16 - 8))))
          weighted += sc * c.weight
          scoreRows.push([++scoreId, c.id, studentId, sc, teacherId, now, 1])
        }
        const key = `${studentId}|${subjectId}`
        subjectScores[key] = subjectScores[key] || {}
        subjectScores[key][sem] = Math.round((weighted / 100) * 10) / 10
      }
    }
  }
  summary.components = await bulkInsert(db, 'assessment_components', ['id', 'class_subject_id', 'name', 'type', 'weight', 'semester_id', 'academic_year_id', 'is_demo'], compRows)
  summary.scores = await bulkInsert(db, 'scores', ['id', 'component_id', 'student_id', 'score', 'updated_by', 'updated_at', 'is_demo'], scoreRows, 80)

  // ---- rapor (mengacu pada nilai tersimpan)
  const rcRows = []
  let rcid = 0
  for (const s of studentRows) {
    for (const sem of [2, 3]) {
      const finals = Object.keys(subjectScores).filter((k) => k.startsWith(`${s[0]}|`)).map((k) => subjectScores[k][sem]).filter((v) => v != null)
      const avg = finals.length ? Math.round((finals.reduce((a, b) => a + b, 0) / finals.length) * 10) / 10 : 0
      const status = sem === 2 ? 'published' : (s[0] % 7 === 0 ? 'approved' : s[0] % 5 === 0 ? 'reviewed' : 'draft')
      const note = sem === 2 ? 'Pertahankan prestasi belajar dan tingkatkan kedisiplinan shalat berjamaah.' : ''
      rcid++
      rcRows.push([rcid, s[0], s[6], s[5], sem, sem === 3 ? 2 : 1, avg, note, status, sem === 2 ? '2026-06-25T02:00:00Z' : null, now, 1])
    }
  }
  summary.reportCards = await bulkInsert(db, 'report_cards', ['id', 'student_id', 'class_id', 'unit_id', 'semester_id', 'academic_year_id', 'average', 'homeroom_note', 'status', 'published_at', 'updated_at', 'is_demo'], rcRows)

  // ---- riwayat keputusan akademik periode lalu
  const pdRows = classStudents[1].slice(0, 4).map((st, i) => [i + 1, st, 1, 1, i === 3 ? null : 2, i === 3 ? 'mengulang' : 'naik', i === 3 ? 'Belum memenuhi kriteria nilai minimal.' : 'Memenuhi seluruh kriteria kenaikan kelas.', 1, '2026-06-28T02:00:00Z', 1])
  summary.promotions = await bulkInsert(db, 'promotion_decisions', ['id', 'student_id', 'class_id', 'academic_year_id', 'to_class_id', 'decision', 'note', 'decided_by', 'decided_at', 'is_demo'], pdRows)

  // ---- LMS: materi
  const materialDefs = [
    ['Pengantar Bilangan Bulat dan Operasinya', 'MAT', 1, 'text', 'Bilangan bulat terdiri dari bilangan positif, nol, dan negatif. Pelajari operasi penjumlahan dan pengurangan menggunakan garis bilangan, lalu kerjakan latihan pada bagian akhir materi.'],
    ['Lembar Latihan Bilangan Bulat', 'MAT', 1, 'link', 'https://example.org/latihan/bilangan-bulat'],
    ['Fikih: Thaharah dan Wudhu', 'FIQ', 1, 'text', 'Thaharah adalah bersuci dari hadas dan najis. Materi ini menjelaskan macam-macam air, tata cara wudhu, serta hal-hal yang membatalkannya.'],
    ['Video Panduan Praktik Wudhu', 'FIQ', 1, 'link', 'https://example.org/video/wudhu'],
    ['Struktur Teks Deskripsi', 'BIN', 1, 'text', 'Teks deskripsi menggambarkan objek secara rinci menggunakan pancaindra. Struktur: identifikasi, deskripsi bagian, dan simpulan.'],
    ["Al-Qur'an Hadis: Hukum Bacaan Mad", 'QH', 2, 'text', "Hukum bacaan mad thabi'i, mad wajib muttasil, dan mad jaiz munfasil beserta contoh ayat."],
    ['Hukum Newton dan Penerapannya', 'MAFIS', 6, 'text', 'Hukum Newton menjelaskan hubungan gaya, massa, dan percepatan. Pelajari ketiga hukum Newton beserta contoh gerak benda.'],
    ['Format Laporan Hasil Praktikum', 'MAFIS', 6, 'link', 'https://example.org/format/laporan-praktikum'],
    ['Persamaan dan Pertidaksamaan Linear', 'MAMAT', 6, 'text', 'Persamaan linear satu dan dua variabel, metode substitusi dan eliminasi, serta penerapan pada masalah kontekstual.'],
    ['Ekonomi: Kebutuhan dan Kelangkaan', 'MAEKO', 7, 'text', 'Konsep kebutuhan, kelangkaan, biaya peluang, dan sistem ekonomi.'],
  ]
  const matRows = materialDefs.map((m, i) => {
    const cs = csOf(m[2], m[1])
    return [i + 1, m[0], m[4] && m[3] === 'link' ? m[0] : m[0], m[3], cs[0], cs[1], cs[1] <= 5 ? 1 : 2, cs[2], cs[3], m[3] === 'text' ? m[4] : '', m[3] === 'link' ? m[4] : '', 'published', `${iso(addDays(today, -12 + i))}T02:00:00Z`, 1]
  })
  summary.materials = await bulkInsert(db, 'lms_materials', ['id', 'title', 'description', 'type', 'class_subject_id', 'class_id', 'unit_id', 'subject_id', 'teacher_id', 'content', 'url', 'status', 'created_at', 'is_demo'], matRows)

  // ---- LMS: tugas
  const assignDefs = [
    ['Latihan Bilangan Bulat', 'Kerjakan soal 1-10 pada buku paket halaman 24. Tuliskan langkah pengerjaan secara lengkap.', 'MAT', 1, -4, 'published'],
    ['Menulis Teks Deskripsi', 'Buatlah teks deskripsi minimal 3 paragraf tentang lingkungan madrasah.', 'BIN', 1, -2, 'published'],
    ['Rangkuman Thaharah', 'Buat rangkuman materi thaharah dan hafalkan doa sebelum berwudhu.', 'FIQ', 1, 2, 'published'],
    ["Analisis Hukum Bacaan Mad", "Analisis hukum bacaan pada QS. Al-Baqarah ayat 1-5, tuliskan minimal 5 contoh.", 'QH', 2, 1, 'published'],
    ['Laporan Praktikum Gerak Lurus', 'Susun laporan praktikum gerak lurus berdasarkan data percobaan di kelas.', 'MAFIS', 6, -1, 'published'],
    ['Latihan Persamaan Linear', 'Kerjakan 15 soal persamaan linear pada lembar kerja berikut.', 'MAMAT', 6, 3, 'published'],
    ['Kajian Kelangkaan dan Biaya Peluang', 'Buat ringkasan tentang kelangkaan dan biaya peluang beserta contoh nyata.', 'MAEKO', 7, 5, 'published'],
    ['Draft: Latihan Trigonometri', 'Soal trigonometri dasar untuk kelas XI (belum dipublikasikan).', 'MAMAT', 8, 7, 'draft'],
  ]
  const asgRows = assignDefs.map((a, i) => {
    const cs = csOf(a[3], a[2])
    return [i + 1, a[0], a[1], cs[0], cs[1], cs[1] <= 5 ? 1 : 2, cs[2], cs[3], 3, `${iso(addDays(today, a[4]))}T15:00:00Z`, 100, 20, 0, a[5], `${iso(addDays(today, a[4] - 7))}T02:00:00Z`, 1]
  })
  summary.assignments = await bulkInsert(db, 'lms_assignments', ['id', 'title', 'instructions', 'class_subject_id', 'class_id', 'unit_id', 'subject_id', 'teacher_id', 'semester_id', 'due_date', 'max_score', 'weight', 'allow_late', 'status', 'created_at', 'is_demo'], asgRows)

  // ---- LMS: pengumpulan tugas
  const subRows = []
  let subid = 0
  for (const aid of [1, 2, 3, 4, 5, 6, 7]) {
    const a = asgRows[aid - 1]
    classStudents[a[4]].forEach((st, idx) => {
      const roll = rand()
      if (roll < 0.62) {
        const graded = roll < 0.3
        subid++
        subRows.push([subid, aid, st, `Jawaban tugas "${a[1]}" dikumpulkan oleh siswa (ID ${st}). Ringkasan: pekerjaan telah diselesaikan sesuai instruksi guru.`,
          graded ? 'jawaban-siswa.pdf' : null, `${iso(addDays(today, a[4] + 1))}T10:${String(10 + idx).padStart(2, '0')}:00Z`,
          graded ? 'graded' : 'submitted', graded ? Math.round(70 + rand() * 28) : null,
          graded ? 'Pekerjaan sudah baik. Tingkatkan kerapian penulisan dan kelengkapan langkah.' : null,
          graded ? a[7] : null, graded ? `${iso(addDays(today, a[4] + 2))}T03:00:00Z` : null, 1])
      }
    })
  }
  summary.submissions = await bulkInsert(db, 'lms_submissions', ['id', 'assignment_id', 'student_id', 'content', 'file_name', 'submitted_at', 'status', 'score', 'feedback', 'graded_by', 'graded_at', 'is_demo'], subRows)
  return { summary, ctx: { today, now, rand, classStudents, studentRows, teacherRows, csRows, subjectRows, csOf, asgRows, schoolDays } }
}

// ---------------------------------------------------------------- bank soal, ujian CBT, audit
async function seedCbt(db, ctx) {
  const { today, now, rand, classStudents, subjectRows, teacherRows } = ctx
  const dstr = (n) => iso(addDays(today, n))
  const subjId = (code) => subjectRows.find((s) => s[1] === code)[0]
  const bank = []
  let qid = 0
  const addQ = (unitId, code, level, topic, type, question, options, key, explanation, difficulty, status = 'ready') => {
    qid++
    bank.push([qid, unitId, subjId(code), level, topic, type, question, options ? JSON.stringify(options) : null, key, explanation, 1, difficulty, status, code === 'MAT' ? 2 : 4, now, 1])
    return qid
  }
  const mtMat = [
    addQ(1, 'MAT', 7, 'Bilangan Bulat', 'multiple_choice', 'Hasil dari -18 + 25 - (-7) adalah ...', ['0', '14', '28', '36'], '14', '-18 + 25 = 7, lalu 7 + 7 = 14.', 'mudah'),
    addQ(1, 'MAT', 7, 'Bilangan Bulat', 'multiple_choice', 'Suhu di puncak gunung -5 derajat Celcius. Jika suhu naik 12 derajat, suhu akhir adalah ...', ['7 derajat Celcius', '-7 derajat Celcius', '17 derajat Celcius', '-17 derajat Celcius'], '7 derajat Celcius', '-5 + 12 = 7.', 'mudah'),
    addQ(1, 'MAT', 7, 'Pecahan', 'multiple_choice', 'Bentuk sederhana dari 18/24 adalah ...', ['2/3', '3/4', '4/5', '5/6'], '3/4', 'FPB dari 18 dan 24 adalah 6 sehingga 18/24 = 3/4.', 'mudah'),
    addQ(1, 'MAT', 7, 'Aljabar', 'multiple_choice', 'Nilai dari 3x - 5 jika x = 9 adalah ...', ['20', '22', '24', '27'], '22', '3(9) - 5 = 27 - 5 = 22.', 'sedang'),
    addQ(1, 'MAT', 7, 'Perbandingan', 'multiple_choice', 'Perbandingan uang A dan B adalah 3 : 5. Jika uang B Rp40.000, uang A adalah ...', ['Rp15.000', 'Rp24.000', 'Rp25.000', 'Rp30.000'], 'Rp24.000', '3/5 x 40.000 = 24.000.', 'sedang'),
    addQ(1, 'MAT', 7, 'Operasi Bilangan', 'true_false', 'Hasil perkalian dua bilangan negatif adalah bilangan positif.', null, 'true', 'Sesuai aturan perkalian bilangan bulat.', 'mudah'),
    addQ(1, 'MAT', 7, 'Persamaan Linear', 'true_false', 'Penyelesaian dari x + 7 = 3 adalah x = 10.', null, 'false', 'x = 3 - 7 = -4, bukan 10.', 'mudah'),
    addQ(1, 'MAT', 7, 'Bilangan Bulat', 'essay', 'Tentukan hasil dari (-12) x 8 + 96 : (-6) dan tuliskan langkah pengerjaan secara lengkap.', null, '-112', '(-12) x 8 = -96; 96 : (-6) = -16; sehingga -96 + (-16) = -112.', 'sedang'),
    addQ(1, 'MAT', 7, 'Pecahan', 'essay', 'Ibu memiliki 3/4 kg gula dan menggunakan 1/2 kg untuk membuat kue. Berapa kg gula yang tersisa? Jelaskan langkahmu.', null, '1/4 kg', '3/4 - 1/2 = 3/4 - 2/4 = 1/4 kg.', 'sedang'),
  ]
  const fikih = [
    addQ(1, 'FIQ', 7, 'Thaharah', 'multiple_choice', 'Air yang suci dan menyucikan disebut ...', ['air mutanajis', 'air mustakmal', 'air mutlak', 'air musyammas'], 'air mutlak', 'Air mutlak masih murni dan belum berubah sifatnya.', 'mudah'),
    addQ(1, 'FIQ', 7, 'Wudhu', 'multiple_choice', 'Hukum membasuh kedua tangan sampai siku saat wudhu adalah ...', ['sunah', 'wajib', 'mubah', 'makruh'], 'wajib', 'Merupakan salah satu rukun wudhu.', 'mudah'),
    addQ(1, 'FIQ', 7, 'Wudhu', 'multiple_choice', 'Berikut yang membatalkan wudhu adalah ...', ['makan', 'tidur nyenyak dengan dada menempel lantai', 'berbicara', 'berjalan'], 'tidur nyenyak dengan dada menempel lantai', 'Tidur nyenyak membatalkan wudhu.', 'sedang'),
    addQ(1, 'FIQ', 7, 'Thaharah', 'essay', 'Sebutkan tiga macam air yang tidak sah untuk berwudhu beserta alasannya.', null, 'air mutanajis, air mustakmal, air air musyammas', 'Air terkena najis tidak menyucikan, air mustakmal sudah dipakai bersuci, air musyammas berubah karena panas matahari.', 'sedang'),
    addQ(1, 'FIQ', 7, 'Shalat', 'essay', 'Jelaskan perbedaan rukun dan sunah dalam shalat beserta dua contoh masing-masing.', null, 'Rukun wajib dikerjakan; sunah menyempurnakan', 'Rukun tidak dapat ditinggalkan, sedangkan sunah bila ditinggalkan tidak membatalkan shalat.', 'sedang'),
  ]
  const maMat = [
    addQ(2, 'MAMAT', 10, 'Persamaan Linear', 'multiple_choice', 'Himpunan penyelesaian dari 2x + 3 = 11 adalah ...', ['{2}', '{4}', '{5}', '{7}'], '{4}', '2x = 8 sehingga x = 4.', 'mudah'),
    addQ(2, 'MAMAT', 10, 'Pertidaksamaan', 'multiple_choice', 'Penyelesaian dari 3x - 6 > 9 adalah ...', ['x > 5', 'x < 5', 'x > 3', 'x < 3'], 'x > 5', '3x > 15 sehingga x > 5.', 'sedang'),
    addQ(2, 'MAMAT', 10, 'Fungsi Kuadrat', 'multiple_choice', 'Titik puncak fungsi f(x) = x^2 - 6x + 5 adalah ...', ['(3, -4)', '(-3, -4)', '(3, 4)', '(6, 5)'], '(3, -4)', 'xp = -b/2a = 3; yp = 9 - 18 + 5 = -4.', 'sulit'),
    addQ(2, 'MAMAT', 10, 'Sistem Persamaan', 'multiple_choice', 'Jika x + y = 10 dan x - y = 4, maka nilai x adalah ...', ['3', '5', '7', '9'], '7', 'Jumlahkan kedua persamaan: 2x = 14 sehingga x = 7.', 'sedang'),
    addQ(2, 'MAMAT', 10, 'Sistem Persamaan', 'essay', 'Selesaikan sistem persamaan 2x + 3y = 16 dan x - y = 2 menggunakan metode substitusi. Tuliskan langkah lengkap.', null, 'x = 4,4 dan y = 2,4', 'Dari x - y = 2 diperoleh x = y + 2; substitusi ke 2(y+2) + 3y = 16 sehingga 5y = 12, y = 2,4 dan x = 4,4.', 'sulit'),
    addQ(2, 'MAMAT', 10, 'Fungsi Invers', 'essay', 'Diketahui f(x) = 2x + 5. Tentukan f-invers(x) dan hitung f-invers(1).', null, 'f-invers(x) = (x-5)/2 dan f-invers(1) = -2', 'Tukar x dan y: x = 2y + 5 sehingga y = (x-5)/2; f-invers(1) = -2.', 'sedang'),
  ]
  const fisika = [
    addQ(2, 'MAFIS', 10, 'Hukum Newton', 'multiple_choice', 'Benda bermassa 4 kg diberi gaya 12 N. Percepatan benda adalah ...', ['2 m/s2', '3 m/s2', '4 m/s2', '6 m/s2'], '3 m/s2', 'a = F/m = 12/4 = 3 m/s2.', 'mudah'),
    addQ(2, 'MAFIS', 10, 'Hukum Newton', 'multiple_choice', 'Pernyataan setiap aksi menimbulkan reaksi yang sama besar dan berlawanan arah merupakan ...', ['Hukum I Newton', 'Hukum II Newton', 'Hukum III Newton', 'Hukum Kekekalan Energi'], 'Hukum III Newton', 'Merupakan bunyi Hukum III Newton.', 'mudah'),
    addQ(2, 'MAFIS', 10, 'Gerak Lurus', 'true_false', 'Percepatan gravitasi tidak mempengaruhi gerak jatuh bebas di ruang hampa.', null, 'false', 'Di ruang hampa benda tetap jatuh dengan percepatan gravitasi g.', 'sedang'),
    addQ(2, 'MAFIS', 10, 'Gerak Lurus', 'essay', 'Sebuah mobil mula-mula diam lalu dipercepat 2 m/s2 selama 5 detik. Hitung kecepatan akhir dan jarak tempuhnya.', null, 'v = 10 m/s dan s = 25 m', 'v = a.t = 10 m/s; s = 1/2 a t^2 = 25 m.', 'sedang'),
    addQ(2, 'MAFIS', 10, 'Usaha dan Energi', 'essay', 'Jelaskan perbedaan energi kinetik dan energi potensial serta tuliskan rumusnya.', null, 'Ek = 1/2 m v^2 dan Ep = m g h', 'Energi kinetik berkaitan dengan gerak, energi potensial berkaitan dengan posisi atau ketinggian.', 'mudah'),
  ]
  const misc = [
    addQ(1, 'IPA', 7, 'Klasifikasi Makhluk Hidup', 'multiple_choice', 'Ilmu yang mempelajari pengelompokan makhluk hidup disebut ...', ['ekologi', 'taksonomi', 'genetika', 'anatomi'], 'taksonomi', 'Taksonomi mengelompokkan makhluk hidup berdasarkan ciri.', 'mudah'),
    addQ(1, 'BIN', 7, 'Teks Deskripsi', 'multiple_choice', 'Bagian teks deskripsi yang berisi gambaran objek secara rinci disebut ...', ['identifikasi', 'deskripsi bagian', 'simpulan', 'orientasi'], 'deskripsi bagian', 'Deskripsi bagian memuat perincian objek.', 'mudah'),
    addQ(1, 'BIG', 7, 'Tenses', 'multiple_choice', 'She ... to school every day.', ['go', 'goes', 'going', 'gone'], 'goes', 'Subjek orang ketiga tunggal memakai bentuk -s.', 'mudah'),
    addQ(1, 'QH', 7, 'Tajwid', 'multiple_choice', 'Bacaan mad yang panjangnya dua harakat dan tidak terpengaruh hamzah atau sukun adalah ...', ["mad thabi'i", 'mad wajib', 'mad jaiz', 'mad lazim'], "mad thabi'i", "Mad thabi'i dibaca dua harakat.", 'sedang'),
    addQ(1, 'MAT', 8, 'Teorema Pythagoras', 'multiple_choice', 'Segitiga siku-siku dengan sisi tegak 6 cm dan 8 cm memiliki sisi miring ...', ['10 cm', '12 cm', '14 cm', '16 cm'], '10 cm', 'akar(36 + 64) = 10 cm.', 'mudah'),
    addQ(1, 'MAT', 8, 'Statistika', 'essay', 'Diketahui data nilai: 7, 8, 6, 9, 8, 7, 10. Hitung rata-rata, median, dan modusnya.', null, 'rata-rata 7,86; median 8; modus 7 dan 8', 'Urutkan data lalu hitung ukuran pemusatan.', 'sedang'),
    addQ(2, 'MABIN', 10, 'Teks Eksposisi', 'multiple_choice', 'Ciri utama teks eksposisi adalah ...', ['mengandung konflik', 'memaparkan gagasan disertai fakta', 'berisi langkah-langkah', 'menggambarkan objek'], 'memaparkan gagasan disertai fakta', 'Eksposisi bersifat informatif dan berargumen.', 'mudah'),
    addQ(2, 'MAKIM', 10, 'Struktur Atom', 'multiple_choice', 'Jumlah proton dalam atom netral sama dengan ...', ['jumlah neutron', 'jumlah elektron', 'nomor massa', 'jumlah kulit'], 'jumlah elektron', 'Atom netral memiliki jumlah proton sama dengan elektron.', 'mudah'),
    addQ(2, 'MABIO', 10, 'Keanekaragaman Hayati', 'essay', 'Jelaskan tiga tingkat keanekaragaman hayati beserta contohnya.', null, 'gen, jenis, ekosistem', 'Keanekaragaman gen, jenis, dan ekosistem.', 'sedang'),
    addQ(1, 'IPS', 7, 'Interaksi Sosial', 'true_false', 'Interaksi sosial hanya dapat terjadi secara langsung atau tatap muka.', null, 'false', 'Interaksi juga dapat terjadi secara tidak langsung melalui media.', 'mudah'),
    addQ(2, 'MAEKO', 10, 'Kelangkaan', 'multiple_choice', 'Biaya peluang adalah ...', ['biaya yang dikeluarkan', 'nilai alternatif terbaik yang dikorbankan', 'harga pasar', 'biaya tetap'], 'nilai alternatif terbaik yang dikorbankan', 'Biaya peluang atau opportunity cost.', 'sedang'),
    addQ(1, 'INF', 8, 'Algoritma', 'multiple_choice', 'Urutan langkah logis untuk menyelesaikan masalah disebut ...', ['program', 'algoritma', 'struktur data', 'basis data'], 'algoritma', 'Definisi algoritma.', 'mudah'),
  ]
  const bankById = {}
  for (const b of bank) bankById[b[0]] = { id: b[0], type: b[5], options: b[7], answer_key: b[8] }
  await bulkInsert(db, 'question_bank', ['id', 'unit_id', 'subject_id', 'class_level', 'topic', 'type', 'question', 'options', 'answer_key', 'explanation', 'weight', 'difficulty', 'status', 'created_by', 'created_at', 'is_demo'], bank)

  const examDefs = [
    { id: 1, title: 'PTS Ganjil - Matematika Kelas VII A', unit: 1, code: 'MAT', classId: 1, teacher: 2, date: dstr(0), dur: 60, status: 'published', questions: mtMat, instr: 'Kerjakan seluruh soal dengan teliti. Ujian terdiri atas soal pilihan ganda, benar/salah, dan uraian. Waktu pengerjaan 60 menit.' },
    { id: 2, title: 'Ulangan Harian Fikih - Kelas VII A', unit: 1, code: 'FIQ', classId: 1, teacher: 4, date: dstr(-5), dur: 45, status: 'closed', questions: fikih, instr: 'Bacalah setiap soal dengan cermat sebelum menjawab.' },
    { id: 3, title: 'PTS Ganjil - Matematika Kelas X IPA', unit: 2, code: 'MAMAT', classId: 6, teacher: 14, date: dstr(-3), dur: 60, status: 'closed', questions: maMat, instr: 'Gunakan metode penyelesaian yang telah dipelajari di kelas.' },
    { id: 4, title: 'UH Fisika - Kelas X IPA', unit: 2, code: 'MAFIS', classId: 6, teacher: 17, date: dstr(0), dur: 45, status: 'published', questions: fisika, instr: 'Sertakan langkah perhitungan pada soal uraian.' },
    { id: 5, title: 'PAS Ganjil - Bahasa Indonesia Kelas VII A', unit: 1, code: 'BIN', classId: 1, teacher: 3, date: dstr(6), dur: 90, status: 'published', questions: [], instr: 'Ujian Akhir Semester dilaksanakan sesuai jadwal madrasah.' },
    { id: 6, title: 'PAS Ganjil - Fisika Kelas X IPA', unit: 2, code: 'MAFIS', classId: 6, teacher: 17, date: dstr(7), dur: 90, status: 'published', questions: [], instr: 'Ujian Akhir Semester Fisika kelas X IPA.' },
  ]
  const examRows = [], eqRows = [], partRows = [], ansRows = []
  let eqid = 0, pid = 0, aid = 0
  for (const e of examDefs) {
    const openAllDay = e.id === 1 || e.id === 4
    examRows.push([e.id, e.title, e.unit, subjId(e.code), e.classId, e.teacher, 2, 3, e.date, `${e.date}T01:00:00Z`, `${e.date}${openAllDay ? 'T16:00:00Z' : 'T09:00:00Z'}`, e.dur, e.instr, 1, 0, e.status, 1, now, 1])
    e.questions.forEach((q, idx) => { eqid++; eqRows.push([eqid, e.id, q, idx + 1, 1]) })
    for (const st of classStudents[e.classId]) { pid++; partRows.push([pid, e.id, st, 'not_started', null, null, null, null, null, 0, 1]) }
  }
  await bulkInsert(db, 'exams', ['id', 'title', 'unit_id', 'subject_id', 'class_id', 'teacher_id', 'academic_year_id', 'semester_id', 'exam_date', 'start_at', 'end_at', 'duration_minutes', 'instructions', 'shuffle_questions', 'shuffle_options', 'status', 'show_result', 'created_at', 'is_demo'], examRows)
  await bulkInsert(db, 'exam_questions', ['id', 'exam_id', 'question_id', 'order_no', 'weight'], eqRows)

  const partIndex = {}
  for (const p of partRows) partIndex[`${p[1]}|${p[2]}`] = p
  const setStatus = (examId, st, status, extra = {}) => {
    const p = partIndex[`${examId}|${st}`]
    if (!p) return null
    p[3] = status
    if (extra.started_at) p[4] = extra.started_at
    if (extra.submitted_at) p[5] = extra.submitted_at
    if (extra.objective != null) p[6] = extra.objective
    if (extra.published != null) p[9] = extra.published
    return p
  }
  const answerFor = (q, correct) => {
    if (q.type === 'multiple_choice') {
      const opts = JSON.parse(q.options || '[]')
      return correct ? q.answer_key : opts.find((o) => o !== q.answer_key)
    }
    if (q.type === 'true_false') return correct ? q.answer_key : (q.answer_key === 'true' ? 'false' : 'true')
    return correct ? q.answer_key : 'Jawaban siswa belum lengkap sesuai kunci pembahasan.'
  }
  const buildAttempt = (exam, studentId, ratio) => {
    const p = setStatus(exam.id, studentId, 'submitted', { started_at: `${exam.date}T01:05:00Z`, submitted_at: `${exam.date}T02:00:00Z` })
    let correctCount = 0, objCount = 0
    for (const question of exam.questions) {
      const qr = bankById[question]
      const correct = rand() < ratio
      aid++
      if (qr.type === 'essay') {
        ansRows.push([aid, p[0], question, answerFor(qr, correct), null, null, null, null, `${exam.date}T01:40:00Z`, 1])
      } else {
        objCount++
        if (correct) correctCount++
        ansRows.push([aid, p[0], question, answerFor(qr, correct), correct ? 1 : 0, correct ? 1 : 0, null, null, `${exam.date}T01:35:00Z`, 1])
      }
    }
    p[6] = objCount ? Math.round((correctCount / objCount) * 1000) / 10 : 0
    return p
  }
  const gradeEssays = (participant, exam, ratio, note) => {
    for (const a of ansRows) {
      if (a[1] === participant[0] && a[5] == null && a[2] != null) {
        const isEssay = bankById[a[2]] && bankById[a[2]].type === 'essay'
        if (isEssay) { a[5] = Math.round(ratio * 100); a[6] = note; a[7] = exam.teacher; a[8] = `${exam.date}T08:00:00Z` }
      }
    }
  }
  const c1 = classStudents[1]
  // ujian 1 (Matematika VII A): belum mulai, sedang mengerjakan, sudah mengirim
  buildAttempt(examDefs[0], c1[0], 0.9)
  buildAttempt(examDefs[0], c1[1], 0.7)
  buildAttempt(examDefs[0], c1[2], 0.8)
  const pr1 = setStatus(1, c1[3], 'in_progress', { started_at: `${dstr(0)}T01:20:00Z` })
  aid++; ansRows.push([aid, pr1[0], mtMat[0], bankById[mtMat[0]].answer_key, 1, 1, null, null, `${dstr(0)}T01:25:00Z`, 1])
  const pr2 = setStatus(1, c1[4], 'in_progress', { started_at: `${dstr(0)}T01:30:00Z` })
  aid++; ansRows.push([aid, pr2[0], mtMat[1], bankById[mtMat[1]].answer_key, 1, 1, null, null, `${dstr(0)}T01:35:00Z`, 1])

  // ujian 2 (Fikih VII A): sebagian sudah dinilai, dua peserta masih menunggu koreksi uraian
  classStudents[1].slice(0, 6).forEach((st) => {
    const p = buildAttempt(examDefs[1], st, 0.85)
    p[7] = Math.round((65 + rand() * 25) * 10) / 10
    p[8] = Math.round((p[6] * 0.7 + p[7] * 0.3) * 10) / 10
    p[3] = 'graded'; p[9] = 1
    gradeEssays(p, examDefs[1], 0.85, 'Jawaban sesuai kunci pembahasan.')
  })
  classStudents[1].slice(6, 8).forEach((st) => { buildAttempt(examDefs[1], st, 0.8) })

  // ujian 3 (Matematika X IPA): sudah dinilai dan dipublikasikan
  classStudents[6].slice(0, 7).forEach((st) => {
    const p = buildAttempt(examDefs[2], st, 0.82)
    p[7] = Math.round((70 + rand() * 25) * 10) / 10
    p[8] = Math.round((p[6] * 0.7 + p[7] * 0.3) * 10) / 10
    p[3] = 'graded'; p[9] = 1
    gradeEssays(p, examDefs[2], 0.8, 'Langkah pengerjaan sudah benar.')
  })
  await bulkInsert(db, 'exam_participants', ['id', 'exam_id', 'student_id', 'status', 'started_at', 'submitted_at', 'objective_score', 'essay_score', 'final_score', 'published', 'is_demo'], partRows, 80)
  await bulkInsert(db, 'exam_answers', ['id', 'participant_id', 'question_id', 'answer', 'is_correct', 'score', 'feedback', 'graded_by', 'saved_at', 'is_demo'], ansRows, 80)

  const audit = [
    [2, 'Menyimpan nilai', 'scores', 'Matematika VII A - PTS', 'Input nilai PTS Matematika kelas VII A untuk 16 siswa.'],
    [3, 'Koreksi presensi', 'attendance_students', 'VII A', 'Koreksi status alpa menjadi izin atas permohonan wali kelas.'],
    [1, 'Menerbitkan rapor', 'report_cards', '2025/2026 Genap', 'Penerbitan rapor semester genap tahun ajaran 2025/2026.'],
    [1, 'Menambah pengguna', 'users', 'guru.matematika@piat6.sch.id', 'Pembuatan akun guru mata pelajaran Matematika MTs.'],
    [2, 'Membuat soal', 'question_bank', 'Matematika VII', 'Menambahkan 9 soal PTS Matematika kelas VII.'],
    [3, 'Membuat ujian', 'exams', 'PAS Ganjil Bahasa Indonesia', 'Penjadwalan ujian PAS Bahasa Indonesia kelas VII A.'],
    [4, 'Menilai uraian', 'exam_answers', 'UH Fikih VII A', 'Koreksi jawaban uraian dan publikasi nilai ulangan harian Fikih.'],
  ]
  const aRows = audit.map((a, i) => {
    const t = teacherRows[a[0] - 1]
    return [i + 1, a[0], t[2], t[4] === 1 ? 'kepala_mts' : 'guru', t[4] || null, a[1], a[2], a[3], a[4], `${iso(addDays(today, -i - 1))}T03:15:00Z`]
  })
  await bulkInsert(db, 'audit_logs', ['id', 'actor_user_id', 'actor_name', 'role', 'unit_id', 'action', 'entity', 'entity_id', 'detail', 'created_at'], aRows)

  const accounts = [
    ['superadmin@piat6.sch.id', 'Super Admin PIAT 6', 'super_admin', null, null, null],
    ['pimpinan@piat6.sch.id', 'Drs. H. Sholehuddin, M.Pd (Pimpinan/Yayasan)', 'pimpinan', null, null, null],
    ['kamad.mts@piat6.sch.id', 'Ust. Ahmad Fauzi, S.Pd.I (Kepala MTs)', 'kepala_mts', 1, 1, null],
    ['kamad.ma@piat6.sch.id', 'Drs. H. Abdul Karim, M.Pd (Kepala MA)', 'kepala_ma', 2, 13, null],
    ['operator.mts@piat6.sch.id', 'Ust. Dimas Prayoga (Operator MTs)', 'operator', 1, 23, null],
    ['operator.ma@piat6.sch.id', 'Ustzh. Nabila Zahra (Operator MA)', 'operator', 2, 24, null],
    ['guru.matematika@piat6.sch.id', 'Ust. Zainal Abidin, S.Pd (Guru Matematika MTs)', 'guru', 1, 2, null],
    ['guru.fikih@piat6.sch.id', 'Ust. Ridwan Hakim, S.Ag (Guru Fikih MTs)', 'guru', 1, 4, null],
    ['walikelas.viia@piat6.sch.id', 'Ustzh. Nur Hidayah, S.Pd (Wali Kelas VII A)', 'wali_kelas', 1, 3, null],
    ['guru.matematika.ma@piat6.sch.id', 'Ust. Muhammad Iqbal, S.Pd (Guru Matematika MA)', 'guru', 2, 14, null],
    ['guru.fisika.ma@piat6.sch.id', 'Ust. Ali Mustofa, S.Pd (Guru Fisika MA)', 'guru', 2, 17, null],
    ['pengawas@piat6.sch.id', 'Drs. Suryadi, M.Pd (Pengawas Mutu)', 'pengawas', null, 25, null],
    ['siswa.mts@piat6.sch.id', 'Salman Ramadhan (Siswa VII A)', 'siswa', 1, null, c1[5]],
    ['siswa.ma@piat6.sch.id', 'Zahra Salsabila (Siswa X IPA)', 'siswa', 2, null, classStudents[6][8]],
  ]
  const userRows = []
  for (let i = 0; i < accounts.length; i++) {
    const [email, name, role, unitId, teacherId, studentId] = accounts[i]
    userRows.push([i + 1, email, name, await hashPassword(DEMO_PASSWORD), role, unitId, teacherId, studentId, 1, 1, now, null])
  }
  await bulkInsert(db, 'users', ['id', 'email', 'name', 'password_hash', 'role', 'unit_id', 'teacher_id', 'student_id', 'is_active', 'is_demo', 'created_at', 'last_login'], userRows)
  for (const [k, v] of [['seed_version', SEED_VERSION], ['seeded_at', new Date().toISOString()], ['schema_version', SCHEMA_VERSION]]) {
    await db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').bind(k, v).run()
  }
  return { questions: bank.length, exams: examRows.length, participants: partRows.length, answers: ansRows.length, users: userRows.length, audit: aRows.length }
}

export async function seedAll(db) {
  const { summary, ctx } = await seedDemo(db)
  const cbt = await seedCbt(db, ctx)
  return { ...summary, ...cbt }
}
