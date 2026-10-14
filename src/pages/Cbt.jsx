import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useFetch, useDebounced } from '../lib/auth'
import { Card, StatCard, Pill, Loading, Empty, Modal, Tabs, Select, Input, TextArea, Confirm, Check, Bars, SimpleDonut } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { post, put, del } from '../lib/api'
import { num, pct, tanggal, waktu, label } from '../lib/format'

export default function Cbt({ tab }) {
  const { user } = useAuth()
  const [t, setT] = useState(tab)
  useEffect(() => { setT(tab) }, [tab])
  const isSiswa = user.role === 'siswa'
  const tabs = isSiswa
    ? [{ value: 'siswa', label: 'Ujian saya' }]
    : [
      { value: 'bank', label: 'Bank soal' },
      { value: 'ujian', label: 'Kelola ujian' },
      { value: 'jadwal', label: 'Jadwal & monitoring' },
      { value: 'koreksi', label: 'Koreksi ujian' },
    ]
  return (
    <div className="stack">
      <Card title="Ujian Berbasis Komputer (CBT)" subtitle="Soal objektif dinilai otomatis dari kunci jawaban; soal uraian diperiksa guru. Kunci jawaban tidak pernah dikirim ke akun siswa.">
        <Tabs value={t} onChange={setT} tabs={tabs} />
        <div className="mt2">
          {t === 'bank' && <BankSoal />}
          {t === 'ujian' && <ExamManager />}
          {t === 'jadwal' && <ScheduleMonitor />}
          {t === 'koreksi' && <ExamGrading />}
          {t === 'siswa' && <StudentExams />}
        </div>
      </Card>
    </div>
  )
}

const emptyQuestion = { type: 'multiple_choice', difficulty: 'sedang', status: 'ready', options: ['', '', '', ''], answer_key: '' }

