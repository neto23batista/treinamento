# Arquitetura

## Camadas e contratos

- `src/main.tsx`: composição das rotas TanStack Router, contexto de sessão/carrinho e telas.
- `src/services/api.ts`: instância Axios, timeout e injeção de `X-Demo-User`.
- `src/mocks/handlers.ts`: contratos REST MSW e estado dos cenários; componentes não carregam respostas fictícias.
- `src/data/catalog.ts`: fixture tipada do catálogo usada pelos handlers e pelo socket de demonstração.
- `src/mocks/socket-handlers.ts`: transporte experimental WebSocket usando `@mswjs/socket.io-binding`.
- `scripts/socket-server.mjs`: servidor Socket.IO local para exercitar o cliente real; ele emite `nft.updated` e `order.updated` com recurso, identidade e versão.
- `src/components/ui/button.tsx`: primitive visual no padrão shadcn/ui, combinada com o sistema visual existente.

Os endpoints simulados são:

| Recurso | Operações |
| --- | --- |
| Sessão | `GET /api/session`, `POST /api/session/login`, `POST /api/session/signup`, `POST /api/session/logout` |
| NFTs | `GET /api/nfts`, `GET /api/nfts/:id` |
| Carrinho | `GET/PUT /api/cart` |
| Favoritos | `GET/PUT /api/favorites` |
| Cupom | `POST /api/coupons/validate` |
| Pedido | `POST /api/orders` com `Idempotency-Key`, `GET /api/orders/:id` |
| Perfil | `GET/PUT /api/profile`, `PUT /api/profile/password` |
| Carteiras | `GET /api/wallets`, `POST /api/wallets`, `PUT /api/wallets/:id` |

Pedidos recusam ausência de chave de idempotência, reuso da mesma chave com outro payload, estoque inválido e cotação desatualizada. O checkout só limpa os itens após uma resposta `confirmed`; timeout, erro HTTP, `pending` e `rejected` preservam o carrinho.

## Estado, cache e sessão

TanStack Query usa cache por parâmetros (`['nfts', { q, category, sort, page, maxPrice }]`) e mantém a resposta anterior durante a troca de página para evitar saltos visuais. Catálogo e detalhe têm skeleton, retry e estado de erro. O histórico do navegador é atualizado com `pushState`; busca, categoria, faixa de preço, aba, ordenação e página sobrevivem a refresh, acesso direto e voltar/avançar.

O contexto mantém a sessão corrente e persiste chaves isoladas (`kurio-cart:<email>`, `kurio-favorites:<email>`, `kurio-order:<email>`). O carrinho e favoritos do visitante são mesclados no login; logout mantém somente o snapshot público do visitante. O cabeçalho de usuário também separa o estado em memória do MSW.

O pedido usa snapshot de itens, quantidades, total, carteira, rede e data. Alterações posteriores do catálogo não reescrevem o recibo. Uma chave determinística de idempotência impede duplicação por clique repetido ou reenvio. O identificador do usuário é gravado no pedido simulado e aplicado também na consulta de recuperação, evitando que a reconciliação revele pedidos de outra sessão.

## Tempo real

O `socket.io-client` conecta sob demanda ao servidor configurado por `VITE_SOCKET_URL`, no primeiro gesto do usuário ou no fallback de segurança. Quando `VITE_SOCKET_MOCK=true`, ele usa o mesmo host da aplicação e o worker MSW é inicializado antes da conexão; essa é a configuração de `.env.production` para o deploy demonstrativo. `nft.updated` altera preço e estoque do fixture, invalida as queries de catálogo/detalhe e informa o usuário; `order.updated` altera o pedido ativo. Um mapa de versões ignora duplicatas e eventos antigos, e é limpo ao trocar de sessão. Listeners são removidos no cleanup do provider; ao reconectar, o pedido ativo é reconciliado por `GET /api/orders/:id`.

O servidor local é uma ferramenta de demonstração para exercitar o transporte real, não um backend de produção. Para testar eventos localmente, conecte um cliente Socket.IO a `http://127.0.0.1:3001` e emita `demo:nft-update` ou `demo:order-update`; o servidor então transmite o evento de domínio aos clientes. No build publicado, o binding MSW fica atrás de `VITE_SOCKET_MOCK=true` e intercepta o WebSocket no mesmo host da aplicação; essa modalidade cobre o demo estático, enquanto um ambiente com socket real deve hospedar o processo Node separadamente.

## Acessibilidade e responsividade

Há skip link, foco visível, landmarks, labels, `role="status"`/`role="alert"`, navegação semântica, texto alternativo, controles de quantidade acessíveis, feedback de atualização e `prefers-reduced-motion`. Os testes E2E executam Chromium desktop e Pixel 5, e os breakpoints cobrem também tablets. A auditoria Lighthouse registra performance, acessibilidade, boas práticas, SEO, LCP, CLS e TBT.

## Limitações assumidas

Blockchain, extensões de carteira, gateway de pagamento, upload real de avatar e backend persistente estão fora do escopo. A conexão de carteira e o pagamento são estados simulados e podem ser exercitados por `kurio-mock-wallet-status`; não há transação real. O deploy público usa o binding Socket.IO do MSW no mesmo host; uma integração real exige hospedar o processo Socket.IO separadamente ou apontar `VITE_SOCKET_URL` para uma implementação compatível. As ilustrações SVG locais são substitutas documentadas dos assets do Figma e evitam dependência de rede no LCP.
