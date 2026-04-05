// ── Atelier.sh Extension — Content Script ───────────────────────────────
// Injeta overlay de anotações em qualquer página

const SUPABASE_URL = 'https://siatawlkxafrdyjglaec.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYXRhd2xreGFmcmR5amdsYWVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNjIxNTgsImV4cCI6MjA5MDgzODE1OH0.CYMSWq6aDivNYnVygHQuYLagCX7Njje7PDz69lhpxxw'

let state = {
  active:      false,
  tool:        'select',   // select | draw | highlight | comment | check | cross | eraser
  penColor:    '#C0211C',
  penWidth:    2.5,
  paths:       [],
  annotations: [],
  currentPath: [],
  drawing:     false,
  groupId:     null,
  groupName:   '',
  sessionToken: null,
}

// ── Criar elementos DOM ──────────────────────────────────────────────────

function buildUI() {
  if (document.getElementById('atelier-toolbar')) return

  // Overlay
  const overlay = document.createElement('div')
  overlay.id = 'atelier-overlay'
  document.body.appendChild(overlay)

  // SVG de desenho
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.id = 'atelier-svg'
  overlay.appendChild(svg)

  // Toolbar
  const tb = document.createElement('div')
  tb.id = 'atelier-toolbar'
  tb.innerHTML = `
    <span style="font-size:9px;letter-spacing:0.3em;color:#4e3e3e;text-transform:uppercase;margin-right:4px">atelier</span>
    <div class="atelier-sep"></div>
    <button class="atelier-btn" data-tool="select"    title="selecionar (v)">↖</button>
    <button class="atelier-btn" data-tool="draw"      title="desenhar (d)">✏</button>
    <button class="atelier-btn" data-tool="highlight" title="marca-texto (m)">▬</button>
    <button class="atelier-btn" data-tool="comment"   title="comentário (c)">💬</button>
    <button class="atelier-btn" data-tool="check"     title="ok (k)">✓</button>
    <button class="atelier-btn" data-tool="cross"     title="corrigir (x)">✗</button>
    <button class="atelier-btn" data-tool="eraser"    title="borracha (e)">◻</button>
    <div class="atelier-sep"></div>
    <div class="atelier-color-btn" id="atelier-color-toggle" title="cor da caneta" style="background:#C0211C"></div>
    <div class="atelier-sep"></div>
    <button class="atelier-btn capture" id="atelier-capture-btn" title="capturar screenshot">⬡</button>
    <button class="atelier-btn" id="atelier-clear-btn" title="limpar tudo" style="color:#4e3e3e">↺</button>
    <button class="atelier-btn" id="atelier-close-btn" title="fechar" style="color:#4e3e3e">✕</button>
  `
  document.body.appendChild(tb)

  // Color picker
  const cp = document.createElement('div')
  cp.id = 'atelier-colorpicker'
  cp.innerHTML = `
    <label>cor</label>
    <div class="atelier-colors">
      ${['#C0211C','#F0EDE8','#5aab6e','#4a90e2','#c8922a','#a259ff','#EC4899','#000000']
        .map(c => `<div class="atelier-swatch${c==='#C0211C'?' selected':''}" style="background:${c}" data-color="${c}"></div>`).join('')}
    </div>
    <label>custom</label>
    <input type="color" id="atelier-custom-color" value="#C0211C" style="width:36px;height:24px;border:none;border-radius:4px;cursor:pointer;background:none;padding:0">
    <label>espessura</label>
    <div class="atelier-widths">
      ${[1,2.5,5,10].map(w => `<button class="atelier-width-btn${w===2.5?' selected':''}" data-width="${w}" style="display:flex;align-items:center;justify-content:center;">
        <div style="width:${Math.min(w*3,20)}px;height:${w}px;background:#C0211C;border-radius:99px"></div>
      </button>`).join('')}
    </div>
  `
  document.body.appendChild(cp)

  // Status bar
  const status = document.createElement('div')
  status.id = 'atelier-status'
  status.textContent = 'atelier.sh · pronto'
  document.body.appendChild(status)

  bindEvents()
  updateToolbar()
}

// ── Eventos ──────────────────────────────────────────────────────────────