function BankSoal() {
  const { options, user } = useAuth()
  const [filters, setFilters] = useState({ unit_id: '', subject_id: '', type: '', difficulty: '', status: '' })
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const qs = useMemo(() => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v)
    if (dq) p.set('q', dq)
    return p.toString()
  }, [filters, dq])
  const { data, loading, reload } = useFetch(`/qbank?${qs}`, qs)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [imp, setImp] = useState(null)
  const [impUnit, setImpUnit] = useState('')
  const canWrite = ['super_admin', 'kepala_mts', 'kepala_ma', 'guru', 'wali_kelas', 'operator'].includes(user.role)
  const save = async () => {
    const v = form
    setBusy(true)
    try {
      const payload = {
        unit_id: Number(v.unit_id), subject_id: Number(v.subject_id), class_level: v.class_level ? Number(v.class_level) : null,
        topic: v.topic, type: v.type, question: v.question, explanation: v.explanation,
        difficulty: v.difficulty, weight: Number(v.weight || 1), status: v.status,
        options: v.type === 'multiple_choice' ? v.options.filter((o) => o && o.trim()) : null,
        answer_key: v.type === 'true_false' ? v.answer_key : v.answer_key,
      }
      if (v.id) await put(`/qbank/${v.id}`, payload)
      else await post('/qbank', payload)
      setForm(null); reload()
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <div className="toolbar">
        <input placeholder="Cari pertanyaan atau topik…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
        <Select value={filters.unit_id} onChange={(v) => setFilters((s) => ({ ...s, unit_id: v }))} options={(options?.allUnits || options?.units || []).map((u) => ({ value: u.id, label: u.code }))} placeholder="Unit: semua" />
        <Select value={filters.subject_id} onChange={(v) => setFilters((s) => ({ ...s, subject_id: v }))} options={(options?.subjects || []).map((s) => ({ value: s.id, label: s.name }))} placeholder="Mapel: semua" />
        <Select value={filters.type} onChange={(v) => setFilters((s) => ({ ...s, type: v }))} options={[{ value: 'multiple_choice', label: 'Pilihan ganda' }, { value: 'true_false', label: 'Benar/Salah' }, { value: 'essay', label: 'Uraian' }]} placeholder="Jenis: semua" />
        <Select value={filters.difficulty} onChange={(v) => setFilters((s) => ({ ...s, difficulty: v }))} options={[{ value: 'mudah', label: 'Mudah' }, { value: 'sedang', label: 'Sedang' }, { value: 'sulit', label: 'Sulit' }]} placeholder="Kesulitan: semua" />
        <Select value={filters.status} onChange={(v) => setFilters((s) => ({ ...s, status: v }))} options={[{ value: 'ready', label: 'Siap digunakan' }, { value: 'draft', label: 'Draft' }, { value: 'arsip', label: 'Arsip' }]} placeholder="Status: semua" />
        {canWrite && <button className="btn sm" onClick={() => setForm({ ...emptyQuestion, unit_id: options?.units?.[0]?.id || '' })}>+ Tambah soal</button>}
        {canWrite && <button className="btn secondary sm" onClick={() => { setImpUnit(String(options?.units?.[0]?.id || '')); setImp({ text: '' }) }}>Impor soal (JSON)</button>}
      </div>
      {loading ? <Loading /> : (
        <DataTable columns={[
          { key: 'question', label: 'Pertanyaan', render: (r) => <div><b>{r.question}</b><div className="small muted">{r.topic || '-'} • {r.subject_name} • kelas {r.class_level || '-'}</div></div> },
          { key: 'type', label: 'Jenis', render: (r) => label(r.type) },
          { key: 'difficulty', label: 'Kesulitan', render: (r) => <Pill value={r.difficulty} text={label(r.difficulty)} /> },
          { key: 'answer_key', label: 'Kunci', render: (r) => <span className="small">{r.type === 'essay' ? 'Pembahasan (uraian)' : r.answer_key}</span> },
          { key: 'status', label: 'Status', render: (r) => <Pill value={r.status} /> },
          { key: 'aksi', label: 'Aksi', render: (r) => canWrite ? <div className="row tight">
            <button className="btn secondary sm" onClick={() => setForm({ ...r, options: r.options || ['', '', '', ''] })}>Ubah</button>
            <button className="btn secondary sm" onClick={async () => { if (!confirm('Hapus/arsipkan soal ini?')) return; try { const res = await del(`/qbank/${r.id}`); alert(res.archived ? 'Soal dipakai pada ujian sehingga diarsipkan.' : 'Soal dihapus.'); reload() } catch (e) { alert(e.message) } }}>{r.status === 'arsip' ? 'Hapus' : 'Hapus'}</button>
          </div> : <span className="small muted">Hanya baca</span> },
        ]} rows={data?.data || []} emptyText="Belum ada soal yang cocok dengan filter." />
      )}
      {form && <QuestionForm form={form} setForm={setForm} options={options} busy={busy} onSave={save} onClose={() => setForm(null)} />}
      {imp && (
        <Modal title="Impor soal dari JSON" onClose={() => setImp(null)} footer={<>
          <button className="btn secondary" onClick={() => setImp(null)}>Tutup</button>
          <button className="btn" disabled={busy} onClick={async () => {
            let items
            try { items = JSON.parse(imp.text) } catch { alert('JSON tidak valid. Periksa format pada contoh.'); return }
            setBusy(true)
            try {
              const res = await post('/qbank/import', { unit_id: Number(impUnit), items: Array.isArray(items) ? items : [items] })
              setImp({ text: imp.text, result: res }); reload()
            } catch (e) { alert(e.message) } finally { setBusy(false) }
          }}>Impor</button>
        </>}>
          <div className="hint mb1">
            Format: array objek dengan kunci <code>subject_code</code> (kode mapel), <code>type</code> (multiple_choice/true_false/essay),
            <code> question</code>, <code>options</code>, <code>answer_key</code>, <code>explanation</code>, <code>difficulty</code>. Format ini adalah format internal aplikasi (belum diuji terhadap format impor aplikasi lain).
          </div>
          <Select label="Unit tujuan impor" value={impUnit} onChange={setImpUnit} options={(options?.allUnits || options?.units || []).map((u) => ({ value: u.id, label: u.name }))} />
          <TextArea label="Tempel JSON soal" rows={8} value={imp.text} onChange={(v) => setImp((s) => ({ ...s, text: v }))} />
          {imp.result && (
            <div className="small">
              <b>{imp.result.imported} soal berhasil diimpor.</b>
              {imp.result.failed.length ? <div className="err">Gagal: {imp.result.failed.map((f) => `baris ${f.index} (${f.problems.join(', ')})`).join('; ')}</div> : null}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function QuestionForm({ form, setForm, options, busy, onSave, onClose }) {
  const set = (patch) => setForm((s) => ({ ...s, ...patch }))
  const subjects = (options?.subjects || []).filter((s) => !form.unit_id || s.unit_id === Number(form.unit_id))
  return (
    <Modal wide title={form.id ? 'Ubah soal' : 'Tambah soal'} onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose} disabled={busy}>Batal</button>
      <button className="btn" onClick={onSave} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan soal'}</button>
    </>}>
      <div className="grid k2">
        <Select label="Unit pendidikan" required value={form.unit_id} onChange={(v) => set({ unit_id: v, subject_id: '' })} options={(options?.allUnits || options?.units || []).map((u) => ({ value: u.id, label: u.name }))} />
        <Select label="Mata pelajaran" required value={form.subject_id} onChange={(v) => set({ subject_id: v })} options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
        <Input label="Tingkat kelas" type="number" value={form.class_level || ''} onChange={(v) => set({ class_level: v })} hint="Contoh: 7 untuk kelas VII MTs, 10 untuk kelas X MA" />
        <Input label="Topik/bab" value={form.topic || ''} onChange={(v) => set({ topic: v })} />
        <Select label="Jenis soal" value={form.type} onChange={(v) => set({ type: v, answer_key: '' })} options={[{ value: 'multiple_choice', label: 'Pilihan ganda' }, { value: 'true_false', label: 'Benar/Salah' }, { value: 'essay', label: 'Uraian' }]} />
        <Select label="Tingkat kesulitan" value={form.difficulty} onChange={(v) => set({ difficulty: v })} options={[{ value: 'mudah', label: 'Mudah' }, { value: 'sedang', label: 'Sedang' }, { value: 'sulit', label: 'Sulit' }]} />
        <Select label="Status" value={form.status} onChange={(v) => set({ status: v })} options={[{ value: 'ready', label: 'Siap digunakan' }, { value: 'draft', label: 'Draft' }]} />
        <Input label="Bobot nilai" type="number" value={form.weight || 1} onChange={(v) => set({ weight: v })} />
      </div>
      <TextArea label="Pertanyaan" rows={3} required value={form.question || ''} onChange={(v) => set({ question: v })} />
      {form.type === 'multiple_choice' && (
        <div className="mt1">
          <div className="small"><b>Pilihan jawaban</b> (minimal dua)</div>
          <div className="grid k2">
            {[0, 1, 2, 3].map((i) => (
              <Input key={i} label={`Pilihan ${String.fromCharCode(65 + i)}`} value={(form.options || [])[i] || ''}
                onChange={(v) => setForm((s) => { const o = [...(s.options || ['', '', '', ''])]; o[i] = v; return { ...s, options: o } })} />
            ))}
          </div>
          <Select label="Kunci jawaban (pilih salah satu pilihan)" required value={form.answer_key} onChange={(v) => set({ answer_key: v })}
            options={(form.options || []).filter((o) => o && o.trim()).map((o) => ({ value: o, label: o }))} />
        </div>
      )}
      {form.type === 'true_false' && (
        <Select label="Kunci jawaban" required value={form.answer_key} onChange={(v) => set({ answer_key: v })} options={[{ value: 'true', label: 'Benar' }, { value: 'false', label: 'Salah' }]} />
      )}
      {form.type === 'essay' && (
        <TextArea label="Kunci pembahasan (dipakai guru saat mengoreksi)" rows={3} required value={form.answer_key || ''} onChange={(v) => set({ answer_key: v })} />
      )}
      <TextArea label="Pembahasan/penjelasan jawaban" rows={3} value={form.explanation || ''} onChange={(v) => set({ explanation: v })} />
    </Modal>
  )
}

// ------------------------------------------------------------------ kelola ujian
function ExamManager() {
  const { options, user } = useAuth()
  const [filters, setFilters] = useState({ class_id: '', status: '' })
  const qs = `?${filters.class_id ? `class_id=${filters.class_id}&` : ''}${filters.status ? `status=${filters.status}` : ''}`
  const { data, loading, reload } = useFetch(`/exams${qs}`, `${filters.class_id}|${filters.status}`)
  const [builder, setBuilder] = useState(null)
  const [monitor, setMonitor] = useState(null)
  const canWrite = ['super_admin', 'kepala_mts', 'kepala_ma', 'guru', 'wali_kelas'].includes(user.role)
  return (
    <div className="stack">
      <div className="toolbar">
        <Select label="Filter kelas" value={filters.class_id} onChange={(v) => setFilters((s) => ({ ...s, class_id: v }))} options={(options?.classes || []).map((c) => ({ value: c.id, label: `${c.unit_code} — ${c.name}` }))} />
        <Select label="Status" value={filters.status} onChange={(v) => setFilters((s) => ({ ...s, status: v }))} options={['draft', 'published', 'closed'].map((v) => ({ value: v, label: label(v) }))} />
        {canWrite && <button className="btn sm" style={{ alignSelf: 'flex-end' }} onClick={() => setBuilder({ type: 'new' })}>+ Buat ujian</button>}
        <button className="btn secondary sm" style={{ alignSelf: 'flex-end' }} onClick={reload}>↻ Muat ulang</button>
      </div>
      {loading ? <Loading /> : (
        <DataTable columns={[
          { key: 'title', label: 'Ujian', render: (r) => <div><b>{r.title}</b><div className="small muted">{r.unit_code} {r.class_name} • {r.subject_name} • {r.teacher_name || '-'}</div></div> },
          { key: 'start_at', label: 'Jadwal', render: (r) => <div>{tanggal(r.start_at)}<div className="small muted">{waktu(r.start_at).split(', ').pop()} – {waktu(r.end_at).split(', ').pop()}</div></div> },
          { key: 'duration_minutes', label: 'Durasi', align: 'right', render: (r) => `${r.duration_minutes} menit` },
          { key: 'question_count', label: 'Soal', align: 'right' },
          { key: 'participant_count', label: 'Peserta', align: 'right' },
          { key: 'graded_count', label: 'Selesai dinilai', align: 'right' },
          { key: 'pending_count', label: 'Perlu koreksi', align: 'right', render: (r) => r.pending_count ? <Pill value="warn" text={String(r.pending_count)} /> : '0' },
          { key: 'status', label: 'Status', render: (r) => <Pill value={r.status} /> },
          { key: 'aksi', label: 'Aksi', render: (r) => <div className="row tight">
            <button className="btn secondary sm" onClick={() => setMonitor(r.id)}>Monitoring</button>
            {canWrite && <button className="btn secondary sm" onClick={() => setBuilder({ ...r, type: 'edit' })}>Ubah</button>}
          </div> },
        ]} rows={data?.data || []} emptyText="Belum ada ujian." />
      )}
      {builder && <ExamBuilder exam={builder} onClose={() => setBuilder(null)} onDone={() => { setBuilder(null); reload() }} />}
      {monitor && <MonitorModal examId={monitor} onClose={() => setMonitor(null)} />}
    </div>
  )
}

function ExamBuilder({ exam, onClose, onDone }) {
  const { options } = useAuth()
  const isEdit = exam.type === 'edit'
  const [v, setV] = useState(() => ({
    id: exam.id, title: exam.title || '', class_id: exam.class_id ? String(exam.class_id) : '', subject_id: exam.subject_id ? String(exam.subject_id) : '',
    start_at: exam.start_at ? String(exam.start_at).slice(0, 16) : '', end_at: exam.end_at ? String(exam.end_at).slice(0, 16) : '',
    duration_minutes: exam.duration_minutes || 60, instructions: exam.instructions || '', shuffle_questions: !!exam.shuffle_questions,
    shuffle_options: !!exam.shuffle_options, status: exam.status || 'draft', show_result: exam.show_result !== 0,
  }))
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const classLevel = (options?.classes || []).find((c) => String(c.id) === v.class_id)?.level
  const qs = v.subject_id ? `?subject_id=${v.subject_id}${classLevel ? `&class_level=${classLevel}` : ''}` : ''
  const { data: bank } = useFetch(`/qbank${qs}`, `${v.subject_id}|${classLevel}`)
  const { data: detail } = useFetch(isEdit ? `/exams/${exam.id}` : '', String(exam.id || ''))
  useEffect(() => { if (detail?.questions) setSelected(detail.questions.map((q) => q.question_id)) }, [detail])
  const subjects = (options?.subjects || []).filter((s) => { const c = (options?.classes || []).find((x) => String(x.id) === v.class_id); return !c || s.unit_id === c.unit_id })

  const save = async () => {
    if (!v.title || !v.class_id || !v.subject_id || !v.start_at || !v.end_at) { setError('Judul, kelas, mata pelajaran, waktu mulai, dan waktu selesai wajib diisi.'); return }
    setBusy(true); setError(null)
    try {
      if (isEdit) await put(`/exams/${exam.id}`, { ...v, duration_minutes: Number(v.duration_minutes), question_ids: selected.map(Number) })
      else await post('/exams', { ...v, class_id: Number(v.class_id), subject_id: Number(v.subject_id), duration_minutes: Number(v.duration_minutes), question_ids: selected.map(Number) })
      onDone()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal wide title={isEdit ? 'Ubah ujian' : 'Buat ujian baru'} onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose} disabled={busy}>Batal</button>
      <button className="btn" onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan ujian'}</button>
    </>}>
      <div className="grid k2">
        <Input label="Judul ujian" required value={v.title} onChange={(x) => setV((s) => ({ ...s, title: x }))} />
        <Select label="Kelas peserta" required value={v.class_id} onChange={(x) => setV((s) => ({ ...s, class_id: x }))} options={(options?.classes || []).map((c) => ({ value: c.id, label: `${c.unit_code} — ${c.name}` }))} />
        <Select label="Mata pelajaran" required value={v.subject_id} onChange={(x) => setV((s) => ({ ...s, subject_id: x }))} options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
        <Input label="Durasi (menit)" type="number" min="5" value={v.duration_minutes} onChange={(x) => setV((s) => ({ ...s, duration_minutes: x }))} />
        <Input label="Waktu mulai" type="datetime-local" required value={v.start_at} onChange={(x) => setV((s) => ({ ...s, start_at: x }))} />
        <Input label="Waktu selesai" type="datetime-local" required value={v.end_at} onChange={(x) => setV((s) => ({ ...s, end_at: x }))} />
        <Select label="Status" value={v.status} onChange={(x) => setV((s) => ({ ...s, status: x }))} options={[{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Terbit (dapat dikerjakan siswa)' }, { value: 'closed', label: 'Ditutup' }]} />
        <div>
          <Check label="Acak urutan soal" checked={v.shuffle_questions} onChange={(x) => setV((s) => ({ ...s, shuffle_questions: x }))} />
          <Check label="Acak urutan pilihan jawaban" checked={v.shuffle_options} onChange={(x) => setV((s) => ({ ...s, shuffle_options: x }))} hint="Pengacakan memakai urutan tetap per peserta." />
          <Check label="Tampilkan nilai ke siswa setelah dipublikasikan" checked={v.show_result} onChange={(x) => setV((s) => ({ ...s, show_result: x }))} />
        </div>
      </div>
      <TextArea label="Instruksi ujian" rows={3} value={v.instructions} onChange={(x) => setV((s) => ({ ...s, instructions: x }))} />
      <div className="mt1">
        <div className="row between">
          <b className="small">Pilih soal dari bank soal ({selected.length} dipilih)</b>
          <span className="small muted">Pilih mata pelajaran dan kelas untuk menampilkan soal yang sesuai tingkat.</span>
        </div>
        <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: '.5rem' }}>
          {(bank?.data || []).length === 0 ? <div className="small muted">Tidak ada soal pada mata pelajaran/tingkat ini. Tambahkan soal pada tab Bank Soal.</div> : (bank?.data || []).map((q) => (
            <label key={q.id} className="row tight" style={{ alignItems: 'flex-start', padding: '.25rem 0', borderBottom: '1px solid #f1f5f3' }}>
              <input type="checkbox" checked={selected.includes(q.id)} onChange={(e) => setSelected((s) => e.target.checked ? [...s, q.id] : s.filter((x) => x !== q.id))} />
              <span className="small"><b>{label(q.type)}</b> — {q.question.slice(0, 110)}{q.question.length > 110 ? '…' : ''} <span className="muted">({q.topic || '-'}, {label(q.difficulty)})</span></span>
            </label>
          ))}
        </div>
      </div>
      {error && <div className="err mt1" role="alert">{error}</div>}
    </Modal>
  )
}

function MonitorModal({ examId, onClose }) {
  const { data, loading, reload } = useFetch(`/exams/${examId}/monitor`, String(examId))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const publish = async () => {
    setBusy(true); setMsg(null)
    try { const r = await post(`/exams/${examId}/publish`, { mode: 'graded' }); setMsg(`Hasil dipublikasikan untuk ${r.published} peserta yang sudah dinilai.`); reload() }
    catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal wide title={`Monitoring ujian — ${data?.exam?.title || ''}`} onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose}>Tutup</button>
      <button className="btn" onClick={publish} disabled={busy}>{busy ? 'Memproses…' : 'Publikasikan hasil yang sudah dinilai'}</button>
    </>}>
      {loading || !data ? <Loading /> : (
        <div className="stack">
          <div className="grid k4">
            <StatCard label="Peserta" value={num(data.counts.not_started + data.counts.in_progress + data.counts.submitted + data.counts.graded, 0)} />
            <StatCard label="Belum mulai" value={num(data.counts.not_started, 0)} />
            <StatCard label="Sedang mengerjakan" value={num(data.counts.in_progress, 0)} />
            <StatCard label="Sudah mengirim" value={num(data.counts.submitted + data.counts.graded, 0)} foot={`${data.counts.graded} sudah dinilai`} />
          </div>
          <div className="row tight">
            <Pill value={data.exam.window_state} text={label(data.exam.window_state)} />
            <span className="small muted">Jadwal {waktu(data.exam.start_at)} – {waktu(data.exam.end_at)} • durasi {data.exam.duration_minutes} menit • {data.exam.question_count} soal</span>
          </div>
          {data.conflicts.length ? <div className="small" style={{ color: '#b54708' }}>Peringatan: jadwal bertumpuk dengan {data.conflicts.map((c) => c.title).join(', ')} pada kelas yang sama.</div> : <div className="small" style={{ color: '#067647' }}>Tidak terdeteksi konflik jadwal pada kelas dan tanggal yang sama.</div>}
          {msg && <div className="small" style={{ color: '#0f6b4f' }}>{msg}</div>}
          <SimpleDonut data={[
            { name: 'Belum mulai', value: data.counts.not_started }, { name: 'Mengerjakan', value: data.counts.in_progress },
            { name: 'Terkirim', value: data.counts.submitted }, { name: 'Dinilai', value: data.counts.graded },
          ]} />
          <DataTable columns={[
            { key: 'student_name', label: 'Siswa' },
            { key: 'nis', label: 'NIS' },
            { key: 'status', label: 'Status', render: (r) => <Pill value={r.status} /> },
            { key: 'answered', label: 'Jawaban tersimpan', align: 'right' },
            { key: 'started_at', label: 'Mulai', render: (r) => r.started_at ? waktu(r.started_at) : '-' },
            { key: 'submitted_at', label: 'Kirim', render: (r) => r.submitted_at ? waktu(r.submitted_at) : '-' },
            { key: 'objective_score', label: 'Objektif', align: 'right', render: (r) => r.objective_score == null ? '-' : num(r.objective_score) },
            { key: 'final_score', label: 'Nilai akhir', align: 'right', render: (r) => r.final_score == null ? '-' : num(r.final_score) },
            { key: 'published', label: 'Publikasi', render: (r) => r.published ? <Pill value="ok" text="Terbit" /> : <Pill value="neutral" text="Belum" /> },
          ]} rows={data.participants} emptyText="Belum ada peserta." />
        </div>
      )}
    </Modal>
  )
}

function ScheduleMonitor() {
  const [range, setRange] = useState({ from: '', to: '' })
  const qs = `?${range.from ? `from=${range.from}&` : ''}${range.to ? `to=${range.to}` : ''}`
  const { data, loading, reload } = useFetch(`/exam/schedule${qs}`, `${range.from}|${range.to}`)
  const [monitor, setMonitor] = useState(null)
  const rows = data?.data || []
  return (
    <div className="stack">
      <div className="toolbar">
        <Input label="Dari tanggal" type="date" value={range.from} onChange={(v) => setRange((s) => ({ ...s, from: v }))} />
        <Input label="Sampai tanggal" type="date" value={range.to} onChange={(v) => setRange((s) => ({ ...s, to: v }))} />
        <button className="btn secondary sm" style={{ alignSelf: 'flex-end' }} onClick={reload}>↻ Muat ulang</button>
      </div>
      <div className="grid k4">
        <StatCard label="Ujian terjadwal" value={num(rows.length, 0)} />
        <StatCard label="Siap dilaksanakan" value={num(rows.filter((r) => r.ready).length, 0)} />
        <StatCard label="Belum siap" value={num(rows.filter((r) => !r.ready).length, 0)} foot="belum memiliki soal atau peserta" />
        <StatCard label="Potensi konflik jadwal" value={num((data?.conflicts || []).length, 0)} />
      </div>
      {data?.conflicts?.length ? (
        <div className="card" style={{ background: 'var(--warn-50)', borderColor: '#fedf89' }}>
          <b className="small">Peringatan jadwal bertumpuk</b>
          {data.conflicts.map((c, i) => <div className="small" key={i}>Kelas {c.class_name} pada {tanggal(c.date)}: “{c.exam_a}” bertumpuk dengan “{c.exam_b}”.</div>)}
        </div>
      ) : null}
      {loading ? <Loading /> : (
        <DataTable columns={[
          { key: 'exam_date', label: 'Tanggal', render: (r) => tanggal(r.exam_date) },
          { key: 'title', label: 'Ujian', render: (r) => <div><b>{r.title}</b><div className="small muted">{r.unit_code} {r.class_name} • {r.subject_name}</div></div> },
          { key: 'waktu', label: 'Waktu', render: (r) => `${waktu(r.start_at).split(', ').pop()} – ${waktu(r.end_at).split(', ').pop()}` },
          { key: 'duration_minutes', label: 'Durasi', align: 'right', render: (r) => `${r.duration_minutes}′` },
          { key: 'window_state', label: 'Status waktu', render: (r) => <Pill value={r.window_state} text={label(r.window_state)} /> },
          { key: 'not_started', label: 'Belum mulai', align: 'right' },
          { key: 'in_progress', label: 'Mengerjakan', align: 'right' },
          { key: 'finished', label: 'Selesai', align: 'right' },
          { key: 'ready', label: 'Kesiapan', render: (r) => r.ready ? <Pill value="ok" text="Siap" /> : <Pill value="warn" text={r.ready_issues.join(', ')} /> },
          { key: 'aksi', label: 'Aksi', render: (r) => <button className="btn secondary sm" onClick={() => setMonitor(r.id)}>Monitoring</button> },
        ]} rows={rows} emptyText="Belum ada ujian pada rentang tanggal ini." />
      )}
      {monitor && <MonitorModal examId={monitor} onClose={() => setMonitor(null)} />}
    </div>
  )
}

// ------------------------------------------------------------------ koreksi ujian
function ExamGrading() {
  const { options } = useAuth()
  const [examId, setExamId] = useState('')
  const { data: exams } = useFetch('/exams?status=&limit=100', 'grading-list')
  const list = (exams?.data || []).filter((e) => ['published', 'closed'].includes(e.status))
  const { data, loading, reload } = useFetch(examId ? `/exams/${examId}/grading` : '', examId)
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const publish = async () => {
    setBusy(true); setMessage(null)
    try { const r = await post(`/exams/${examId}/publish`, { mode: 'graded' }); setMessage(`Hasil dipublikasikan untuk ${r.published} peserta yang sudah dinilai.`); reload() }
    catch (e) { setMessage(e.message) } finally { setBusy(false) }
  }
  const participants = data?.participants || []
  const pending = participants.filter((p) => p.essays_pending > 0)
  return (
    <div className="stack">
      <div className="toolbar">
        <Select label="Pilih ujian" value={examId} onChange={setExamId} options={list.map((e) => ({ value: e.id, label: `${e.title} (${e.unit_code} ${e.class_name})` }))} />
        {examId && <button className="btn sm" style={{ alignSelf: 'flex-end' }} onClick={publish} disabled={busy}>Publikasikan hasil yang sudah dinilai</button>}
        {examId && <button className="btn secondary sm" style={{ alignSelf: 'flex-end' }} onClick={reload}>↻ Muat ulang</button>}
      </div>
      {message && <div className="small" style={{ color: '#0f6b4f' }}>{message}</div>}
      {!examId ? <Empty text="Pilih ujian untuk melihat jawaban siswa. Nilai pilihan ganda dihitung otomatis; jawaban uraian dinilai manual di sini." /> : loading ? <Loading /> : (
        <div className="stack">
          <div className="grid k4">
            <StatCard label="Peserta mengirim" value={num(participants.length, 0)} />
            <StatCard label="Perlu koreksi uraian" value={num(pending.length, 0)} />
            <StatCard label="Sudah dinilai" value={num(participants.filter((p) => p.status === 'graded').length, 0)} />
            <StatCard label="Rata-rata belum lengkap" value={num(participants.filter((p) => p.final_score == null).length, 0)} foot="menunggu nilai uraian" />
          </div>
          {participants.map((p) => (
            <div className="card" key={p.participant_id}>
              <div className="row between">
                <div>
                  <b>{p.student_name}</b> <span className="small muted">NIS {p.nis} • dikirim {p.submitted_at ? waktu(p.submitted_at) : '-'}</span>
                </div>
                <div className="row tight">
                  <Pill value={p.status} />
                  <span className="small">Objektif: <b>{num(p.objective_score)}</b></span>
                  <span className="small">Uraian: <b>{num(p.essay_score)}</b></span>
                  <span className="small">Nilai akhir: <b>{num(p.final_score)}</b></span>
                  {p.published ? <Pill value="ok" text="Terbit" /> : null}
                </div>
              </div>
              <div className="grid k2 mt2">
                <div className="small muted">Pilihan ganda: {p.objective_correct} benar dari {p.objective_total} soal.</div>
              </div>
              {p.essays.length === 0 ? <div className="small muted mt1">Ujian ini tidak memiliki soal uraian.</div> : (
                <div className="stack mt1">
                  {p.essays.map((e) => <EssayGrade key={e.answer_id} essay={e} onSaved={() => { setMessage('Nilai uraian tersimpan.'); reload() }} onError={(m) => setMessage(m)} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EssayGrade({ essay, onSaved, onError }) {
  const [score, setScore] = useState(essay.score == null ? '' : String(essay.score))
  const [feedback, setFeedback] = useState(essay.feedback || '')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try { await post(`/exam/answers/${essay.answer_id}/grade`, { score: Number(score), feedback }); onSaved() }
    catch (e) { onError(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="qbox">
      <div className="small"><b>Soal uraian:</b> {essay.question}</div>
      <div className="small mt1" style={{ background: '#f7faf9', borderRadius: 8, padding: '.5rem' }}>
        <b>Jawaban siswa:</b><div>{essay.answer || '(tidak dijawab)'}</div>
      </div>
      <div className="small mt1 muted"><b>Kunci/pembahasan:</b> {essay.answer_key}{essay.explanation ? ` — ${essay.explanation}` : ''}</div>
      <div className="row tight mt1">
        <input type="number" min="0" max="100" placeholder="nilai 0-100" value={score} onChange={(e) => setScore(e.target.value)} style={{ maxWidth: 130 }} />
        <input placeholder="umpan balik untuk siswa" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
        <button className="btn sm" onClick={save} disabled={busy || score === ''}>{busy ? 'Menyimpan…' : essay.score == null ? 'Simpan nilai' : 'Perbarui nilai'}</button>
        {essay.score != null ? <Pill value="ok" text={`Dinilai: ${essay.score}`} /> : <Pill value="warn" text="Belum dinilai" />}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ siswa
function StudentExams() {
  const { data, loading, reload } = useFetch('/exams', 'student-exams')
  const rows = (data?.data || []).filter((e) => ['published', 'closed'].includes(e.status))
  return (
    <div className="stack">
      <div className="grid k4">
        <StatCard label="Ujian terdaftar" value={num(rows.length, 0)} />
        <StatCard label="Siap dikerjakan" value={num(rows.filter((r) => r.can_start).length, 0)} />
        <StatCard label="Sedang dikerjakan" value={num(rows.filter((r) => r.can_continue).length, 0)} />
        <StatCard label="Nilai sudah terbit" value={num(rows.filter((r) => r.my_score != null).length, 0)} />
      </div>
      <div className="toolbar">
        <Link className="btn secondary sm" to="/lms/tugas">Tugas pembelajaran →</Link>
        <button className="btn secondary sm" onClick={reload}>↻ Muat ulang</button>
      </div>
      {loading ? <Loading /> : (
        <DataTable columns={[
          { key: 'title', label: 'Ujian', render: (r) => <div><b>{r.title}</b><div className="small muted">{r.subject_name} • {r.teacher_name || '-'} • {r.question_count} soal • {r.duration_minutes} menit</div></div> },
          { key: 'start_at', label: 'Jadwal', render: (r) => `${tanggal(r.start_at)} ${waktu(r.start_at).split(', ').pop()}–${waktu(r.end_at).split(', ').pop()}` },
          { key: 'window_state', label: 'Waktu', render: (r) => <Pill value={r.window_state} text={label(r.window_state)} /> },
          { key: 'my_status', label: 'Status saya', render: (r) => <Pill value={r.my_status} /> },
          { key: 'my_score', label: 'Nilai', align: 'right', render: (r) => r.show_result && r.my_score != null ? num(r.my_score) : (r.my_status === 'graded' ? 'Menunggu publikasi' : '-') },
          { key: 'aksi', label: 'Aksi', render: (r) => (
            <div className="row tight">
              {r.can_start ? <Link className="btn sm" to={`/ujian/${r.id}`}>Mulai ujian</Link> : null}
              {r.can_continue ? <Link className="btn sm" to={`/ujian/${r.id}`}>Lanjutkan</Link> : null}
              {['submitted', 'graded'].includes(r.my_status) ? <Link className="btn secondary sm" to={`/ujian/${r.id}`}>Lihat jawaban</Link> : null}
              {!r.can_start && !r.can_continue && !['submitted', 'graded'].includes(r.my_status) ? <span className="small muted">Belum dibuka</span> : null}
            </div>
          ) },
        ]} rows={rows} emptyText="Belum ada ujian untuk kelas Anda." />
      )}
      <div className="small muted">Catatan: sistem tidak menyediakan penguncian perangkat atau anti-kecurangan tingkat lanjut. Pengawasan ujian dilakukan oleh guru/pengawas ruang.</div>
    </div>
  )
}
