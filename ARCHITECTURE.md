# Arquitetura

## Camadas

- `src/main.tsx`: composição da aplicação, rotas, contexto de sessão/carrinho e componentes de tela.
- Adapter Axios: simula contratos REST para catálogo e detalhes, mantendo a fronteira pronta para handlers MSW/backend.
- TanStack Query: consultas de catálogo/detalhe, cache por identificador e skeletons durante latência simulada.
- TanStack Router: rotas de descoberta, detalhe, carrinho, checkout, confirmação, perfil e carteiras.
- Socket.IO Client: listener de `nft.updated` com invalidação da consulta e feedback ao colecionador. `autoConnect` fica desligado no build demo quando não há servidor local.

## Estado e persistência

Carrinho, favoritos, usuário e o snapshot do último pedido são isolados no contexto e persistidos em `localStorage`. O pedido guarda itens, quantidades, valor total, carteira e identificador de transação; alterações futuras no catálogo não reescrevem o recibo.

## Acessibilidade e responsividade

Há skip link, foco visível, labels de formulário, aria-labels em botões iconográficos, feedback com `role="status"`/`role="alert"`, contraste sem depender somente de cor, targets de toque de pelo menos 42px e fallback para `prefers-reduced-motion`. Os breakpoints principais cobrem mobile, tablet e desktop.
