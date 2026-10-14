import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, useFetch, useDebounced } from '../lib/auth'
import { navFor } from '../lib/nav'
import { roleLabel, tanggal } from '../lib/format'
import { Modal } from './ui'

function TopSearch({ role, onOpenStudent }) {
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 300)
  const allowed = ['super_admin', 'pimpinan', 'kepala_mts', 'kepala_ma', 'operator', 'guru', 'wali_kelas', 'pengawas'].includes(role)
  const { data } = useFetch(allowed && dq.length >= 2 ? `/rt/students?q=${encodeURIComponent(dq)}&limit=6` : '', dq)
  const { data: tData } = useFetch(allowed && dq.length >= 2 ? `/rt/teachers?q=${encodeURIComponent(dq)}&limit=5` : '', dq)
  const navigate = useNavigate()
  const results = []
  if (data && data.data) for (const s of data.data) results.push({ type: 'Siswa', label: s.name, sub: `${s.class_name || '-'} • ${s.unit_code || ''}`, to: `/siswa?focus=${s.id}` })
  if (tData && tData.data) for (const t of tData.data) results.push({ type: 'Guru', label: t.name, sub: t.position || '', to: `/guru?focus=${t.id}` })
  return (
    <div className="search" style={{ position: 'relative', flex: '1 1 220px', maxWidth: 420 }}>
      {allowed && (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari siswa atau guru…" aria-label="Pencarian cepat" />
          {dq.length >= 2 && (
            <div className="menu-pop" style={{ top: '2.6rem', left: 0, right: 'auto', width: '100%' }}>
              {results.length === 0 && <div className="small muted">Tidak ada hasil untuk “{dq}”.</div>}
              {results.map((r, i) => (
                <button key={i} className="demo-item" style={{ width: '100%' }} onClick={() => { setQ(''); navigate(r.to) }}>
                  <b>{r.label}</b><span>{r.type} • {r.sub}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Layout({ children, title, subtitle }) {
  const { user, scope, options, logout, extra } = useAuth()
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  const [notif, setNotif] = useState(false)
  const [studentModal, setStudentModal] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()
  const nav = useMemo(() => navFor(user.role), [user.role])
  const { data: dash } = useFetch('/dashboard', location.pathname)

  useEffect(() => { setOpen(false); setMenu(false); setNotif(false) }, [location.pathname])
  useEffect(() => {
    const sp = new URLSearchParams(location.search)
    const f = sp.get('focus')
    if (f && location.pathname === '/siswa') setStudentModal(Number(f))
  }, [location.pathname, location.search])

  const unitText = scope.kind === 'all' ? 'Lintas unit (MTs & MA)' : scope.kind === 'unit' ? (options?.units?.[0]?.name || `Unit ${scope.unitId}`) : scope.kind === 'classes' ? `${extra?.teacher?.position || 'Guru'} • ${options?.units?.[0]?.name || ''}` : extra?.student ? `${extra.student.class_name} • ${extra.student.unit_name}` : ''
  const notifications = (dash && dash.notifications) || []

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">P6</span>
          <span><b>PIAT 6 Madrasah</b><span>MTs &amp; MA Bondowoso</span></span>
        </div>
        <nav className="nav">
          {nav.map((g) => (
            <div key={g.group}>
              <div className="nav-group">{g.group}</div>
              {g.items.map((i) => (
                <NavLink key={i.to} to={i.to} className={({ isActive }) => (isActive ? 'active' : '')} onClick={() => setOpen(false)}>
                  <span className="ico" aria-hidden="true">{i.icon}</span>{i.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', fontSize: '.75rem', color: '#9fc3b6', padding: '.6rem .4rem 0', borderTop: '1px solid rgba(255,255,255,.12)' }}>
          v1.0 • Data demo<br />{options?.demo?.notice ? 'Bukan untuk data resmi' : ''}
        </div>
      </aside>
      <div className={`overlay ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="burger" onClick={() => setOpen((s) => !s)} aria-label="Buka menu">☰</button>
          <div style={{ minWidth: 0 }}>
            <h1>{title}</h1>
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <span style={{ flex: 1 }} />
          <TopSearch role={user.role} />
          <div style={{ position: 'relative' }}>
            <button className="btn secondary sm" onClick={() => setNotif((s) => !s)} aria-label="Notifikasi">
              🔔{notifications.length ? ` ${notifications.length}` : ''}
            </button>
            {notif && (
              <div className="menu-pop">
                <b className="small">Notifikasi & tindak lanjut</b>
                <div className="mt1">
                  {notifications.length === 0 && <div className="small muted">Tidak ada pekerjaan yang perlu ditindaklanjuti saat ini.</div>}
                  {notifications.map((n, i) => (
                    <div className="notif" key={i}>
                      <span className={`pill ${n.level === 'peringatan' ? 'danger' : n.level === 'akademik' ? 'warn' : 'info'}`}>{n.level}</span>
                      <div className="small">{n.text}</div>
                      {n.link && <button className="linkbtn small" onClick={() => navigate(n.link)}>Buka halaman terkait</button>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button className="btn secondary sm row tight" onClick={() => setMenu((s) => !s)} aria-label="Menu pengguna">
              <span className="avatar" style={{ width: 26, height: 26, fontSize: '.75rem' }}>{user.name.slice(0, 1)}</span>
              <span className="small">{user.name.split(' ').slice(0, 2).join(' ')}</span>
            </button>
            {menu && (
              <div className="menu-pop">
                <div className="small"><b>{user.name}</b></div>
                <div className="small muted">{user.email}</div>
                <div className="small mt1"><span className="pill info">{roleLabel(user.role)}</span></div>
                <div className="small muted mt1">{unitText}</div>
                {user.is_demo ? <div className="small mt1"><span className="pill warn">Akun demo</span></div> : null}
                <div className="mt2 row tight">
                  <button className="btn secondary sm" onClick={() => navigate('/bantuan')}>Batasan &amp; panduan</button>
                  <button className="btn sm" onClick={async () => { await logout(); navigate('/masuk') }}>Keluar</button>
                </div>
              </div>
            )}
          </div>
        </header>
        <main className="content">
          {options && options.demo && options.demo.mode ? (
            <div style={{ background: '#fffaeb', border: '1px solid #fedf89', color: '#b54708', padding: '.45rem .7rem', borderRadius: 10, fontSize: '.82rem' }}>
              <b>Mode demo:</b> seluruh nama, nilai, dan jadwal pada aplikasi ini adalah data fiktif untuk pengujian fitur. Sumber data demo: seed bawaan aplikasi.
            </div>
          ) : null}
          {children}
        </main>
      </div>
      {studentModal && <StudentPeek id={studentModal} onClose={() => { setStudentModal(null); navigate('/siswa', { replace: true }) }} />}
    </div>
  )
}

function StudentPeek({ id, onClose }) {
  const { data } = useFetch(`/rt/students/${id}`, String(id))
  const s = data && data.data
  return (
    <Modal title="Profil singkat siswa" onClose={onClose} footer={<button className="btn" onClick={onClose}>Tutup</button>}>
      {!s ? <div className="muted">Memuat…</div> : (
        <div className="stack">
          <div><b>{s.name}</b><div className="small muted">NIS {s.nis} • NISN {s.nisn || '-'}</div></div>
          <div className="grid k2">
            <div className="small">Kelas: <b>{s.class_name || '-'}</b></div>
            <div className="small">Unit: <b>{s.unit_name || s.unit_code}</b></div>
            <div className="small">Jenis kelamin: <b>{s.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</b></div>
            <div className="small">Status: <b>{s.status}</b></div>
            <div className="small">Wali: <b>{s.parent_name || '-'}</b></div>
            <div className="small">Telepon wali: <b>{s.parent_phone || '-'}</b></div>
            <div className="small">Tempat/tanggal lahir: <b>{s.birth_place || '-'}, {tanggal(s.birth_date)}</b></div>
            <div className="small">Alamat: <b>{s.address || '-'}</b></div>
          </div>
          <a className="btn secondary sm" href={`#`} onClick={(e) => { e.preventDefault(); window.location.href = `/siswa?focus=${s.id}` }}>Buka di halaman data siswa</a>
        </div>
      )}
    </Modal>
  )
}
