// Entry untuk uji UI (dibundel esbuild lalu dijalankan di jsdom).
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '../src/lib/auth'
import App from '../src/App'

export function mount() {
  const root = createRoot(document.getElementById('root'))
  root.render(
    <BrowserRouter>
      <AppProviders>
        <App />
      </AppProviders>
    </BrowserRouter>
  )
  return root
}
