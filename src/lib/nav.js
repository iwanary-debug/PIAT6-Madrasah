const STAFF = ['super_admin', 'pimpinan', 'kepala_mts', 'kepala_ma', 'operator', 'guru', 'wali_kelas', 'pengawas']
const UNIT_STAFF = ['super_admin', 'kepala_mts', 'kepala_ma', 'operator']
const ACADEMIC = ['super_admin', 'kepala_mts', 'kepala_ma', 'operator', 'guru', 'wali_kelas', 'pengawas']
const TEACHING = ['super_admin', 'kepala_mts', 'kepala_ma', 'operator', 'guru', 'wali_kelas']
const CROSS = ['super_admin', 'pimpinan', 'pengawas']

export const NAV = [
  { group: 'Utama', items: [
    { to: '/dasbor', label: 'Dashboard', icon: '▦', roles: [...STAFF, 'siswa'] },
    { to: '/dashboard-eksekutif', label: 'Dashboard Eksekutif', icon: '★', roles: CROSS },
  ] },
  { group: 'Data Induk', items: [
    { to: '/siswa', label: 'Siswa/Santri', icon: '👤', roles: ACADEMIC },
    { to: '/guru', label: 'Guru & Tendik', icon: '🎓', roles: ACADEMIC },
    { to: '/kelas', label: 'Kelas & Rombel', icon: '🏫', roles: ACADEMIC },
    { to: '/mata-pelajaran', label: 'Mata Pelajaran', icon: '📚', roles: ACADEMIC },
    { to: '/kurikulum', label: 'Penugasan Kurikulum', icon: '🧩', roles: ACADEMIC },
    { to: '/jadwal', label: 'Jadwal Pelajaran', icon: '🗓️', roles: ACADEMIC },
    { to: '/unit', label: 'Unit Pendidikan', icon: '🏛️', roles: STAFF },
    { to: '/periode', label: 'Tahun Ajaran & Semester', icon: '⏳', roles: STAFF },
  ] },
  { group: 'Akademik', items: [
    { to: '/presensi-siswa', label: 'Presensi Siswa', icon: '✅', roles: TEACHING },
    { to: '/presensi-guru', label: 'Presensi Guru', icon: '🕒', roles: TEACHING },
    { to: '/nilai', label: 'Penilaian Akademik', icon: '📊', roles: ACADEMIC },
    { to: '/rapor', label: 'Rapor Siswa', icon: '📄', roles: ACADEMIC },
    { to: '/kenaikan-kelas', label: 'Kenaikan Kelas & Kelulusan', icon: '🎯', roles: ['super_admin', 'kepala_mts', 'kepala_ma', 'operator'] },
    { to: '/kinerja-guru', label: 'Manajemen Guru', icon: '🧑‍🏫', roles: ACADEMIC },
  ] },
  { group: 'Pembelajaran (LMS)', items: [
    { to: '/lms/materi', label: 'Materi Pembelajaran', icon: '📖', roles: TEACHING.concat('siswa') },
    { to: '/lms/tugas', label: 'Tugas & Pengumpulan', icon: '📝', roles: TEACHING.concat('siswa') },
    { to: '/lms/koreksi', label: 'Koreksi Tugas', icon: '🖊️', roles: TEACHING },
  ] },
  { group: 'Ujian CBT', items: [
    { to: '/cbt/bank-soal', label: 'Bank Soal', icon: '🗃️', roles: ACADEMIC },
    { to: '/cbt/ujian', label: 'Kelola Ujian', icon: '🖥️', roles: TEACHING },
    { to: '/cbt/jadwal', label: 'Jadwal & Monitoring', icon: '📅', roles: ACADEMIC },
    { to: '/cbt/koreksi', label: 'Koreksi Ujian', icon: '✍️', roles: ACADEMIC },
    { to: '/cbt/ujian-saya', label: 'Ujian Saya', icon: '🧪', roles: ['siswa'] },
  ] },
  { group: 'Laporan & Administrasi', items: [
    { to: '/laporan', label: 'Laporan & Analitik', icon: '📈', roles: ACADEMIC },
    { to: '/pengguna', label: 'Pengguna & Peran', icon: '🔐', roles: ['super_admin'] },
    { to: '/audit', label: 'Audit Log', icon: '🧾', roles: ['super_admin', 'kepala_mts', 'kepala_ma', 'pimpinan', 'pengawas'] },
    { to: '/pengaturan', label: 'Pengaturan', icon: '⚙️', roles: ['super_admin'] },
    { to: '/bantuan', label: 'Batasan & Panduan', icon: '❓', roles: [...STAFF, 'siswa'] },
  ] },
]

export function navFor(role) {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length)
}
export function canSee(role, to) {
  for (const g of NAV) for (const i of g.items) if (i.to === to) return i.roles.includes(role)
  return false
}
export const roleHome = () => '/dasbor'