function bindEvents() {
  // Botões de ferramenta
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      setTool(btn.dataset.tool)
    })
  })

  // Color toggle
  document.getElementById('atelier-color-toggle').addEventListener('click', e => {
    e.stopPropagation()
    const cp = document.getElementById('atelier-colorpicker')
    const rect = e.target.getBoundingClientRect()
    cp.style.top  = (rect.bottom + 8) + 'px'
    cp.style.left = rect.left + 'px'
    cp.classList.toggle('open')
  })

  // Swatches
  document.querySelectorAll('.atelier-swatch').forEach(sw => {
    sw.addEventListener('click', e => {
      e.stopPropagation()
      setColor(sw.dataset.color)
      document.getElementById('atelier-colorpicker').classList.remove('open')
    })
  })

  // Custom color
  document.getElementById('atelier-custom-color').addEventListener('input', e => {
    setColor(e.target.value)
  })

  // Espessura
  document.querySelectorAll('.atelier-width-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      state.penWidth = parseFloat(btn.dataset.width)
      document.querySelectorAll('.atelier-width-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
    })
  })

  // Fechar color picker ao clicar fora
  document.addEventListener('click', () => {
    document.getElementById('atelier-colorpicker')?.classList.remove('open')
  })

  // Capturar
  document.getElementById('atelier-capture-btn').addEventListener('click', e => {
    e.stopPropagation()
    captureAndSave()
  })

  // Limpar
  document.getElementById('atelier-clear-btn').addEventListener('click', e => {
    e.stopPropagation()
    if (confirm('Limpar todas as anotações?')) {
      state.paths = []
      state.annotations = []
      renderSVG()
      document.querySelectorAll('.atelier-comment').forEach(el => el.remove())
      updateStatus('tudo limpo')
    }
  })

  // Fechar
  document.getElementById('atelier-close-btn').addEventListener('click', e => {
    e.stopPropagation()
    deactivate()
  })

  // Overlay — cliques para comment, check, cross
  const overlay = document.getElementById('atelier-overlay')
  overlay.addEventListener('click', onOverlayClick)

  // SVG — desenho livre (draw, highlight) e eraser de traços
  const svg = document.getElementById('atelier-svg')
  svg.addEventListener('mousedown', onMouseDown)
  svg.addEventListener('mousemove', onMouseMove)
  svg.addEventListener('mouseup',   onMouseUp)

  // Atalhos de teclado
  document.addEventListener('keydown', onKey)
}

function onKey(e) {
  if (!state.active) return
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
  const map = { v:'select', d:'draw', m:'highlight', c:'comment', k:'check', x:'cross', e:'eraser' }
  if (map[e.key]) setTool(map[e.key])
  if (e.key === 'Escape') deactivate()
}

function getPos(e) {
  return { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY }
}

function onOverlayClick(e) {
  if (!state.active) return
  // Ignora se o clique veio de dentro da toolbar, colorpicker ou comentário
  if (e.target.closest('#atelier-toolbar, #atelier-colorpicker, .atelier-comment')) return
  if (state.tool === 'draw' || state.tool === 'highlight' || state.tool === 'select' || state.tool === 'eraser') return

  const pos = { x: e.clientX + window.scrollX, y: e.clientY + window.scrollY }

  if (state.tool === 'comment') {
    addComment(pos)
    setTool('select') // volta pro select depois de soltar o comentário
  } else if (state.tool === 'check') {
    addAnnotation('check', pos)
  } else if (state.tool === 'cross') {
    addAnnotation('cross', pos)
  }
}

function onMouseDown(e) {
  if (!state.active) return
  if (e.button !== 0) return

  const pos = getPos(e)

  if (state.tool === 'draw' || state.tool === 'highlight') {
    state.drawing = true
    state.currentPath = [pos]
  } else if (state.tool === 'eraser') {
    eraseAt(pos)
  }
}

function onMouseMove(e) {
  if (!state.drawing) return
  state.currentPath.push(getPos(e))
  renderCurrentPath()
}

function onMouseUp() {
  if (state.drawing && state.currentPath.length > 1) {
    const color = state.tool === 'highlight'
      ? state.penColor + '66'
      : state.penColor
    const width = state.tool === 'highlight'
      ? state.penWidth * 5
      : state.penWidth
    state.paths.push({
      id:     Date.now(),
      points: state.currentPath,
      color,
      width,
      mode:   state.tool,
    })
    state.currentPath = []
    renderSVG()
    updateStatus(state.paths.length + ' traços · ' + state.annotations.length + ' anotações')
  }
  state.drawing = false
}

// ── Ferramentas ──────────────────────────────────────────────────────────

