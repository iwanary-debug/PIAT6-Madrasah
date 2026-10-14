import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useFetch } from '../lib/auth'
import { Card, Tabs, StatCard, Pill, Loading, Empty, Bars, Select, Input, TextArea, Modal, Confirm } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { post, del } from '../lib/api'
import { num, pct, label } from '../lib/format'

const TYPES = [
  { value: 'tugas', label: 'Tugas' }, { value: 'harian', label: 'Nilai Harian' }, { value: 'uts', label: 'PTS/UTS' },
  { value: 'uas', label: 'PAS/UAS' }, { value: 'praktik', label: 'Praktik' }, { value: 'proyek', label: 'Proyek' },
]

export default function Grades() {
  const { options, user } = useAuth()
  const semesters = options?.semesters || []
  const [semesterId, setSemesterId] = useState(String(semesters.find((s) => s.is_active)?.id || semesters[0]?.id || ''))
  const classSubjects = options?.classSubjects || []
  const [csId, setCsId] = useState(classSubjects.length ? String(classSubjects[0].id) : '')
  const [tab, setTab] = useState('input')
  const [message, setMessage] = useState(null)
  const [newComp, setNewComp] = useState(null)

  useEffect(() => { if (!csId && classSubjects.length) setCsId(String(classSubjects[0].id)) }, [classSubjects, csId])

  const cs = classSubjects.find((c) => String(c.id) === csId)
  const comps = useFetch(csId ? `/grades/components?class_subject_id=${csId}&semester_id=${semesterId}` : '', `${csId}|${semesterId}`)
  const [compId, setCompId] = useState('')
  useEffect(() => {
    const list = comps.data?.data || []
    if (list.length && !list.find((c) => String(c.id) === compId)) setCompId(String(list[0].id))
    if (!list.length) setCompId('')
  }, [comps.data, compId])

  const usedWeight = (comps.data?.data || []).reduce((a, c) => a + Number(c.weight || 0), 0)
  const remaining = 100 - usedWeight

  return (
    <div className="stack">
      <Card title="Penilaian Akademik" subtitle="Nilai akhir dihitung dari komponen terpilih: (Σ nilai × bobot) ÷ total bobot komponen yang sudah terisi.">
        <div className="toolbar">
          <Select label="Mata pelajaran & kelas" value={csId} onChange={setCsId} options={classSubjects.map((c) => ({ value: c.id, label: `${c.class_name} — ${c.subject_name}` }))} />
          <Select label="Semester" value={semesterId} onChange={setSemesterId} options={semesters.map((s) => ({ value: s.id, label: `${s.academic_year_name} — ${s.name}` }))} />
          <div className="small muted" style={{ alignSelf: 'flex-end' }}>KKM mapel ini: <b>{cs ? cs.kkm : '-'}</b> • Bobot terpakai: <b>{usedWeight}%</b> (sisa {remaining}%)</div>
        </div>
        {message && <div className={message.type === 'err' ? 'err' : ''} style={message.type === 'ok' ? { color: '#067647' } : undefined}>{message.text}</div>}
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'input', label: 'Input nilai' },
          { value: 'komponen', label: 'Komponen & bobot', count: (comps.data?.data || []).length },
          { value: 'rekap', label: 'Rekap kelas' },
          { value: 'analisis', label: 'Analisis mapel' },
        ]} />
        <div className="mt2">
          {!csId ? <Empty text="Pilih mata pelajaran dan kelas. Jika daftar kosong, pastikan Anda memiliki penugasan mengajar." /> : tab === 'input' && (
            <GradeInput cs={cs} comps={comps.data?.data || []} compId={compId} setCompId={setCompId} busy={comps.loading} onSaved={(t) => { setMessage({ type: 'ok', text: t }); comps.reload() }} onError={(t) => setMessage({ type: 'err', text: t })} />
          )}
          {tab === 'komponen' && (
            <>
              <div className="toolbar mb1">
                <button className="btn sm" onClick={() => setNewComp(true)} disabled={usedWeight >= 100}>+ Tambah komponen</button>
                <span className="small muted">Total bobot tidak boleh melebihi 100%.</span>
              </div>
              <DataTable columns={[
                { key: 'name', label: 'Komponen' },
                { key: 'type', label: 'Jenis', render: (r) => label(r.type) },
                { key: 'weight', label: 'Bobot', align: 'right', render: (r) => `${r.weight}%` },
                { key: 'aksi', label: 'Aksi', render: (r) => <div className="row tight">
                  <button className="btn secondary sm" onClick={() => { setCompId(String(r.id)); setTab('input') }}>Isi nilai</button>
                  <DeleteComponent id={r.id} onDone={() => comps.reload()} onError={(t) => setMessage({ type: 'err', text: t })} />
                </div> },
              ]} rows={comps.data?.data || []} emptyText="Belum ada komponen penilaian pada semester ini." />
              {newComp && (
                <ComponentForm csId={csId} semesterId={semesterId} remaining={remaining} onClose={() => setNewComp(null)}
                  onSaved={(t) => { setMessage({ type: 'ok', text: t }); setNewComp(null); comps.reload() }} />
              )}
            </>
          )}
          {tab === 'rekap' && <ClassRecap cs={cs} semesterId={semesterId} />}
          {tab === 'analisis' && <SubjectAnalysis cs={cs} semesterId={semesterId} />}
        </div>
      </Card>
    </div>
  )
}

