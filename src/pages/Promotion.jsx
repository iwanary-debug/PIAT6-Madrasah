import React, { useEffect, useState } from 'react'
import { useAuth, useFetch } from '../lib/auth'
import { Card, StatCard, Pill, Loading, Empty, Select, Confirm, Tabs, Input } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { post } from '../lib/api'
import { num, pct, label, tanggal } from '../lib/format'

const DECISIONS = [
  { value: 'naik', label: 'Naik kelas' }, { value: 'pertimbangan', label: 'Perlu pertimbangan' },
  { value: 'tidak_naik', label: 'Tidak naik' }, { value: 'mengulang', label: 'Mengulang' },
  { value: 'lulus', label: 'Lulus' }, { value: 'tidak_lulus', label: 'Tidak lulus' },
]

export default function Promotion() {
  const { options, user } = useAuth()
  const semesters = options?.semesters || []
  const [semesterId, setSemesterId] = useState(String(semesters.find((s) => s.is_active)?.id || ''))
  const [classId, setClassId] = useState(options?.classes?.[0]?.id ? String(options.classes[0].id) : '')
  const [tab, setTab] = useState('kandidat')
  const [message, setMessage] = useState(null)
  const [bulk, setBulk] = useState(false)
  const [busy, setBusy] = useState(false)
  const { data, loading, reload, error } = useFetch(classId && semesterId ? `/promotion/candidates?class_id=${classId}&semester_id=${semesterId}` : '', `${classId}|${semesterId}`)
  const rows = data?.data || []
  const [drafts, setDrafts] = useState({})
  useEffect(() => { setDrafts({}) }, [classId, semesterId])

  const setDraft = (studentId, patch) => setDrafts((s) => ({ ...s, [studentId]: { ...(s[studentId] || {}), ...patch } }))
  const decide = async (studentId) => {
    const d = drafts[studentId] || {}
    if (!d.decision) { setMessage('Pilih keputusan terlebih dahulu untuk baris tersebut.'); return }
    setBusy(true); setMessage(null)
    try {
      await post('/promotion/decide', { student_id: studentId, academic_year_id: data.academic_year_id, semester_id: Number(semesterId), decision: d.decision, to_class_id: d.to_class_id ? Number(d.to_class_id) : null, note: d.note || '' })
      setMessage('Keputusan tersimpan pada riwayat keputusan akademik.')
      reload()
    } catch (e) { setMessage(e.message) } finally { setBusy(false) }
  }
  const bulkApply = async () => {
    setBusy(true); setMessage(null)
    let ok = 0, failed = 0
    for (const r of rows) {
      const decision = r.recommendation === 'naik' ? 'naik' : r.recommendation === 'tidak_naik' ? 'tidak_naik' : 'pertimbangan'
      const toClass = (data.next_classes || [])[0]
      try {
        await post('/promotion/decide', {
          student_id: r.student_id, academic_year_id: data.academic_year_id, semester_id: Number(semesterId), decision,
          to_class_id: decision === 'naik' && toClass ? toClass.id : null,
          note: `Ditetapkan mengikuti rekomendasi sistem: ${r.recommendation_reason}`,
        })
        ok++
      } catch { failed++ }
    }
    setBusy(false); setBulk(false)
    setMessage(`Keputusan massal selesai: ${ok} berhasil${failed ? `, ${failed} gagal` : ''}. Rekomendasi tetap dapat diubah manual per siswa.`)
    reload()
  }

  if (user.role === 'siswa') return <Empty text="Halaman ini tidak tersedia untuk akun siswa." />

  return (
    <div className="stack">
      <Card title="Kenaikan Kelas & Kelulusan" subtitle="Rekomendasi dihitung sistem dari nilai akhir dan presensi; keputusan tetap ditetapkan pejabat berwenang dan tersimpan sebagai riwayat.">
        <div className="toolbar">
          <Select label="Kelas" value={classId} onChange={setClassId} options={(options?.classes || []).map((c) => ({ value: c.id, label: `${c.unit_code} — ${c.name}` }))} />
          <Select label="Semester" value={semesterId} onChange={setSemesterId} options={semesters.map((s) => ({ value: s.id, label: `${s.academic_year_name} — ${s.name}` }))} />
          <div className="grow" />
          {data && <div className="small muted" style={{ alignSelf: 'flex-end' }}>
            Kriteria: rata-rata ≥ <b>{data.criteria.min_average}</b>, ketidakhadiran ≤ <b>{data.criteria.max_absence_percent}%</b>, nilai wajib lengkap: <b>{data.criteria.require_scores ? 'ya' : 'tidak'}</b>
          </div>}
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'kandidat', label: 'Kandidat & keputusan' }, { value: 'riwayat', label: 'Riwayat keputusan' }]} />
        <div className="mt2">
          {message && <div className="mb1 small" style={{ color: '#0f6b4f' }}>{message}</div>}
          {error ? <div className="err">{error.message}</div> : null}
          {tab === 'kandidat' && (loading ? <Loading /> : !data ? <Empty text="Pilih kelas dan semester." /> : (
            <>
              <div className="grid k4 mb2">
                <StatCard label="Siswa" value={num(rows.length, 0)} />
                <StatCard label="Rekomendasi naik" value={num(rows.filter((r) => r.recommendation === 'naik').length, 0)} />
                <StatCard label="Perlu pertimbangan" value={num(rows.filter((r) => r.recommendation === 'pertimbangan').length, 0)} />
                <StatCard label="Data belum lengkap" value={num(rows.filter((r) => r.recommendation === 'data_belum_lengkap').length, 0)} />
              </div>
              {['super_admin', 'kepala_mts', 'kepala_ma'].includes(user.role) && (
                <div className="toolbar mb1">
                  <button className="btn secondary sm" onClick={() => setBulk(true)} disabled={busy || !rows.length}>Terapkan keputusan sesuai rekomendasi</button>
                  <span className="small muted">Tindakan massal tetap memerlukan konfirmasi dan dicatat pada audit log.</span>
                </div>
              )}
              <DataTable columns={[
                { key: 'name', label: 'Nama' },
                { key: 'nis', label: 'NIS' },
                { key: 'average', label: 'Rata-rata', align: 'right', render: (r) => num(r.average) },
                { key: 'attendance_percent', label: 'Kehadiran', align: 'right', render: (r) => pct(r.attendance_percent) },
                { key: 'below_kkm', label: 'Mapel < KKM', align: 'right', render: (r) => r.below_kkm.length || '0' },
                { key: 'incomplete', label: 'Data', render: (r) => r.incomplete_subjects.length ? <Pill value="warn" text={`${r.incomplete_subjects.length} mapel kosong`} /> : <Pill value="ok" text="Lengkap" /> },
                { key: 'recommendation', label: 'Rekomendasi sistem', render: (r) => <div><Pill value={r.recommendation} /><div className="small muted">{r.recommendation_reason}</div></div> },
                { key: 'decision', label: 'Keputusan', render: (r) => r.decision
                  ? <div><Pill value={r.decision} text={label(r.decision)} /><div className="small muted">{tanggal(r.decided_at, true)}</div></div>
                  : <Select value={(drafts[r.student_id] || {}).decision || ''} onChange={(v) => setDraft(r.student_id, { decision: v })} options={DECISIONS} placeholder="— pilih keputusan —" /> },
                { key: 'to_class', label: 'Kelas tujuan', render: (r) => (
                  <Select value={(drafts[r.student_id] || {}).to_class_id || ''} onChange={(v) => setDraft(r.student_id, { to_class_id: v })}
                    options={(data.next_classes || []).map((c) => ({ value: c.id, label: c.name }))} placeholder="— pilih kelas —" />
                ) },
                { key: 'aksi', label: 'Aksi', render: (r) => ['super_admin', 'kepala_mts', 'kepala_ma'].includes(user.role)
                  ? <button className="btn sm" onClick={() => decide(r.student_id)} disabled={busy}>Simpan keputusan</button>
                  : <span className="muted small">Hanya kepala madrasah</span> },
              ]} rows={rows} emptyText="Tidak ada siswa pada kelas ini." />
            </>
          ))}
          {tab === 'riwayat' && <PromotionHistory options={options} />}
        </div>
      </Card>
      {bulk && <Confirm title="Terapkan keputusan massal" confirmLabel="Terapkan" busy={busy}
        message={`Sistem akan menyimpan keputusan untuk ${rows.length} siswa sesuai rekomendasi (naik/pertimbangan/tidak naik). Kelas tujuan diisi otomatis dengan tingkat berikutnya. Pastikan Anda sudah meninjau rekomendasi.`}
        onCancel={() => setBulk(false)} onConfirm={bulkApply} />}
    </div>
  )
}

