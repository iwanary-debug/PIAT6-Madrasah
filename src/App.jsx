import React from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { canSee } from './lib/nav'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { StudentsPage, TeachersPage, ClassesPage, SubjectsPage, CurriculumPage, SchedulesPage, UnitsPage, PeriodsPage } from './pages/Master'
import { StudentAttendance, TeacherAttendance } from './pages/Attendance'
import Grades from './pages/Grades'
import ReportCards from './pages/ReportCards'
import Promotion from './pages/Promotion'
import TeacherPerformance from './pages/Teachers'
import Lms from './pages/Lms'
import Cbt from './pages/Cbt'
import TakeExam from './pages/TakeExam'
import Reports from './pages/Reports'
import { UsersPage, AuditPage, SettingsPage } from './pages/Admin'
import Help from './pages/Help'

const TITLES = {
  '/dasbor': ['Dashboard', 'Ringkasan akademik sesuai peran dan unit pendidikan Anda'],
  '/dashboard-eksekutif': ['Dashboard Eksekutif', 'Ringkasan lintas unit MTs & MA untuk pimpinan'],
  '/siswa': ['Data Siswa/Santri', 'Data induk siswa dengan pencarian, filter, dan detail'],
  '/guru': ['Guru & Tenaga Kependidikan', 'Data induk guru, wali kelas, dan tenaga kependidikan'],
  '/kelas': ['Kelas & Rombongan Belajar', 'Pengelolaan kelas, tingkat, dan wali kelas'],
  '/mata-pelajaran': ['Mata Pelajaran', 'Daftar mata pelajaran per unit pendidikan'],
  '/kurikulum': ['Penugasan Kurikulum', 'Mata pelajaran per kelas, guru pengampu, dan KKM'],
  '/jadwal': ['Jadwal Pelajaran', 'Jadwal mengajar per kelas dan mata pelajaran'],
  '/unit': ['Unit Pendidikan', 'MTs PIAT 6 dan MA PIAT 6 Bondowoso'],
  '/periode': ['Tahun Ajaran & Semester', 'Periode akademik yang digunakan aplikasi'],
  '/presensi-siswa': ['Presensi Siswa', 'Pencatatan dan rekap kehadiran siswa'],
  '/presensi-guru': ['Presensi Guru', 'Pencatatan dan rekap kehadiran guru & tendik'],
  '/nilai': ['Penilaian Akademik', 'Komponen penilaian, input nilai, rekap, dan analisis'],
  '/rapor': ['Rapor Siswa', 'Kelengkapan nilai, catatan wali kelas, dan penerbitan rapor'],
  '/kenaikan-kelas': ['Kenaikan Kelas & Kelulusan', 'Rekomendasi berbasis kriteria dan keputusan pejabat berwenang'],
  '/kinerja-guru': ['Manajemen Guru & Wali Kelas', 'Beban mengajar, kelengkapan administrasi, dan tugas akademik'],
  '/lms/materi': ['Materi Pembelajaran (LMS)', 'Materi digital per kelas dan mata pelajaran'],
  '/lms/tugas': ['Tugas & Pengumpulan (LMS)', 'Pembuatan tugas, tenggat, dan pemantauan pengumpulan'],
  '/lms/koreksi': ['Koreksi Tugas', 'Penilaian tugas siswa beserta umpan balik'],
  '/cbt/bank-soal': ['Bank Soal CBT', 'Pengelolaan soal pilihan ganda, benar/salah, dan uraian'],
  '/cbt/ujian': ['Kelola Ujian CBT', 'Penyusunan ujian, pemilihan soal, dan peserta'],
  '/cbt/jadwal': ['Jadwal & Monitoring Ujian', 'Kalender ujian, kesiapan, dan status pengerjaan'],
  '/cbt/koreksi': ['Koreksi Ujian', 'Penilaian jawaban uraian dan publikasi hasil'],
  '/cbt/ujian-saya': ['Ujian Saya', 'Daftar ujian yang dapat Anda kerjakan'],
  '/laporan': ['Laporan & Analitik', 'Laporan operasional dan analitik berbasis data tersimpan'],
  '/pengguna': ['Pengguna & Peran', 'Manajemen akun dan hak akses (RBAC)'],
  '/audit': ['Audit Log', 'Riwayat aktivitas penting pada sistem'],
  '/pengaturan': ['Pengaturan Aplikasi', 'KKM, ambang kehadiran, dan kriteria akademik'],
  '/bantuan': ['Batasan & Panduan', 'Cara memakai aplikasi, akun demo, dan fitur yang belum tersedia'],
}

