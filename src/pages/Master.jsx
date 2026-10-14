import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth, useFetch } from '../lib/auth'
import { ResourceList, DataTable } from '../components/DataTable'
import { Card, Modal, Confirm, Field, Input, Select, TextArea, Check, Tabs, Pill, Loading, Empty, Bars, StatCard } from '../components/ui'
import { post, put, del } from '../lib/api'
import { tanggal, num, pct, label } from '../lib/format'

const WRITE_ROLES = ['super_admin', 'kepala_mts', 'kepala_ma', 'operator']
const SUPER = ['super_admin']

export function ResourceForm({ title, fields, initial = {}, onSubmit, onClose, busy, extraNote }) {
  const [values, setValues] = useState(() => {
    const v = {}
    for (const f of fields) v[f.name] = initial[f.name] == null ? (f.type === 'check' ? false : '') : initial[f.name]
    return v
  })
  const [error, setError] = useState(null)
  const set = (name, val) => setValues((s) => ({ ...s, [name]: val }))
  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    const missing = fields.filter((f) => f.required && (values[f.name] === '' || values[f.name] == null)).map((f) => f.label)
    if (missing.length) { setError(`Kolom wajib belum diisi: ${missing.join(', ')}.`); return }
    try { await onSubmit(values) } catch (err) { setError(err.message || 'Gagal menyimpan data.') }
  }
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose} disabled={busy}>Batal</button>
      <button className="btn" onClick={submit} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
    </>}>
      <form onSubmit={submit}>
        <div className="grid k2">
          {fields.map((f) => {
            if (f.type === 'select') return <Select key={f.name} label={f.label} required={f.required} hint={f.hint} value={values[f.name]} onChange={(v) => set(f.name, v)} options={f.options || []} disabled={f.disabled} />
            if (f.type === 'textarea') return <TextArea key={f.name} label={f.label} required={f.required} hint={f.hint} value={values[f.name]} onChange={(v) => set(f.name, v)} rows={f.rows || 3} />
            if (f.type === 'check') return <Check key={f.name} label={f.label} hint={f.hint} checked={values[f.name]} onChange={(v) => set(f.name, v)} />
            if (f.render) return <div key={f.name}>{f.render(values, set)}</div>
            return <Input key={f.name} label={f.label} required={f.required} hint={f.hint} type={f.type || 'text'} value={values[f.name]} onChange={(v) => set(f.name, v)} placeholder={f.placeholder} min={f.min} max={f.max} step={f.step} />
          })}
        </div>
        {extraNote && <div className="hint">{extraNote}</div>}
        {error && <div className="err mt1" role="alert">{error}</div>}
      </form>
    </Modal>
  )
}

function useCrud(table) {
  const [state, setState] = useState({ item: null, mode: null, busy: false, confirm: null })
  const submit = async (values, id) => {
    setState((s) => ({ ...s, busy: true }))
    try {
      if (id) await put(`/rt/${table}/${id}`, values)
      else await post(`/rt/${table}`, values)
      setState({ item: null, mode: null, busy: false, confirm: null })
      return true
    } catch (e) {
      setState((s) => ({ ...s, busy: false }))
      throw e
    }
  }
  const remove = async (id) => {
    setState((s) => ({ ...s, busy: true }))
    try { await del(`/rt/${table}/${id}`); setState({ item: null, mode: null, busy: false, confirm: null }); return true } catch (e) { setState((s) => ({ ...s, busy: false })); throw e }
  }
  return { state, setState, submit, remove }
}

const unitOptions = (options, role, user) => (options?.units || []).filter((u) => role === 'super_admin' || u.id === user.unit_id).map((u) => ({ value: u.id, label: u.name }))
const classOptions = (options) => (options?.classes || []).map((c) => ({ value: c.id, label: `${c.unit_code} — ${c.name}` }))
const teacherOptions = (options) => (options?.teachers || []).map((t) => ({ value: t.id, label: `${t.name}${t.position ? ` (${t.position})` : ''}` }))
const subjectOptions = (options) => (options?.subjects || []).map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))
const semesterOptions = (options) => (options?.semesters || []).map((s) => ({ value: s.id, label: `${s.academic_year_name} — ${s.name}` }))