function DeleteComponent({ id, onDone, onError }) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <>
      <button className="btn secondary sm" onClick={() => setConfirm(true)}>Hapus</button>
      {confirm && <Confirm title="Hapus komponen nilai" danger
        message="Menghapus komponen akan menghapus seluruh nilai siswa pada komponen ini. Tindakan ini tercatat pada audit log."
        busy={busy} onCancel={() => setConfirm(false)}
        onConfirm={async () => { setBusy(true); try { await del(`/grades/components/${id}`); setConfirm(false); onDone() } catch (e) { onError(e.message) } finally { setBusy(false) } }} />}
    </>
  )
}

function ComponentForm({ csId, semesterId, remaining, onClose, onSaved }) {
  const [v, setV] = useState({ name: '', type: 'tugas', weight: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const save = async () => {
    setBusy(true); setError(null)
    try {
      await post('/grades/components', { class_subject_id: Number(csId), name: v.name, type: v.type, weight: Number(v.weight), semester_id: Number(semesterId) })
      onSaved(`Komponen "${v.name}" ditambahkan dengan bobot ${v.weight}%.`)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal title="Tambah komponen penilaian" onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose} disabled={busy}>Batal</button>
      <button className="btn" onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan komponen'}</button>
    </>}>
      <Input label="Nama komponen" required value={v.name} onChange={(x) => setV((s) => ({ ...s, name: x }))} placeholder="Contoh: Nilai Praktik" />
      <Select label="Jenis komponen" value={v.type} onChange={(x) => setV((s) => ({ ...s, type: x }))} options={TYPES} />
      <Input label={`Bobot (%) — sisa ${remaining}%`} type="number" min="1" max="100" value={v.weight} onChange={(x) => setV((s) => ({ ...s, weight: x }))} />
      {error && <div className="err" role="alert">{error}</div>}
      <div className="hint">Bobot dipakai untuk menghitung nilai akhir bersama komponen lain pada semester ini.</div>
    </Modal>
  )
}

function GradeInput({ cs, comps, compId, setCompId, onSaved, onError, busy }) {
  const { data, loading, reload } = useFetch(compId ? `/grades/matrix?component_id=${compId}` : '', compId)
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!data) return
    const init = {}
    for (const r of data.records) init[r.student_id] = r.score == null ? '' : String(r.score)
    setValues(init)
  }, [data])
  if (!comps.length) return <Empty text="Belum ada komponen. Tambahkan komponen penilaian terlebih dahulu." />
  const filled = Object.values(values).filter((v) => v !== '').length
  const save = async () => {
    const entries = Object.entries(values).map(([k, v]) => ({ student_id: Number(k), score: v === '' ? null : Number(v) }))
    const bad = entries.find((e) => e.score != null && (isNaN(e.score) || e.score < 0 || e.score > 100))
    if (bad) { onError('Nilai harus berupa angka antara 0 dan 100.'); return }
    setSaving(true)
    try {
      const res = await post('/grades/scores', { component_id: Number(compId), entries })
      onSaved(`Nilai tersimpan untuk ${res.saved} siswa pada komponen terpilih.`)
      reload()
    } catch (e) { onError(e.message) } finally { setSaving(false) }
  }
  return (
    <div className="stack">
      <div className="toolbar">
        <Select label="Komponen nilai" value={compId} onChange={setCompId} options={comps.map((c) => ({ value: c.id, label: `${c.name} (${c.weight}%)` }))} />
        <div className="small muted" style={{ alignSelf: 'flex-end' }}>{data ? `${filled} dari ${data.records.length} nilai terisi` : ''}</div>
        <div className="grow" />
        <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={save} disabled={saving || !data}>{saving ? 'Menyimpan…' : 'Simpan nilai'}</button>
      </div>
      {loading ? <Loading /> : !data ? <Empty text="Pilih komponen nilai." /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>NIS</th><th>Nama siswa</th><th style={{ width: 140 }}>Nilai (0-100)</th><th>Status</th></tr></thead>
            <tbody>
              {data.records.map((r) => {
                const v = values[r.student_id]
                return (
                  <tr key={r.student_id}>
                    <td>{r.nis}</td>
                    <td>{r.name}</td>
                    <td><input type="number" min="0" max="100" value={v == null ? '' : v} onChange={(e) => setValues((s) => ({ ...s, [r.student_id]: e.target.value }))} /></td>
                    <td>{v === '' ? <Pill value="missing" text="Belum diisi" /> : Number(v) < (cs ? cs.kkm : 75) ? <Pill value="warn" text="Di bawah KKM" /> : <Pill value="ok" text="Baik" />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ClassRecap({ cs, semesterId }) {
  const { data, loading } = useFetch(cs ? `/grades/class?class_id=${cs.class_id}&semester_id=${semesterId}` : '', `${cs ? cs.class_id : ''}|${semesterId}`)
  if (!cs) return <Empty text="Pilih mata pelajaran terlebih dahulu." />
  if (loading) return <Loading />
  const subjects = data.subjects || []
  const students = data.students || []
  const avg = data.student_avg || {}
  const columns = [
    { key: 'nis', label: 'NIS' },
    { key: 'name', label: 'Nama' },
    ...subjects.map((s) => ({ key: `s${s.class_subject_id}`, label: s.subject_code, align: 'right', render: (r) => num(s.finals[r.id]) })),
    { key: 'avg', label: 'Rata-rata', align: 'right', render: (r) => <b>{num(avg[r.id])}</b> },
    { key: 'below', label: 'Mapel < KKM', align: 'right', render: (r) => { const n = subjects.filter((s) => s.finals[r.id] != null && s.finals[r.id] < s.kkm).length; return n ? <Pill value="warn" text={String(n)} /> : '0' } },
    { key: 'aksi', label: 'Aksi', render: (r) => <Link className="btn secondary sm" to={`/rapor?semester_id=${semesterId}`}>Rapor</Link> },
  ]
  return (
    <div className="stack">
      <div className="grid k4">
        <StatCard label="Kelas" value={`${data.class.unit_code} ${data.class.name}`} foot={`Wali kelas: ${data.class.homeroom_name || '-'}`} />
        <StatCard label="Jumlah siswa" value={num(students.length, 0)} />
        <StatCard label="Rata-rata kelas" value={num(Object.values(avg).filter((v) => v != null).length ? Math.round((Object.values(avg).filter((v) => v != null).reduce((a, b) => a + b, 0) / Object.values(avg).filter((v) => v != null).length) * 10) / 10 : null)} />
        <StatCard label="Mapel belum lengkap nilainya" value={num(subjects.filter((s) => !s.complete).length, 0)} foot={`dari ${subjects.length} mata pelajaran`} />
      </div>
      {data.limited_to_own_subjects ? <div className="small muted">Anda hanya melihat mata pelajaran yang Anda ampu. Wali kelas melihat seluruh mata pelajaran kelas binaannya.</div> : null}
      <DataTable columns={columns} rows={students} emptyText="Belum ada siswa." />
    </div>
  )
}

function SubjectAnalysis({ cs, semesterId }) {
  const { data, loading } = useFetch(cs ? `/reports/subject-analysis?semester_id=${semesterId}` : '', `${cs ? cs.class_id : ''}|${semesterId}`)
  if (!cs) return <Empty text="Pilih mata pelajaran terlebih dahulu." />
  if (loading) return <Loading />
  const rows = (data?.data || []).filter((r) => r.class_name === cs.class_name)
  return (
    <div className="stack">
      <Bars rows={rows.map((r) => ({ key: r.subject_name, label: r.subject_name, value: r.average }))} max={100} suffix="" warnBelow={75} />
      <DataTable columns={[
        { key: 'subject_name', label: 'Mata pelajaran' },
        { key: 'students', label: 'Siswa', align: 'right' },
        { key: 'average', label: 'Rata-rata', align: 'right', render: (r) => num(r.average) },
        { key: 'highest', label: 'Tertinggi', align: 'right' },
        { key: 'lowest', label: 'Terendah', align: 'right' },
        { key: 'below_kkm', label: 'Di bawah KKM', align: 'right' },
        { key: 'below_kkm_percent', label: '% di bawah KKM', align: 'right', render: (r) => pct(r.below_kkm_percent) },
      ]} rows={rows} emptyText="Belum ada nilai pada kelas ini." />
      <div className="small muted">Analisis ini memakai nilai akhir tersimpan pada semester terpilih, sehingga angka dapat ditelusuri sampai komponen nilai.</div>
    </div>
  )
}