function setTool(tool) {
  state.tool = tool
  updateToolbar()
  const overlay = document.getElementById('atelier-overlay')
  // select = site fica interativo (overlay some dos eventos)
  // qualquer outro = overlay captura eventos
  overlay.className = 'active ' + tool
  overlay.style.pointerEvents = tool === 'select' ? 'none' : 'all'
  updateStatus('ferramenta: ' + tool)
}

function setColor(color) {
  state.penColor = color
  document.getElementById('atelier-color-toggle').style.background = color
  document.querySelectorAll('.atelier-swatch').forEach(sw => {
    sw.classList.toggle('selected', sw.dataset.color === color)
  })
}

function updateToolbar() {
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === state.tool)
  })
}

function updateStatus(msg) {
  const el = document.getElementById('atelier-status')
  if (el) el.textContent = msg
}

function eraseAt(pos) {
  const RADIUS = 30
  state.paths = state.paths.filter(path => {
    const hit = path.points.some(pt =>
      Math.sqrt(Math.pow(pt.x - pos.x, 2) + Math.pow(pt.y - pos.y, 2)) < RADIUS
    )
    return !hit
  })
  renderSVG()
}

function addAnnotation(type, pos) {
  const ann = { id: Date.now(), type, x: pos.x, y: pos.y }
  state.annotations.push(ann)
  renderSVG()
  updateStatus(type + ' adicionado · ' + state.annotations.length + ' total')
}

function addComment(pos) {
  const ann = { id: Date.now(), type: 'comment', x: pos.x, y: pos.y, text: '' }
  state.annotations.push(ann)
  renderComment(ann)
}

function renderComment(ann) {
  const el = document.createElement('div')
  el.className = 'atelier-comment'
  el.dataset.annId = ann.id
  el.style.left = ann.x + 'px'
  el.style.top  = ann.y + 'px'
  el.innerHTML = `
    <button class="atelier-comment-del" title="remover">×</button>
    <textarea placeholder="comentário..." rows="3">${ann.text || ''}</textarea>
  `
  el.querySelector('textarea').addEventListener('input', e => {
    ann.text = e.target.value
  })
  el.querySelector('.atelier-comment-del').addEventListener('click', () => {
    state.annotations = state.annotations.filter(a => a.id !== ann.id)
    el.remove()
    updateStatus(state.annotations.length + ' anotações')
  })

  // Drag
  let dragging = false, dx = 0, dy = 0
  el.addEventListener('mousedown', e => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return
    dragging = true
    dx = e.clientX + window.scrollX - parseInt(el.style.left)
    dy = e.clientY + window.scrollY - parseInt(el.style.top)
    e.stopPropagation()
  })
  document.addEventListener('mousemove', e => {
    if (!dragging) return
    el.style.left = (e.clientX + window.scrollX - dx) + 'px'
    el.style.top  = (e.clientY + window.scrollY - dy) + 'px'
    ann.x = parseInt(el.style.left)
    ann.y = parseInt(el.style.top)
  })
  document.addEventListener('mouseup', () => { dragging = false })

  document.body.appendChild(el)
}

// ── Render SVG ───────────────────────────────────────────────────────────

