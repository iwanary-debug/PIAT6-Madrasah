import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth, useFetch } from '../lib/auth'
import { Card, StatCard, Pill, Loading, Empty, Modal, Select, Confirm, Bars } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { post, put } from '../lib/api'
import { num, pct, tanggal, label } from '../lib/format'

export default function ReportCards() {
  const { options, user, extra } = useAuth()
  const semesters = options?.semesters || []
  const [params, setParams] = useSearchParams()
  const [semesterId, setSemesterId] = useState(params.get('semester_id') || String(semesters.find((s) => s.is_active)?.id || ''))
  const homeroomIds = (extra?.homeroomClasses || []).map((c) => c.id)
  const isWali = user.role === 'wali_kelas' && homeroomIds.length
  const classes = useMemo(() => {
    const list = options?.classes || []
    if (user.role === 'guru' && !homeroomIds.length) return []
    return isWali ? list.filter((c) => homeroomIds.includes(c.id)) : list
  }, [options, isWali, homeroomIds, user.role])
  const [classId, setClassId] = useState(classes.length ? String(classes[0].id) : '')
  useEffect(() => { if (!classId && classes.length) setClassId(String(classes[0].id)) }, [classes, classId])
  useEffect(() => { if (semesterId) setParams({ semester_id: semesterId }, { replace: true }) }, [semesterId, setParams])

  const { data, loading, reload, error } = useFetch(classId && semesterId ? `/report-cards?class_id=${classId}&semester_id=${semesterId}` : '', `${classId}|${semesterId}`)
  const [preview, setPreview] = useState(null)
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const canManage = ['super_admin', 'kepala_mts', 'kepala_ma', 'operator'].includes(user.role)
  const canApprove = ['super_admin', 'kepala_mts', 'kepala_ma'].includes(user.role)
  const canReview = canManage || (user.role === 'wali_kelas' && homeroomIds.includes(Number(classId)))
  const rows = data?.data || []
  const counts = {
    total: rows.length, complete: rows.filter((r) => r.complete).length,
    reviewed: rows.filter((r) => r.status === 'reviewed').length, approved: rows.filter((r) => r.status === 'approved').length,
    published: rows.filter((r) => r.status === 'published').length, incomplete: rows.filter((r) => !r.complete).length,
  }
  const generate = async () => {
    setBusy(true); setMessage(null)
    try { const res = await post('/report-cards/generate', { class_id: Number(classId), semester_id: Number(semesterId) }); setMessage(`Rekap rapor disiapkan: ${res.created} dibuat, ${res.updated} diperbarui (${res.students} siswa).`); reload() }
    catch (e) { setMessage(e.message) } finally { setBusy(false) }
  }
  const changeStatus = async (studentId, status) => {
    try { await post(`/report-cards/${studentId}/status`, { semester_id: Number(semesterId), status }); reload() }
    catch (e) { setMessage(e.message) }
  }
  const saveNote = async (studentId, note) => {
    try { await put(`/report-cards/${studentId}/note`, { semester_id: Number(semesterId), homeroom_note: note }); setMessage('Catatan wali kelas tersimpan.'); reload() }
    catch (e) { setMessage(e.message) }
  }

  if (user.role === 'guru' && !homeroomIds.length) {
    return <Card title="Rapor Siswa" subtitle="Rekap rapor kelas dibuka oleh wali kelas atau pejabat berwenang"><Empty text="Anda bukan wali kelas. Gunakan halaman Penilaian Akademik untuk mengisi nilai mata pelajaran yang Anda ampu." /></Card>
  }
  return (
    <div className="stack">
      <Card title="Rapor Siswa" subtitle="Alur status: draft → diperiksa wali kelas → disetujui kepala madrasah → diterbitkan">
        <div className="toolbar">
          <Select label="Kelas" value={classId} onChange={setClassId} options={classes.map((c) => ({ value: c.id, label: `${c.unit_code} — ${c.name}` }))} />
          <Select label="Semester" value={semesterId} onChange={setSemesterId} options={semesters.map((s) => ({ value: s.id, label: `${s.academic_year_name} — ${s.name}${s.is_active ? ' (aktif)' : ''}` }))} />
          <div className="grow" />
          {canManage && <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={generate} disabled={busy || !classId}>{busy ? 'Menyiapkan…' : 'Siapkan/perbarui rekap rapor'}</button>}
        </div>
        {message && <div className="mb1" style={{ color: '#0f6b4f', fontSize: '.85rem' }}>{message}</div>}
        {error ? <div className="err">{error.message}</div> : null}
        <div className="grid k4 mt1">
          <StatCard label="Siswa" value={num(counts.total, 0)} />
          <StatCard label="Nilai lengkap" value={`${counts.complete}/${counts.total}`} tone={counts.incomplete ? '#b54708' : undefined} />
          <StatCard label="Disetujui" value={num(counts.approved, 0)} />
          <StatCard label="Diterbitkan" value={num(counts.published, 0)} />
        </div>
        <div className="mt2">
          {loading ? <Loading /> : !classId ? <Empty text="Pilih kelas." /> : (
            <DataTable columns={[
              { key: 'name', label: 'Nama' },
              { key: 'nis', label: 'NIS' },
              { key: 'average', label: 'Rata-rata', align: 'right', render: (r) => num(r.average) },
              { key: 'rank', label: 'Peringkat', align: 'right' },
              { key: 'subjects_scored', label: 'Kelengkapan mapel', align: 'right', render: (r) => `${r.subjects_scored}/${r.subjects_total}` },
              { key: 'below_kkm', label: 'Mapel < KKM', align: 'right' },
              { key: 'attendance_percent', label: 'Kehadiran', align: 'right', render: (r) => pct(r.attendance_percent) },
              { key: 'status', label: 'Status', render: (r) => <Pill value={r.status} text={r.status_label} /> },
              { key: 'aksi', label: 'Aksi', render: (r) => (
                <div className="row tight">
                  <button className="btn secondary sm" onClick={() => setPreview(r.student_id)}>Pratinjau</button>
                  {canReview && r.status === 'draft' && <button className="btn secondary sm" onClick={() => changeStatus(r.student_id, 'reviewed')}>Tandai diperiksa</button>}
                  {canApprove && r.status === 'reviewed' && <button className="btn secondary sm" onClick={() => changeStatus(r.student_id, 'approved')}>Setujui</button>}
                  {canApprove && r.status === 'approved' && <button className="btn sm" onClick={() => changeStatus(r.student_id, 'published')} disabled={!r.complete} title={r.complete ? 'Terbitkan rapor' : 'Nilai belum lengkap'}>Terbitkan</button>}
                </div>
              ) },
            ]} rows={rows} emptyText="Belum ada data. Klik “Siapkan/perbarui rekap rapor” untuk membuat rekap dari nilai tersimpan." />
          )}
        </div>
        <div className="small muted mt1">Rapor tidak dapat diterbitkan apabila masih ada mata pelajaran tanpa nilai akhir (pengaturan aplikasi).</div>
      </Card>
      {preview && <ReportPreview studentId={preview} semesterId={Number(semesterId)} canReview={canReview} onClose={() => setPreview(null)} onSaveNote={saveNote} />}
    </div>
  )
}