// ------------------------------------------------------------------ siswa
export function StudentsPage() {
  const { options, user } = useAuth()
  const [params, setParams] = useSearchParams()
  const { state, setState, submit, remove } = useCrud('students')
  const canWrite = WRITE_ROLES.includes(user.role)
  const [detail, setDetail] = useState(null)
  const focus = params.get('focus')

  useEffect(() => { if (focus) { setDetail(Number(focus)) } }, [focus])

  const fields = useMemo(() => [
    { name: 'nis', label: 'NIS', placeholder: 'Contoh: MTS-2026-0001' },
    { name: 'nisn', label: 'NISN' },
    { name: 'name', label: 'Nama lengkap', required: true },
    { name: 'gender', label: 'Jenis kelamin', type: 'select', options: [{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }] },
    { name: 'unit_id', label: 'Unit pendidikan', type: 'select', required: true, options: unitOptions(options, user.role, user) },
    { name: 'class_id', label: 'Kelas', type: 'select', required: true, options: classOptions(options) },
    { name: 'birth_place', label: 'Tempat lahir' },
    { name: 'birth_date', label: 'Tanggal lahir', type: 'date' },
    { name: 'parent_name', label: 'Nama orang tua/wali' },
    { name: 'parent_phone', label: 'Telepon orang tua/wali' },
    { name: 'entry_year', label: 'Tahun masuk' },
    { name: 'status', label: 'Status siswa', type: 'select', options: ['aktif', 'lulus', 'keluar', 'pindah', 'nonaktif'].map((v) => ({ value: v, label: label(v) })) },
    { name: 'address', label: 'Alamat', type: 'textarea' },
  ], [options, user])

  return (
    <Card title="Data Siswa/Santri" subtitle="Data induk dipakai bersama oleh presensi, penilaian, rapor, LMS, dan CBT">
      <ResourceList
        table="students" depKey={user.role}
        searchPlaceholder="Cari nama, NIS, NISN, atau wali…"
        filters={[
          { key: 'class_id', label: 'Kelas', options: classOptions(options) },
          { key: 'unit_id', label: 'Unit', options: unitOptions(options, user.role, user) },
          { key: 'status', label: 'Status', options: ['aktif', 'lulus', 'keluar', 'pindah', 'nonaktif'].map((v) => ({ value: v, label: label(v) })) },
          { key: 'gender', label: 'Jenis kelamin', options: [{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }] },
        ]}
        columns={[
          { key: 'nis', label: 'NIS', sortable: true },
          { key: 'name', label: 'Nama', sortable: true, render: (r) => <button className="linkbtn" onClick={() => { setDetail(r.id); setParams({ focus: r.id }) }}>{r.name}</button> },
          { key: 'class_name', label: 'Kelas', render: (r) => `${r.unit_code || ''} ${r.class_name || '-'}` },
          { key: 'gender', label: 'JK', render: (r) => label(r.gender) },
          { key: 'status', label: 'Status', render: (r) => <Pill value={r.status} /> },
          { key: 'parent_name', label: 'Wali' },
          { key: 'aksi', label: 'Aksi', render: (r) => (
            <div className="row tight">
              <button className="btn secondary sm" onClick={() => setDetail(r.id)}>Detail</button>
              {canWrite && <button className="btn secondary sm" onClick={() => setState({ item: r, mode: 'edit' })}>Ubah</button>}
              {canWrite && <button className="btn secondary sm" onClick={() => setState({ confirm: r })}>Arsipkan</button>}
            </div>
          ) },
        ]}
        toolbar={() => canWrite ? <button className="btn sm" onClick={() => setState({ item: null, mode: 'create' })}>+ Tambah siswa</button> : <span className="small muted">Hak tulis tidak tersedia untuk peran Anda</span>}
      />
      {state.mode && (
        <ResourceForm title={state.mode === 'edit' ? 'Ubah data siswa' : 'Tambah siswa baru'} fields={fields} initial={state.item || {}}
          busy={state.busy} onClose={() => setState({ item: null, mode: null })}
          onSubmit={async (v) => { await submit(v, state.item ? state.item.id : null) }}
          extraNote="NIS dan NISN harus unik. Data siswa tidak dihapus permanen; gunakan Arsipkan untuk menonaktifkan." />
      )}
      {state.confirm && (
        <Confirm title="Arsipkan data siswa" danger confirmLabel="Arsipkan"
          message={`Arsipkan ${state.confirm.name}? Status siswa berubah menjadi nonaktif dan tetap tersimpan beserta riwayat nilainya.`}
          busy={state.busy} onCancel={() => setState({ confirm: null })}
          onConfirm={async () => { try { await remove(state.confirm.id) } catch (e) { alert(e.message) } }} />
      )}
      {detail && <StudentDetail id={detail} onClose={() => { setDetail(null); setParams({}) }} canWrite={canWrite} />}
    </Card>
  )
}

function StudentDetail({ id, onClose, canWrite }) {
  const { options } = useAuth()
  const sem = options?.semesters?.find((s) => s.is_active)
  const [tab, setTab] = useState('profil')
  const { data } = useFetch(`/rt/students/${id}`, String(id))
  const s = data?.data
  return (
    <Modal wide title={`Detail siswa — ${s ? s.name : ''}`} onClose={onClose} footer={<button className="btn" onClick={onClose}>Tutup</button>}>
      {!s ? <Loading /> : (
        <>
          <Tabs value={tab} onChange={setTab} tabs={[{ value: 'profil', label: 'Profil' }, { value: 'nilai', label: 'Nilai & Rapor' }, { value: 'presensi', label: 'Presensi' }, { value: 'belajar', label: 'LMS & Ujian' }]} />
          <div className="mt2">
            {tab === 'profil' && (
              <div className="grid k2">
                <div className="small">NIS: <b>{s.nis}</b></div>
                <div className="small">NISN: <b>{s.nisn || '-'}</b></div>
                <div className="small">Kelas: <b>{s.unit_code} {s.class_name}</b></div>
                <div className="small">Jenis kelamin: <b>{label(s.gender)}</b></div>
                <div className="small">Tempat/tanggal lahir: <b>{s.birth_place || '-'}, {tanggal(s.birth_date)}</b></div>
                <div className="small">Status: <Pill value={s.status} /></div>
                <div className="small">Wali: <b>{s.parent_name || '-'}</b> ({s.parent_phone || '-'})</div>
                <div className="small">Alamat: <b>{s.address || '-'}</b></div>
                <div className="small muted">Data demo: {s.is_demo ? 'ya' : 'tidak'} • Terdaftar sejak {tanggal(s.birth_date) ? s.entry_year : '-'}</div>
              </div>
            )}
            {tab === 'nilai' && <StudentGrades id={id} semesterId={sem?.id} />}
            {tab === 'presensi' && <StudentAttendanceTab classId={s.class_id} studentId={id} />}
            {tab === 'belajar' && <StudentLearning classId={s.class_id} />}
          </div>
        </>
      )}
    </Modal>
  )
}