function pathD(points) {
  if (!points || points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`
  }
  return d
}

function renderSVG() {
  const svg = document.getElementById('atelier-svg')
  if (!svg) return

  // Limpar paths existentes (manter currentPath se houver)
  svg.querySelectorAll('[data-type]').forEach(el => el.remove())

  // Desenhar paths salvos
  state.paths.forEach(p => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', pathD(p.points))
    path.setAttribute('fill', 'none')
    path.setAttribute('stroke', p.color || '#C0211C')
    path.setAttribute('stroke-width', p.width || 2.5)
    path.setAttribute('stroke-linecap', p.mode === 'highlight' ? 'square' : 'round')
    path.setAttribute('stroke-linejoin', p.mode === 'highlight' ? 'miter' : 'round')
    path.setAttribute('opacity', p.mode === 'highlight' ? '0.5' : '0.85')
    path.setAttribute('data-type', 'path')
    svg.appendChild(path)
  })

  // Checks e crosses
  state.annotations.forEach(ann => {
    if (ann.type !== 'check' && ann.type !== 'cross') return
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.setAttribute('data-type', 'annotation')
    g.setAttribute('transform', `translate(${ann.x}, ${ann.y})`)

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('r', 14)
    circle.setAttribute('fill', ann.type === 'check' ? 'rgba(90,171,110,0.15)' : 'rgba(192,33,28,0.15)')
    circle.setAttribute('stroke', ann.type === 'check' ? '#5aab6e' : '#C0211C')
    circle.setAttribute('stroke-width', 1.5)

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.setAttribute('text-anchor', 'middle')
    text.setAttribute('dominant-baseline', 'central')
    text.setAttribute('font-size', '14')
    text.setAttribute('fill', ann.type === 'check' ? '#5aab6e' : '#C0211C')
    text.textContent = ann.type === 'check' ? '✓' : '✗'

    g.appendChild(circle)
    g.appendChild(text)
    svg.appendChild(g)
  })
}

function renderCurrentPath() {
  const svg = document.getElementById('atelier-svg')
  if (!svg || state.currentPath.length < 2) return

  let current = svg.querySelector('[data-type="current"]')
  if (!current) {
    current = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    current.setAttribute('data-type', 'current')
    svg.appendChild(current)
  }

  const color = state.tool === 'highlight' ? state.penColor + '66' : state.penColor
  const width = state.tool === 'highlight' ? state.penWidth * 5 : state.penWidth

  current.setAttribute('d', pathD(state.currentPath))
  current.setAttribute('fill', 'none')
  current.setAttribute('stroke', color)
  current.setAttribute('stroke-width', width)
  current.setAttribute('stroke-linecap', state.tool === 'highlight' ? 'square' : 'round')
  current.setAttribute('stroke-linejoin', state.tool === 'highlight' ? 'miter' : 'round')
  current.setAttribute('opacity', state.tool === 'highlight' ? '0.5' : '0.85')
}

// ── Captura e Supabase ───────────────────────────────────────────────────

async function captureAndSave() {
  updateStatus('capturando screenshot...')

  // Pedir screenshot ao background script
  const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' })
  if (!response || !response.dataUrl) {
    updateStatus('erro ao capturar')
    return
  }

  const screenshotDataUrl = response.dataUrl

  // Gerar SVG base64 das anotações
  const svg   = document.getElementById('atelier-svg')
  const clone = svg.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', window.innerWidth)
  clone.setAttribute('height', window.innerHeight)
  const svgStr = new XMLSerializer().serializeToString(clone)
  const svgB64 = btoa(unescape(encodeURIComponent(svgStr)))

  // Gerar .md da devolutiva
  const md = buildMd(screenshotDataUrl, svgB64)

  // Salvar no Supabase se tiver grupo vinculado
  if (state.groupId) {
    await saveToSupabase(screenshotDataUrl, svgB64, md)
  }

  // Download do .md
  const blob = new Blob([md], { type: 'text/markdown' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = 'devolutiva-' + (state.groupName || 'review').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + new Date().toISOString().slice(0,10) + '.md'
  a.click()

  updateStatus('✓ capturado e salvo!')
}

function buildMd(screenshotDataUrl, svgB64) {
  const date     = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const comments = state.annotations.filter(a => a.type === 'comment' && a.text)
  const checks   = state.annotations.filter(a => a.type === 'check')
  const crosses  = state.annotations.filter(a => a.type === 'cross')
  const url      = window.location.href

  const lines = []
  lines.push('# Devolutiva — ' + (state.groupName || 'Review'))
  lines.push('')
  lines.push('| Campo | Valor |')
  lines.push('|-------|-------|')
  lines.push('| **Grupo** | ' + (state.groupName || '—') + ' |')
  lines.push('| **URL revisada** | ' + url + ' |')
  lines.push('| **Data** | ' + date + ' |')
  lines.push('| **Revisado por** | Profa. Samara Sabino |')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('## Resumo')
  lines.push('')
  lines.push('| Anotações | Traços | ✓ Ok | ✗ Corrigir |')
  lines.push('|-----------|--------|------|------------|')
  lines.push('| ' + state.annotations.length + ' | ' + state.paths.length + ' | ' + checks.length + ' | ' + crosses.length + ' |')
  lines.push('')
  lines.push('---')
  lines.push('')

  // Screenshot real do site com anotações por cima
  if (screenshotDataUrl) {
    lines.push('## Screenshot com anotações')
    lines.push('')
    lines.push('![screenshot com anotações](' + screenshotDataUrl + ')')
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  if (checks.length > 0) {
    lines.push('## ✓ Pontos positivos')
    lines.push('')
    checks.forEach(function(_, i) { lines.push('- ✓ ponto ' + (i + 1)) })
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  if (crosses.length > 0) {
    lines.push('## ✗ Pontos a corrigir')
    lines.push('')
    crosses.forEach(function(_, i) { lines.push('- [ ] correção ' + (i + 1)) })
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  if (comments.length > 0) {
    lines.push('## Comentários da professora')
    lines.push('')
    comments.forEach(function(a, i) {
      lines.push('### ' + (i + 1) + '. ' + (a.text || '').split('\n')[0])
      lines.push('')
    })
    lines.push('---')
    lines.push('')
  }

  lines.push('## Próximos passos')
  lines.push('')
  lines.push('- [ ] ')
  lines.push('- [ ] ')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('> *Gerado pelo atelier.sh extension · ' + new Date().toLocaleString('pt-BR') + '*')

  return lines.join('\n')
}

async function saveToSupabase(screenshotDataUrl, svgB64, md) {
  try {
    const token = await getSupabaseToken()
    if (!token) return

    await fetch(SUPABASE_URL + '/rest/v1/reviews', {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + token,
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        group_id:    state.groupId,
        url:         window.location.href,
        annotations: state.annotations,
        paths:       state.paths,
        screenshot:  screenshotDataUrl,
        md:          md,
        updated_at:  new Date().toISOString(),
      })
    })
  } catch(e) {
    console.error('[atelier] saveToSupabase:', e)
  }
}

async function getSupabaseToken() {
  return new Promise(resolve => {
    chrome.storage.local.get(['supabase_token'], r => resolve(r.supabase_token || null))
  })
}

// ── Tamanho do overlay — cobre a página inteira ──────────────────────────
// Chamado no activate e sempre que a página muda de tamanho/scroll

function updateOverlaySize() {
  const overlay = document.getElementById('atelier-overlay')
  const svg     = document.getElementById('atelier-svg')
  if (!overlay || !svg) return
  const w = Math.max(document.documentElement.scrollWidth,  document.body.scrollWidth,  window.innerWidth)
  const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight)
  overlay.style.width  = w + 'px'
  overlay.style.height = h + 'px'
  svg.setAttribute('width',  w)
  svg.setAttribute('height', h)
}

// ── Ativar / Desativar ───────────────────────────────────────────────────

function activate(groupId, groupName) {
  state.active    = true
  state.groupId   = groupId   || null
  state.groupName = groupName || ''
  buildUI()
  updateOverlaySize()
  window.addEventListener('scroll', updateOverlaySize, { passive: true })
  window.addEventListener('resize', updateOverlaySize, { passive: true })
  document.getElementById('atelier-overlay').classList.add('active')
  setTool('draw')
  updateStatus('atelier.sh · ' + (groupName || window.location.hostname) + ' · desenhando')
  chrome.storage.local.set({ last_url: window.location.href })
}

function deactivate() {
  state.active = false
  window.removeEventListener('scroll', updateOverlaySize)
  window.removeEventListener('resize', updateOverlaySize)
  document.getElementById('atelier-overlay')?.classList.remove('active')
  document.getElementById('atelier-toolbar')?.remove()
  document.getElementById('atelier-colorpicker')?.remove()
  document.getElementById('atelier-status')?.remove()
  document.getElementById('atelier-overlay')?.remove()
  document.querySelectorAll('.atelier-comment').forEach(el => el.remove())
}

// ── Mensagens do popup/background ───────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ACTIVATE') {
    activate(msg.groupId, msg.groupName)
    sendResponse({ ok: true })
  }
  if (msg.type === 'DEACTIVATE') {
    deactivate()
    sendResponse({ ok: true })
  }
  if (msg.type === 'IS_ACTIVE') {
    sendResponse({ active: state.active })
  }
  return true
})


// ── Auto-ativação via hash do Atelier.sh ────────────────────────────────
// Quando o Atelier.sh abre o site com #atelier_group=xxx&atelier_name=yyy,
// a extensão detecta e ativa o overlay automaticamente.

;(function autoActivateFromHash() {
  const hash = window.location.hash.replace('#', '')
  if (!hash.includes('atelier_group')) return

  const params = new URLSearchParams(hash)
  const groupId   = params.get('atelier_group')
  const groupName = params.get('atelier_name')

  if (!groupId) return

  // Limpa o hash da URL (não fica visível pra ninguém)
  history.replaceState(null, '', window.location.pathname + window.location.search)

  // Aguarda o DOM estar pronto antes de ativar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      activate(groupId, decodeURIComponent(groupName || ''))
    })
  } else {
    activate(groupId, decodeURIComponent(groupName || ''))
  }
})()
