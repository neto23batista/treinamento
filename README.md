# Kurio NFT Marketplace

Marketplace de NFTs em React + TypeScript, implementado a partir do protótipo do Figma do desafio. A entrega cobre descoberta, detalhe, carrinho, autenticação simulada, checkout, confirmação, perfil e carteiras em desktop e mobile.

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- Chromium instalado automaticamente pelo Playwright para os testes E2E

## Execução

```bash
npm install
npm run dev
```

`npm run dev` inicia o Vite em `http://127.0.0.1:5173` e o servidor Socket.IO de demonstração em `http://127.0.0.1:3001`. Para iniciar somente o frontend ou somente o socket, use `npm run dev:web` ou `npm run dev:socket`.

Comandos de validação:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm run lighthouse
```

Para reproduzir o Lighthouse, execute `npm run build`, mantenha `npm run preview -- --host 127.0.0.1 --port 4173` em outro terminal e então rode `npm run lighthouse`. Se o preview estiver em outra porta, use `LIGHTHOUSE_ORIGIN=http://127.0.0.1:PORTA npm run lighthouse`.

O relatório HTML autocontido da última execução do Playwright fica em `playwright-report/index.html`. A auditoria gera três medições por página e perfil em `reports/lighthouse/`, incluindo HTML, JSON e `summary.json` com as medianas; esses relatórios também são entregues no repositório para conferência e reprodução da auditoria.

## Dados simulados e cenários

O MSW intercepta Axios na camada de rede no build de demonstração. Para preservar o primeiro paint, o worker é iniciado sob demanda no primeiro gesto do usuário (com fallback automático); o worker está em `public/mockServiceWorker.js` e os contratos ficam em `src/mocks/handlers.ts`. O estado simulado é separado pelo cabeçalho `X-Demo-User`; a interface ainda mantém snapshots de sessão, carrinho, favoritos e pedido no `localStorage` para sobreviver a refresh.

Variáveis opcionais:

| Variável | Efeito |
| --- | --- |
| `VITE_ENABLE_MOCKS=false` | Desliga o worker MSW para apontar o cliente a uma API real em `/api`. |
| `VITE_MOCK_LATENCY=slow` | Adiciona latência reproduzível para conferir skeletons e retry. |
| `VITE_MOCK_LATENCY=timeout` | Faz consultas REST demorarem mais que o timeout do Axios. |
| `VITE_MOCK_FAILURE=true` | Faz a listagem de NFTs responder `503`. |
| `VITE_MOCK_ORDER_TIMEOUT=true` | Atrasa a criação do pedido além do timeout; repetir a mesma chave recupera o pedido idempotente. |
| `VITE_MOCK_ORDER_STATUS=pending` | Cria o pedido como pendente. |
| `VITE_MOCK_ORDER_STATUS=rejected` | Cria o pedido como recusado. |
| `VITE_SOCKET_URL` | Troca a origem do Socket.IO; o padrão local é `http://127.0.0.1:3001`. |
| `VITE_SOCKET_MOCK=true` | Habilita o handler compatível com `@mswjs/socket.io-binding` no mesmo host da aplicação; já vem ativado em `.env.production` para o deploy demonstrativo. |

Durante uma sessão no navegador, os mesmos cenários também podem ser alternados sem rebuild pelas chaves `kurio-mock-latency`, `kurio-mock-failure`, `kurio-mock-favorites-failure`, `kurio-mock-order-timeout`, `kurio-mock-order-status` e `kurio-mock-wallet-status=rejected|disconnected`. O filtro de preço do catálogo usa `maxPrice` junto de `q`, `category`, `tab`, `sort` e `page`, todos preservados na URL.

Credenciais fictícias: no login, qualquer e-mail válido com senha de pelo menos seis caracteres funciona. Para testar conflito de cadastro, crie a mesma conta duas vezes. O cupom de demonstração é `KURIO10`.

Para restaurar o cenário local, remova as chaves `kurio-*` do armazenamento do domínio no DevTools e recarregue. Para restaurar o estado em memória dos handlers, recarregue o worker; `resetMockState` também está exportado para fixtures e testes.

