# Role dan Permission (RBAC)

  -----------------------------------------------------------------------
  Role                    Lingkup                 Hak utama
  ----------------------- ----------------------- -----------------------
  Super Admin             Administrasi lintas     Konfigurasi, pengguna,
                          unit                    role, akses sesuai
                                                  kebutuhan admin

  Pimpinan/Yayasan        MTs + MA sesuai izin    Dashboard dan laporan
                                                  lintas unit; perubahan
                                                  hanya bila ditugaskan

  Kepala MTs              MTs                     Pantau dan kelola data
                                                  MTs sesuai kewenangan

  Kepala MA               MA                      Pantau dan kelola data
                                                  MA sesuai kewenangan

  Operator Akademik       Unit yang ditugaskan    Data induk dan
                                                  administrasi akademik

  Guru                    Kelas/mapel yang        Presensi, materi,
                          ditugaskan              tugas, nilai, koreksi
                                                  sesuai izin

  Wali Kelas              Kelas tanggung jawab    Pantau siswa, catatan
                                                  kelas, kelengkapan
                                                  rapor

  Pengawas/Tim Mutu       Lingkup penugasan       Laporan dan analitik;
                                                  tidak mengubah data
                                                  secara default

  Siswa                   Data sendiri            Materi, tugas, ujian,
                                                  hasil yang
                                                  dipublikasikan,
                                                  pengumpulan jawaban
  -----------------------------------------------------------------------

## Aturan wajib

-   Kamad MTs tidak dapat membaca atau mengubah data operasional MA
    tanpa izin eksplisit, dan sebaliknya.
-   Guru hanya mengakses kelas/mapel yang ditugaskan.
-   Siswa hanya mengakses data diri dan aktivitas belajarnya.
-   Kunci jawaban CBT dan nilai draft tidak terlihat oleh siswa.
-   Hak ekspor mengikuti hak baca data.
-   Role harus membatasi operasi dan data, bukan hanya menyembunyikan
    menu.
-   Jangan menyimpan kata sandi dalam profil atau log.
-   Uji dengan akun terpisah untuk setiap role.
