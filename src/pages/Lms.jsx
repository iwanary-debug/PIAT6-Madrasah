import React, { useEffect, useMemo, useState } from 'react'
import { useAuth, useFetch } from '../lib/auth'
import { Card, StatCard, Pill, Loading, Empty, Modal, Tabs, Select, Input, TextArea, Confirm, Bars } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { post, put, del } from '../lib/api'
import { num, pct, tanggal, label } from '../lib/format'

export default function Lms({ tab: initialTab }) {
  const { user, options } = useAuth()
  const isSiswa = user.role === 'siswa'
  const [tab, setTab] = useState(isSiswa && initialTab === 'koreksi' ? 'tugas' : initialTab)
  const tabs = isSiswa
    ? [{ value: 'materi', label: 'Materi untuk saya' }, { value: 'tugas', label: 'Tugas & pengumpulan' }]
    : [{ value: 'materi', label: 'Materi pembelajaran' }, { value: 'tugas', label: 'Tugas & pengumpulan' }, { value: 'koreksi', label: 'Koreksi tugas' }]
  useEffect(() => { setTab(isSiswa && initialTab === 'koreksi' ? 'tugas' : initialTab) }, [initialTab, isSiswa])

  return (
    <div className="stack">
      {isSiswa ? <StudentLms tab={tab} setTab={setTab} tabs={tabs} /> : (
        <Card title="LMS — Pembelajaran Digital" subtitle="Materi, tugas, tenggat pengumpulan, dan koreksi dengan umpan balik">
          <Tabs value={tab} onChange={setTab} tabs={tabs} />
          <div className="mt2">
            {tab === 'materi' && <MaterialsTab />}
            {tab === 'tugas' && <AssignmentsTab />}
            {tab === 'koreksi' && <GradingTab />}
          </div>
        </Card>
      )}
    </div>
  )
}

function StudentLms({ tab, setTab, tabs }) {
  const { data, loading, reload } = useFetch('/lms/student')
  const [submitFor, setSubmitFor] = useState(null)
  if (loading || !data) return <Loading text="Memuat materi dan tugas…" />
  const s = data.summary
  return (
    <div className="stack">
      <div className="grid k4">
        <StatCard label="Materi tersedia" value={num(s.materials, 0)} />
        <StatCard label="Tugas" value={num(s.assignments, 0)} foot={`${s.submitted} sudah dikumpulkan`} />
        <StatCard label="Belum dikumpulkan" value={num(s.missing, 0)} tone={s.missing ? '#b54708' : undefined} />
        <StatCard label="Nilai sudah dipublikasikan" value={num(s.published, 0)} />
      </div>
      <Card title="Pembelajaran saya" subtitle="Hanya materi, tugas, dan nilai milik akun Anda">
        <Tabs value={tab} onChange={setTab} tabs={tabs} />
        <div className="mt2">
          {tab === 'materi' && (data.materials.length === 0 ? <Empty text="Belum ada materi untuk kelas Anda." /> : (
            <div className="grid k2">
              {data.materials.map((m) => (
                <div className="card" key={m.id}>
                  <div className="row between"><b>{m.title}</b><Pill value="info" text={m.subject_name || 'Materi'} /></div>
                  <div className="small muted">{m.teacher_name || '-'} • {tanggal(m.created_at)}</div>
                  {m.description && <p className="small">{m.description}</p>}
                  {m.type === 'link' && m.url ? <a className="btn secondary sm" href={m.url} target="_blank" rel="noreferrer">Buka tautan materi</a> : null}
                </div>
              ))}
            </div>
          ))}
          {tab === 'tugas' && (
            <DataTable columns={[
              { key: 'title', label: 'Tugas' },
              { key: 'subject_name', label: 'Mapel' },
              { key: 'due_date', label: 'Tenggat', render: (r) => <span className={r.overdue ? 'err' : ''}>{tanggal(r.due_date)}{r.overdue ? ' (terlewat)' : ''}</span> },
              { key: 'submission_status', label: 'Status', render: (r) => r.submission_status ? <Pill value={r.submission_status} /> : <Pill value="missing" /> },
              { key: 'score', label: 'Nilai', align: 'right', render: (r) => r.score == null ? '-' : `${r.score}/${r.max_score}` },
              { key: 'feedback', label: 'Umpan balik', render: (r) => r.feedback || '-' },
              { key: 'aksi', label: 'Aksi', render: (r) => (
                <button className="btn secondary sm" disabled={r.submission_status === 'graded' || r.submission_status === 'published'} onClick={() => setSubmitFor(r)}>
                  {['graded', 'published'].includes(r.submission_status) ? 'Sudah dinilai' : r.submission_status ? 'Perbarui jawaban' : 'Kumpulkan'}
                </button>
              ) },
            ]} rows={data.assignments} emptyText="Belum ada tugas untuk kelas Anda." />
          )}
        </div>
      </Card>
      {submitFor && <SubmitForm assignment={submitFor} onClose={() => setSubmitFor(null)} onDone={() => { setSubmitFor(null); reload() }} />}
    </div>
  )
}

