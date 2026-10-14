import React, { useEffect, useMemo, useState } from 'react'
import { useAuth, useFetch } from '../lib/auth'
import { Card, StatCard, Pill, Loading, Empty, Modal, Tabs, Select, Input, Confirm } from '../components/ui'
import { ResourceList, DataTable } from '../components/DataTable'
import { post, put, del } from '../lib/api'
import { tanggal, num, label, roleLabel } from '../lib/format'

export function UsersPage() {
  const { options, user } = useAuth()
  const [form, setForm] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const isSuper = user.role === 'super_admin'
  const { data, loading, reload } = useFetch('/rt/users?limit=100', 'users')
  const rows = data?.data || []
  const save = async (values, id) => {
    setBusy(true)
    try {
      const payload = { email: values.email, name: values.name, role: values.role, unit_id: values.unit_id ? Number(values.unit_id) : null, teacher_id: values.teacher_id ? Number(values.teacher_id) : null, student_id: values.student_id ? Number(values.student_id) : null, is_active: values.is_active ? 1 : 0, password: values.password || undefined }
      if (id) await put(`/rt/users/${id}`, payload)
      else await post('/rt/users', payload)
      setForm(null); reload()
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }
  const summary = useMemo(() => {
    const by = {}
    for (const r of rows) by[r.role] = (by[r.role] || 0) + 1
    return by
  }, [rows])
  return (
    <div className="stack">
      <Card title="Pengguna & Peran (RBAC)" subtitle="Hak akses dibatasi oleh peran dan unit pendidikan. Kata sandi tidak pernah ditampilkan pada daftar maupun log.">
        <div className="grid k4">
          <StatCard label="Total akun" value={num(rows.length, 0)} />
          <StatCard label="Akun aktif" value={num(rows.filter((r) => r.is_active).length, 0)} />
          <StatCard label="Akun demo" value={num(rows.filter((r) => r.is_demo).length, 0)} />
          <StatCard label="Peran terpakai" value={num(Object.keys(summary).length, 0)} foot={Object.entries(summary).map(([k, v]) => `${roleLabel(k)}: ${v}`).join(' • ').slice(0, 90)} />
        </div>
        <div className="toolbar mt2">
          {isSuper && <button className="btn sm" onClick={() => setForm({ is_active: true, role: 'guru' })}>+ Tambah pengguna</button>}
          <button className="btn secondary sm" onClick={reload}>↻ Muat ulang</button>
        </div>
        {loading ? <Loading /> : (
          <DataTable columns={[
            { key: 'name', label: 'Nama' },
            { key: 'email', label: 'Email' },
            { key: 'role', label: 'Peran', render: (r) => <Pill value="info" text={roleLabel(r.role)} /> },
            { key: 'unit_name', label: 'Unit', render: (r) => r.unit_name || 'Lintas unit' },
            { key: 'teacher_id', label: 'Terhubung guru', render: (r) => r.teacher_id || '-' },
            { key: 'student_id', label: 'Terhubung siswa', render: (r) => r.student_id || '-' },
            { key: 'is_active', label: 'Status', render: (r) => r.is_active ? <Pill value="aktif" /> : <Pill value="nonaktif" /> },
            { key: 'last_login', label: 'Login terakhir', render: (r) => (r.last_login ? tanggal(r.last_login, true) : '-') },
            { key: 'aksi', label: 'Aksi', render: (r) => isSuper ? <div className="row tight">
              <button className="btn secondary sm" onClick={() => setForm({ ...r, password: '' })}>Ubah</button>
              <button className="btn secondary sm" onClick={() => setConfirm(r)}>Nonaktifkan</button>
            </div> : <span className="small muted">—</span> },
          ]} rows={rows} emptyText="Belum ada pengguna." />
        )}
      </Card>
      {form && (
        <Modal title={form.id ? 'Ubah pengguna' : 'Tambah pengguna'} onClose={() => setForm(null)} footer={<>
          <button className="btn secondary" onClick={() => setForm(null)} disabled={busy}>Batal</button>
          <button className="btn" onClick={() => {
            if (!form.email || !form.name || !form.role) { alert('Email, nama, dan peran wajib diisi.'); return }
            save(form, form.id)
          }} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </>}>
          <div className="grid k2">
            <Input label="Email" type="email" required value={form.email} onChange={(v) => setForm((s) => ({ ...s, email: v }))} />
            <Input label="Nama lengkap" required value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} />
            <Select label="Peran" required value={form.role} onChange={(v) => setForm((s) => ({ ...s, role: v }))} options={(options?.roles || []).map((r) => ({ value: r.value, label: r.label }))} />
            <Select label="Unit pendidikan (kewenangan)" value={form.unit_id} onChange={(v) => setForm((s) => ({ ...s, unit_id: v }))} options={(options?.allUnits || []).map((u) => ({ value: u.id, label: u.name }))} placeholder="— lintas unit —" />
            <Input label="ID guru terhubung" type="number" value={form.teacher_id || ''} onChange={(v) => setForm((s) => ({ ...s, teacher_id: v }))} hint="Wajib untuk peran guru/wali kelas. Lihat ID di halaman Guru & Tendik." />
            <Input label="ID siswa terhubung" type="number" value={form.student_id || ''} onChange={(v) => setForm((s) => ({ ...s, student_id: v }))} hint="Wajib untuk peran siswa." />
            <Select label="Status akun" value={form.is_active ? '1' : '0'} onChange={(v) => setForm((s) => ({ ...s, is_active: v === '1' }))} options={[{ value: '1', label: 'Aktif' }, { value: '0', label: 'Nonaktif' }]} />
            <Input label={form.id ? 'Reset kata sandi (opsional)' : 'Kata sandi awal'} type="text" value={form.password || ''} onChange={(v) => setForm((s) => ({ ...s, password: v }))} hint="Nilai kata sandi tidak ditampilkan kembali dan tidak dicatat di audit log. Untuk akun demo gunakan piat6demo." />
          </div>
        </Modal>
      )}
      {confirm && <Confirm title="Nonaktifkan akun" danger confirmLabel="Nonaktifkan" busy={busy}
        message={`Nonaktifkan akun ${confirm.email}? Akun tidak dihapus permanen sehingga riwayat aktivitasnya tetap tersimpan.`}
        onCancel={() => setConfirm(null)} onConfirm={async () => { setBusy(true); try { await del(`/rt/users/${confirm.id}`); setConfirm(null); reload() } catch (e) { alert(e.message) } finally { setBusy(false) } }} />}
    </div>
  )
}