function Shell() {
  const location = useLocation()
  const { user } = useAuth()
  const t = TITLES[location.pathname] || ['PIAT 6 Madrasah', '']
  const allowed = canSee(user.role, location.pathname) || location.pathname === '/'
  if (!allowed) return (
    <Layout title="Akses ditolak" subtitle="Peran Anda tidak memiliki kewenangan pada halaman ini">
      <div className="card">
        <b>Anda tidak memiliki hak akses ke halaman ini.</b>
        <p className="small muted">Hak akses dibatasi berdasarkan peran dan unit pendidikan. Silakan gunakan menu yang tersedia sesuai peran Anda.</p>
      </div>
    </Layout>
  )
  return <Layout title={t[0]} subtitle={t[1]}><Outlet /></Layout>
}

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <div className="empty" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>Memuat aplikasi…</div>
  if (!user) return <Navigate to="/masuk" replace />
  return <Shell />
}

export default function App() {
  const { loading, user } = useAuth()
  if (loading) return <div className="empty" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Memuat aplikasi PIAT 6…</div>
  return (
    <Routes>
      <Route path="/masuk" element={user ? <Navigate to="/dasbor" replace /> : <Login />} />
      <Route path="/ujian/:id" element={user ? <TakeExam /> : <Navigate to="/masuk" replace />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Navigate to="/dasbor" replace />} />
        <Route path="/dasbor" element={<Dashboard />} />
        <Route path="/dashboard-eksekutif" element={<Dashboard eksekutif />} />
        <Route path="/siswa" element={<StudentsPage />} />
        <Route path="/guru" element={<TeachersPage />} />
        <Route path="/kelas" element={<ClassesPage />} />
        <Route path="/mata-pelajaran" element={<SubjectsPage />} />
        <Route path="/kurikulum" element={<CurriculumPage />} />
        <Route path="/jadwal" element={<SchedulesPage />} />
        <Route path="/unit" element={<UnitsPage />} />
        <Route path="/periode" element={<PeriodsPage />} />
        <Route path="/presensi-siswa" element={<StudentAttendance />} />
        <Route path="/presensi-guru" element={<TeacherAttendance />} />
        <Route path="/nilai" element={<Grades />} />
        <Route path="/rapor" element={<ReportCards />} />
        <Route path="/kenaikan-kelas" element={<Promotion />} />
        <Route path="/kinerja-guru" element={<TeacherPerformance />} />
        <Route path="/lms/materi" element={<Lms tab="materi" />} />
        <Route path="/lms/tugas" element={<Lms tab="tugas" />} />
        <Route path="/lms/koreksi" element={<Lms tab="koreksi" />} />
        <Route path="/cbt/bank-soal" element={<Cbt tab="bank" />} />
        <Route path="/cbt/ujian" element={<Cbt tab="ujian" />} />
        <Route path="/cbt/jadwal" element={<Cbt tab="jadwal" />} />
        <Route path="/cbt/koreksi" element={<Cbt tab="koreksi" />} />
        <Route path="/cbt/ujian-saya" element={<Cbt tab="siswa" />} />
        <Route path="/laporan" element={<Reports />} />
        <Route path="/pengguna" element={<UsersPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/pengaturan" element={<SettingsPage />} />
        <Route path="/bantuan" element={<Help />} />
        <Route path="*" element={<div className="card"><b>Halaman tidak ditemukan.</b><p className="small muted">Periksa kembali alamat halaman atau gunakan menu navigasi.</p></div>} />
      </Route>
    </Routes>
  )
}
