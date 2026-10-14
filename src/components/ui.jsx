import React, { useEffect, useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { label, badgeClass } from '../lib/format'

export const Card = ({ title, actions, children, className = '', subtitle }) => (
  <section className={`card ${className}`}>
    {(title || actions) && (
      <div className="card-head">
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          {subtitle && <div className="small muted">{subtitle}</div>}
        </div>
        {actions && <div className="toolbar">{actions}</div>}
      </div>
    )}
    {children}
  </section>
)

export const StatCard = ({ label: lbl, value, foot, tone }) => (
  <div className="card stat">
    <span className="label">{lbl}</span>
    <span className="value" style={tone ? { color: tone } : undefined}>{value}</span>
    {foot && <span className="foot">{foot}</span>}
  </div>
)

export const Pill = ({ value, text }) => (
  <span className={`pill ${badgeClass(value)}`}>{text || label(value)}</span>
)

export const Loading = ({ text = 'Memuat data…' }) => <div className="empty" role="status">{text}</div>
export const Empty = ({ text = 'Belum ada data untuk ditampilkan.', action }) => (
  <div className="empty">{text}{action ? <div className="mt1">{action}</div> : null}</div>
)
export const ErrorBox = ({ error, onRetry }) => (
  <div className="card" style={{ borderColor: '#fecdca', background: 'var(--danger-50)' }} role="alert">
    <b>Terjadi masalah.</b>
    <div className="small mt1">{error && error.message ? error.message : 'Permintaan gagal.'}</div>
    {onRetry && <button className="btn secondary sm mt1" onClick={onRetry}>Coba lagi</button>}
  </div>
)

export const Modal = ({ title, children, onClose, footer, wide }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3 style={{ margin: 0 }}>{title}</h3><button className="btn secondary sm" onClick={onClose}>Tutup</button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export const Confirm = ({ title = 'Konfirmasi tindakan', message, onCancel, onConfirm, busy, confirmLabel = 'Lanjutkan', danger }) => (
  <Modal title={title} onClose={onCancel} footer={<>
    <button className="btn secondary" onClick={onCancel} disabled={busy}>Batal</button>
    <button className={`btn ${danger ? 'danger' : ''}`} onClick={onConfirm} disabled={busy}>{busy ? 'Memproses…' : confirmLabel}</button>
  </>}>
    <div>{message}</div>
  </Modal>
)

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="tabs" role="tablist">
    {tabs.map((t) => (
      <button key={t.value} role="tab" aria-selected={value === t.value} className={value === t.value ? 'active' : ''} onClick={() => onChange(t.value)}>
        {t.label}{typeof t.count === 'number' ? ` (${t.count})` : ''}
      </button>
    ))}
  </div>
)

export const Field = ({ label: lbl, hint, error, children, required }) => (
  <label className="field">
    <span>{lbl}{required ? ' *' : ''}</span>
    {children}
    {hint && <span className="hint">{hint}</span>}
    {error && <span className="err">{error}</span>}
  </label>
)

export const Input = ({ label: lbl, value, onChange, type = 'text', ...rest }) => (
  <Field label={lbl} required={rest.required} hint={rest.hint}>
    <input type={type} value={value == null ? '' : value} onChange={(e) => onChange(type === 'number' ? e.target.value : e.target.value)} {...{ placeholder: rest.placeholder, disabled: rest.disabled, min: rest.min, max: rest.max, step: rest.step }} />
  </Field>
)

export const TextArea = ({ label: lbl, value, onChange, rows = 3, hint, required }) => (
  <Field label={lbl} hint={hint} required={required}>
    <textarea rows={rows} value={value == null ? '' : value} onChange={(e) => onChange(e.target.value)} />
  </Field>
)

export const Select = ({ label: lbl, value, onChange, options = [], placeholder = '— pilih —', required, hint, disabled }) => (
  <Field label={lbl} required={required} hint={hint}>
    <select value={value == null ? '' : value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
    </select>
  </Field>
)

export const Check = ({ label: lbl, checked, onChange, hint }) => (
  <label className="field">
    <span className="row tight" style={{ alignItems: 'center', gap: '.45rem', fontWeight: 600 }}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} /> {lbl}
    </span>
    {hint && <span className="hint">{hint}</span>}
  </label>
)

export const Pagination = ({ page, limit, total, onPage }) => {
  const pages = Math.max(1, Math.ceil((total || 0) / (limit || 25)))
  return (
    <div className="row between small mt1">
      <span className="muted">Menampilkan {total ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, total || 0)} dari {total || 0} data</span>
      <div className="row tight">
        <button className="btn secondary sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Sebelumnya</button>
        <span className="muted">Halaman {page} / {pages}</span>
        <button className="btn secondary sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Berikutnya →</button>
      </div>
    </div>
  )
}

export const Bars = ({ rows, max = 100, suffix = '%', warnBelow, dangerBelow }) => (
  <div className="bars">
    {rows.map((r) => {
      const v = r.value == null ? 0 : Number(r.value)
      const tone = dangerBelow != null && v < dangerBelow ? 'danger' : warnBelow != null && v < warnBelow ? 'warn' : ''
      return (
        <div className="bar-row" key={r.key || r.label}>
          <span title={r.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <span className={`bar ${tone}`}><span style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></span>
          <span className="right muted">{r.value == null ? '-' : `${Number(r.value).toLocaleString('id-ID', { maximumFractionDigits: 1 })}${suffix}`}</span>
        </div>
      )
    })}
  </div>
)

const TEAL = ['#0f6b4f', '#17a06f', '#3fbf8f', '#7bd0b0', '#b8860b', '#b54708', '#175cd3', '#6941c6']
export const SimpleBars = ({ data, xKey, yKey, height = 240, suffix = '' }) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f0" />
      <XAxis dataKey={xKey} angle={-25} textAnchor="end" interval={0} height={70} tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip formatter={(v) => [`${v}${suffix}`, '']} />
      <Bar dataKey={yKey} fill="#0f6b4f" radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
)
export const SimpleLine = ({ data, xKey, yKey, height = 240, suffix = '', domain }) => (
  <ResponsiveContainer width="100%" height={height}>
    <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 24 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f0" />
      <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} domain={domain || ['auto', 'auto']} />
      <Tooltip formatter={(v) => [`${v}${suffix}`, '']} />
      <Line type="monotone" dataKey={yKey} stroke="#0f6b4f" strokeWidth={2} dot={{ r: 3 }} />
    </LineChart>
  </ResponsiveContainer>
)
export const SimpleDonut = ({ data, height = 240, nameKey = 'name', valueKey = 'value' }) => (
  <ResponsiveContainer width="100%" height={height}>
    <PieChart>
      <Pie data={data} dataKey={valueKey} nameKey={nameKey} innerRadius={50} outerRadius={85} paddingAngle={2}>
        {data.map((_, i) => <Cell key={i} fill={TEAL[i % TEAL.length]} />)}
      </Pie>
      <Legend wrapperStyle={{ fontSize: 12 }} />
      <Tooltip />
    </PieChart>
  </ResponsiveContainer>
)
export const MultiBars = ({ data, xKey, keys, height = 260 }) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#eef2f0" />
      <XAxis dataKey={xKey} angle={-25} textAnchor="end" interval={0} height={70} tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} />
      <Tooltip />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      {keys.map((k, i) => <Bar key={k.key} dataKey={k.key} name={k.label} fill={TEAL[i % TEAL.length]} radius={[4, 4, 0, 0]} />)}
    </BarChart>
  </ResponsiveContainer>
)