function SubmitForm({ assignment, onClose, onDone }) {
  const [content, setContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const save = async () => {
    setBusy(true); setError(null)
    try { await post(`/lms/assignments/${assignment.id}/submit`, { content, file_name: fileName || null }); onDone() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal title={`Kumpulkan tugas — ${assignment.title}`} onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose} disabled={busy}>Batal</button>
      <button className="btn" onClick={save} disabled={busy}>{busy ? 'Mengirim…' : 'Kumpulkan tugas'}</button>
    </>}>
      <div className="small muted mb1">Tenggat {tanggal(assignment.due_date, true)} • Nilai maksimal {assignment.max_score}</div>
      <TextArea label="Jawaban" rows={6} value={content} onChange={setContent} hint="Tulis jawaban Anda di sini." />
      <Input label="Nama berkas (opsional)" value={fileName} onChange={setFileName} placeholder="contoh: jawaban-tugas.pdf" />
      <div className="hint">Unggahan berkas belum tersedia pada versi 1.0. Tuliskan jawaban pada kolom di atas dan cantumkan nama berkas jika sudah diunggah melalui sarana lain (mis. Google Drive madrasah).</div>
      {error && <div className="err" role="alert">{error}</div>}
    </Modal>
  )
}

function MaterialsTab() {
  const { options, user } = useAuth()
  const cs = options?.classSubjects || []
  const [filters, setFilters] = useState({ class_id: '' })
  const qs = `?${filters.class_id ? `class_id=${filters.class_id}` : ''}`
  const { data, loading, reload } = useFetch(`/lms/materials${qs}`, filters.class_id)
  const [form, setForm] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const canWrite = ['super_admin', 'kepala_mts', 'kepala_ma', 'guru', 'wali_kelas'].includes(user.role)
  const fields = useMemo(() => ([
    { name: 'class_subject_id', label: 'Kelas & mata pelajaran', type: 'select', required: true, options: cs.map((c) => ({ value: c.id, label: `${c.class_name} — ${c.subject_name}` })) },
    { name: 'title', label: 'Judul materi', required: true },
    { name: 'type', label: 'Jenis materi', type: 'select', options: [{ value: 'text', label: 'Teks/uraian' }, { value: 'link', label: 'Tautan' }] },
    { name: 'status', label: 'Status', type: 'select', options: [{ value: 'published', label: 'Terbit (dapat dilihat siswa)' }, { value: 'draft', label: 'Draft' }] },
    { name: 'url', label: 'Tautan (jika jenis tautan)' },
    { name: 'description', label: 'Ringkasan', type: 'textarea' },
    { name: 'content', label: 'Isi materi', type: 'textarea', rows: 5 },
  ]), [cs])
  const save = async (values, id) => {
    setBusy(true)
    try {
      if (id) {
        const patch = { title: values.title, description: values.description, type: values.type, content: values.content, url: values.url, status: values.status }
        await put(`/lms/materials/${id}`, patch)
      } else {
        await post('/lms/materials', { ...values, class_subject_id: Number(values.class_subject_id) })
      }
      setForm(null); reload()
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <div className="toolbar">
        <Select label="Filter kelas" value={filters.class_id} onChange={(v) => setFilters({ class_id: v })} options={(options?.classes || []).map((c) => ({ value: c.id, label: `${c.unit_code} — ${c.name}` }))} />
        {canWrite && <button className="btn sm" style={{ alignSelf: 'flex-end' }} onClick={() => setForm({})}>+ Tambah materi</button>}
        <button className="btn secondary sm" style={{ alignSelf: 'flex-end' }} onClick={reload}>↻ Muat ulang</button>
      </div>
      {loading ? <Loading /> : (data?.data || []).length === 0 ? <Empty text="Belum ada materi." /> : (
        <DataTable columns={[
          { key: 'title', label: 'Judul', render: (r) => <div><b>{r.title}</b>{r.description ? <div className="small muted">{r.description}</div> : null}</div> },
          { key: 'class_name', label: 'Kelas' },
          { key: 'subject_name', label: 'Mapel' },
          { key: 'teacher_name', label: 'Guru' },
          { key: 'type', label: 'Jenis', render: (r) => r.type === 'link' ? 'Tautan' : 'Teks' },
          { key: 'status', label: 'Status', render: (r) => <Pill value={r.status} /> },
          { key: 'created_at', label: 'Dibuat', render: (r) => tanggal(r.created_at) },
          { key: 'aksi', label: 'Aksi', render: (r) => canWrite ? <div className="row tight">
            <button className="btn secondary sm" onClick={() => setForm(r)}>Ubah</button>
            <button className="btn secondary sm" onClick={() => setConfirm(r)}>Arsipkan</button>
          </div> : <span className="muted small">—</span> },
        ]} rows={data.data} />
      )}
      {form && (
        <Modal title={form.id ? 'Ubah materi' : 'Tambah materi'} onClose={() => setForm(null)} footer={<>
          <button className="btn secondary" onClick={() => setForm(null)} disabled={busy}>Batal</button>
          <button className="btn" onClick={() => {
            const missing = fields.filter((f) => f.required && !(form[f.name] || '').toString().trim()).map((f) => f.label)
            if (missing.length) { alert(`Kolom wajib: ${missing.join(', ')}`); return }
            save(form, form.id)
          }} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </>}>
          <div className="grid k2">
            {fields.map((f) => {
              if (f.type === 'select') return <Select key={f.name} label={f.label} required={f.required} value={form[f.name]} onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))} options={f.options} />
              if (f.type === 'textarea') return <TextArea key={f.name} label={f.label} rows={f.rows || 3} value={form[f.name]} onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))} />
              return <Input key={f.name} label={f.label} required={f.required} value={form[f.name]} onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))} />
            })}
          </div>
        </Modal>
      )}
      {confirm && <Confirm title="Arsipkan materi" danger message={`Arsipkan materi "${confirm.title}"? Materi tetap tersimpan namun tidak tampil lagi bagi siswa.`}
        busy={busy} onCancel={() => setConfirm(null)} onConfirm={async () => { setBusy(true); try { await del(`/lms/materials/${confirm.id}`); setConfirm(null); reload() } catch (e) { alert(e.message) } finally { setBusy(false) } }} />}
    </div>
  )
}

