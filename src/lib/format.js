export const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '')
export function tanggal(v, withTime = false) {
  if (!v) return '-'
  const d = new Date(v)
  if (isNaN(d)) return String(v)
  const opt = { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }
  if (withTime) { opt.hour = '2-digit'; opt.minute = '2-digit' }
  return d.toLocaleDateString('id-ID', opt)
}
export function waktu(v) { return v ? tanggal(v, true).replace('pukul', '') : '-' }
export function num(v, digits = 1) { return v == null || v === '' ? '-' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: digits, minimumFractionDigits: 0 }) }
export function pct(v) { return v == null ? '-' : `${num(v)}%` }
export const LABEL = {
  hadir: 'Hadir', sakit: 'Sakit', izin: 'Izin', alpa: 'Alpa', terlambat: 'Terlambat',
  dinas_luar: 'Dinas luar', tugas_luar: 'Tugas luar', cuti: 'Cuti',
  aktif: 'Aktif', nonaktif: 'Nonaktif', lulus: 'Lulus', keluar: 'Keluar', pindah: 'Pindah',
  L: 'Laki-laki', P: 'Perempuan',
  multiple_choice: 'Pilihan ganda', true_false: 'Benar/Salah', essay: 'Uraian',
  draft: 'Draft', reviewed: 'Diperiksa', approved: 'Disetujui', published: 'Diterbitkan', closed: 'Ditutup', arsip: 'Arsip',
  not_started: 'Belum mulai', in_progress: 'Sedang mengerjakan', submitted: 'Terkirim (perlu diperiksa)', graded: 'Sudah dinilai',
  missing: 'Belum dikumpulkan', ready: 'Siap digunakan',
  naik: 'Naik kelas', tidak_naik: 'Tidak naik', mengulang: 'Mengulang', lulus_akademik: 'Lulus', tidak_lulus: 'Tidak lulus', pertimbangan: 'Perlu pertimbangan',
  data_belum_lengkap: 'Data belum lengkap',
  belum_mulai: 'Belum dimulai', berlangsung: 'Berlangsung', berakhir: 'Berakhir',
  mudah: 'Mudah', sedang: 'Sedang', sulit: 'Sulit',
  role_super_admin: 'Super Admin',
}
export const label = (v) => (v == null ? '-' : LABEL[v] || cap(String(v).replace(/_/g, ' ')))
export function badgeClass(v) {
  if (['hadir', 'aktif', 'published', 'graded', 'lulus', 'naik', 'ready', 'approved', 'berlangsung'].includes(v)) return 'ok'
  if (['sakit', 'izin', 'terlambat', 'draft', 'reviewed', 'submitted', 'in_progress', 'pertimbangan', 'sedang', 'dinamika'].includes(v)) return 'warn'
  if (['alpa', 'tidak_naik', 'tidak_lulus', 'nonaktif', 'keluar', 'missing', 'arsip', 'berakhir'].includes(v)) return 'danger'
  if (['belum_mulai', 'info', 'not_started', 'closed'].includes(v)) return 'info'
  return 'neutral'
}
export const ROLE_LABEL = {
  super_admin: 'Super Admin', pimpinan: 'Pimpinan/Yayasan', kepala_mts: 'Kepala MTs', kepala_ma: 'Kepala MA',
  operator: 'Operator Akademik', guru: 'Guru', wali_kelas: 'Wali Kelas', pengawas: 'Pengawas/Tim Mutu', siswa: 'Siswa',
}
export const roleLabel = (r) => ROLE_LABEL[r] || r
export function todayInput() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}
export function fullName(u) { return u ? u.name : '-' }
