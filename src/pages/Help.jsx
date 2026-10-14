import React from 'react'
import { Card, Pill, Tabs } from '../components/ui'
import { useAuth } from '../lib/auth'
import { roleLabel } from '../lib/format'

const LIMITS = [
  ['Integrasi eksternal', 'Aplikasi belum terhubung ke EMIS/Dapodik, e-learning pihak ketiga, atau sistem pesantren lain. Data siswa diisi manual oleh operator.'],
  ['Presensi biometrik', 'Presensi guru dan siswa dicatat manual (atau melalui impor berkas oleh operator). Tidak ada integrasi perangkat biometrik/absensi otomatis.'],
  ['Notifikasi WhatsApp/SMS', 'Belum ada pengiriman notifikasi ke orang tua. Jalur alternatif: cetak/ekspor rekap dari halaman Laporan lalu sampaikan melalui kanal madrasah.'],
  ['Unggah berkas', 'Pengumpulan tugas dapat dituliskan pada kolom jawaban dan nama berkas; unggahan file langsung ke penyimpanan objek belum diaktifkan pada versi ini.'],
  ['Anti-kecurangan CBT', 'Aplikasi hanya menyediakan pembatasan waktu, pengacakan urutan soal, pencatatan waktu penyimpanan jawaban, dan pembatasan akses kunci jawaban. Tidak ada penguncian perangkat maupun pengawasan layar.'],
  ['Impor soal', 'Impor bank soal memakai format JSON internal aplikasi dan belum diuji terhadap format aplikasi lain (mis. Moodle).'],
  ['Autentikasi', 'Versi demo memakai akun lokal (email + kata sandi) agar setiap peran dapat diuji. Untuk penggunaan resmi, disarankan mengaktifkan penyedia identitas madrasah/SSO dan menghapus akun demo.'],
  ['Data demo', 'Seluruh data awal adalah fiktif. Hapus/ganti dengan data resmi sebelum digunakan, dan jangan mencampurkan data demo dengan data operasional.'],
]

const ROLES = [
  ['super_admin', 'Konfigurasi aplikasi, pengguna, peran, akses lintas unit, pengaturan KKM/kriteria, audit log.'],
  ['pimpinan', 'Melihat dashboard eksekutif, laporan, dan perbandingan MTs–MA. Tidak mengubah data operasional.'],
  ['kepala_mts', 'Mengelola dan memantau seluruh data MTs, menyetujui/menerbitkan rapor dan keputusan kenaikan kelas MTs.'],
  ['kepala_ma', 'Sama seperti kepala MTs namun hanya untuk unit MA.'],
  ['operator', 'Data induk, penugasan kurikulum, jadwal, presensi, penyiapan rekap rapor pada unit yang ditugaskan.'],
  ['guru', 'Kelas dan mata pelajaran yang diampu: presensi, nilai, materi, tugas, bank soal, ujian, koreksi.'],
  ['wali_kelas', 'Tugas mengajar ditambah pemantauan kelas binaan: kelengkapan nilai, catatan wali kelas, status rapor, presensi.'],
  ['pengawas', 'Melihat laporan, analitik, audit log, dan memantau ujian lintas unit tanpa hak mengubah data.'],
  ['siswa', 'Materi, tugas, ujian, nilai yang dipublikasikan, rapor terbit, dan presensi miliknya sendiri.'],
]