function StudentGrades({ id, semesterId }) {
  const { data } = useFetch(`/grades/student/${id}?semester_id=${semesterId || 0}`, String(semesterId))
  if (!data) return <Loading />
  return (
    <div className="stack">
      <div className="row tight">
        <span className="pill info">Rata-rata: {num(data.average)}</span>
        <span className="pill neutral">Kehadiran: {pct(data.attendance.percent)}</span>
      </div>
      <DataTable columns={[
        { key: 'subject_name', label: 'Mata pelajaran' },
        { key: 'kkm', label: 'KKM', align: 'right' },
        { key: 'final', label: 'Nilai akhir', align: 'right', render: (r) => num(r.final) },
        { key: 'complete', label: 'Kelengkapan', render: (r) => r.complete ? <Pill value="ok" text="Lengkap" /> : <Pill value="warn" text="Belum lengkap" /> },
      ]} rows={data.subjects} emptyText="Belum ada nilai pada semester ini." />
      <div className="small muted">Rincian komponen per mata pelajaran dihitung dari tabel nilai (bobot × nilai ÷ total bobot).</div>
    </div>
  )
}

function StudentAttendanceTab({ classId, studentId }) {
  const { data } = useFetch(`/attendance/students/recap?class_id=${classId}`, String(classId))
  const row = data?.data?.find((r) => r.student_id === studentId)
  const { data: daily } = useFetch(`/attendance/students/daily`, String(classId))
  if (!data) return <Loading />
  if (!row) return <Empty text="Belum ada data presensi." />
  return (
    <div className="stack">
      <div className="grid k4">
        <StatCard label="Hadir" value={num(row.hadir, 0)} />
        <StatCard label="Sakit" value={num(row.sakit, 0)} />
        <StatCard label="Izin" value={num(row.izin, 0)} />
        <StatCard label="Alpa" value={num(row.alpa, 0)} />
      </div>
      <div className="small">Persentase kehadiran: <b>{pct(row.percent)}</b> {row.alert ? <Pill value="warn" text="Di bawah ambang" /> : <Pill value="ok" text="Baik" />}</div>
      <DataTable columns={[
        { key: 'date', label: 'Tanggal', render: (r) => tanggal(r.date) },
        { key: 'status', label: 'Status', render: (r) => <Pill value={r.status} /> },
        { key: 'class_name', label: 'Kelas' },
        { key: 'note', label: 'Catatan' },
      ]} rows={(daily?.data || []).filter((d) => d.nis === row.nis)} emptyText="Tidak ada ketidakhadiran tercatat pada periode ini." />
    </div>
  )
}

function StudentLearning({ classId }) {
  const { data: lms } = useFetch(`/lms/assignments?class_id=${classId}`, String(classId))
  const { data: exams } = useFetch(`/exams?class_id=${classId}`, String(classId))
  return (
    <div className="stack">
      <div><b className="small">Tugas kelas</b></div>
      <DataTable columns={[
        { key: 'title', label: 'Tugas' },
        { key: 'due_date', label: 'Tenggat', render: (r) => tanggal(r.due_date) },
        { key: 'submitted_count', label: 'Terkumpul', align: 'right', render: (r) => `${r.submitted_count}/${r.student_count}` },
        { key: 'completion_percent', label: 'Penyelesaian', align: 'right', render: (r) => pct(r.completion_percent) },
      ]} rows={lms?.data || []} emptyText="Belum ada tugas." />
      <div><b className="small">Ujian kelas</b></div>
      <DataTable columns={[
        { key: 'title', label: 'Ujian' },
        { key: 'exam_date', label: 'Tanggal', render: (r) => tanggal(r.exam_date) },
        { key: 'question_count', label: 'Soal', align: 'right' },
        { key: 'status', label: 'Status', render: (r) => <Pill value={r.status} /> },
      ]} rows={exams?.data || []} emptyText="Belum ada ujian." />
    </div>
  )
}