function AssignmentsTab() {
  const { options, user } = useAuth()
  const cs = options?.classSubjects || []
  const [filters, setFilters] = useState({ class_id: '', status: '' })
  const qs = `?${filters.class_id ? `class_id=${filters.class_id}&` : ''}${filters.status ? `status=${filters.status}` : ''}`
  const { data, loading, reload } = useFetch(`/lms/assignments${qs}`, `${filters.class_id}|${filters.status}`)
  const [form, setForm] = useState(null)
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)
  const canWrite = ['super_admin', 'kepala_mts', 'kepala_ma', 'guru', 'wali_kelas'].includes(user.role)
  const save = async (values, id) => {
    setBusy(true)
    try {
      if (id) await put(`/lms/assignments/${id}`, { title: values.title, instructions: values.instructions, due_date: values.due_date, weight: Number(values.weight || 20), max_score: Number(values.max_score || 100), status: values.status, allow_late: !!values.allow_late })
      else await post('/lms/assignments', { ...values, class_subject_id: Number(values.class_subject_id), weight: Number(values.weight || 20), max_score: Number(values.max_score || 100) })
      setForm(null); reload()
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <div className="toolbar">
        <Select label="Filter kelas" value={filters.class_id} onChange={(v) => setFilters((s) => ({ ...s, class_id: v }))} options={(options?.classes || []).map((c) => ({ value: c.id, label: `${c.unit_code} — ${c.name}` }))} />
        <Select label="Status" value={filters.status} onChange={(v) => setFilters((s) => ({ ...s, status: v }))} options={[{ value: 'published', label: 'Terbit' }, { value: 'draft', label: 'Draft' }]} />
        {canWrite && <button className="btn sm" style={{ alignSelf: 'flex-end' }} onClick={() => setForm({ type: 'new' })}>+ Tambah tugas</button>}
        <button className="btn secondary sm" style={{ alignSelf: 'flex-end' }} onClick={reload}>↻ Muat ulang</button>
      </div>
      {loading ? <Loading /> : (data?.data || []).length === 0 ? <Empty text="Belum ada tugas." /> : (
        <DataTable columns={[
          { key: 'title', label: 'Tugas', render: (r) => <div><b>{r.title}</b><div className="small muted">{(r.instructions || '').slice(0, 90)}{(r.instructions || '').length > 90 ? '…' : ''}</div></div> },
          { key: 'class_name', label: 'Kelas' },
          { key: 'subject_name', label: 'Mapel' },
          { key: 'due_date', label: 'Tenggat', render: (r) => tanggal(r.due_date) },
          { key: 'student_count', label: 'Siswa', align: 'right' },
          { key: 'submitted_count', label: 'Terkumpul', align: 'right', render: (r) => `${r.submitted_count}` },
          { key: 'ungraded_count', label: 'Belum dinilai', align: 'right', render: (r) => r.ungraded_count ? <Pill value="warn" text={String(r.ungraded_count)} /> : '0' },
          { key: 'completion_percent', label: 'Penyelesaian', align: 'right', render: (r) => pct(r.completion_percent) },
          { key: 'status', label: 'Status', render: (r) => <Pill value={r.status} /> },
          { key: 'aksi', label: 'Aksi', render: (r) => <div className="row tight">
            <button className="btn secondary sm" onClick={() => setDetail(r)}>Daftar siswa</button>
            {canWrite && <button className="btn secondary sm" onClick={() => setForm({ ...r, type: 'edit' })}>Ubah</button>}
          </div> },
        ]} rows={data.data} />
      )}
      {form && (
        <Modal title={form.type === 'edit' ? 'Ubah tugas' : 'Tambah tugas'} onClose={() => setForm(null)} footer={<>
          <button className="btn secondary" onClick={() => setForm(null)} disabled={busy}>Batal</button>
          <button className="btn" onClick={() => {
            if (!form.title || !form.due_date) { alert('Judul dan tenggat pengumpulan wajib diisi.'); return }
            if (form.type === 'new' && !form.class_subject_id) { alert('Pilih kelas dan mata pelajaran.'); return }
            save(form, form.type === 'edit' ? form.id : null)
          }} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </>}>
          <div className="grid k2">
            {form.type === 'new' && <Select label="Kelas & mata pelajaran" required value={form.class_subject_id} onChange={(v) => setForm((s) => ({ ...s, class_subject_id: v }))} options={cs.map((c) => ({ value: c.id, label: `${c.class_name} — ${c.subject_name}` }))} />}
            <Input label="Judul tugas" required value={form.title} onChange={(v) => setForm((s) => ({ ...s, title: v }))} />
            <Input label="Tenggat pengumpulan" type="datetime-local" required value={(form.due_date || '').slice(0, 16)} onChange={(v) => setForm((s) => ({ ...s, due_date: v }))} />
            <Input label="Nilai maksimal" type="number" value={form.max_score || 100} onChange={(v) => setForm((s) => ({ ...s, max_score: v }))} />
            <Input label="Bobot terhadap nilai tugas (%)" type="number" value={form.weight || 20} onChange={(v) => setForm((s) => ({ ...s, weight: v }))} />
            <Select label="Status" value={form.status} onChange={(v) => setForm((s) => ({ ...s, status: v }))} options={[{ value: 'published', label: 'Terbit (siswa dapat mengumpulkan)' }, { value: 'draft', label: 'Draft' }]} />
          </div>
          <TextArea label="Instruksi tugas" rows={4} value={form.instructions} onChange={(v) => setForm((s) => ({ ...s, instructions: v }))} />
        </Modal>
      )}
      {detail && <AssignmentDetail assignment={detail} onClose={() => setDetail(null)} onChanged={reload} canGrade={canWrite} />}
    </div>
  )
}