function ReportPreview({ studentId, semesterId, onClose, onSaveNote, canReview }) {
  const { data, error } = useFetch(`/report-cards/${studentId}?semester_id=${semesterId}`, `${studentId}|${semesterId}`)
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(null)
  useEffect(() => { if (data?.data) setNote(data.data.card.homeroom_note || '') }, [data])
  const d = data?.data
  return (
    <Modal wide title="Pratinjau rapor" onClose={onClose} footer={<>
      <button className="btn secondary" onClick={onClose}>Tutup</button>
      {canReview && d && d.card.status !== 'published' && <button className="btn" onClick={async () => { await onSaveNote(studentId, note); setSaved('Catatan tersimpan.') }}>Simpan catatan</button>}
      <button className="btn" onClick={() => window.print()}>Cetak / simpan PDF</button>
    </>}>
      {error ? <div className="err">{error.message}</div> : !d ? <Loading /> : (
        <div className="print-page">
          <div style={{ textAlign: 'center', borderBottom: '2px solid #0f6b4f', paddingBottom: '.5rem', marginBottom: '.8rem' }}>
            <div style={{ fontWeight: 700 }}>PESANTREN ISLAM AL IRSYAD TENGARAN 6 BONDOWOSO</div>
            <div>{d.student.unit_name}</div>
            <div className="small muted">Laporan Hasil Belajar Siswa (Rapor) — Semester {d.semester.name} {d.semester.academic_year_name}</div>
          </div>
          <div className="grid k2 small">
            <div>Nama: <b>{d.student.name}</b></div>
            <div>Kelas: <b>{d.student.class_name}</b></div>
            <div>NIS/NISN: <b>{d.student.nis}/{d.student.nisn || '-'}</b></div>
            <div>Wali kelas: <b>{d.student.homeroom_name || '-'}</b></div>
          </div>
          <table className="mt2">
            <thead><tr><th>No</th><th>Mata pelajaran</th><th className="right">Nilai</th><th className="right">KKM</th><th>Ketuntasan</th></tr></thead>
            <tbody>
              {d.subjects.map((s, i) => (
                <tr key={s.subject_id}>
                  <td>{i + 1}</td><td>{s.subject_name}</td>
                  <td className="right">{num(s.final)}</td><td className="right">{s.kkm}</td>
                  <td>{s.tuntas == null ? 'Belum ada nilai' : s.tuntas ? 'Tuntas' : 'Belum tuntas'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid k2 small mt2">
            <div>Rata-rata: <b>{num(d.average)}</b></div>
            <div>Peringkat: <b>{d.rank || '-'}</b> dari {d.class_size} siswa</div>
            <div>Hadir: <b>{d.attendance.hadir}</b> hari • Sakit: {d.attendance.sakit} • Izin: {d.attendance.izin} • Alpa: {d.attendance.alpa}</div>
            <div>Persentase kehadiran: <b>{pct(d.attendance.percent)}</b></div>
          </div>
          <div className="mt2 small"><b>Catatan wali kelas:</b></div>
          {canReview && d.card.status !== 'published'
            ? <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            : <div className="small" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '.5rem' }}>{note || 'Belum diisi.'}</div>}
          {saved && <div className="small" style={{ color: '#067647' }}>{saved}</div>}
          <div className="grid k2 small mt2" style={{ textAlign: 'center' }}>
            <div>Wali Kelas<br /><br /><br /><b>{d.student.homeroom_name || '…………………'}</b></div>
            <div>Kepala Madrasah<br /><br /><br /><b>……………………………</b></div>
          </div>
          <div className="small muted mt2">Status rapor: {label(d.card.status)} {d.card.published_at ? `• diterbitkan ${tanggal(d.card.published_at, true)}` : ''}</div>
          {!d.complete ? <div className="small" style={{ color: '#b54708' }}>Catatan: nilai belum lengkap pada {d.incomplete_subjects.join(', ')}.</div> : null}
        </div>
      )}
    </Modal>
  )
}
