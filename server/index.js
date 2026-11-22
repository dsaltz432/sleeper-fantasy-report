import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createReportCache } from './report.js'

const app = express()
const getReport = createReportCache()
const dist = fileURLToPath(new URL('../dist', import.meta.url))

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.get('/api/v1/report', async (_req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=60')
    res.json(await getReport())
  } catch (e) {
    console.error('[report] failed:', e)
    res.status(502).json({ error: 'Error fetching data from Sleeper.' })
  }
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

// The built React app (npm run build). In dev, Vite serves it and proxies /api here.
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }))
  app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: dist }))
}

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}${existsSync(dist) ? '' : ' (API only; run npm run build for the app)'}`)
  // Warm the cache so the first visitor doesn't wait on Sleeper.
  getReport().catch((e) => console.error('[report] warm-up failed:', e.message))
})