function AssignmentDetail({ assignment, onClose, onChanged, canGrade }) {
  const { data, loading, reload } = useFetch(`/lms/assignments/${assignment.id}`, String(assignment.id))
  const [gradeFor, setGradeFor] = useState(null)
  const rows = data?.records || []
  return (
    <Modal wide title={`Pengumpulan — ${assignment.title}`} onClose={onClose} footer={<button className="btn" onClick={onClose}>Tutup</button>}>
      {loading ? <Loading /> : (
        <div className="stack">
          <div className="grid k4">
            <StatCard label="Siswa" value={num(rows.length, 0)} />
            <StatCard label="Sudah mengumpulkan" value={num(rows.filter((r) => r.status !== 'missing').length, 0)} />
            <StatCard label="Belum mengumpulkan" value={num(rows.filter((r) => r.status === 'missing').length, 0)} />
            <StatCard label="Belum dinilai" value={num(rows.filter((r) => r.status === 'submitted').length, 0)} />
          </div>
          <Bars rows={rows.slice(0, 12).map((r) => ({ key: r.student_id, label: r.name, value: r.score == null ? 0 : (r.score / (data.assignment.max_score || 100)) * 100 }))} suffix="%" warnBelow={0} />
          <DataTable columns={[
            { key: 'name', label: 'Siswa' },
            { key: 'nis', label: 'NIS' },
            { key: 'status', label: 'Status', render: (r) => <Pill value={r.status} /> },
            { key: 'submitted_at', label: 'Waktu kumpul', render: (r) => r.submitted_at ? tanggal(r.submitted_at, true) : '-' },
            { key: 'score', label: 'Nilai', align: 'right', render: (r) => r.score == null ? '-' : r.score },
            { key: 'feedback', label: 'Umpan balik', render: (r) => r.feedback || '-' },
            { key: 'aksi', label: 'Aksi', render: (r) => canGrade && r.submission_id ? <button className="btn secondary sm" onClick={() => setGradeFor(r)}>{r.score == null ? 'Nilai' : 'Ubah nilai'}</button> : null },
          ]} rows={rows} emptyText="Belum ada siswa." />
        </div>
      )}
      {gradeFor && <GradeSubmission record={gradeFor} maxScore={data?.assignment?.max_score} onClose={() => setGradeFor(null)} onDone={() => { setGradeFor(null); reload(); onChanged && onChanged() }} />}
    </Modal>
  )
}