// ------------------------------------------------------------------ guru & tendik
export function TeachersPage() {
  const { options, user } = useAuth()
  const [params, setParams] = useSearchParams()
  const { state, setState, submit, remove } = useCrud('teachers')
  const canWrite = WRITE_ROLES.includes(user.role)
  const focus = params.get('focus')
  const fields = useMemo(() => [
    { name: 'name', label: 'Nama lengkap & gelar', required: true },
    { name: 'nip', label: 'NIP/NUPTK' },
    { name: 'gender', label: 'Jenis kelamin', type: 'select', options: [{ value: 'L', label: 'Laki-laki' }, { value: 'P', label: 'Perempuan' }] },
    { name: 'unit_id', label: 'Unit pendidikan', type: 'select', options: unitOptions(options, user.role, user) },
    { name: 'position', label: 'Jabatan/tugas utama', hint: 'Contoh: Guru Matematika, Wali Kelas VII A, Operator Akademik' },
    { name: 'status', label: 'Status kepegawaian', type: 'select', options: ['aktif', 'nonaktif'].map((v) => ({ value: v, label: label(v) })) },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'phone', label: 'Nomor telepon' },
  ], [options, user])
  return (
    <Card title="Guru & Tenaga Kependidikan" subtitle="Profil, penugasan mengajar, dan pemantauan administrasi akademik">
      <ResourceList table="teachers" depKey={user.role} searchPlaceholder="Cari nama, NIP, jabatan…"
        filters={[
          { key: 'unit_id', label: 'Unit', options: unitOptions(options, user.role, user) },
          { key: 'status', label: 'Status', options: [{ value: 'aktif', label: 'Aktif' }, { value: 'nonaktif', label: 'Nonaktif' }] },
        ]}
        columns={[
          { key: 'name', label: 'Nama', sortable: true, render: (r) => <button className="linkbtn" onClick={() => setParams({ focus: r.id })}>{r.name}</button> },
          { key: 'nip', label: 'NIP' },
          { key: 'position', label: 'Jabatan' },
          { key: 'unit_name', label: 'Unit' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Telepon' },
          { key: 'status', label: 'Status', render: (r) => <Pill value={r.status} /> },
          { key: 'aksi', label: 'Aksi', render: (r) => (
            <div className="row tight">
              <button className="btn secondary sm" onClick={() => setParams({ focus: r.id })}>Beban tugas</button>
              {canWrite && <button className="btn secondary sm" onClick={() => setState({ item: r, mode: 'edit' })}>Ubah</button>}
            </div>
          ) },
        ]}
        toolbar={() => canWrite ? <button className="btn sm" onClick={() => setState({ item: null, mode: 'create' })}>+ Tambah guru</button> : <span className="small muted">Hak tulis tidak tersedia</span>}
      />
      {state.mode && (
        <ResourceForm title={state.mode === 'edit' ? 'Ubah data guru' : 'Tambah guru/tendik'} fields={fields} initial={state.item || {}} busy={state.busy}
          onClose={() => setState({ item: null, mode: null })} onSubmit={async (v) => { await submit(v, state.item ? state.item.id : null) }} />
      )}
      {state.confirm && <Confirm title="Hapus data guru" danger message="Hapus data ini?" busy={state.busy} onCancel={() => setState({ confirm: null })} onConfirm={async () => { await remove(state.confirm.id) }} />}
      {focus && <TeacherDetail id={Number(focus)} onClose={() => setParams({})} />}
    </Card>
  )
}

function TeacherDetail({ id, onClose }) {
  const { data } = useFetch(`/teachers/${id}/workload`, String(id))
  const w = data
  return (
    <Modal wide title={`Beban tugas — ${w?.teacher ? w.teacher.name : ''}`} onClose={onClose} footer={<button className="btn" onClick={onClose}>Tutup</button>}>
      {!w ? <Loading /> : (
        <div className="stack">
          <div className="row tight">
            <span className="pill info">{w.teacher.position || 'Guru'}</span>
            <span className="pill neutral">{w.teacher.unit_code || 'Lintas unit'}</span>
            {w.homeroom.map((h) => <span key={h.id} className="pill warn">Wali kelas {h.name}</span>)}
          </div>
          <div className="grid k4">
            <StatCard label="Penugasan mapel" value={num(w.class_subjects.length, 0)} />
            <StatCard label="Jadwal mengajar" value={num(w.schedules.length, 0)} />
            <StatCard label="Hari presensi tercatat" value={num(w.attendance_days, 0)} />
            <StatCard label="Perlu dikoreksi" value={num(w.pending_submissions + w.pending_exam_grading, 0)} />
          </div>
          <div><b className="small">Mata pelajaran & kelas yang diampu</b></div>
          <DataTable columns={[
            { key: 'class_name', label: 'Kelas' },
            { key: 'subject_name', label: 'Mata pelajaran' },
            { key: 'kkm', label: 'KKM', align: 'right' },
          ]} rows={w.class_subjects} emptyText="Belum ada penugasan." />
          <div><b className="small">Jadwal mengajar</b></div>
          <DataTable columns={[
            { key: 'day', label: 'Hari' },
            { key: 'period', label: 'Jam ke', align: 'right' },
            { key: 'start_time', label: 'Mulai' },
            { key: 'end_time', label: 'Selesai' },
            { key: 'class_name', label: 'Kelas' },
            { key: 'subject_name', label: 'Mapel' },
          ]} rows={w.schedules} emptyText="Belum ada jadwal." />
        </div>
      )}
    </Modal>
  )
}

