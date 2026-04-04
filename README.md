# Atelier.sh — Review Editor (Extensão Chrome/Opera)

Anote e revise sites dos alunos diretamente no browser, com screenshot real + anotações sincronizadas com o Atelier.sh.

## Instalação

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

## Como usar

1. Clique no ícone da extensão na barra do browser
2. (Opcional) Selecione o grupo do Atelier.sh para vincular
3. Digite a URL do site a revisar ou use a aba atual
4. Clique em **Ativar overlay**
5. Use as ferramentas para anotar:
   - `d` — desenhar
   - `m` — marca-texto
   - `c` — comentário
   - `k` — marcar ok (✓)
   - `x` — marcar corrigir (✗)
   - `e` — borracha
   - `Esc` — fechar
6. Clique em **⬡** (capturar) para gerar o screenshot + `.md`

## Configurar token do Supabase

Para sincronizar com o Atelier.sh:

1. Abra o Atelier.sh e faça login
2. Abra o DevTools (F12) → Console
3. Digite: `JSON.parse(localStorage.getItem('sb-siat-auth-token')).access_token`
4. Copie o token
5. Na extensão → aba **Configurar** → cole o token → Salvar

## O que a extensão captura

- **Screenshot real** da página inteira com suas anotações por cima
- **Arquivo `.md`** com a devolutiva completa incluindo a imagem
- **Supabase** — salva vinculado ao grupo se configurado