function GradeSubmission({ record, maxScore = 100, onClose, onDone }) {
  const [score, setScore] = useState(record.score == null ? '' : String(record.score))
  const [feedback, setFeedback] = useState(record.feedback || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const send = async (publish) => {
    setBusy(true); setError(null)
    try { await post(`/lms/submissions/${record.submission_id}/grade`, { score: Number(score), feedback, publish }); onDone() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal title={`Nilai tugas — ${record.name}`} onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose} disabled={busy}>Batal</button>
      <button className="btn secondary" onClick={() => send(false)} disabled={busy || score === ''}>Simpan draft</button>
      <button className="btn" onClick={() => send(true)} disabled={busy || score === ''}>{busy ? 'Menyimpan…' : 'Simpan & publikasikan'}</button>
    </>}>
      <div className="small muted mb1">Jawaban siswa:</div>
      <div className="small" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '.5rem', maxHeight: 180, overflow: 'auto' }}>{record.content || '(tanpa teks jawaban)'}</div>
      {record.file_name && <div className="small muted mt1">Berkas: {record.file_name}</div>}
      <div className="mt2">
        <Input label={`Nilai (0-${maxScore})`} type="number" min="0" max={maxScore} value={score} onChange={setScore} required />
        <TextArea label="Umpan balik untuk siswa" rows={3} value={feedback} onChange={setFeedback} />
      </div>
      <div className="hint">Nilai hanya terlihat oleh siswa setelah dipublikasikan. Aksi ini tercatat pada audit log.</div>
      {error && <div className="err" role="alert">{error}</div>}
    </Modal>
  )
}

