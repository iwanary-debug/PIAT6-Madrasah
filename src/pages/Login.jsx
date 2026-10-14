import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const DEMO = [
  ['superadmin@piat6.sch.id', 'Super Admin', 'Konfigurasi aplikasi, pengguna, peran, dan akses lintas unit'],
  ['pimpinan@piat6.sch.id', 'Pimpinan/Yayasan', 'Dashboard & laporan lintas unit MTs dan MA'],
  ['kamad.mts@piat6.sch.id', 'Kepala MTs', 'Mengelola dan memantau data operasional MTs'],
  ['kamad.ma@piat6.sch.id', 'Kepala MA', 'Mengelola dan memantau data operasional MA'],
  ['operator.mts@piat6.sch.id', 'Operator Akademik MTs', 'Data induk dan administrasi akademik MTs'],
  ['operator.ma@piat6.sch.id', 'Operator Akademik MA', 'Data induk dan administrasi akademik MA'],
  ['guru.matematika@piat6.sch.id', 'Guru Matematika MTs', 'Presensi, nilai, materi, tugas, dan ujian untuk kelas diampu'],
  ['guru.fikih@piat6.sch.id', 'Guru Fikih MTs', 'Kelas VII A dan kelas MTs lain yang diampu'],
  ['walikelas.viia@piat6.sch.id', 'Wali Kelas VII A', 'Pemantauan kelas binaan dan catatan wali kelas'],
  ['guru.matematika.ma@piat6.sch.id', 'Guru Matematika MA', 'Kelas X IPA, XI IPA, dan XII IPA'],
  ['pengawas@piat6.sch.id', 'Pengawas Mutu', 'Laporan dan analitik lintas unit (tanpa hak ubah)'],
  ['siswa.mts@piat6.sch.id', 'Siswa MTs (VII A)', 'Materi, tugas, ujian, dan hasil milik sendiri'],
  ['siswa.ma@piat6.sch.id', 'Siswa MA (X IPA)', 'Materi, tugas, ujian, dan hasil milik sendiri'],
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e, override) => {
    if (e) e.preventDefault()
    setBusy(true); setError(null)
    try {
      await login(override ? override[0] : email, override ? 'piat6demo' : password)
      navigate('/dasbor', { replace: true })
    } catch (err) {
      setError(err.message || 'Gagal masuk.')
    } finally { setBusy(false) }
  }

  return (
    <div className="login-wrap">
      <div className="login-left">
        <h1>PIAT 6 Madrasah Management System</h1>
        <p style={{ maxWidth: 520 }}>
          Sistem informasi manajemen akademik terintegrasi untuk <b>MTs PIAT 6 Bondowoso</b> dan <b>MA PIAT 6 Bondowoso</b>:
          data induk, kurikulum, presensi, penilaian, rapor, kenaikan kelas, pembelajaran digital (LMS), dan ujian berbasis komputer (CBT).
        </p>
        <div className="small" style={{ opacity: .9 }}>
          Aplikasi ini berisi <b>data demo</b> (nama, nilai, dan jadwal fiktif) agar seluruh alur dapat langsung dicoba.
          Hak akses dibatasi per peran dan per unit pendidikan.
        </div>
        <div className="small" style={{ opacity: .8 }}>
          Catatan keterbatasan: aplikasi belum terhubung ke EMIS/Dapodik, belum memakai perangkat biometrik, dan
          belum terintegrasi WhatsApp/SMS. Rincian ada di halaman “Batasan &amp; Panduan” setelah masuk.
        </div>
      </div>
      <div className="login-card">
        <h2>Masuk</h2>
        <p className="small muted">Gunakan akun demo di bawah atau akun yang diberikan operator madrasah.</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" placeholder="nama@piat6.sch.id" />
          </label>
          <label className="field">
            <span>Kata sandi</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" />
          </label>
          {error && <div className="err mb1" role="alert">{error}</div>}
          <button className="btn" type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Memproses…' : 'Masuk'}</button>
        </form>
        <div className="mt2">
          <div className="small"><b>Akun demo</b> — kata sandi: <code>piat6demo</code></div>
          <div className="demo-list mt1">
            {DEMO.map((d) => (
              <button key={d[0]} className="demo-item" onClick={() => submit(null, d)} disabled={busy}>
                <b>{d[1]}</b>
                <span>{d[0]} — {d[2]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