// ------------------------------------------------------------------ kelas
export function ClassesPage() {
  const { options, user } = useAuth()
  const { state, setState, submit } = useCrud('classes')
  const canWrite = WRITE_ROLES.includes(user.role)
  const [detail, setDetail] = useState(null)
  const fields = [
    { name: 'name', label: 'Nama kelas', required: true, placeholder: 'Contoh: VII A' },
    { name: 'level', label: 'Tingkat', type: 'number', required: true, min: 1, max: 12, hint: '7, 8, 9 untuk MTs dan 10, 11, 12 untuk MA' },
    { name: 'unit_id', label: 'Unit pendidikan', type: 'select', required: true, options: unitOptions(options, user.role, user) },
    { name: 'academic_year_id', label: 'Tahun ajaran', type: 'select', options: (options?.academicYears || []).map((a) => ({ value: a.id, label: a.name })) },
    { name: 'homeroom_teacher_id', label: 'Wali kelas', type: 'select', options: teacherOptions(options) },
    { name: 'capacity', label: 'Kapasitas', type: 'number' },
  ]
  return (
    <Card title="Kelas & Rombongan Belajar" subtitle="Kelas menghubungkan siswa, wali kelas, penugasan mata pelajaran, dan jadwal">
      <ResourceList table="classes" depKey={user.role} searchPlaceholder="Cari nama kelas…"
        filters={[{ key: 'unit_id', label: 'Unit', options: unitOptions(options, user.role, user) }, { key: 'level', label: 'Tingkat', options: [7, 8, 9, 10, 11, 12].map((l) => ({ value: l, label: `Tingkat ${l}` })) }]}
        columns={[
          { key: 'name', label: 'Kelas', render: (r) => <button className="linkbtn" onClick={() => setDetail(r)}>{r.name}</button> },
          { key: 'unit_name', label: 'Unit' },
          { key: 'level', label: 'Tingkat', align: 'right' },
          { key: 'homeroom_name', label: 'Wali kelas' },
          { key: 'student_count', label: 'Jumlah siswa', align: 'right' },
          { key: 'capacity', label: 'Kapasitas', align: 'right' },
          { key: 'aksi', label: 'Aksi', render: (r) => <div className="row tight">
            <button className="btn secondary sm" onClick={() => setDetail(r)}>Daftar siswa</button>
            {canWrite && <button className="btn secondary sm" onClick={() => setState({ item: r, mode: 'edit' })}>Ubah</button>}
          </div> },
        ]}
        toolbar={() => canWrite ? <button className="btn sm" onClick={() => setState({ item: null, mode: 'create' })}>+ Tambah kelas</button> : null} />
      {state.mode && <ResourceForm title={state.mode === 'edit' ? 'Ubah kelas' : 'Tambah kelas'} fields={fields} initial={state.item || {}} busy={state.busy}
        onClose={() => setState({ item: null, mode: null })} onSubmit={async (v) => { await submit(v, state.item ? state.item.id : null) }} />}
      {detail && (
        <Modal wide title={`Siswa kelas ${detail.name} (${detail.unit_code})`} onClose={() => setDetail(null)} footer={<button className="btn" onClick={() => setDetail(null)}>Tutup</button>}>
          <ClassStudents classId={detail.id} />
        </Modal>
      )}
    </Card>
  )
}

function ClassStudents({ classId }) {
  const { data } = useFetch(`/rt/students?filter_class_id=${classId}&limit=100`, String(classId))
  const { data: recap } = useFetch(`/attendance/students/recap?class_id=${classId}`, String(classId))
  const att = Object.fromEntries((recap?.data || []).map((r) => [r.student_id, r.percent]))
  return (
    <DataTable columns={[
      { key: 'nis', label: 'NIS' },
      { key: 'name', label: 'Nama' },
      { key: 'gender', label: 'JK', render: (r) => label(r.gender) },
      { key: 'status', label: 'Status', render: (r) => <Pill value={r.status} /> },
      { key: 'attendance', label: 'Kehadiran', align: 'right', render: (r) => pct(att[r.id]) },
    ]} rows={data?.data || []} emptyText="Belum ada siswa pada kelas ini." />
  )
}