## Fluxos cobertos

- catálogo com busca, categoria, ordenação, paginação e estado completo na URL;
- acesso direto ao detalhe, galeria, limite de quantidade, favorito e peça inexistente;
- carrinho persistente, isolamento por usuário, ajuste/remoção, cupom e totais;
- login, cadastro, logout, preservação do carrinho visitante e sessão após refresh;
- checkout com revalidação de disponibilidade/cotação, chave `Idempotency-Key`, estados confirmado, pendente e recusado;
- checkout semântico com validação de campos, rede, carteiras persistidas, conexão/recusa/desconexão simuladas e preservação do carrinho em falhas;
- recibo com snapshot do pedido;
- edição persistida de perfil, alteração de senha simulada e cadastro de carteira;
- eventos `nft.updated` e `order.updated` com `resourceId`, versão e descarte de duplicatas/versões antigas;
- feedback acessível, skeleton com shimmer, estados vazios, falhas, retry, foco visível e layout responsivo.

Os 19 cenários Playwright são executados em Chromium desktop, Pixel 5 e tablet de 768px (57 execuções), com 12 baselines visuais versionadas para início, detalhe, carrinho e pagamento. A suíte cobre também alteração de preço via Socket.IO durante o checkout, idempotência após timeout, isolamento entre usuários e recuperação de falhas REST.

## Stack efetivamente usada

React, TypeScript, TanStack Router, TanStack Query, Axios, REST simulado por MSW, Socket.IO client/server, Tailwind CSS v4, primitive no padrão shadcn/ui em `src/components/ui/button.tsx`, Playwright e Lighthouse.

## Última auditoria local

Executada em 01/11/2026 contra o build de produção em `http://127.0.0.1:4174`, com três medições por cenário. A mediana, as versões de Node/Lighthouse, os viewports, a configuração de throttling e a quantidade de execuções estão registradas em `reports/lighthouse/summary.json`; os relatórios individuais em HTML/JSON ficam no mesmo diretório.

| Página/perfil | Performance | Accessibility | Best Practices | SEO |
| --- | ---: | ---: | ---: | ---: |
| Home desktop | 100 | 100 | 100 | 100 |
| Home mobile | 98 | 100 | 100 | 100 |
| Detalhe desktop | 100 | 100 | 100 | 100 |
| Detalhe mobile | 98 | 100 | 100 | 100 |

Todos os quatro perfis atendem ao alvo de performance `>= 90`, além de 100 em acessibilidade, boas práticas e SEO. As medianas de LCP/CLS/TBT foram, respectivamente: home desktop `438/0/0`, home mobile `1885/0/143`, detalhe desktop `433/0/0` e detalhe mobile `1820/0/156` (ms, exceto CLS). O boot sob demanda mantém MSW e Socket.IO disponíveis para os fluxos interativos sem colocar seus chunks de desenvolvimento no caminho crítico do primeiro paint. O runner usa o preset desktop real e registra as medianas completas em `reports/lighthouse/summary.json`; o resultado não é mascarado por uma página simplificada: catálogo, revalidação REST, cenários MSW e eventos Socket.IO continuam cobertos pelos testes.

## Imagens e Figma

O arquivo Figma fornecido no desafio não expõe assets exportáveis anonimamente durante a execução local. Por isso, a entrega usa ilustrações SVG locais em `public/assets` como substitutos dos assets visuais. Elas mantêm a direção de arte, paleta, enquadramento e proporções sem depender de uma CDN externa durante os testes e o deploy.

## Deploy

O frontend Vite pode ser publicado em Vercel, Netlify ou Cloudflare Pages com fallback de SPA para `index.html`. O `.env.production` ativa o MSW e o binding Socket.IO no mesmo host, mantendo os eventos demonstrativos funcionando também no deploy estático. Para trocar o mock por um servidor Socket.IO real, remova `VITE_SOCKET_MOCK` e aponte `VITE_SOCKET_URL` para um processo Node hospedado separadamente. Pagamentos e blockchain são deliberadamente simulados, conforme o escopo do desafio.