export default function Help() {
  const { user, options } = useAuth()
  const [tab, setTab] = React.useState('panduan')
  return (
    <div className="stack">
      <Card title="Batasan & Panduan Penggunaan" subtitle="Dokumen jujur tentang apa yang sudah berjalan, apa yang belum, dan langkah sebelum penggunaan resmi">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: 'panduan', label: 'Alur penggunaan' },
          { value: 'peran', label: 'Peran & hak akses' },
          { value: 'batasan', label: 'Fitur yang belum tersedia' },
          { value: 'sebelum', label: 'Sebelum data resmi' },
        ]} />
        <div className="mt2">
          {tab === 'panduan' && (
            <div className="stack small">
              <p><b>Akun demo</b> — kata sandi untuk semua akun: <code>piat6demo</code>. Akun contoh ada di halaman masuk (mis. <code>kamad.mts@piat6.sch.id</code>, <code>guru.fikih@piat6.sch.id</code>, <code>siswa.mts@piat6.sch.id</code>).</p>
              <p><b>Alur tahun ajaran:</b> Super Admin menentukan tahun ajaran &amp; semester aktif (menu Tahun Ajaran &amp; Semester) → Operator menetapkan mata pelajaran per kelas dan jadwal → Guru mengisi presensi dan nilai → Wali kelas memeriksa rapor → Kepala madrasah menyetujui dan menerbitkan rapor.</p>
              <p><b>Alur LMS:</b> Guru membuat materi dan tugas pada kelas/mapel yang diampu → siswa melihat materi dan mengumpulkan tugas → guru menilai dan mempublikasikan nilai beserta umpan balik.</p>
              <p><b>Alur CBT:</b> Guru membuat soal di Bank Soal → menyusun ujian dan memilih soal → menerbitkan ujian (status terbit) → siswa mengerjakan pada jendela waktu ujian → soal objektif dinilai otomatis, uraian dikoreksi guru → guru mempublikasikan hasil.</p>
              <p><b>Perhitungan nilai akhir:</b> (Σ nilai komponen × bobot) ÷ (Σ bobot komponen yang sudah terisi). Jika ada komponen yang belum diisi, nilai akhir dihitung dari komponen yang ada dan ditandai belum lengkap pada halaman Rapor.</p>
              <p><b>Kenaikan kelas:</b> sistem hanya memberi <i>rekomendasi</i> berdasarkan kriteria pada Pengaturan (rata-rata minimal dan batas ketidakhadiran). Keputusan tetap ditetapkan kepala madrasah dan tersimpan sebagai riwayat.</p>
              <p><b>Data demo:</b> ditandai pada <code>is_demo</code> di basis data dan banner kuning di setiap halaman. Super Admin dapat membangun ulang data demo dari menu Pengaturan API (<code>POST /api/system/reseed</code>).</p>
            </div>
          )}
          {tab === 'peran' && (
            <div className="stack small">
              <p>Peran Anda saat ini: <Pill value="info" text={roleLabel(user.role)} />. Batasan akses diterapkan di server (setiap permintaan API diperiksa peran, unit, dan relasi data), bukan hanya menyembunyikan menu.</p>
              <ul>
                {ROLES.map(([r, desc]) => (
                  <li key={r}><b>{roleLabel(r)}</b> — {desc}{user.role === r ? ' ← peran Anda' : ''}</li>
                ))}
              </ul>
              <p className="muted">Akun demo dengan kewenangan: {options?.demo?.notice}</p>
            </div>
          )}
          {tab === 'batasan' && (
            <div className="stack small">
              {LIMITS.map(([t, d]) => (
                <div key={t} className="card" style={{ padding: '.6rem .8rem' }}>
                  <b>{t}</b>
                  <div className="muted">{d}</div>
                </div>
              ))}
            </div>
          )}
          {tab === 'sebelum' && (
            <div className="stack small">
              <ol>
                <li>Ganti seluruh akun demo dengan akun resmi madrasah dan aktifkan penyedia identitas (SSO) / kebijakan kata sandi kuat.</li>
                <li>Hapus data demo (<code>POST /api/system/reseed</code> hanya membangun ulang demo; gunakan pembersihan data sebelum mengisi data asli).</li>
                <li>Isi data induk resmi: unit, tahun ajaran, semester, kelas, siswa, guru, mata pelajaran, penugasan, dan jadwal.</li>
                <li>Tinjau Pengaturan: KKM, ambang kehadiran, kriteria kenaikan kelas, dan kewajiban kelengkapan nilai sebelum rapor diterbitkan.</li>
                <li>Lakukan uji coba satu kelas penuh (presensi → nilai → rapor → LMS → CBT) dan periksa laporan.</li>
                <li>Siapkan prosedur cadangan (backup) berkala basis data D1 dan kebijakan penyimpanan nilai/rapor.</li>
                <li>Sosialisasikan alur kerja dan pembagian peran kepada guru, wali kelas, operator, dan pimpinan.</li>
                <li>Pastikan kebijakan privasi data siswa dan persetujuan penggunaan sesuai ketentuan madrasah/yayasan.</li>
              </ol>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
