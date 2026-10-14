# PIAT 6 Madrasah Management System v1.0

Sistem informasi manajemen akademik **terintegrasi** untuk dua unit pendidikan dalam satu aplikasi:
**MTs PIAT 6 Bondowoso** dan **MA PIAT 6 Bondowoso** (Pesantren Islam Al Irsyad Tengaran 6).

Aplikasi berisi **data demo fiktif** yang saling terhubung sehingga seluruh alur (data induk → kurikulum → presensi → penilaian → rapor → kenaikan kelas → LMS → CBT → laporan) dapat langsung dicoba.

## Ringkasan teknologi

| Bagian | Teknologi |
| --- | --- |
| Antarmuka | React 18 + Vite 5 (SPA), React Router, Recharts, CSS tunggal responsif |
| API | Cloudflare Worker (ES module, Web API) — `worker/index.js` |
| Basis data | Cloudflare D1 (SQLite) — skema + seed demo ada di `worker/schema.js` |
| Autentikasi | Sesi cookie `HttpOnly; SameSite=Lax; Secure` + kata sandi PBKDF2-SHA256 (WebCrypto) |
| Otorisasi | RBAC (9 peran) + pembatasan unit/kelas/relasi data di sisi server, plus audit log |

Antarmuka berbahasa Indonesia. Tidak ada layanan pihak ketiga yang dibutuhkan untuk menjalankan versi ini.

## Menjalankan secara lokal

```bash
npm install

# terminal 1 — API Worker + D1 lokal (http://127.0.0.1:8787)
npm run worker:dev

# terminal 2 — antarmuka (http://localhost:3000, /api diproksi ke Worker)
npm run dev
```

Buka `http://localhost:3000`. Basis data D1 lokal dibuat otomatis pada permintaan pertama
(skema + data demo, ±20.000 baris; < 1 detik di lokal).

### Akun demo (kata sandi semua akun: `piat6demo`)

| Peran | Email |
| --- | --- |
| Super Admin | `superadmin@piat6.sch.id` |
| Pimpinan/Yayasan | `pimpinan@piat6.sch.id` |
| Kepala MTs | `kamad.mts@piat6.sch.id` |
| Kepala MA | `kamad.ma@piat6.sch.id` |
| Operator MTs / MA | `operator.mts@piat6.sch.id`, `operator.ma@piat6.sch.id` |
| Guru (MTs / MA) | `guru.matematika@piat6.sch.id`, `guru.fikih@piat6.sch.id`, `guru.matematika.ma@piat6.sch.id` |
| Wali Kelas | `walikelas.viia@piat6.sch.id` |
| Pengawas Mutu | `pengawas@piat6.sch.id` |
| Siswa (MTs / MA) | `siswa.mts@piat6.sch.id`, `siswa.ma@piat6.sch.id` |

## Pengujian

```bash
npm run test:api   # 150 pemeriksaan API end-to-end (perlu Worker dev di :8787)
npm run test:ui    # 31 pemeriksaan antarmuka (React di jsdom; perlu Worker :8787 + Vite :3000)
npm run test       # keduanya
```

Uji UI menjalankan aplikasi React sungguhan di jsdom terhadap Worker: masuk lewat halaman masuk,
menyusuri menu per peran, menyimpan presensi lewat tombol aplikasi, dan membaca ulang hasilnya dari API.
Skrip uji UI memakai `jsdom` yang dipasang di `/tmp/harness` (di luar proyek) agar `package-lock.json` tidak berubah.

Uji UI juga dapat diarahkan ke hasil deploy:

```bash
UI_BASE=https://<domain-preview> node tests/ui-test.mjs
```

## Deploy (Cloudflare Worker + aset statis)

```bash
npm run build            # hasil antarmuka ke dist/
npm run worker:bundle    # Worker dibundel ke deploy/worker.js
# manifest deploy ada di deploy/manifest.json (entrypoint + assetsDirectory ../dist, spa: true)
```

Berkas yang diunggah hanya `deploy/worker.js` dan isi `dist/` (hasil build). Rahasia tidak ada di dalam repo;
`session_secret` dibuat otomatis dan disimpan di tabel `meta` basis data.

## Struktur berkas penting

```
src/                     antarmuka React (pages/, components/, lib/)
worker/index.js          router API, definisi CRUD, middleware sesi/otorisasi
worker/lib.js            RBAC, cakupan data (unit/kelas/diri sendiri), audit, sesi
worker/schema.js         skema D1 (DDL) + pembuat data demo + pengaturan awal
worker/routes/           modul API: academic, lms, cbt, reports
scripts/api-test.mjs     uji penerimaan API (150 pemeriksaan)
tests/ui-test.mjs        uji antarmuka end-to-end di jsdom (31 pemeriksaan)
docs/STATUS-IMPLEMENTASI.md  status fitur, hasil uji skenario, dan batasan
PIAT6_Madrasah_Freebuff_Docs/  dokumen spesifikasi dari pengguna (tidak diubah)
```

## Batasan versi 1.0

Lihat halaman **Batasan & Panduan** di aplikasi dan `docs/STATUS-IMPLEMENTASI.md`.
Ringkasnya: belum ada integrasi EMIS/Dapodik, biometrik, notifikasi WhatsApp/SMS, maupun unggahan berkas
ke penyimpanan objek; CBT belum mengklaim anti-kecurangan selain pembatasan waktu, pengacakan, dan pencatatan aktivitas.
