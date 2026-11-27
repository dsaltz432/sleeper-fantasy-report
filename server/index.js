import express from 'express'
import { fileURLToPath } from 'node:url'

// The site is a single static page (public/index.html). It loads live results
// straight from the Sleeper API in the browser and falls back to the snapshot
// baked into the page if Sleeper can't be reached.
const app = express()
const site = fileURLToPath(new URL('../public', import.meta.url))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

app.use(express.static(site, { maxAge: '5m' }))
app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: site }))

const port = Number(process.env.PORT ?? 3001)
app.listen(port, () => {
  console.log(`[server] listening on http://localhost:${port}`)
})
