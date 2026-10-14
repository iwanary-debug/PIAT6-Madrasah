# Status Implementasi — PIAT 6 Madrasah Management System v1.0

Dokumen ini menjelaskan apa yang **sudah berjalan**, apa yang **belum**, hasil pengujian, dan langkah
sebelum dipakai dengan data resmi. Semua angka dan perilaku di bawah berasal dari data nyata yang tersimpan
di Cloudflare D1 — bukan tampilan statis.

Terakhir diperbarui: 13 Oktober 2026.
Perintah verifikasi: `npm run test:api` (150 pemeriksaan) dan `npm run test:ui` (31 pemeriksaan) — keduanya lulus.

---

## 1. Fitur yang sudah berfungsi

### 1.1 Dashboard Eksekutif (lintas unit)
- Kartu statistik: jumlah siswa/santri MTs & MA, siswa aktif, guru/tendik, kelas, ringkasan kehadiran siswa dan guru,
  rata-rata nilai akademik, tugas belum dikumpulkan, hasil ujian terakhir, jadwal ujian terdekat, aktivitas LMS.
- Semua angka dihitung dari tabel D1 (presensi, nilai, tugas, ujian) — bukan angka statis.
- Grafik perbandingan performa MTs vs MA, tabel ringkasan per kelas/mata pelajaran, daftar notifikasi tindak lanjut
  (siswa bermasalah akademik, guru yang belum menuntaskan administrasi, ujian menunggu koreksi/publikasi).
- Filter unit, tahun ajaran, semester, kelas, dan rentang tanggal pada halaman laporan/dashboard terkait.
- Hanya peran lintas unit (Super Admin, Pimpinan, Pengawas) yang dapat membuka dashboard eksekutif.

### 1.2 Dashboard Kepala Madrasah
- Dashboard terpisah untuk MTs dan MA; `kepala_mts` hanya menerima data MTs, `kepala_ma` hanya data MA
  (diuji: "dashboard kamad MTs hanya unit MTs", "dashboard kamad MA hanya unit MA").
- Memuat: jumlah siswa/guru unit, kehadiran, kinerja per kelas, performa mata pelajaran, siswa nilai rendah,
  ketuntasan pengisian nilai, kelengkapan rapor, pelaksanaan pembelajaran, pelaksanaan/hasil ujian,
  pekerjaan guru yang belum selesai, dan rekomendasi tindak lanjut berbasis data.
- Guru masuk ke dashboard guru (kelas/mapel yang diampu), siswa masuk ke dashboard siswa (miliknya sendiri).

### 1.3 Data Induk
- Unit pendidikan, tahun ajaran, semester, siswa/santri, guru & tendik, kelas/rombongan belajar, wali kelas,
  mata pelajaran, penugasan kurikulum per kelas, jadwal pelajaran, status siswa.
- Pencarian (nama/NIS/NISN/orang tua), filter kelas/unit/status, paginasi, pengurutan, tambah, detail, ubah, arsip.
- Validasi: kolom wajib, duplikasi NIS ditolak dengan pesan jelas, kelas wajib sesuai unit.
- Penghapusan data penting = **arsip** (`status`/`is_active`), bukan hapus permanen.

### 1.4 Manajemen Akademik & Kurikulum
- Kurikulum sebagai penugasan mata pelajaran per kelas + guru pengampu + KKM per penugasan.
- Jadwal pelajaran (hari, jam ke-, waktu mulai/selesai, guru, ruang) dengan validasi konflik jadwal.
- Pengaturan tahun ajaran/semester aktif, kelas & wali kelas.
- Pemantauan kelengkapan administrasi pembelajaran (materi, tugas, penilaian) per guru per kelas.

### 1.5 Presensi Siswa
- Input presensi per kelas + tanggal (dan jadwal bila ada): hadir, sakit, izin, alpa, catatan.
- Rekap harian/mingguan/bulanan/periode, per kelas, per unit; persentase dihitung dari data tersimpan.
- Penanda siswa dengan ketidakhadiran tinggi (ambang dapat diatur pada Pengaturan).
- Koreksi presensi berubah statusnya dan tercatat sebagai "Koreksi presensi" di audit log.
- Guru hanya dapat mencatat pada kelas yang diampu; guru MA tidak dapat mencatat kelas MTs (diuji).