export function AuditPage() {
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [entity, setEntity] = useState('')
  const [page, setPage] = useState(1)
  const qs = `?limit=25&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}${entity ? `&entity=${entity}` : ''}`
  const { data, loading } = useFetch(`/audit${qs}`, qs)
  const entities = ['users', 'scores', 'attendance_students', 'attendance_teachers', 'report_cards', 'students', 'promotion_decisions', 'exams', 'exam_answers', 'question_bank', 'settings', 'lms_submissions', 'lms_assignments', 'lms_materials']
  return (
    <Card title="Audit Log" subtitle="Riwayat aktivitas penting: perubahan nilai, koreksi presensi, penerbitan rapor, perubahan data siswa, dan perubahan hak akses. Kata sandi tidak pernah dicatat.">
      <div className="toolbar">
        <input placeholder="Cari aktivitas, nama pelaku…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} style={{ maxWidth: 260 }} />
        <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1) }} style={{ maxWidth: 240 }}>
          <option value="">Modul: semua</option>
          {entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <div className="small muted" style={{ alignSelf: 'flex-end' }}>Peran Anda: {user.roleLabel}. Cakupan audit mengikuti kewenangan unit.</div>
      </div>
      {loading ? <Loading /> : (
        <DataTable columns={[
          { key: 'created_at', label: 'Waktu', render: (r) => tanggal(r.created_at, true) },
          { key: 'actor_name', label: 'Pelaku' },
          { key: 'role', label: 'Peran', render: (r) => roleLabel(r.role) },
          { key: 'action', label: 'Aktivitas' },
          { key: 'entity', label: 'Modul' },
          { key: 'entity_id', label: 'Objek' },
          { key: 'detail', label: 'Keterangan' },
        ]} rows={data?.data || []} emptyText="Belum ada aktivitas tercatat." />
      )}
      {data && data.total > 25 ? (
        <div className="row between mt1 small">
          <span className="muted">Total {data.total} aktivitas</span>
          <div className="row tight">
            <button className="btn secondary sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Sebelumnya</button>
            <span className="muted">Halaman {page} / {Math.ceil(data.total / 25)}</span>
            <button className="btn secondary sm" disabled={page >= Math.ceil(data.total / 25)} onClick={() => setPage((p) => p + 1)}>Berikutnya →</button>
          </div>
        </div>
      ) : null}
    </Card>
  )
}

export function SettingsPage() {
  const { user } = useAuth()
  const { data, loading, reload } = useFetch('/settings', 'settings')
  const [values, setValues] = useState({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => { if (data?.data) setValues(Object.fromEntries(data.data.map((r) => [r.key, r.value]))) }, [data])
  if (loading) return <Loading />
  const fields = (data?.data || []).filter((r) => r.key !== 'app_name')
  const save = async () => {
    setBusy(true); setMsg(null)
    try { await put('/settings', values); setMsg('Pengaturan tersimpan dan langsung dipakai perhitungan berikutnya.'); reload() }
    catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }
  return (
    <Card title="Pengaturan Aplikasi" subtitle="Nilai berikut dipakai untuk perhitungan ketuntasan, peringatan kehadiran, kriteria kenaikan kelas, dan penerbitan rapor.">
      <div className="grid k2">
        {fields.map((f) => (
          <Input key={f.key} label={f.key} hint={f.description} value={values[f.key] || ''} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
        ))}
      </div>
      {msg && <div className="small" style={{ color: '#0f6b4f' }}>{msg}</div>}
      <div className="row between mt2">
        <span className="small muted">Perubahan pengaturan dicatat pada audit log. Hanya Super Admin yang dapat mengubah.</span>
        <button className="btn" onClick={save} disabled={busy || user.role !== 'super_admin'}>{busy ? 'Menyimpan…' : 'Simpan pengaturan'}</button>
      </div>
    </Card>
  )
}
