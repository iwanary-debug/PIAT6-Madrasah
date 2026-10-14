import React, { useMemo, useState } from 'react'
import { useFetch, useDebounced } from '../lib/auth'
import { Loading, Empty, ErrorBox, Pagination } from './ui'

export function DataTable({ columns, rows, loading, error, onRetry, emptyText, onRowClick, sort, dir, onSort, footer }) {
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={onRetry} />
  if (!rows || !rows.length) return <Empty text={emptyText || 'Belum ada data.'} />
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || 'left', width: c.width }}
                className={c.sortable ? 'sortable' : ''}
                onClick={c.sortable && onSort ? () => onSort(c.key) : undefined}>
                {c.label}{c.sortable && onSort && sort === c.key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id != null ? r.id : i} onClick={onRowClick ? () => onRowClick(r) : undefined} style={onRowClick ? { cursor: 'pointer' } : undefined}>
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align || 'left' }}>{c.render ? c.render(r) : (r[c.key] == null || r[c.key] === '' ? '-' : r[c.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  )
}

/** Daftar data dari endpoint /api/rt/:table dengan pencarian, filter, pengurutan, dan paginasi. */
export function ResourceList({
  table, columns, filters = [], limit = 25, toolbar, onRowClick, emptyText, depKey = '', defaultSort = 'id', defaultDir = 'asc', searchPlaceholder,
}) {
  const [q, setQ] = useState('')
  const debounced = useDebounced(q)
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState(defaultSort)
  const [dir, setDir] = useState(defaultDir)
  const [filterValues, setFilterValues] = useState({})

  const query = useMemo(() => {
    const p = new URLSearchParams()
    if (debounced) p.set('q', debounced)
    p.set('page', String(page))
    p.set('limit', String(limit))
    if (sort) { p.set('sort', sort); p.set('dir', dir) }
    for (const [k, v] of Object.entries(filterValues)) if (v) p.set(`filter_${k}`, v)
    return p.toString()
  }, [debounced, page, limit, sort, dir, filterValues])

  const { data, loading, error, reload } = useFetch(`/rt/${table}?${query}`, `${query}|${depKey}`)

  const changeSort = (key) => {
    if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc')
    else { setSort(key); setDir('asc') }
  }

  return (
    <div>
      <div className="toolbar mb2">
        <input placeholder={searchPlaceholder || 'Cari…'} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} style={{ maxWidth: 260 }} aria-label="Cari data" />
        {filters.map((f) => (
          <select key={f.key} value={filterValues[f.key] || ''} onChange={(e) => { setFilterValues((s) => ({ ...s, [f.key]: e.target.value })); setPage(1) }} style={{ maxWidth: 230 }} aria-label={f.label}>
            <option value="">{f.label}: semua</option>
            {f.options.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        {toolbar ? toolbar({ reload, rows: data ? data.data : [] }) : null}
        <button className="btn secondary sm" onClick={() => reload()} title="Muat ulang data">↻ Muat ulang</button>
      </div>
      <DataTable columns={columns} rows={data ? data.data : null} loading={loading} error={error} onRetry={reload}
        emptyText={emptyText} onRowClick={onRowClick} sort={sort} dir={dir} onSort={changeSort}
        footer={data && data.total > limit ? <Pagination page={page} limit={limit} total={data.total} onPage={setPage} /> : null} />
    </div>
  )
}
