import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, useFetch } from '../lib/auth'
import { Card, StatCard, Pill, Loading, ErrorBox, Empty, SimpleBars, SimpleLine, SimpleDonut, MultiBars, Bars } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { num, pct, tanggal, waktu, label } from '../lib/format'

export default function Dashboard({ eksekutif }) {
  const { user, scope, options, extra } = useAuth()
  const activeSem = options?.semesters?.find((s) => s.is_active)
  const { data, loading, error, reload } = useFetch('/dashboard', activeSem ? String(activeSem.id) : '')

  if (loading) return <Loading text="Menyiapkan ringkasan…" />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  const c = data.cards
  const isSiswa = user.role === 'siswa'
  const crossUnit = scope.kind === 'all'

  return (
    <div className="stack">
      <div className="row between">
        <div className="small muted">
          Periode aktif: <b>{activeSem ? `${activeSem.academic_year_name} — Semester ${activeSem.name}` : '-'}</b> • Cakupan data:{' '}
          <b>{crossUnit ? 'MTs & MA' : scope.kind === 'unit' ? (options?.units?.[0]?.name || 'Unit Anda') : scope.kind === 'classes' ? 'Kelas yang Anda ampu' : 'Data Anda sendiri'}</b>
        </div>
        <button className="btn secondary sm" onClick={reload}>↻ Perbarui</button>
      </div>

      {isSiswa ? <StudentDashboard options={options} user={user} extra={extra} activeSem={activeSem} dash={data} /> : (
        <>
          {user.role === 'guru' || user.role === 'wali_kelas' ? <TeacherPanel user={user} data={data} options={options} /> : null}

          <div className="grid k4">
            <StatCard label="Total siswa" value={num(c.students_total, 0)} foot={`${num(c.students_active, 0)} siswa aktif`} />
            <StatCard label="Guru & tendik" value={num(c.teachers, 0)} />
            <StatCard label="Kelas / rombel" value={num(c.classes, 0)} foot={`${num(c.subjects, 0)} mata pelajaran`} />
            <StatCard label="Kehadiran siswa" value={pct(c.attendance_percent)} foot="Rata-rata periode aktif" tone={c.attendance_percent != null && c.attendance_percent < 90 ? '#b42318' : undefined} />
            <StatCard label="Kehadiran guru" value={pct(c.teacher_attendance_percent)} />
            <StatCard label="Rata-rata nilai akhir" value={num(c.average_score)} />
            <StatCard label="Siswa berisiko akademik" value={num(c.at_risk, 0)} foot="Nilai < KKM pada ≥2 mapel atau kehadiran rendah" />
            <StatCard label="Penyelesaian tugas (LMS)" value={pct(data.tasks.completion_percent)} foot={`${num(data.tasks.submitted, 0)} dari ${num(data.tasks.students, 0)} penugasan-siswa`} />
          </div>

          <div className="grid k2">
            <Card title="Kehadiran siswa per kelas" subtitle="Diambil dari data presensi tersimpan; kelas dengan kehadiran terendah di atas">
              <Bars rows={data.attendance.by_class.slice(0, 8).map((x) => ({ key: x.class_id, label: `${x.unit_code} ${x.class_name}`, value: x.percent }))} warnBelow={92} dangerBelow={87} />
            </Card>
            <Card title="Tren kehadiran harian" subtitle="Persentase kehadiran per tanggal pencatatan">
              {data.attendance.trend.length ? <SimpleLine data={data.attendance.trend.map((t) => ({ x: tanggal(t.date), y: t.percent }))} xKey="x" yKey="y" suffix="%" domain={[60, 100]} /> : <Empty text="Belum ada data presensi." />}
            </Card>
          </div>

          {crossUnit || eksekutif ? (
            <Card title="Perbandingan performa MTs dan MA" subtitle="Dihitung dari data siswa, presensi, nilai akhir, pengumpulan tugas, dan hasil CBT">
              <DataTable columns={[
                { key: 'unit_name', label: 'Unit' },
                { key: 'students', label: 'Siswa', align: 'right', render: (r) => num(r.students, 0) },
                { key: 'teachers', label: 'Guru', align: 'right', render: (r) => num(r.teachers, 0) },
                { key: 'classes', label: 'Kelas', align: 'right', render: (r) => num(r.classes, 0) },
                { key: 'attendance_percent', label: 'Kehadiran siswa', align: 'right', render: (r) => pct(r.attendance_percent) },
                { key: 'teacher_attendance_percent', label: 'Kehadiran guru', align: 'right', render: (r) => pct(r.teacher_attendance_percent) },
                { key: 'average_score', label: 'Rata-rata nilai', align: 'right', render: (r) => num(r.average_score) },
              ]} rows={data.unit_comparison} />
              <div className="mt2">
                <MultiBars data={data.unit_comparison.map((u) => ({ x: u.unit_code, kehadiran: u.attendance_percent, nilai: u.average_score }))}
                  xKey="x" keys={[{ key: 'kehadiran', label: 'Kehadiran (%)' }, { key: 'nilai', label: 'Rata-rata nilai' }]} />
              </div>
            </Card>
          ) : (
            <Card title={`Perbandingan kelas — ${data.scope.units.map((u) => u.code).join(', ')}`} subtitle="Rata-rata nilai akhir dan kehadiran per kelas">
              <SimpleBars data={data.academic.by_class.map((x) => ({ x: `${x.unit_code} ${x.class_name}`, nilai: x.average }))} xKey="x" yKey="nilai" />
            </Card>
          )}

          <div className="grid k2">
            <Card title="Mata pelajaran dengan capaian terendah" subtitle="Rata-rata nilai akhir per mata pelajaran">
              {data.academic.lowest.length ? <Bars rows={data.academic.lowest.map((s) => ({ key: `${s.unit_code}-${s.subject_name}`, label: `${s.unit_code} ${s.subject_name}`, value: s.average }))} max={100} suffix="" warnBelow={75} /> : <Empty text="Belum ada nilai tersimpan." />}
            </Card>
            <Card title="Mata pelajaran dengan capaian tertinggi" subtitle="Sebagai bahan berbagi praktik baik antar guru">
              {data.academic.highest.length ? <Bars rows={data.academic.highest.map((s) => ({ key: `${s.unit_code}-${s.subject_name}`, label: `${s.unit_code} ${s.subject_name}`, value: s.average }))} max={100} suffix="" /> : <Empty text="Belum ada nilai tersimpan." />}
            </Card>
          </div>

          <div className="grid k2">
            <Card title="Siswa dengan indikasi masalah akademik" subtitle="Nilai di bawah KKM pada minimal dua mata pelajaran atau kehadiran di bawah ambang">
              <DataTable columns={[
                { key: 'name', label: 'Nama', render: (r) => <Link to={`/siswa?focus=${r.student_id}`}>{r.name}</Link> },
                { key: 'class_name', label: 'Kelas', render: (r) => `${r.unit_code} ${r.class_name}` },
                { key: 'average', label: 'Rata-rata', align: 'right', render: (r) => num(r.average) },
                { key: 'below', label: 'Mapel < KKM', align: 'right' },
                { key: 'attendance_percent', label: 'Kehadiran', align: 'right', render: (r) => pct(r.attendance_percent) },
              ]} rows={data.at_risk} emptyText="Tidak ada siswa yang masuk kriteria saat ini." />
            </Card>
            <Card title="Pekerjaan yang perlu ditindaklanjuti" subtitle="Rekomendasi sistem berdasarkan data tersimpan">
              {data.notifications.length === 0 ? <Empty text="Tidak ada pekerjaan yang tertunda." /> : (
                <div className="timeline">
                  {data.notifications.map((n, i) => (
                    <div className="item" key={i}>
                      <span className={`pill ${n.level === 'peringatan' ? 'danger' : n.level === 'akademik' ? 'warn' : 'info'}`}>{n.level}</span>
                      <div className="small">{n.text}</div>
                      {n.link && <Link className="small" to={n.link}>Buka halaman terkait →</Link>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="grid k2">
            <Card title="Jadwal ujian terdekat" subtitle="Berdasarkan jadwal ujian yang tersimpan">
              <DataTable columns={[
                { key: 'title', label: 'Ujian' },
                { key: 'class_name', label: 'Kelas', render: (r) => `${r.unit_code} ${r.class_name}` },
                { key: 'start_at', label: 'Mulai', render: (r) => waktu(r.start_at) },
                { key: 'question_count', label: 'Soal', align: 'right' },
                { key: 'participants', label: 'Peserta', align: 'right' },
              ]} rows={data.exams.upcoming} emptyText="Tidak ada ujian terjadwal." />
            </Card>
            <Card title="Hasil ujian terakhir" subtitle="Rata-rata nilai peserta dan ketuntasan (KKM 75)">
              <DataTable columns={[
                { key: 'title', label: 'Ujian' },
                { key: 'class_name', label: 'Kelas' },
                { key: 'graded', label: 'Dinilai', align: 'right' },
                { key: 'avg_score', label: 'Rata-rata', align: 'right', render: (r) => num(r.avg_score) },
                { key: 'pass_rate', label: 'Tuntas', align: 'right', render: (r) => pct(r.pass_rate) },
              ]} rows={data.exams.recent} emptyText="Belum ada ujian yang selesai." />
            </Card>
          </div>

          <div className="grid k2">
            <Card title="Ringkasan tugas & materi LMS">
              <div className="grid k3">
                <StatCard label="Materi aktif" value={num(data.tasks.materials, 0)} />
                <StatCard label="Tugas belum dikumpulkan" value={num(data.tasks.missing, 0)} />
                <StatCard label="Tugas belum dinilai" value={num(data.tasks.ungraded, 0)} />
              </div>
              <div className="mt2"><Bars rows={data.attendance.by_unit.map((u) => ({ key: u.unit_code, label: `Kehadiran ${u.unit_code}`, value: u.percent }))} warnBelow={92} dangerBelow={87} /></div>
            </Card>
            <Card title="Komposisi siswa per unit">
              <SimpleDonut data={data.cards.students_by_unit.map((u) => ({ name: u.unit_code, value: u.total }))} />
              <div className="small muted center">{data.cards.students_by_unit.map((u) => `${u.unit_code}: ${u.total} siswa (L ${u.male} / P ${u.female})`).join(' • ')}</div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function TeacherPanel({ user, data, options }) {
  const { data: wl } = useFetch(user.teacher_id ? `/teachers/${user.teacher_id}/workload` : '', String(user.teacher_id || ''))
  if (!wl) return null
  return (
    <Card title="Ringkasan tugas mengajar Anda" subtitle={`${wl.teacher.position || 'Guru'} • ${wl.teacher.unit_code || ''}`}>
      <div className="grid k4">
        <StatCard label="Penugasan mapel" value={num(wl.class_subjects.length, 0)} />
        <StatCard label="Kelas diampu" value={num(new Set(wl.class_subjects.map((c) => c.class_id)).size, 0)} />
        <StatCard label="Tugas belum dikoreksi" value={num(wl.pending_submissions, 0)} />
        <StatCard label="Ujian uraian belum dikoreksi" value={num(wl.pending_exam_grading, 0)} />
      </div>
      <div className="mt2 row tight">
        {wl.homeroom.length ? <span className="pill info">Wali kelas: {wl.homeroom.map((h) => h.name).join(', ')}</span> : null}
        <Link className="btn secondary sm" to="/presensi-siswa">Isi presensi</Link>
        <Link className="btn secondary sm" to="/nilai">Isi nilai</Link>
        <Link className="btn secondary sm" to="/lms/koreksi">Koreksi tugas</Link>
        <Link className="btn secondary sm" to="/cbt/koreksi">Koreksi ujian</Link>
      </div>
      <div className="mt2">
        <DataTable columns={[
          { key: 'class_name', label: 'Kelas' },
          { key: 'subject_name', label: 'Mata pelajaran' },
          { key: 'kkm', label: 'KKM', align: 'right' },
        ]} rows={wl.class_subjects.slice(0, 8)} emptyText="Belum ada penugasan mengajar." />
      </div>
    </Card>
  )
}

function StudentDashboard({ options, user, extra, activeSem, dash }) {
  const student = extra.student
  const { data: lms } = useFetch('/lms/student', String(activeSem?.id || ''))
  const { data: exams } = useFetch('/exams', String(activeSem?.id || ''))
  const { data: grades } = useFetch(student ? `/grades/student/${student.id}?semester_id=${activeSem?.id || 0}` : '', str(activeSem?.id))
  const { data: rc } = useFetch(student ? `/report-cards/${student.id}?semester_id=${activeSem?.id || 0}` : '', str(activeSem?.id))
  const myExams = exams?.data || []
  return (
    <>
      <div className="grid k4">
        <StatCard label="Rata-rata nilai saya" value={num(grades?.average)} foot={activeSem ? `${activeSem.academic_year_name} ${activeSem.name}` : ''} />
        <StatCard label="Kehadiran saya" value={pct(grades?.attendance?.percent)} foot={grades?.attendance ? `${grades.attendance.hadir} hadir / ${grades.attendance.total} hari tercatat` : ''} />
        <StatCard label="Tugas belum dikumpulkan" value={num(lms?.summary?.missing, 0)} foot={`${num(lms?.summary?.submitted, 0)} sudah dikumpulkan`} />
        <StatCard label="Ujian perlu dikerjakan" value={num(myExams.filter((e) => e.my_status === 'not_started' && e.window_state === 'berlangsung').length, 0)} foot={`${myExams.length} ujian terdaftar`} />
      </div>
      <div className="grid k2">
        <Card title="Tugas mendatang" subtitle="Diurutkan berdasarkan tenggat pengumpulan">
          <DataTable columns={[
            { key: 'title', label: 'Tugas' },
            { key: 'subject_name', label: 'Mapel' },
            { key: 'due_date', label: 'Tenggat', render: (r) => tanggal(r.due_date) },
            { key: 'submission_status', label: 'Status', render: (r) => r.submission_status ? <Pill value={r.submission_status} /> : <Pill value="missing" /> },
          ]} rows={(lms?.assignments || []).slice(0, 6)} emptyText="Belum ada tugas untuk kelas Anda." />
        </Card>
        <Card title="Ujian saya" subtitle="Kunci jawaban tidak pernah dikirim ke akun siswa">
          <DataTable columns={[
            { key: 'title', label: 'Ujian' },
            { key: 'start_at', label: 'Jadwal', render: (r) => waktu(r.start_at) },
            { key: 'window_state', label: 'Waktu', render: (r) => <Pill value={r.window_state} /> },
            { key: 'my_status', label: 'Status saya', render: (r) => <Pill value={r.my_status} /> },
            { key: 'aksi', label: 'Aksi', render: (r) => (r.can_start || r.can_continue) ? <Link className="btn sm" to={`/ujian/${r.id}`}>Kerjakan</Link> : (r.my_status === 'graded' || r.my_status === 'submitted') ? <Link className="btn secondary sm" to={`/ujian/${r.id}`}>Lihat</Link> : <span className="muted small">—</span> },
          ]} rows={myExams.slice(0, 6)} emptyText="Tidak ada ujian untuk kelas Anda." />
        </Card>
      </div>
      <div className="grid k2">
        <Card title="Nilai per mata pelajaran" subtitle="Perhitungan nilai akhir sesuai bobot komponen yang ditetapkan guru">
          {grades ? (
            <DataTable columns={[
              { key: 'subject_name', label: 'Mata pelajaran' },
              { key: 'final', label: 'Nilai akhir', align: 'right', render: (r) => num(r.final) },
              { key: 'kkm', label: 'KKM', align: 'right' },
              { key: 'tuntas', label: 'Ketuntasan', render: (r) => <Pill value={r.tuntas ? 'ok' : 'alpa'} text={r.tuntas ? 'Tuntas' : 'Belum tuntas'} /> },
            ]} rows={grades.subjects} emptyText="Belum ada nilai." />
          ) : <Loading />}
        </Card>
        <Card title="Rapor saya">
          {rc?.data ? (
            <div className="stack">
              <div className="row tight"><Pill value={rc.data.card.status} /></div>
              <div className="small">Peringkat <b>{rc.data.rank || '-'}</b> dari {rc.data.class_size} siswa • Rata-rata <b>{num(rc.data.average)}</b></div>
              <div className="small">Catatan wali kelas: <i>{rc.data.card.homeroom_note || 'Belum diisi'}</i></div>
              <div className="small muted">Rapor diterbitkan madrasah pada {rc.data.card.published_at ? tanggal(rc.data.card.published_at, true) : '—'}.</div>
            </div>
          ) : <Empty text="Rapor semester ini belum diterbitkan oleh madrasah. Nilai yang sudah dipublikasikan tetap terlihat pada menu Nilai." />}
        </Card>
      </div>
    </>
  )
}

const str = (v) => String(v == null ? '' : v)