function PromotionHistory({ options }) {
  const [filters, setFilters] = useState({ class_id: '', academic_year_id: '' })
  const qs = `?${filters.class_id ? `class_id=${filters.class_id}&` : ''}${filters.academic_year_id ? `academic_year_id=${filters.academic_year_id}` : ''}`
  const { data, loading } = useFetch(`/promotion/history${qs}`, `${filters.class_id}|${filters.academic_year_id}`)
  if (loading) return <Loading />
  return (
    <div className="stack">
      <div className="toolbar">
        <Select label="Kelas" value={filters.class_id} onChange={(v) => setFilters((s) => ({ ...s, class_id: v }))} options={(options?.classes || []).map((c) => ({ value: c.id, label: `${c.unit_code} — ${c.name}` }))} />
        <Select label="Tahun ajaran" value={filters.academic_year_id} onChange={(v) => setFilters((s) => ({ ...s, academic_year_id: v }))} options={(options?.academicYears || []).map((a) => ({ value: a.id, label: a.name }))} />
      </div>
      <DataTable columns={[
        { key: 'student_name', label: 'Siswa' },
        { key: 'class_name', label: 'Kelas' },
        { key: 'academic_year_name', label: 'Tahun ajaran' },
        { key: 'decision', label: 'Keputusan', render: (r) => <Pill value={r.decision} text={label(r.decision)} /> },
        { key: 'to_class_name', label: 'Kelas tujuan' },
        { key: 'decided_by_name', label: 'Ditetapkan oleh' },
        { key: 'decided_at', label: 'Waktu', render: (r) => tanggal(r.decided_at, true) },
        { key: 'note', label: 'Catatan' },
      ]} rows={data?.data || []} emptyText="Belum ada keputusan tersimpan." />
    </div>
  )
}