// ------------------------------------------------------------------ mata pelajaran
export function SubjectsPage() {
  const { options, user } = useAuth()
  const { state, setState, submit } = useCrud('subjects')
  const canWrite = WRITE_ROLES.includes(user.role)
  const fields = [
    { name: 'code', label: 'Kode mapel', required: true, placeholder: 'Contoh: MAT' },
    { name: 'name', label: 'Nama mata pelajaran', required: true },
    { name: 'unit_id', label: 'Unit pendidikan', type: 'select', required: true, options: unitOptions(options, user.role, user) },
    { name: 'category', label: 'Kelompok', type: 'select', options: ['PAI', 'Bahasa', 'Umum', 'Peminatan', 'Muatan Lokal'].map((c) => ({ value: c, label: c })) },
  ]
  return (
    <Card title="Mata Pelajaran" subtitle="Struktur kurikulum dapat berbeda antarunit; sesuaikan dengan konfigurasi madrasah">
      <ResourceList table="subjects" depKey={user.role} searchPlaceholder="Cari nama atau kode mapel…"
        filters={[{ key: 'unit_id', label: 'Unit', options: unitOptions(options, user.role, user) }, { key: 'category', label: 'Kelompok', options: ['PAI', 'Bahasa', 'Umum', 'Peminatan', 'Muatan Lokal'].map((c) => ({ value: c, label: c })) }]}
        columns={[
          { key: 'code', label: 'Kode' },
          { key: 'name', label: 'Mata pelajaran', sortable: true },
          { key: 'unit_code', label: 'Unit' },
          { key: 'category', label: 'Kelompok' },
          { key: 'aksi', label: 'Aksi', render: (r) => canWrite ? <button className="btn secondary sm" onClick={() => setState({ item: r, mode: 'edit' })}>Ubah</button> : <span className="muted small">—</span> },
        ]}
        toolbar={() => canWrite ? <button className="btn sm" onClick={() => setState({ item: null, mode: 'create' })}>+ Tambah mapel</button> : null} />
      {state.mode && <ResourceForm title={state.mode === 'edit' ? 'Ubah mata pelajaran' : 'Tambah mata pelajaran'} fields={fields} initial={state.item || {}} busy={state.busy}
        onClose={() => setState({ item: null, mode: null })} onSubmit={async (v) => { await submit(v, state.item ? state.item.id : null) }} />}
    </Card>
  )
}

// ------------------------------------------------------------------ penugasan kurikulum
export function CurriculumPage() {
  const { options, user } = useAuth()
  const { state, setState, submit, remove } = useCrud('class_subjects')
  const canWrite = WRITE_ROLES.includes(user.role)
  const csOptions = (options?.classSubjects || []).map((c) => ({ value: c.id, label: `${c.class_name} — ${c.subject_name}` }))
  const fields = [
    { name: 'class_id', label: 'Kelas', type: 'select', required: true, options: classOptions(options) },
    { name: 'subject_id', label: 'Mata pelajaran', type: 'select', required: true, options: subjectOptions(options) },
    { name: 'teacher_id', label: 'Guru pengampu', type: 'select', required: true, options: teacherOptions(options) },
    { name: 'semester_id', label: 'Semester', type: 'select', required: true, options: semesterOptions(options) },
    { name: 'academic_year_id', label: 'Tahun ajaran', type: 'select', options: (options?.academicYears || []).map((a) => ({ value: a.id, label: a.name })) },
    { name: 'kkm', label: 'KKM (ketuntasan minimal)', type: 'number', min: 0, max: 100 },
    { name: 'hours', label: 'Jumlah jam per pekan', type: 'number', min: 1, max: 12 },
  ]
  return (
    <Card title="Penugasan Mata Pelajaran (Kurikulum)" subtitle={user.role === 'guru' || user.role === 'wali_kelas' ? 'Anda hanya melihat mata pelajaran yang menjadi tanggung jawab Anda' : 'Mata pelajaran per kelas beserta guru pengampu dan KKM'}>
      <ResourceList table="class_subjects" limit={30} depKey={user.role} searchPlaceholder="Cari kelas atau mapel…"
        defaultSort="id"
        filters={[
          { key: 'class_id', label: 'Kelas', options: classOptions(options) },
          { key: 'semester_id', label: 'Semester', options: semesterOptions(options) },
        ]}
        columns={[
          { key: 'class_name', label: 'Kelas', sortable: true },
          { key: 'subject_name', label: 'Mata pelajaran', sortable: true },
          { key: 'teacher_name', label: 'Guru pengampu' },
          { key: 'kkm', label: 'KKM', align: 'right' },
          { key: 'hours', label: 'Jam/pekan', align: 'right' },
          { key: 'aksi', label: 'Aksi', render: (r) => canWrite ? <div className="row tight">
            <button className="btn secondary sm" onClick={() => setState({ item: r, mode: 'edit' })}>Ubah</button>
            <button className="btn secondary sm" onClick={() => setState({ confirm: r })}>Hapus</button>
          </div> : <span className="muted small">—</span> },
        ]}
        toolbar={() => canWrite ? <button className="btn sm" onClick={() => setState({ item: null, mode: 'create' })}>+ Tetapkan mapel</button> : null} />
      {state.mode && <ResourceForm title={state.mode === 'edit' ? 'Ubah penugasan mapel' : 'Tetapkan mata pelajaran ke kelas'} fields={fields} initial={state.item || {}} busy={state.busy}
        onClose={() => setState({ item: null, mode: null })} onSubmit={async (v) => { await submit(v, state.item ? state.item.id : null) }} />}
      {state.confirm && <Confirm title="Hapus penugasan" danger message={`Hapus penugasan ${state.confirm.subject_name} pada kelas ${state.confirm.class_name}? Nilai yang sudah tercatat akan kehilangan relasi komponennya.`}
        busy={state.busy} onCancel={() => setState({ confirm: null })} onConfirm={async () => { try { await remove(state.confirm.id) } catch (e) { alert(e.message) } }} />}
    </Card>
  )
}

