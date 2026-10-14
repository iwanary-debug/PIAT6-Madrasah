import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useFetch } from '../lib/auth'
import { Card, StatCard, Tabs, Pill, Loading, Bars, Select, Input } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { num, pct } from '../lib/format'

export default function TeacherPerformance() {
  const { options, user } = useAuth()
  const semesters = options?.semesters || []
  const [semesterId, setSemesterId] = useState(String(semesters.find((s) => s.is_active)?.id || semesters[0]?.id || ''))
  const [tab, setTab] = useState('kinerja')
  const { data, loading, reload } = useFetch(`/teachers/overview?semester_id=${semesterId}`, semesterId)
  const { data: comp } = useFetch(`/academic/completeness?semester_id=${semesterId}`, semesterId)
  const rows = data?.data || []
  const incomplete = rows.filter((r) => r.grade_completeness != null && r.grade_completeness < 100)
  return (
    <div className="stack">
      <Card title="Manajemen Guru & Wali Kelas" subtitle="Ringkasan berbasis data: beban mengajar, kelengkapan nilai, presensi yang dicatat, dan pekerjaan yang belum selesai">
        <div className="toolbar">
          <Select label="Semester" value={semesterId} onChange={setSemesterId} options={semesters.map((s) => ({ value: s.id, label: `${s.academic_year_name} — ${s.name}${s.is_active ? ' (aktif)' : ''}` }))} />
          <div className="grow" />
          <button className="btn secondary sm" style={{ alignSelf: 'flex-end' }} onClick={reload}>↻ Perbarui</button>
        </div>
        <div className="grid k4 mt1">
          <StatCard label="Guru & tendik terdata" value={num(rows.length, 0)} />
          <StatCard label="Guru dengan nilai belum lengkap" value={num(incomplete.length, 0)} />
          <StatCard label="Tugas/ujian belum dikoreksi" value={num(rows.reduce((a, r) => a + (r.pending_total || 0), 0), 0)} />
          <StatCard label="Wali kelas terdata" value={num(rows.filter((r) => r.homeroom).length, 0)} />
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'kinerja', label: 'Kinerja & administrasi' }, { value: 'kelas', label: 'Kelengkapan per kelas' }]} />
        <div className="mt2">
          {tab === 'kinerja' && (loading ? <Loading /> : (
            <DataTable columns={[
              { key: 'name', label: 'Nama', render: (r) => <Link to={`/guru?focus=${r.id}`}>{r.name}</Link> },
              { key: 'position', label: 'Jabatan' },
              { key: 'unit_code', label: 'Unit', render: (r) => r.unit_code || 'Lintas unit' },
              { key: 'homeroom', label: 'Wali kelas', render: (r) => r.homeroom ? <Pill value="info" text={r.homeroom} /> : '-' },
              { key: 'subjects', label: 'Penugasan mapel', align: 'right' },
              { key: 'classes', label: 'Kelas', align: 'right' },
              { key: 'grade_completeness', label: 'Kelengkapan nilai', align: 'right', render: (r) => r.grade_completeness == null ? '-' : pct(r.grade_completeness) },
              { key: 'attendance_days_filled', label: 'Hari presensi', align: 'right' },
              { key: 'lms_assignments', label: 'Tugas LMS', align: 'right' },
              { key: 'pending_total', label: 'Belum dikoreksi', align: 'right', render: (r) => r.pending_total ? <Pill value="warn" text={String(r.pending_total)} /> : <Pill value="ok" text="0" /> },
            ]} rows={rows} emptyText="Belum ada data guru." />
          ))}
          {tab === 'kelas' && (
            <div className="stack">
              <Bars rows={(comp?.data || []).map((c) => ({ key: c.class_id, label: `${c.unit_code} ${c.class_name}`, value: c.score_completeness }))} warnBelow={100} dangerBelow={80} />
              <DataTable columns={[
                { key: 'class_name', label: 'Kelas', render: (r) => `${r.unit_code} ${r.class_name}` },
                { key: 'students', label: 'Siswa', align: 'right' },
                { key: 'subjects_complete', label: 'Mapel lengkap', align: 'right', render: (r) => `${r.subjects_complete}/${r.subjects}` },
                { key: 'score_completeness', label: 'Kelengkapan nilai', align: 'right', render: (r) => pct(r.score_completeness) },
                { key: 'rapor', label: 'Rapor (draft/diperiksa/disetujui/terbit)', render: (r) => `${r.report_cards.draft}/${r.report_cards.reviewed}/${r.report_cards.approved}/${r.report_cards.published}` },
                { key: 'pending_submissions', label: 'Tugas belum dinilai', align: 'right' },
                { key: 'aksi', label: 'Aksi', render: (r) => <div className="row tight"><Link className="btn secondary sm" to="/nilai">Nilai</Link><Link className="btn secondary sm" to="/rapor">Rapor</Link></div> },
              ]} rows={comp?.data || []} emptyText="Belum ada data kelas." />
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
