import { useEffect, useState } from 'react'

// Same origin in production (Express serves this app); Vite proxies /api in dev.
let pending = null

export function fetchReport() {
  pending ??= fetch('/api/v1/report')
    .then((res) => {
      if (!res.ok) throw new Error(`Report request failed (${res.status})`)
      return res.json()
    })
    .catch((e) => {
      pending = null
      throw e
    })
  return pending
}

/** One request per page load, shared by every page. */
export function useReport() {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  useEffect(() => {
    let live = true
    fetchReport()
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e) => live && setState({ data: null, error: e.message, loading: false }))
    return () => {
      live = false
    }
  }, [])
  return state
}
