# MASTER PROMPT FREEBUFF --- PIAT 6 MADRASAH MANAGEMENT SYSTEM v1.0

Bertindak sebagai tim profesional: Product Manager, UI/UX Designer,
Full-Stack Developer, Database Designer, dan QA Engineer. Saya pengguna
non-teknis. Saya ingin Anda LANGSUNG MEMBANGUN aplikasi web PIAT 6
Madrasah Management System berdasarkan dokumen proyek yang tersedia.
Jangan berhenti pada analisis, rencana, atau mockup.

## Konteks

Satu aplikasi mengelola dua unit: MTs PIAT 6 Bondowoso dan MA PIAT 6
Bondowoso. Kamad MTs hanya mengelola MTs; Kamad MA hanya mengelola MA;
pimpinan berwenang dapat melihat ringkasan lintas unit. Guru, operator,
wali kelas, pengawas, dan siswa memiliki hak sesuai role dan penugasan.

## Baca dokumen

Baca PRD, modul/workflow, role/permission, rancangan data, UI/UX,
LMS/CBT, dan acceptance criteria di folder docs. Jika Anda tidak dapat
membaca repository secara langsung, minta hanya dokumen yang benar-benar
diperlukan, lalu lanjutkan berdasarkan spesifikasi yang tersedia. Jangan
meminta persetujuan untuk keputusan teknis rutin.

## Modul wajib

1.  Dashboard eksekutif.
2.  Dashboard Kamad per unit.
3.  Data induk siswa, guru, kelas, mapel, kurikulum, tahun ajaran,
    semester, jadwal.
4.  Manajemen akademik.
5.  Presensi siswa dan guru.
6.  Penilaian.
7.  Rapor.
8.  Kenaikan kelas/kelulusan.
9.  Manajemen guru/wali kelas.
10. LMS: materi, tugas, pengumpulan, koreksi, umpan balik.
11. Bank soal CBT.
12. Ujian CBT.
13. Koreksi tugas dan ujian.
14. Jadwal/monitoring ujian.
15. Laporan dan analitik.
16. Pengguna, RBAC, permission, audit log.

## Instruksi pembangunan

1.  Periksa repo dan aplikasi yang sudah ada terlebih dahulu. Jika sudah
    ada aplikasi, lanjutkan aplikasi tersebut; jangan membuat duplikat.
2.  Bangun fondasi, navigasi, autentikasi, role, dan pemisahan MTs/MA.
3.  Bangun data induk, akademik, presensi, nilai, rapor, dan keputusan
    kenaikan kelas.
4.  Bangun LMS dan CBT end-to-end sesuai kemampuan platform.
5.  Bangun laporan, analitik, audit, dan pengaturan.
6.  Isi data demo yang realistis dan saling terhubung.
7.  Uji alur dan perbaiki masalah yang ditemukan.
8.  Teruskan sampai versi 1.0 dapat dicoba. Jangan berhenti setelah
    memberi rencana.

## Persyaratan

-   Gunakan RBAC yang membatasi operasi dan data, bukan hanya menu.
-   Terapkan pemisahan data MTs/MA.
-   Data dashboard, grafik, dan laporan harus berasal dari data
    tersimpan.
-   Form, tombol, CRUD, pencarian, filter, dan navigasi inti harus
    berfungsi.
-   Gunakan Bahasa Indonesia dan UI modern, bersih, profesional,
    responsif.
-   Buat loading state, empty state, validasi, pesan error, dan
    konfirmasi aksi penting.
-   Data demo harus ditandai jelas.
-   Lindungi kunci jawaban CBT dan nilai draft.
-   Jangan menampilkan kata sandi di log.
-   Jangan mengklaim integrasi eksternal atau fitur anti-cheat tersedia
    sebelum benar-benar teruji.
-   Jangan menghapus fitur yang sudah berjalan tanpa alasan dan backup
    yang sesuai.

## Selesai jika

-   Modul utama tersedia dan bisa diuji.
-   Pengguna masuk ke dashboard sesuai role.
-   Pemisahan MTs/MA teruji.
-   Data demo terhubung antarmodul.
-   Presensi, penilaian, rapor, LMS, dan CBT memiliki alur yang bisa
    dicoba.
-   Laporan berasal dari data aktual.
-   Tampilan desktop/ponsel memadai.
-   Tidak ada tombol inti palsu.

## Laporan akhir

Jelaskan fitur yang selesai, role/akses, pengujian lulus/gagal/belum
terverifikasi, keterbatasan, dan hal yang harus diperiksa sebelum
memasukkan data resmi.

MULAI SEKARANG: periksa proyek dan dokumen, lalu bangun, uji, dan
perbaiki aplikasi. Jangan hanya mengulang instruksi ini sebagai jawaban.
