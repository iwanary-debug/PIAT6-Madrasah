import React, { useEffect, useMemo, useState } from 'react'
import { useAuth, useFetch } from '../lib/auth'
import { Card, Tabs, Pill, Loading, Empty, StatCard, Bars, Select, Input } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { post, put } from '../lib/api'
import { todayInput, tanggal, num, pct, label } from '../lib/format'

const STATUS = [
  { value: 'hadir', label: 'Hadir' }, { value: 'sakit', label: 'Sakit' }, { value: 'izin', label: 'Izin' }, { value: 'alpa', label: 'Alpa' },
]
const TCH_STATUS = [
  { value: 'hadir', label: 'Hadir' }, { value: 'sakit', label: 'Sakit' }, { value: 'izin', label: 'Izin' },
  { value: 'tugas_luar', label: 'Tugas luar' }, { value: 'cuti', label: 'Cuti' },
]

export function StudentAttendance() {
  const { options, user } = useAuth()
  const classes = options?.classes || []
  const [classId, setClassId] = useState(classes.length ? String(classes[0].id) : '')
  const [date, setDate] = useState(todayInput())
  const [tab, setTab] = useState('input')
  const { data, loading, reload } = useFetch(classId ? `/attendance/students?class_id=${classId}&date=${date}` : '', `${classId}|${date}`)
  const [rows, setRows] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!data) return
    const init = {}
    for (const r of data.records) init[r.student_id] = { status: r.status || '', note: r.note || '' }
    setRows(init)
  }, [data])

  const setAll = (status) => {
    const next = {}
    for (const r of data.records) next[r.student_id] = { status, note: '' }
    setRows(next)
  }

  const save = async () => {
    const records = Object.entries(rows).filter(([, v]) => v.status).map(([k, v]) => ({ student_id: Number(k), status: v.status, note: v.note }))
    if (!records.length) { setMessage({ type: 'err', text: 'Belum ada status presensi yang dipilih.' }); return }
    setBusy(true); setMessage(null)
    try {
      const res = await post('/attendance/students/bulk', { class_id: Number(classId), date, records })
      setMessage({ type: 'ok', text: `Presensi tersimpan untuk ${res.saved} siswa${res.corrections ? ` (${res.corrections} koreksi tercatat pada audit log)` : ''}.` })
      reload()
    } catch (e) { setMessage({ type: 'err', text: e.message }) } finally { setBusy(false) }
  }

  const filled = Object.values(rows).filter((r) => r.status).length

  return (
    <div className="stack">
      <Card title="Presensi Siswa" subtitle="Catatan kehadiran per kelas dan tanggal. Koreksi tersimpan berubah statusnya dan dicatat pada audit log.">
        <div className="toolbar">
          <Select label="Kelas" value={classId} onChange={setClassId} options={classes.map((c) => ({ value: c.id, label: `${c.unit_code} — ${c.name}` }))} />
          <Input label="Tanggal" type="date" value={date} onChange={setDate} />
          <div className="grow" />
          <div className="row tight" style={{ alignSelf: 'flex-end' }}>
            <button className="btn secondary sm" onClick={() => setAll('hadir')} disabled={!data}>Tandai semua hadir</button>
            <button className="btn" onClick={save} disabled={busy || !data}>{busy ? 'Menyimpan…' : 'Simpan presensi'}</button>
          </div>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'input', label: 'Input presensi' },
          { value: 'rekap', label: 'Rekap kelas' },
          { value: 'harian', label: 'Ketidakhadiran harian' },
        ]} />
        <div className="mt2">
          {tab === 'input' && (
            <>
              {message && <div className={message.type === 'err' ? 'err mb1' : 'mb1'} style={message.type === 'ok' ? { color: '#067647' } : undefined} role="status">{message.text}</div>}
              <div className="small muted mb1">{data ? `${filled} dari ${data.records.length} siswa sudah diisi • Kelas ${data.class.name}` : ''}</div>
              {loading ? <Loading /> : !data ? <Empty text="Pilih kelas untuk menampilkan daftar siswa." /> : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>NIS</th><th>Nama</th><th>Status presensi</th><th>Catatan</th></tr></thead>
                    <tbody>
                      {data.records.map((r) => (
                        <tr key={r.student_id}>
                          <td>{r.nis}</td>
                          <td>{r.name}</td>
                          <td>
                            <div className="row tight">
                              {STATUS.map((s) => (
                                <button key={s.value} className={`btn sm ${rows[r.student_id]?.status === s.value ? '' : 'secondary'}`}
                                  onClick={() => setRows((st) => ({ ...st, [r.student_id]: { ...(st[r.student_id] || {}), status: s.value } }))}>{s.label}</button>
                              ))}
                              {rows[r.student_id]?.status ? <Pill value={rows[r.student_id].status} /> : null}
                            </div>
                          </td>
                          <td><input value={rows[r.student_id]?.note || ''} placeholder="opsional" onChange={(e) => setRows((st) => ({ ...st, [r.student_id]: { ...(st[r.student_id] || { status: '' }), note: e.target.value } }))} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {tab === 'rekap' && <ClassRecapOption classId={classId} />}
          {tab === 'harian' && <DailyAbsence classId={classId} date={date} />}
        </div>
      </Card>
    </div>
  )
}

function ClassRecapOption({ classId }) {
  const [range, setRange] = useState({ from: '', to: '' })
  const qs = classId ? `?class_id=${classId}${range.from ? `&from=${range.from}` : ''}${range.to ? `&to=${range.to}` : ''}` : ''
  const { data, loading } = useFetch(`/attendance/students/recap${qs}`, `${classId}|${range.from}|${range.to}`)
  if (!classId) return <Empty text="Pilih kelas terlebih dahulu." />
  if (loading) return <Loading />
  const rows = data?.data || []
  const flagged = rows.filter((r) => r.alert)
  return (
    <div className="stack">
      <div className="toolbar">
        <Input label="Dari tanggal" type="date" value={range.from} onChange={(v) => setRange((s) => ({ ...s, from: v }))} />
        <Input label="Sampai tanggal" type="date" value={range.to} onChange={(v) => setRange((s) => ({ ...s, to: v }))} />
        <div className="small muted" style={{ alignSelf: 'flex-end' }}>Persentase dihitung dari data presensi tersimpan. Ambang peringatan: {data ? pct(data.alert_percent) : '-'}</div>
      </div>
      <div className="grid k4">
        <StatCard label="Rata-rata kehadiran kelas" value={pct(rows.length ? Math.round((rows.reduce((a, r) => a + (r.percent || 0), 0) / rows.length) * 10) / 10 : null)} />
        <StatCard label="Siswa di bawah ambang" value={num(flagged.length, 0)} />
        <StatCard label="Total catatan presensi" value={num(rows.reduce((a, r) => a + (r.total || 0), 0), 0)} />
        <StatCard label="Total alpa" value={num(rows.reduce((a, r) => a + (r.alpa || 0), 0), 0)} />
      </div>
      <DataTable columns={[
        { key: 'nis', label: 'NIS' },
        { key: 'name', label: 'Nama' },
        { key: 'hadir', label: 'Hadir', align: 'right' },
        { key: 'sakit', label: 'Sakit', align: 'right' },
        { key: 'izin', label: 'Izin', align: 'right' },
        { key: 'alpa', label: 'Alpa', align: 'right' },
        { key: 'percent', label: 'Kehadiran', align: 'right', render: (r) => pct(r.percent) },
        { key: 'status', label: 'Keterangan', render: (r) => r.alert ? <Pill value="warn" text="Perlu perhatian" /> : <Pill value="ok" text="Baik" /> },
      ]} rows={rows} emptyText="Belum ada data presensi pada rentang tanggal ini." />
    </div>
  )
}

function DailyAbsence({ classId, date }) {
  const { data, loading } = useFetch(`/attendance/students/daily?date=${date}${classId ? `&class_id=${classId}` : ''}`, `${classId}|${date}`)
  if (loading) return <Loading />
  return (
    <DataTable columns={[
      { key: 'date', label: 'Tanggal', render: (r) => tanggal(r.date) },
      { key: 'student_name', label: 'Siswa' },
      { key: 'nis', label: 'NIS' },
      { key: 'class_name', label: 'Kelas', render: (r) => `${r.unit_code} ${r.class_name}` },
      { key: 'status', label: 'Status', render: (r) => <Pill value={r.status} /> },
      { key: 'note', label: 'Catatan' },
    ]} rows={data?.data || []} emptyText="Tidak ada ketidakhadiran pada tanggal ini." />
  )
}

export function TeacherAttendance() {
  const { options, user } = useAuth()
  const canWrite = ['super_admin', 'kepala_mts', 'kepala_ma', 'operator'].includes(user.role)
  const [date, setDate] = useState(todayInput())
  const [tab, setTab] = useState('input')
  const { data, loading, reload } = useFetch(`/attendance/teachers?date=${date}`, date)
  const [rows, setRows] = useState({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  useEffect(() => {
    if (!data) return
    const init = {}
    for (const r of data.data) init[r.teacher_id] = { status: r.status || '', note: r.note || '' }
    setRows(init)
  }, [data])
  const save = async () => {
    const records = Object.entries(rows).filter(([, v]) => v.status).map(([k, v]) => ({ teacher_id: Number(k), status: v.status, note: v.note }))
    if (!records.length) { setMessage({ type: 'err', text: 'Belum ada status kehadiran yang dipilih.' }); return }
    setBusy(true); setMessage(null)
    try {
      const res = await post('/attendance/teachers/bulk', { date, records })
      setMessage({ type: 'ok', text: `Presensi guru tersimpan untuk ${res.saved} guru/tendik.` })
      reload()
    } catch (e) { setMessage({ type: 'err', text: e.message }) } finally { setBusy(false) }
  }
  return (
    <div className="stack">
      <Card title="Presensi Guru & Tenaga Kependidikan" subtitle="Pencatatan manual oleh operator/kepala madrasah. Belum terhubung ke perangkat biometrik atau data eksternal.">
        <div className="toolbar">
          <Input label="Tanggal" type="date" value={date} onChange={setDate} />
          <div className="grow" />
          {canWrite && <div className="row tight" style={{ alignSelf: 'flex-end' }}>
            <button className="btn secondary sm" onClick={() => { const n = {}; for (const r of data.data) n[r.teacher_id] = { status: 'hadir', note: '' }; setRows(n) }} disabled={!data}>Tandai semua hadir</button>
            <button className="btn" onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan presensi guru'}</button>
          </div>}
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'input', label: 'Input harian' }, { value: 'rekap', label: 'Rekap periode' }]} />
        <div className="mt2">
          {message && <div className={message.type === 'err' ? 'err mb1' : 'mb1'} style={message.type === 'ok' ? { color: '#067647' } : undefined}>{message.text}</div>}
          {tab === 'input' && (loading ? <Loading /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nama</th><th>Jabatan</th><th>Unit</th><th>Status</th><th>Catatan</th></tr></thead>
                <tbody>
                  {(data?.data || []).map((r) => (
                    <tr key={r.teacher_id}>
                      <td>{r.name}</td><td>{r.position}</td><td>{r.unit_code || 'Lintas unit'}</td>
                      <td>
                        {canWrite ? <div className="row tight">
                          {TCH_STATUS.map((s) => (
                            <button key={s.value} className={`btn sm ${rows[r.teacher_id]?.status === s.value ? '' : 'secondary'}`}
                              onClick={() => setRows((st) => ({ ...st, [r.teacher_id]: { ...(st[r.teacher_id] || {}), status: s.value } }))}>{s.label}</button>
                          ))}
                        </div> : <Pill value={r.status || 'belum_dicatat'} text={r.status ? label(r.status) : 'Belum dicatat'} />}
                      </td>
                      <td>{canWrite ? <input value={rows[r.teacher_id]?.note || ''} onChange={(e) => setRows((st) => ({ ...st, [r.teacher_id]: { ...(st[r.teacher_id] || { status: '' }), note: e.target.value } }))} /> : (r.note || '-')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {tab === 'rekap' && <TeacherRecap options={options} />}
        </div>
      </Card>
    </div>
  )
}

function TeacherRecap({ options }) {
  const [range, setRange] = useState({ from: '', to: '' })
  const qs = `?${range.from ? `from=${range.from}&` : ''}${range.to ? `to=${range.to}` : ''}`
  const { data, loading } = useFetch(`/attendance/teachers/recap${qs}`, `${range.from}|${range.to}`)
  if (loading) return <Loading />
  const rows = data?.data || []
  return (
    <div className="stack">
      <div className="toolbar">
        <Input label="Dari tanggal" type="date" value={range.from} onChange={(v) => setRange((s) => ({ ...s, from: v }))} />
        <Input label="Sampai tanggal" type="date" value={range.to} onChange={(v) => setRange((s) => ({ ...s, to: v }))} />
      </div>
      <div className="grid k2">
        <StatCard label="Rata-rata kehadiran guru" value={pct(rows.length ? Math.round((rows.reduce((a, r) => a + (r.percent || 0), 0) / rows.length) * 10) / 10 : null)} />
        <StatCard label="Total ketidakhadiran (izin/sakit/tugas luar)" value={num(rows.reduce((a, r) => a + (r.izin || 0) + (r.sakit || 0) + (r.tugas_luar || 0), 0), 0)} />
      </div>
      <DataTable columns={[
        { key: 'name', label: 'Nama' },
        { key: 'position', label: 'Jabatan' },
        { key: 'unit_code', label: 'Unit', render: (r) => r.unit_code || 'Lintas unit' },
        { key: 'hadir', label: 'Hadir', align: 'right' },
        { key: 'izin', label: 'Izin', align: 'right' },
        { key: 'sakit', label: 'Sakit', align: 'right' },
        { key: 'tugas_luar', label: 'Tugas luar', align: 'right' },
        { key: 'cuti', label: 'Cuti', align: 'right' },
        { key: 'percent', label: 'Kehadiran', align: 'right', render: (r) => pct(r.percent) },
      ]} rows={rows} emptyText="Belum ada data presensi guru." />
    </div>
  )
}