function GradingTab() {
  const { options } = useAuth()
  const [filters, setFilters] = useState({ class_id: '' })
  const { data, loading, reload } = useFetch(`/lms/assignments?${filters.class_id ? `class_id=${filters.class_id}` : ''}`, filters.class_id)
  const pending = (data?.data || []).filter((a) => a.ungraded_count > 0)
  const [detail, setDetail] = useState(null)
  return (
    <div className="stack">
      <div className="toolbar">
        <Select label="Filter kelas" value={filters.class_id} onChange={(v) => setFilters({ class_id: v })} options={(options?.classes || []).map((c) => ({ value: c.id, label: `${c.unit_code} — ${c.name}` }))} />
        <button className="btn secondary sm" style={{ alignSelf: 'flex-end' }} onClick={reload}>↻ Muat ulang</button>
        <div className="small muted" style={{ alignSelf: 'flex-end' }}>{pending.length} tugas memiliki pengumpulan yang belum dinilai.</div>
      </div>
      {loading ? <Loading /> : (
        <DataTable columns={[
          { key: 'title', label: 'Tugas' },
          { key: 'class_name', label: 'Kelas' },
          { key: 'subject_name', label: 'Mapel' },
          { key: 'due_date', label: 'Tenggat', render: (r) => tanggal(r.due_date) },
          { key: 'submitted_count', label: 'Terkumpul', align: 'right' },
          { key: 'ungraded_count', label: 'Belum dinilai', align: 'right', render: (r) => r.ungraded_count ? <Pill value="warn" text={String(r.ungraded_count)} /> : <Pill value="ok" text="0" /> },
          { key: 'aksi', label: 'Aksi', render: (r) => <button className="btn secondary sm" onClick={() => setDetail(r)} disabled={!r.ungraded_count}>Periksa & nilai</button> },
        ]} rows={pending} emptyText="Tidak ada pengumpulan tugas yang menunggu penilaian." />
      )}
      {detail && <AssignmentDetail assignment={detail} onClose={() => setDetail(null)} onChanged={reload} canGrade />}
    </div>
  )
}
