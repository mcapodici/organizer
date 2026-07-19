#!/usr/bin/env node
// Pipeline chat server — serves pending questions and approval requests
// Usage: node .claude/chat/server.js
// Then open http://localhost:7331

const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 7331
const QUESTIONS_DIR = path.join(__dirname, '../../.kanban/questions')
const HTML_FILE = path.join(__dirname, 'index.html')

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { fm: {}, body: content }
  const fm = {}
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const val = line.slice(colon + 1).trim()
    if (key) fm[key] = val
  }
  return { fm, body: match[2].trim() }
}

function writeFrontmatter(content, updates) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return content
  const lines = match[1].split('\n').map(line => {
    const colon = line.indexOf(':')
    if (colon === -1) return line
    const key = line.slice(0, colon).trim()
    if (key in updates) return `${key}: ${updates[key]}`
    return line
  })
  // Add any new keys not already present
  for (const [key, val] of Object.entries(updates)) {
    if (!lines.some(l => l.startsWith(key + ':'))) {
      lines.push(`${key}: ${val}`)
    }
  }
  return `---\n${lines.join('\n')}\n---\n${match[2]}`
}

function listQuestions() {
  if (!fs.existsSync(QUESTIONS_DIR)) return []
  return fs.readdirSync(QUESTIONS_DIR)
    .filter(f => f.endsWith('.md') && f !== '.gitkeep')
    .map(f => {
      const filepath = path.join(QUESTIONS_DIR, f)
      const content = fs.readFileSync(filepath, 'utf8')
      const { fm, body } = parseFrontmatter(content)
      return { file: f, filepath, fm, body }
    })
    .filter(q => q.fm.status === 'pending')
    .sort((a, b) => a.fm.asked_at > b.fm.asked_at ? 1 : -1)
}

function handleAnswer(body, res) {
  const { file, answer, action } = JSON.parse(body)
  const filepath = path.join(QUESTIONS_DIR, file)
  if (!fs.existsSync(filepath)) {
    res.writeHead(404)
    return res.end(JSON.stringify({ error: 'file not found' }))
  }
  const content = fs.readFileSync(filepath, 'utf8')
  const now = new Date().toISOString()
  const status = action === 'reject' ? 'rejected' : action === 'approve' ? 'approved' : 'answered'
  const updated = writeFrontmatter(content, {
    status,
    answered_at: now,
    answer: answer.replace(/\n/g, ' '),
  })
  fs.writeFileSync(filepath, updated)
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ ok: true, status }))
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    return res.end()
  }

  if (req.method === 'GET' && req.url === '/') {
    const html = fs.readFileSync(HTML_FILE, 'utf8')
    res.writeHead(200, { 'Content-Type': 'text/html' })
    return res.end(html)
  }

  if (req.method === 'GET' && req.url === '/questions') {
    const questions = listQuestions()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(questions.map(q => ({
      file: q.file,
      ticket_id: q.fm.ticket_id,
      ticket_title: q.fm.ticket_title,
      type: q.fm.type || 'question',
      preview_url: q.fm.preview_url || '',
      asked_at: q.fm.asked_at,
      body: q.body,
    }))))
  }

  if (req.method === 'POST' && req.url === '/answer') {
    let body = ''
    req.on('data', d => body += d)
    req.on('end', () => handleAnswer(body, res))
    return
  }

  res.writeHead(404)
  res.end('not found')
})

server.listen(PORT, () => {
  console.log(`Pipeline chat: http://localhost:${PORT}`)
  console.log(`Watching: ${QUESTIONS_DIR}`)
})
