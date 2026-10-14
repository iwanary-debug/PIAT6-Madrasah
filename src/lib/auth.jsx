import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'

const AuthCtx = createContext(null)
const ToastCtx = createContext(null)

export function useAuth() { return useContext(AuthCtx) }
export function useToast() { return useContext(ToastCtx) }

export function AppProviders({ children }) {
  const [state, setState] = useState({ loading: true, user: null, scope: null, extra: {}, options: null })
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  const loadOptions = useCallback(async () => {
    try { return await api('/options') } catch { return null }
  }, [])

  const load = useCallback(async () => {
    try {
      const me = await api('/auth/me')
      const options = await loadOptions()
      setState({ loading: false, user: me.user, scope: me.scope, extra: me, options })
    } catch {
      setState({ loading: false, user: null, scope: null, extra: {}, options: null })
    }
  }, [loadOptions])

  useEffect(() => { load() }, [load])

  const login = useCallback(async (email, password) => {
    const res = await api('/auth/login', { method: 'POST', body: { email, password } })
    const options = await loadOptions()
    setState({ loading: false, user: res.user, scope: res.scope, extra: {}, options })
    return res
  }, [loadOptions])

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }) } catch { /* sesi mungkin sudah berakhir */ }
    setState({ loading: false, user: null, scope: null, extra: {}, options: null })
  }, [])

  const refreshOptions = useCallback(async () => {
    const options = await loadOptions()
    setState((s) => ({ ...s, options }))
  }, [loadOptions])

  const value = useMemo(() => ({ ...state, login, logout, reload: load, refreshOptions }), [state, login, logout, load, refreshOptions])
  const toastValue = useMemo(() => ({ push, toasts }), [push, toasts])
  return (
    <AuthCtx.Provider value={value}>
      <ToastCtx.Provider value={toastValue}>{children}</ToastCtx.Provider>
    </AuthCtx.Provider>
  )
}

/** Pengambilan data asinkron dengan status loading/error dan fungsi muat ulang. */
export function useFetch(path, depKey = '', { skip = false } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(!skip)
  const [error, setError] = useState(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  const load = useCallback(async () => {
    if (skip || !path) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const res = await api(path)
      if (mounted.current) setData(res)
    } catch (e) {
      if (mounted.current) setError(e)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [path, depKey, skip])
  useEffect(() => { load() }, [load])
  return { data, loading, error, reload: load, setData }
}

export function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), delay); return () => clearTimeout(t) }, [value, delay])
  return v
}
