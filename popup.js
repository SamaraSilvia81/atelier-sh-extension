// ── Atelier.sh Extension — Popup Script ─────────────────────────────────

const SUPABASE_URL = 'https://siatawlkxafrdyjglaec.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYXRhd2xreGFmcmR5amdsYWVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNjIxNTgsImV4cCI6MjA5MDgzODE1OH0.CYMSWq6aDivNYnVygHQuYLagCX7Njje7PDz69lhpxxw'

let selectedGroup = null
let groups = []

// ── Init ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      document.getElementById('tab-review').style.display = tab.dataset.tab === 'review' ? 'block' : 'none'
      document.getElementById('tab-config').style.display = tab.dataset.tab === 'config' ? 'block' : 'none'
    })
  })

  // URL atual
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.url) {
    document.getElementById('url-input').value = tab.url
  }

  document.getElementById('btn-use-current').addEventListener('click', async () => {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (t?.url) document.getElementById('url-input').value = t.url
  })

  // Carregar grupos do Supabase
  await loadGroups()

  // Busca de grupos
  document.getElementById('group-search').addEventListener('input', e => {
    filterGroups(e.target.value)
  })

  // Ativar overlay
  document.getElementById('btn-activate').addEventListener('click', async () => {
    const url = document.getElementById('url-input').value.trim()
    if (!url) { setStatus('informe a URL', 'error'); return }

    setStatus('abrindo...', '')

    // Abrir ou focar na aba
    const [existing] = await chrome.tabs.query({ url: url + '*' })
    let targetTab

    if (existing) {
      targetTab = existing
      await chrome.tabs.update(existing.id, { active: true })
    } else {
      targetTab = await chrome.tabs.create({ url })
      // Aguardar carregar
      await new Promise(resolve => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === targetTab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener)
            resolve()
          }
        })
      })
    }

    // Injetar content script se necessário e ativar
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: targetTab.id },
        files:  ['content.css']
      })
      await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        files:  ['content.js']
      })
    } catch(e) {
      // já injetado, ignorar
    }

    await chrome.tabs.sendMessage(targetTab.id, {
      type:      'ACTIVATE',
      groupId:   selectedGroup?.id || null,
      groupName: selectedGroup?.name || '',
    })

    setStatus('✓ overlay ativo em ' + (selectedGroup?.name || new URL(url).hostname), 'ok')
    setTimeout(() => window.close(), 1200)
  })

  // Desativar
  document.getElementById('btn-deactivate').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab) {
      await chrome.tabs.sendMessage(tab.id, { type: 'DEACTIVATE' }).catch(() => {})
    }
    setStatus('overlay desativado', '')
  })

  // Salvar config
  document.getElementById('btn-save-config').addEventListener('click', () => {
    const token = document.getElementById('cfg-token').value.trim()
    chrome.storage.local.set({ supabase_token: token }, () => {
      setStatus('✓ token salvo', 'ok')
    })
  })

  // Carregar token salvo
  chrome.storage.local.get(['supabase_token'], r => {
    if (r.supabase_token) {
      document.getElementById('cfg-token').value = r.supabase_token
    }
  })
})

// ── Grupos ───────────────────────────────────────────────────────────────

async function loadGroups() {
  try {
    const token = await getToken()
    if (!token) return

    const res = await fetch(
      SUPABASE_URL + '/rest/v1/groups?select=id,name,github_repo,figma_url&order=name',
      {
        headers: {
          'apikey':        SUPABASE_KEY,
          'Authorization': 'Bearer ' + token,
        }
      }
    )
    if (!res.ok) return
    groups = await res.json()
    filterGroups('')
    document.getElementById('groups-list').style.display = 'block'
  } catch(e) {
    // sem conexão, ok
  }
}

function filterGroups(query) {
  const list = document.getElementById('groups-list')
  const filtered = query
    ? groups.filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
    : groups.slice(0, 6)

  list.innerHTML = filtered.map(g => `
    <div class="group-item${selectedGroup?.id === g.id ? ' selected' : ''}"
      data-id="${g.id}" data-name="${g.name}"
      data-url="${g.github_repo ? 'https://github.com/' + g.github_repo : (g.figma_url || '')}">
      ${g.name}
    </div>
  `).join('')

  list.querySelectorAll('.group-item').forEach(el => {
    el.addEventListener('click', () => {
      selectedGroup = { id: el.dataset.id, name: el.dataset.name }
      document.getElementById('selected-group').textContent = '✓ ' + el.dataset.name

      // Sugerir URL do grupo se o campo estiver vazio ou padrão
      const urlInput = document.getElementById('url-input')
      const suggestedUrl = el.dataset.url
      if (suggestedUrl && (!urlInput.value || urlInput.value.startsWith('chrome'))) {
        urlInput.value = suggestedUrl
      }

      filterGroups(document.getElementById('group-search').value)
    })
  })
}

async function getToken() {
  return new Promise(resolve => {
    chrome.storage.local.get(['supabase_token'], r => resolve(r.supabase_token || null))
  })
}

function setStatus(msg, type) {
  const el = document.getElementById('status')
  el.textContent = msg
  el.className = 'status' + (type ? ' ' + type : '')
}