// ------------------------------------------------------------------ jadwal
export function SchedulesPage() {
  const { options, user } = useAuth()
  const { state, setState, submit, remove } = useCrud('schedules')
  const canWrite = WRITE_ROLES.includes(user.role)
  const csOptions = (options?.classSubjects || []).map((c) => ({ value: c.id, label: `${c.class_name} — ${c.subject_name}` }))
  const fields = [
    { name: 'class_id', label: 'Kelas', type: 'select', required: true, options: classOptions(options) },
    { name: 'class_subject_id', label: 'Mata pelajaran (penugasan kelas)', type: 'select', required: true, options: csOptions },
    { name: 'day', label: 'Hari', type: 'select', required: true, options: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map((d) => ({ value: d, label: d })) },
    { name: 'period', label: 'Jam ke', type: 'number', required: true, min: 1, max: 12 },
    { name: 'start_time', label: 'Jam mulai', type: 'time' },
    { name: 'end_time', label: 'Jam selesai', type: 'time' },
    { name: 'room', label: 'Ruang' },
  ]
  return (
    <Card title="Jadwal Pelajaran" subtitle="Jadwal digunakan sebagai acuan pencatatan presensi dan pemantauan pelaksanaan pembelajaran">
      <ResourceList table="schedules" limit={30} depKey={user.role} searchPlaceholder="Cari hari atau ruang…"
        filters={[{ key: 'class_id', label: 'Kelas', options: classOptions(options) }]}
        columns={[
          { key: 'day', label: 'Hari', sortable: true },
          { key: 'period', label: 'Jam ke', align: 'right' },
          { key: 'start_time', label: 'Mulai' },
          { key: 'end_time', label: 'Selesai' },
          { key: 'class_name', label: 'Kelas' },
          { key: 'subject_name', label: 'Mapel' },
          { key: 'teacher_name', label: 'Guru' },
          { key: 'room', label: 'Ruang' },
          { key: 'aksi', label: 'Aksi', render: (r) => canWrite ? <div className="row tight">
            <button className="btn secondary sm" onClick={() => setState({ item: r, mode: 'edit' })}>Ubah</button>
            <button className="btn secondary sm" onClick={() => setState({ confirm: r })}>Hapus</button>
          </div> : <span className="muted small">—</span> },
        ]}
        toolbar={() => canWrite ? <button className="btn sm" onClick={() => setState({ item: null, mode: 'create' })}>+ Tambah jadwal</button> : null} />
      {state.mode && <ResourceForm title={state.mode === 'edit' ? 'Ubah jadwal' : 'Tambah jadwal pelajaran'} fields={fields} initial={state.item || {}} busy={state.busy}
        onClose={() => setState({ item: null, mode: null })} onSubmit={async (v) => { await submit(v, state.item ? state.item.id : null) }}
        extraNote="Pastikan kelas dan guru tidak memiliki jadwal bertumpuk pada hari dan jam yang sama." />}
      {state.confirm && <Confirm title="Hapus jadwal" danger message="Hapus jadwal pelajaran ini?" busy={state.busy}
        onCancel={() => setState({ confirm: null })} onConfirm={async () => { try { await remove(state.confirm.id) } catch (e) { alert(e.message) } }} />}
    </Card>
  )
}

// ------------------------------------------------------------------ unit & periode
export function UnitsPage() {
  const { user } = useAuth()
  const isSuper = user.role === 'super_admin'
  const { state, setState, submit } = useCrud('units')
  const fields = [
    { name: 'code', label: 'Kode unit', required: true },
    { name: 'name', label: 'Nama unit', required: true },
    { name: 'level', label: 'Jenjang', type: 'select', required: true, options: [{ value: 'MTs', label: 'MTs' }, { value: 'MA', label: 'MA' }] },
    { name: 'head_teacher_id', label: 'Kepala madrasah (ID guru)', type: 'number', hint: 'Lihat ID pada halaman Guru & Tendik' },
    { name: 'address', label: 'Alamat', type: 'textarea' },
  ]
  return (
    <Card title="Unit Pendidikan" subtitle="Satu aplikasi mengelola dua unit: MTs PIAT 6 dan MA PIAT 6 Bondowoso">
      <ResourceList table="units" depKey={user.role}
        columns={[
          { key: 'code', label: 'Kode' },
          { key: 'name', label: 'Nama unit', sortable: true },
          { key: 'level', label: 'Jenjang' },
          { key: 'address', label: 'Alamat' },
          { key: 'aksi', label: 'Aksi', render: (r) => isSuper ? <button className="btn secondary sm" onClick={() => setState({ item: r, mode: 'edit' })}>Ubah</button> : <span className="muted small">—</span> },
        ]}
        toolbar={() => isSuper ? <button className="btn sm" onClick={() => setState({ item: null, mode: 'create' })}>+ Tambah unit</button> : <span className="small muted">Hanya Super Admin dapat mengubah unit</span>} />
      {state.mode && <ResourceForm title={state.mode === 'edit' ? 'Ubah unit pendidikan' : 'Tambah unit'} fields={fields} initial={state.item || {}} busy={state.busy}
        onClose={() => setState({ item: null, mode: null })} onSubmit={async (v) => { await submit(v, state.item ? state.item.id : null) }} />}
    </Card>
  )
}

