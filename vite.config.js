import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import fs from 'node:fs'
import path from 'node:path'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'microlab-editor-api',
      configureServer(server) {
        const root = server.config.root
        const publicSlidesDir = path.join(root, 'public', 'slides')
        const overridesPath = path.join(root, 'src', 'slides', 'overrides.json')

        function listSlides() {
          try {
            const files = fs
              .readdirSync(publicSlidesDir, { withFileTypes: true })
              .filter((d) => d.isFile())
              .map((d) => d.name)
              .filter((name) => /\.(png|jpe?g|webp|gif|svg)$/i.test(name))
              .sort((a, b) => a.localeCompare(b))
            return files.map((name) => `/slides/${name}`)
          } catch {
            return []
          }
        }

        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/__slides_manifest')) {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ images: listSlides() }))
            return
          }

          if (req.url?.startsWith('/__editor_save') && req.method === 'POST') {
            let body = ''
            req.on('data', (chunk) => {
              body += String(chunk)
            })
            req.on('end', () => {
              try {
                const payload = JSON.parse(body || '{}')
                const { slideId, slide } = payload
                if (!slideId || !slide) {
                  res.statusCode = 400
                  res.end(JSON.stringify({ ok: false, error: 'missing slideId/slide' }))
                  return
                }

                let current = {}
                try {
                  current = JSON.parse(fs.readFileSync(overridesPath, 'utf-8') || '{}')
                } catch {
                  current = {}
                }
                current[slideId] = slide
                fs.writeFileSync(overridesPath, JSON.stringify(current, null, 2) + '\n', 'utf-8')

                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: true }))
              } catch (e) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }))
              }
            })
            return
          }

          next()
        })

        server.watcher.add(publicSlidesDir)
        server.watcher.on('all', (eventName, filePath) => {
          if (filePath && filePath.includes(`${path.sep}public${path.sep}slides${path.sep}`)) {
            server.ws.send({ type: 'custom', event: 'microlab:slides-changed', data: {} })
          }
        })
      }
    }
  ],
  server: {
    port: 5173,
    strictPort: true
  }
})