### 1.6 Presensi Guru
- Pencatatan kehadiran guru/tendik per tanggal, rekap per guru dan per unit, ringkasan ketidakhadiran.
- Saat ini **manual** (atau impor berkas oleh operator) — bukan dari perangkat biometrik.

### 1.7 Penilaian Akademik
- Komponen penilaian per kelas + mata pelajaran + semester dengan jenis (tugas, harian, ujian, praktik/proyek) dan bobot.
- Validasi: total bobot tidak boleh melebihi 100%, nilai harus 0–100.
- Input nilai massal per komponen, matriks nilai kelas, status ketuntasan terhadap KKM.
- Nilai akhir = (Σ nilai × bobot) ÷ (Σ bobot komponen terisi); rumus ditampilkan di halaman analisis sehingga dapat ditelusuri.
- Analisis per mata pelajaran dan daftar siswa di bawah KKM untuk remedial.

### 1.8 Rapor Siswa
- Rekap nilai per semester, rekap kehadiran, peringkat, catatan wali kelas, ringkasan capaian akademik.
- Status kelengkapan nilai per siswa (komponen yang belum diisi ditandai).
- Alur status: draft → diperiksa (wali kelas) → disetujui (kepala madrasah) → diterbitkan.
- **Rapor hanya dapat diterbitkan bila nilai lengkap** — sistem menolak sebaliknya.
- Pratinjau rapor per siswa + cetak (CSS cetak) ; siswa hanya melihat rapor yang sudah diterbitkan.
- Data MTs dan MA terpisah; identitas siswa, kelas, semester, dan nilai konsisten dari sumber yang sama.

### 1.9 Kenaikan Kelas & Kelulusan
- Rekap nilai akhir + presensi, pemeriksaan kelengkapan data, daftar memenuhi/belum memenuhi kriteria.
- Rekomendasi sistem berdasarkan kriteria pada Pengaturan (rata-rata minimal, batas ketidakhadiran) **beserta alasan data**.
- Keputusan tetap ditetapkan pejabat berwenang (kepala madrasah); guru tidak dapat menetapkan keputusan (diuji).
- Riwayat keputusan tersimpan, rekap siswa per status (naik/tidak naik/lulus).

### 1.10 Manajemen Guru dan Wali Kelas
- Profil guru, mata pelajaran yang diampu, kelas yang diajar, penetapan wali kelas, jadwal mengajar.
- Beban mengajar (jumlah kelas/mapel/jam), kelengkapan nilai, pengisian presensi, pembuatan materi/tugas.
- Ringkasan kinerja berbasis data tersimpan; guru hanya melihat lingkup tugas dan unitnya.

### 1.11 LMS (Learning Management System)
- Guru: membuat materi (judul, deskripsi, tautan/berkas/teks), mengelompokkan per kelas + mata pelajaran,
  membuat tugas dengan tenggat, melihat daftar sudah/belum mengumpulkan, menilai + umpan balik, memantau aktivitas.
- Siswa: melihat materi dan tugas sesuai kelas/mapel, mengumpulkan jawaban (teks + nama berkas), melihat status,
  melihat nilai/umpan balik **setelah dipublikasikan**.
- Dashboard LMS: jumlah materi, tugas aktif, sudah dikumpulkan, belum dikumpulkan, belum dinilai, tingkat penyelesaian per kelas.

### 1.12 Bank Soal CBT
- Soal pilihan ganda, benar/salah, dan uraian; kunci jawaban, bobot, pembahasan; status draft/siap.
- Pengelompokan per unit, mata pelajaran, kelas, topik, tingkat kesulitan; pencarian dan filter.
- Impor soal format JSON internal (`/api/cbt/questions/import`) dengan laporan hasil per baris (berhasil/gagal + alasan).
- Kunci jawaban **tidak pernah dikirim ke endpoint siswa** sebelum ujian dikoreksi/dipublikasikan (diuji).