export function PeriodsPage() {
  const { user } = useAuth()
  const isSuper = user.role === 'super_admin'
  const [tab, setTab] = useState('tahun')
  const crud = useCrud('academic_years')
  const semCrud = useCrud('semesters')
  const yearFields = [
    { name: 'name', label: 'Nama tahun ajaran', required: true, placeholder: 'Contoh: 2027/2028' },
    { name: 'start_date', label: 'Tanggal mulai', type: 'date' },
    { name: 'end_date', label: 'Tanggal selesai', type: 'date' },
    { name: 'is_active', label: 'Jadikan tahun ajaran aktif', type: 'check', hint: 'Hanya satu periode aktif yang dipakai dashboard dan laporan' },
  ]
  const semFields = [
    { name: 'academic_year_id', label: 'Tahun ajaran', type: 'select', required: true, options: (semCrud.state && []) || [] },
    { name: 'name', label: 'Nama semester', required: true, placeholder: 'Ganjil / Genap' },
    { name: 'term', label: 'Term', type: 'number', required: true, min: 1, max: 2 },
    { name: 'start_date', label: 'Tanggal mulai', type: 'date' },
    { name: 'end_date', label: 'Tanggal selesai', type: 'date' },
    { name: 'is_active', label: 'Jadikan semester aktif', type: 'check' },
  ]
  const { options } = useAuth()
  semFields[0].options = (options?.academicYears || []).map((a) => ({ value: a.id, label: a.name }))
  return (
    <Card title="Tahun Ajaran & Semester" subtitle="Periode akademik dipakai pada penilaian, rapor, LMS, dan CBT">
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'tahun', label: 'Tahun ajaran' }, { value: 'semester', label: 'Semester' }]} />
      <div className="mt2">
        {tab === 'tahun' ? (
          <ResourceList table="academic_years" depKey={user.role}
            columns={[
              { key: 'name', label: 'Tahun ajaran', sortable: true },
              { key: 'start_date', label: 'Mulai', render: (r) => tanggal(r.start_date) },
              { key: 'end_date', label: 'Selesai', render: (r) => tanggal(r.end_date) },
              { key: 'is_active', label: 'Status', render: (r) => r.is_active ? <Pill value="aktif" text="Aktif" /> : <Pill value="nonaktif" /> },
              { key: 'aksi', label: 'Aksi', render: (r) => isSuper ? <button className="btn secondary sm" onClick={() => crud.setState({ item: r, mode: 'edit' })}>Ubah</button> : <span className="muted small">—</span> },
            ]}
            toolbar={() => isSuper ? <button className="btn sm" onClick={() => crud.setState({ item: null, mode: 'create' })}>+ Tambah tahun ajaran</button> : null} />
        ) : (
          <ResourceList table="semesters" depKey={user.role}
            columns={[
              { key: 'academic_year_name', label: 'Tahun ajaran' },
              { key: 'name', label: 'Semester' },
              { key: 'term', label: 'Term', align: 'right' },
              { key: 'start_date', label: 'Mulai', render: (r) => tanggal(r.start_date) },
              { key: 'end_date', label: 'Selesai', render: (r) => tanggal(r.end_date) },
              { key: 'is_active', label: 'Status', render: (r) => r.is_active ? <Pill value="aktif" text="Aktif" /> : <Pill value="nonaktif" /> },
              { key: 'aksi', label: 'Aksi', render: (r) => isSuper ? <button className="btn secondary sm" onClick={() => semCrud.setState({ item: r, mode: 'edit' })}>Ubah</button> : <span className="muted small">—</span> },
            ]}
            toolbar={() => isSuper ? <button className="btn sm" onClick={() => semCrud.setState({ item: null, mode: 'create' })}>+ Tambah semester</button> : null} />
        )}
      </div>
      {crud.state.mode && <ResourceForm title={crud.state.mode === 'edit' ? 'Ubah tahun ajaran' : 'Tambah tahun ajaran'} fields={yearFields} initial={crud.state.item || {}} busy={crud.state.busy}
        onClose={() => crud.setState({ item: null, mode: null })} onSubmit={async (v) => { await crud.submit(v, crud.state.item ? crud.state.item.id : null) }} />}
      {semCrud.state.mode && <ResourceForm title={semCrud.state.mode === 'edit' ? 'Ubah semester' : 'Tambah semester'} fields={semFields} initial={semCrud.state.item || {}} busy={semCrud.state.busy}
        onClose={() => semCrud.setState({ item: null, mode: null })} onSubmit={async (v) => { await semCrud.submit(v, semCrud.state.item ? semCrud.state.item.id : null) }} />}
    </Card>
  )
}
