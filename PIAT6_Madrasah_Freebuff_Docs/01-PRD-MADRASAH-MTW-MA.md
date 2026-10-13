# PRD --- PIAT 6 Madrasah Management System v1.0

## Ringkasan

Aplikasi web manajemen akademik untuk dua unit, MTs PIAT 6 Bondowoso dan
MA PIAT 6 Bondowoso, dalam satu sistem. Aplikasi harus mendukung
operasional harian, analisis akademik, pelaporan, dan pengembangan
lanjutan.

## Tujuan

-   Menyatukan administrasi akademik MTs dan MA.
-   Mengurangi input data berulang dan menjaga konsistensi.
-   Menerapkan hak akses sesuai peran dan unit.
-   Memfasilitasi presensi, penilaian, rapor, LMS, dan CBT.
-   Menyajikan laporan serta analitik dari data aktual.

## Pengguna

Super Admin, Pimpinan/Yayasan, Kepala MTs, Kepala MA, Operator Akademik,
Guru, Wali Kelas, Pengawas/Tim Mutu, Siswa.

## Modul v1.0

1.  Dashboard eksekutif.
2.  Dashboard kepala madrasah per unit.
3.  Data induk siswa, guru, kelas, mata pelajaran, tahun ajaran,
    semester, kurikulum, jadwal.
4.  Manajemen akademik dan kurikulum.
5.  Presensi siswa dan guru.
6.  Penilaian akademik.
7.  Rapor.
8.  Kenaikan kelas dan kelulusan.
9.  Manajemen guru dan wali kelas.
10. LMS: materi, tugas, pengumpulan, koreksi, umpan balik.
11. Bank soal CBT.
12. Ujian CBT.
13. Koreksi tugas dan ujian.
14. Jadwal dan monitoring ujian.
15. Laporan dan analitik.
16. Pengguna, role, permission, audit log.

## Aturan unit

-   Kamad MTs hanya mengakses data operasional MTs.
-   Kamad MA hanya mengakses data operasional MA.
-   Pimpinan lintas unit hanya melihat data sesuai hak yang diberikan.
-   Guru dan wali kelas dibatasi oleh penugasan kelas/mata pelajaran.
-   Siswa hanya melihat data sendiri serta materi, tugas, ujian, dan
    hasil yang ditujukan kepadanya.

## Kebutuhan nonfungsional

UI berbahasa Indonesia, responsif desktop dan ponsel, validasi form,
pesan error yang jelas, data konsisten, akses aman, dan audit aktivitas
penting jika didukung platform.

## Batasan

Jangan mengklaim integrasi EMIS/Dapodik, biometrik, WhatsApp/SMS, bank,
anti-cheat tingkat lanjut, atau SSO lintas aplikasi kecuali benar-benar
tersedia, dikonfigurasi, dan diuji.

## Kriteria sukses

Alur inti dapat diuji, data terhubung antarmodul, pembatasan MTs/MA
benar, laporan berasal dari data tersimpan, dan tidak ada tombol inti
yang hanya dekoratif.
