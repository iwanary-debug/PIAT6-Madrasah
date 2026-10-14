import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useFetch } from '../lib/auth'
import { Card, StatCard, Pill, Loading, Empty, Select, Input, SimpleBars, SimpleLine, Bars, SimpleDonut, MultiBars } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { num, pct, tanggal, label } from '../lib/format'

const COLUMN_LABELS = {
  nis: 'NIS', name: 'Nama', student_name: 'Nama', class_name: 'Kelas', unit_code: 'Unit', unit_name: 'Unit', status: 'Status', gender: 'JK',
  hadir: 'Hadir', sakit: 'Sakit', izin: 'Izin', alpa: 'Alpa', total: 'Total', percent: 'Persentase', absence_percent: 'Ketidakhadiran',
  average: 'Rata-rata', final: 'Nilai akhir', kkm: 'KKM', gap: 'Selisih', subject_name: 'Mata pelajaran', below_kkm: 'Di bawah KKM',
  below_kkm_percent: '% di bawah KKM', highest: 'Tertinggi', lowest: 'Terendah', students: 'Siswa',
  title: 'Ujian/Tugas', due_date: 'Tenggat', submitted: 'Terkumpul', missing: 'Belum dikumpulkan', graded: 'Dinilai', ungraded: 'Belum dinilai',
  completion_percent: 'Penyelesaian (%)', completion: 'Penyelesaian (%)', participants: 'Peserta', exam_date: 'Tanggal', teacher_name: 'Guru',
  average_score: 'Rata-rata nilai', attendance_percent: 'Kehadiran', task_completion: 'Penyelesaian tugas', cbt_average: 'Rata-rata CBT',
  cbt_participants: 'Peserta CBT', score_completeness: 'Kelengkapan nilai', subjects_complete: 'Mapel lengkap', subjects: 'Mapel',
  students_with_complete_scores: 'Siswa nilai lengkap', report_cards: 'Rapor (d/b/s/t)', attendance_days: 'Hari presensi', assignments: 'Tugas',
  pending_submissions: 'Tugas belum dinilai', pending_review: 'Menunggu koreksi', pass_rate: 'Ketuntasan', scored: 'Sudah dinilai',
  attendance_records: 'Catatan presensi', teachers: 'Guru', classes: 'Kelas', priorities: 'Prioritas',
  category: 'Kategori', finding: 'Temuan', action: 'Rekomendasi', priority: 'Prioritas', subject: 'Objek',
  label: 'Periode', overall: 'Rata-rata keseluruhan', is_active: 'Aktif', level: 'Tingkat',
}
const HIDDEN = ['id', 'student_id', 'class_id', 'unit_id', 'semester_id', 'academic_year_id', 'by_unit', 'samples', 'has_card', 'to_class_id', 'school_id']

function cell(r, k) {
  const v = r[k]
  if (v == null || v === '') return '-'
  if (typeof v === 'number') return num(v)
  if (k === 'due_date' || k === 'exam_date' || k.endsWith('_at') || k === 'date') return tanggal(v)
  if (typeof v === 'object') return typeof v === 'object' && r.report_cards && k === 'report_cards' ? `${v.draft}/${v.reviewed}/${v.approved}/${v.published}` : JSON.stringify(v)
  return String(v)
}

function toCsv(rows) {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0]).filter((k) => !HIDDEN.includes(k))
  const esc = (v) => `"${String(v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v).replace(/"/g, '""')}"`
  return [keys.join(';'), ...rows.map((r) => keys.map((k) => esc(r[k])).join(';'))].join('\n')
}

