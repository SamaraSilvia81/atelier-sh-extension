# Atelier.sh — Review Editor (Extensão Chrome/Opera)

Anote e revise sites dos alunos diretamente no browser, com screenshot real + anotações sincronizadas com o Atelier.sh.

## Como instalar

### Chrome
1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione esta pasta (`atelier-extension/`)

### Opera GX
1. Abra `opera://extensions`
2. Ative **Modo do desenvolvedor**
3. Clique em **Carregar extensão descompactada**
4. Selecione esta pasta

---

## Fluxo integrado com o Atelier.sh

Depois de instalar a extensão, o botão **revisar** (ícone de monitor) em cada GroupCard do Atelier.sh vai:

1. Abrir o site de deploy do grupo em uma nova aba
2. A extensão detecta automaticamente e ativa o overlay
3. O grupo já fica pré-selecionado — sem configuração manual

> O grupo precisa ter um GitHub repo cadastrado.
> A URL de deploy é construída como `usuario.github.io/repositorio`.
> Se não houver URL, o Atelier.sh abre o painel interno como fallback.

---

## Como usar manualmente (sem o Atelier.sh)

1. Clique no ícone da extensão na barra do browser
2. (Opcional) Selecione o grupo do Atelier.sh para vincular
3. Digite a URL ou clique em **usar aba atual**
4. Clique em **Ativar overlay**
5. Use as ferramentas:
   - `d` — desenhar
   - `m` — marca-texto
   - `c` — comentário
   - `k` — ok (✓)
   - `x` — corrigir (✗)
   - `e` — borracha
   - `Esc` — fechar
6. Clique em **⬡** para capturar screenshot + baixar `.md`

---

## Configurar token do Supabase

1. Abra o Atelier.sh e faça login
2. DevTools (F12) → Console → execute:
   ```js
   JSON.parse(localStorage.getItem('sb-siat-auth-token')).access_token
   ```
3. Copie o token
4. Na extensão → aba **Configurar** → cole → **Salvar**

---

## Estrutura dos arquivos

```
atelier-extension/
├── manifest.json
├── background.js
├── content.js
├── content.css
├── popup.html
├── popup.js
├── icon16.png
├── icon48.png
└── icon128.png
```