### 1.13 Ujian CBT
- Penyusunan ujian: mata pelajaran, kelas peserta, pemilihan soal dari bank soal, jadwal mulai/selesai, durasi,
  pengacakan urutan soal/opsi, instruksi, jumlah soal per peserta.
- Halaman pengerjaan siswa: navigasi soal, penyimpanan jawaban berjalan, penghitung waktu, kirim jawaban.
- Penilaian otomatis soal objektif; soal uraian ditandai "perlu diperiksa".
- Status peserta: belum mulai, berlangsung, terkirim, selesai, perlu diperiksa; riwayat pengerjaan; ringkasan hasil.
- Setiap jawaban terhubung ke peserta, ujian, dan soal yang benar (unique constraint di `exam_answers`).

### 1.14 Koreksi Tugas dan Ujian
- Daftar tugas masuk, daftar ujian menunggu koreksi, pemeriksaan jawaban uraian, input nilai manual, umpan balik.
- Status belum diperiksa → diperiksa → selesai → dipublikasikan; riwayat koreksi tersimpan.
- Publikasi nilai hanya setelah diotorisasi guru pengampu; siswa baru melihat setelah publikasi (diuji).

### 1.15 Jadwal & Monitoring Ujian
- Kalender/jadwal ujian per unit, kelas, mata pelajaran; waktu, durasi, daftar peserta, status kesiapan ujian.
- Status pengerjaan peserta (belum mulai / sedang mengerjakan / selesai), peringatan konflik jadwal.
- Rekap hasil ujian (rata-rata, ketuntasan) dari data peserta yang tersimpan.

### 1.16 Laporan & Analitik
- Rekap siswa per unit/kelas, presensi siswa & guru, nilai per siswa/kelas, analisis mata pelajaran,
  daftar nilai di bawah KKM, daftar ketidakhadiran tinggi, rekap pengumpulan tugas, rekap hasil CBT,
  kelengkapan nilai & rapor, perbandingan performa MTs–MA (khusus peran lintas unit), tren antarperiode.
- Setiap laporan memakai filter unit/kelas/periode dan menyatakan sumber datanya; rekomendasi dipisahkan dari fakta.

### 1.17 Pengguna, Peran, Permission, dan Audit
- Manajemen akun (buat, ubah, aktif/nonaktif), penetapan peran dan unit kewenangan, kata sandi di-hash (PBKDF2-SHA256).
- Hash kata sandi tidak pernah muncul pada respons API maupun audit log (diuji).
- Audit log aktivitas penting: penyimpanan/koreksi presensi, penyimpanan nilai, penerbitan rapor, keputusan kenaikan kelas,
  perubahan data induk, perubahan pengguna/hak akses, perubahan pengaturan. Terlihat oleh peran berwenang sesuai unit.

---

## 2. Role dan akses yang diterapkan

Pembatasan dilakukan **di server** untuk setiap permintaan API (bukan hanya menyembunyikan menu):

| Peran | Cakupan data | Contoh kewenangan |
| --- | --- | --- |
| `super_admin` | Semua unit | Konfigurasi, pengguna, pengaturan, semua data |
| `pimpinan` | Semua unit (baca) | Dashboard eksekutif, laporan & perbandingan unit; tidak mengubah data operasional |
| `kepala_mts` | Unit MTs | Kelola/pantau MTs, setujui & terbitkan rapor MTs, keputusan kenaikan kelas MTs |
| `kepala_ma` | Unit MA | Sama untuk MA |
| `operator` | Unit yang ditugaskan | Data induk, kurikulum, jadwal, presensi, penyiapan rapor |
| `guru` | Kelas/mapel yang diampu | Presensi, nilai, materi, tugas, bank soal, ujian, koreksi; membuat ujian hanya untuk kelas diampu |
| `wali_kelas` | Kelas binaan | Pemantauan kelas, catatan wali kelas, status rapor |
| `pengawas` | Semua unit (baca) | Laporan, analitik, audit log, monitoring ujian; tanpa hak ubah |
| `siswa` | Dirinya sendiri | Materi, tugas, ujian, nilai terpublikasi, rapor terbit, presensi sendiri |