export default function Reports() {
  const { options, user, scope } = useAuth()
  const semesters = options?.semesters || []
  const [kind, setKind] = useState('students')
  const [filters, setFilters] = useState({ semester_id: String(semesters.find((s) => s.is_active)?.id || ''), class_id: '', from: '', to: '' })
  const { data: catalog } = useFetch('/reports', 'catalog')
  const qs = useMemo(() => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v)
    return p.toString()
  }, [filters])
  const { data, loading, error, reload } = useFetch(`/reports/${kind}?${qs}`, `${kind}|${qs}`)
  const rows = (data?.data || []).filter((r) => r && typeof r === 'object')
  const columns = useMemo(() => {
    const keys = rows.length ? Object.keys(rows[0]).filter((k) => !HIDDEN.includes(k)) : []
    return keys.map((k) => ({ key: k, label: COLUMN_LABELS[k] || k.replace(/_/g, ' '), render: (r) => cell(r, k) }))
  }, [rows])
  const list = catalog?.data || []
  const exportCsv = () => {
    const csv = toCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `laporan-${kind}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="stack">
      <Card title="Laporan & Analitik" subtitle="Seluruh angka dihitung dari data tersimpan pada basis data aplikasi. Rekomendasi sistem ditandai terpisah dari data faktual.">
        <div className="toolbar">
          <Select label="Jenis laporan" value={kind} onChange={setKind} options={list.map((r) => ({ value: r.kind, label: r.label }))} />
          <Select label="Semester" value={filters.semester_id} onChange={(v) => setFilters((s) => ({ ...s, semester_id: v }))} options={semesters.map((s) => ({ value: s.id, label: `${s.academic_year_name} — ${s.name}` }))} />
          <Select label="Kelas" value={filters.class_id} onChange={(v) => setFilters((s) => ({ ...s, class_id: v }))} options={(options?.classes || []).map((c) => ({ value: c.id, label: `${c.unit_code} — ${c.name}` }))} />
          <Input label="Dari tanggal" type="date" value={filters.from} onChange={(v) => setFilters((s) => ({ ...s, from: v }))} />
          <Input label="Sampai tanggal" type="date" value={filters.to} onChange={(v) => setFilters((s) => ({ ...s, to: v }))} />
          <button className="btn secondary sm" style={{ alignSelf: 'flex-end' }} onClick={reload}>↻ Terapkan filter</button>
          <button className="btn secondary sm" style={{ alignSelf: 'flex-end' }} onClick={exportCsv} disabled={!rows.length}>⬇ Ekspor CSV</button>
        </div>
        <div className="small muted mt1">
          Cakupan data: <b>{scope.kind === 'all' ? 'MTs & MA (sesuai kewenangan)' : scope.kind === 'unit' ? 'Unit Anda' : scope.kind === 'classes' ? 'Kelas yang Anda ampu' : 'Data Anda'}</b>
          {data?.meta?.semester ? ` • Semester ${data.meta.semester.name} ${data.meta.semester.academic_year_name}` : ''}
          {data?.meta?.from ? ` • Rentang ${tanggal(data.meta.from)} s/d ${tanggal(data.meta.to)}` : ''}
        </div>
        {error ? <div className="err mt1">{error.message}</div> : null}
      </Card>

      {loading ? <Loading text="Menghitung laporan…" /> : !data ? null : (
        <div className="stack">
          <Summary kind={kind} data={data} />
          {kind === 'attendance-students' && data.data.length > 0 && (
            <Card title="Kehadiran per kelas" subtitle="Diurutkan dari yang terendah">
              <Bars rows={data.data.slice(0, 12).map((r) => ({ key: r.class_id, label: `${r.unit_code} ${r.class_name}`, value: r.percent }))} warnBelow={92} dangerBelow={87} />
              {data.days?.length ? <div className="mt2"><SimpleLine data={data.days.map((d) => ({ x: tanggal(d.date), y: d.percent }))} xKey="x" yKey="y" suffix="%" domain={[60, 100]} /></div> : null}
            </Card>
          )}
          {kind === 'subject-analysis' && (
            <Card title="Rata-rata per mata pelajaran" subtitle="Mapel dengan capaian terendah tampil paling kiri">
              <SimpleBars data={data.data.slice(0, 14).map((r) => ({ x: `${r.class_name} ${r.subject_name}`.slice(0, 18), nilai: r.average }))} xKey="x" yKey="nilai" height={300} />
            </Card>
          )}
          {kind === 'trends' && (
            <Card title="Tren rata-rata nilai antarperiode" subtitle="Hanya semester yang memiliki nilai tersimpan">
              <SimpleLine data={data.data.map((d) => ({ x: d.label, y: d.overall }))} xKey="x" yKey="y" />
              {data.deltas?.length ? <div className="small muted mt1">{data.deltas.map((d, i) => <span key={i}>{d.from} → {d.to}: <b style={{ color: d.delta >= 0 ? '#067647' : '#b42318' }}>{d.delta >= 0 ? '+' : ''}{num(d.delta)}</b>. </span>)}</div> : null}
            </Card>
          )}
          {kind === 'unit-comparison' && (
            <Card title="Perbandingan indikator MTs dan MA">
              <MultiBars data={data.data.map((u) => ({ x: u.unit_code, kehadiran: u.attendance_percent, nilai: u.average_score, tugas: u.task_completion }))} xKey="x"
                keys={[{ key: 'kehadiran', label: 'Kehadiran (%)' }, { key: 'nilai', label: 'Rata-rata nilai' }, { key: 'tugas', label: 'Penyelesaian tugas (%)' }]} />
              <div className="mt2"><SimpleDonut data={data.data.map((u) => ({ name: `Siswa ${u.unit_code}`, value: u.students }))} /></div>
            </Card>
          )}
          {kind === 'cbt' && data.summary && (
            <Card title="Ringkasan ujian CBT">
              <div className="grid k3">
                <StatCard label="Jumlah ujian" value={num(data.summary.exams, 0)} />
                <StatCard label="Menunggu koreksi uraian" value={num(data.summary.pending_review, 0)} />
              </div>
            </Card>
          )}
          {kind === 'follow-up' ? (
            <Card title="Daftar tindak lanjut" subtitle="Rekomendasi sistem berdasarkan temuan data. Keputusan tetap berada pada pimpinan madrasah.">
              <DataTable columns={[
                { key: 'priority', label: 'Prioritas', render: (r) => <Pill value={r.priority === 'tinggi' ? 'danger' : r.priority === 'penting' ? 'warn' : 'info'} text={r.priority} /> },
                { key: 'category', label: 'Kategori' },
                { key: 'subject', label: 'Objek' },
                { key: 'finding', label: 'Temuan (data faktual)' },
                { key: 'action', label: 'Rekomendasi tindak lanjut' },
                { key: 'aksi', label: 'Aksi', render: (r) => r.category === 'Koreksi tugas' ? <Link className="btn secondary sm" to="/lms/koreksi">Buka koreksi</Link> : r.category === 'Koreksi ujian' ? <Link className="btn secondary sm" to="/cbt/koreksi">Buka koreksi ujian</Link> : r.category === 'Rapor' ? <Link className="btn secondary sm" to="/rapor">Buka rapor</Link> : r.category === 'Presensi' ? <Link className="btn secondary sm" to="/presensi-siswa">Buka presensi</Link> : <Link className="btn secondary sm" to="/nilai">Buka penilaian</Link> },
              ]} rows={rows} emptyText="Tidak ada temuan yang memerlukan tindak lanjut. Pertahankan kinerja akademik." />
            </Card>
          ) : (
            <Card title={data.meta?.labels?.title || 'Data laporan'} subtitle={`${rows.length} baris data`}>
              <DataTable columns={columns} rows={rows} emptyText="Tidak ada data pada filter ini." />
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function Summary({ kind, data }) {
  const s = data.summary || {}
  if (kind === 'students') return (
    <div className="grid k4">
      <StatCard label="Total siswa (filter)" value={num(s.total, 0)} />
      <StatCard label="Siswa aktif" value={num(s.active, 0)} />
      <StatCard label="Unit terlibat" value={num(Object.keys(s.by_unit || {}).length, 0)} foot={Object.entries(s.by_unit || {}).map(([k, v]) => `${k}: ${v}`).join(' • ')} />
      <StatCard label="Kelas terlibat" value={num(Object.keys(s.by_class || {}).length, 0)} />
    </div>
  )
  if (kind === 'attendance-students') return (
    <div className="grid k4">
      <StatCard label="Kehadiran keseluruhan" value={pct(s.percent)} />
      <StatCard label="Total catatan hadir" value={num(s.hadir, 0)} />
      <StatCard label="Total catatan presensi" value={num(s.total, 0)} />
      <StatCard label="Kelas terbawah" value={data.data[0] ? data.data[0].class_name : '-'} foot={data.data[0] ? pct(data.data[0].percent) : ''} />
    </div>
  )
  if (kind === 'high-absence') return (
    <div className="grid k4">
      <StatCard label="Siswa perlu perhatian" value={num(s.flagged, 0)} />
      <StatCard label="Ambang kehadiran" value={pct(data.meta?.alert_percent)} foot="diatur pada halaman Pengaturan" />
      <StatCard label="Ketidakhadiran tertinggi" value={data.data[0] ? pct(data.data[0].absence_percent) : '-'} foot={data.data[0] ? data.data[0].name : ''} />
    </div>
  )
  if (kind === 'below-kkm') return (
    <div className="grid k4">
      <StatCard label="Baris nilai di bawah KKM" value={num(s.rows, 0)} />
      <StatCard label="Siswa terdampak" value={num(s.students, 0)} />
      <StatCard label="Rata-rata mapel bermasalah/siswa" value={num(s.per_student, 1)} />
    </div>
  )
  if (kind === 'assignments') return (
    <div className="grid k4">
      <StatCard label="Penyelesaian tugas" value={pct(s.completion_percent)} />
      <StatCard label="Penugasan-siswa" value={num(s.expected, 0)} />
      <StatCard label="Sudah dikumpulkan" value={num(s.submitted, 0)} />
      <StatCard label="Belum dikumpulkan" value={num(s.missing, 0)} foot={`${num(s.ungraded, 0)} belum dinilai`} />
    </div>
  )
  if (kind === 'subject-analysis') return (
    <div className="grid k4">
      <StatCard label="Mata pelajaran dianalisis" value={num(s.subjects, 0)} />
      <StatCard label="Capaian terendah" value={num(s.lowest_average)} foot={data.data[0] ? `${data.data[0].class_name} — ${data.data[0].subject_name}` : ''} />
      <StatCard label="Jumlah baris temuan < KKM" value={num(data.data.reduce((a, r) => a + r.below_kkm, 0), 0)} />
    </div>
  )
  if (kind === 'completeness') return (
    <div className="grid k4">
      <StatCard label="Kelas" value={num(data.data.length, 0)} />
      <StatCard label="Kelas dengan nilai lengkap 100%" value={num(data.data.filter((r) => r.score_completeness === 100).length, 0)} />
      <StatCard label="Rapor diterbitkan" value={num(data.data.reduce((a, r) => a + (r.report_cards?.published || 0), 0), 0)} />
      <StatCard label="Rapor masih draft" value={num(data.data.reduce((a, r) => a + (r.report_cards?.draft || 0), 0), 0)} />
    </div>
  )
  if (kind === 'grades') {
    const avg = data.data.length ? Math.round((data.data.reduce((a, r) => a + (r.average || 0), 0) / data.data.length) * 10) / 10 : null
    return (
      <div className="grid k4">
        <StatCard label="Siswa pada laporan" value={num(data.data.length, 0)} />
        <StatCard label="Rata-rata keseluruhan" value={num(avg)} />
        <StatCard label="Rata-rata tertinggi" value={data.data[0] ? num(data.data[0].average) : '-'} foot={data.data[0] ? data.data[0].name : ''} />
        <StatCard label="Siswa dengan mapel < KKM" value={num(data.data.filter((r) => r.below > 0).length, 0)} />
      </div>
    )
  }
  if (kind === 'attendance-teachers' || kind === 'cbt' || kind === 'trends' || kind === 'unit-comparison') return null
  return null
}
