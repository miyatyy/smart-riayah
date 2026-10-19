import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function stateSyncPlugin() {
  const dataDir = path.resolve(__dirname, 'data')
  const dbFile = path.resolve(dataDir, 'smart_riayah_db.json')

  return {
    name: 'smart-riayah-state-sync',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || ''
        
        if (url.startsWith('/api/sync/version') && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          if (fs.existsSync(dbFile)) {
            try {
              const fileData = JSON.parse(fs.readFileSync(dbFile, 'utf-8'))
              res.end(JSON.stringify({ version: fileData.version || 0, timestamp: fileData.timestamp || 0 }))
              return
            } catch {
              res.end(JSON.stringify({ version: 0 }))
              return
            }
          }
          res.end(JSON.stringify({ version: 0 }))
          return
        }

        if (url.startsWith('/api/sync') && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          if (fs.existsSync(dbFile)) {
            try {
              const fileContent = fs.readFileSync(dbFile, 'utf-8')
              res.end(fileContent)
              return
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: err.message }))
              return
            }
          }
          res.end(JSON.stringify({ version: 0, data: null }))
          return
        }

        if (url.startsWith('/api/sync') && req.method === 'POST') {
          let body = ''
          req.on('data', chunk => {
            body += chunk
          })
          req.on('end', () => {
            try {
              if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true })
              }
              const parsed = JSON.parse(body)
              const payload = {
                version: parsed.version || Date.now(),
                timestamp: new Date().toISOString(),
                data: parsed.data || parsed
              }
              fs.writeFileSync(dbFile, JSON.stringify(payload, null, 2), 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(JSON.stringify({ success: true, version: payload.version }))
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(JSON.stringify({ error: err.message }))
            }
          })
          return
        }

        next()
      })
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), stateSyncPlugin()],
  server: {
    port: 3000,
    open: false
  }
})