Contoh pembuktian: `kamad.mts` menerima 80 siswa MTs dan **tidak** dapat membuka data siswa MA (404);
`kamad.ma` kebalikannya; guru hanya menerima kelas yang diampu; siswa tidak dapat membuka data siswa lain
maupun bank soal; permintaan ubah data dengan `Origin` berbeda ditolak 403.

---

## 3. Skenario pengujian yang telah berhasil

`npm run test:api` → **150/150 lulus**; `npm run test:ui` → **31/31 lulus** (aplikasi React dijalankan di jsdom).

| # | Skenario (bagian J prompt) | Hasil | Bukti uji |
| --- | --- | --- | --- |
| 1 | Super Admin mengelola konfigurasi & pengguna | Lulus | "super admin dapat mengelola pengguna", "pengaturan aplikasi tampil" |
| 2 | Kamad MTs mengelola MTs tanpa akses operasional MA | Lulus | "kamad MTs tidak dapat membuka siswa MA (404)", "opsi kelas kamad MTs hanya kelas MTs" |
| 3 | Kamad MA mengelola MA tanpa akses MTs | Lulus | "kamad MA tidak dapat membuka siswa MTs (404)", "dashboard kamad MA hanya unit MA" |
| 4 | Pimpinan melihat ringkasan lintas unit | Lulus | "laporan perbandingan unit tersedia untuk pimpinan", "opsi pimpinan mencakup dua unit" |
| 5 | Guru melihat kelas & mapel tanggung jawabnya | Lulus | "guru hanya melihat penugasan mata pelajarannya", "opsi kelas guru dibatasi kelas yang diampu" |
| 6 | Guru mencatat presensi/nilai → muncul di laporan | Lulus | API: "rekap menghitung ulang dari data presensi"; **Uji UI**: isi presensi lewat tombol "Tandai semua hadir" + "Simpan presensi", hasil dibaca ulang dari API dan audit log |
| 7 | Nilai direkap & dipakai pratinjau rapor | Lulus | "nilai akhir kelas dihitung dari komponen tersimpan", "pratinjau rapor memuat nilai, presensi, dan peringkat" |
| 8 | Materi & tugas LMS tampil untuk siswa yang sesuai | Lulus | "tugas baru tampil untuk siswa kelas yang sesuai", "tugas tidak tampil untuk siswa unit/kelas lain" |
| 9 | Siswa mengumpulkan tugas | Lulus | "siswa dapat mengumpulkan tugas" |
| 10 | Guru memeriksa tugas, memberi nilai & umpan balik | Lulus | "guru dapat menilai tugas (draft)", "siswa melihat nilai & umpan balik setelah publikasi" |
| 11 | Bank soal dipakai menyusun ujian | Lulus | "guru dapat membuat soal", "impor soal melaporkan hasil per baris" |
| 12 | Siswa mengerjakan & mengirim CBT | Lulus | "siswa dapat memulai ujian yang berlangsung", "jawaban siswa tersimpan", "pengiriman ujian menghitung nilai objektif otomatis" |
| 13 | Hasil pilihan ganda dihitung dari kunci jawaban | Lulus | "pengiriman ujian menghitung nilai objektif otomatis"; "kunci jawaban tidak dikirim ke siswa" |
| 14 | Jawaban uraian diperiksa guru | Lulus | "guru melihat jawaban uraian untuk dikoreksi", "nilai akhir dihitung setelah uraian dinilai" |
| 15 | Jadwal & status ujian tampil dari data | Lulus | "jadwal ujian memuat status kesiapan dan konflik", "monitoring ujian menampilkan status peserta" |
| 16 | Filter, pencarian, laporan sesuai data | Lulus | "pencarian siswa memengaruhi hasil", "filter kelas memengaruhi hasil", "pagination dan pengurutan berjalan" |
| 17 | Data konsisten setelah halaman dimuat ulang | Lulus | API: "data konsisten setelah permintaan ulang"; UI: sesi & data tetap konsisten setelah reload |
| 18 | Tampilan berfungsi di desktop & ponsel | Lulus sebagian | Layout responsif (sidebar dapat dilipat, tabel dapat digulir, media query). Diuji melalui render jsdom + inspeksi CSS; **verifikasi visual di peramban ponsel belum dilakukan otomatis** |
| 19 | Pengguna tidak dapat melakukan tindakan terlarang | Lulus | "guru tidak dapat mengelola pengguna", "siswa tidak dapat menambah data induk", "guru tidak dapat menyetujui rapor", "permintaan ubah data dari origin lain ditolak" |
| 20 | Tidak ada tombol utama yang tidak berfungsi | Lulus | Uji UI mengklik tombol nyata (login, navigasi, simpan presensi, tab rekap); tombol yang tidak tersedia karena keterbatasan dijelaskan pada halaman "Batasan & Panduan" |

---

## 4. Fitur yang belum selesai atau memiliki keterbatasan

1. **Integrasi eksternal** — belum terhubung ke EMIS/Dapodik, e-learning pihak ketiga, atau sistem pesantren lain.
2. **Presensi biometrik/perangkat** — presensi dicatat manual oleh guru/operator; tidak ada integrasi mesin absensi.
3. **Notifikasi WhatsApp/SMS ke orang tua** — belum ada. Jalur alternatif: cetak/ekspor rekap dari halaman Laporan.
4. **Unggahan berkas ke penyimpanan objek** — pengumpulan tugas menerima teks dan nama berkas; berkas fisik belum diunggah.
5. **Anti-kecurangan CBT** — hanya pembatasan waktu, pengacakan urutan soal/opsi, pencatatan aktivitas penyimpanan jawaban,
   dan pembatasan akses kunci. Tidak ada penguncian perangkat atau pemantauan layar.
6. **Impor soal** — memakai format JSON internal; belum diuji dengan format Moodle/Excel/Docx.
7. **Ekspor PDF rapor** — menggunakan cetak peramban (Ctrl+P) dengan CSS cetak; belum ada generator PDF di server.
8. **Autentikasi** — versi ini memakai akun lokal (email + kata sandi) agar semua peran mudah diuji; SSO belum dipasang.
9. **Verifikasi visual peramban nyata** — pengujian otomatis dijalankan sebagai aplikasi React di jsdom (bukan peramban grafis),
   sehingga tata letak ponsel dan interaksi sentuh perlu ditinjau manual sekali oleh pengguna.
10. **Data demo** — semua data awal fiktif dan ditandai `is_demo = 1`; tidak boleh dipakai untuk pelaporan resmi.

---

## 5. Yang harus dilakukan sebelum digunakan dengan data resmi

1. Ganti akun demo dan pasang mekanisme identitas resmi (SSO/kebijakan kata sandi kuat); nonaktifkan akun demo.
2. Bersihkan data demo, jangan mencampur dengan data operasional (data demo bertanda `is_demo`).
3. Isi data induk resmi: unit, tahun ajaran/semester, kelas & wali kelas, siswa, guru, mata pelajaran, penugasan, jadwal.
4. Tinjau Pengaturan: KKM, ambang ketidakhadiran, kriteria kenaikan kelas, dan syarat kelengkapan rapor.
5. Tunjuk penanggung jawab per peran (kepala MTs, kepala MA, operator, wali kelas) dan periksa cakupan unitnya.
6. Siapkan prosedur koreksi presensi dan perubahan nilai (semua tercatat pada audit log) serta jadwal tinjauan berkala.
7. Lakukan uji penerimaan ulang di lingkungan tempat aplikasi dipasang (`npm run test:api`, `npm run test:ui`) dan
   verifikasi tampilan di peramban ponsel sebelum peluncuran.
