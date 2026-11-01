# Kurio NFT Marketplace

Implementação em React + TypeScript inspirada no protótipo do Figma fornecido para o desafio frontend.

## Rodar localmente

```bash
npm install
npm run dev
```

Também estão disponíveis `npm run build`, `npm run preview` e `npm run typecheck`.

## Demo

- O catálogo, busca, ordenação, favoritos e carrinho funcionam no navegador.
- O carrinho, favoritos, sessão e último pedido são persistidos no `localStorage`.
- Para testar login, use qualquer e-mail válido e uma senha com pelo menos 6 caracteres.
- O cupom de demonstração é `KURIO10`.
- O checkout usa carteiras simuladas; nenhuma transação real é enviada.

## Decisões

Os dados são servidos por um adapter Axios tipado, permitindo que o mesmo contrato seja substituído por REST real sem alterar componentes. TanStack Query controla cache e estados de carregamento, enquanto TanStack Router controla as rotas principais. O cliente Socket.IO fica preparado para `nft.updated`; no ambiente local sem servidor ele não abre conexão automaticamente.

Imagens de referência do protótipo foram substituídas por imagens remotas de animais enquanto o arquivo Figma não expõe assets exportáveis anonimamente. O layout preserva a direção visual, proporções, cores, tipografia monoespaciada, estados de foco e responsividade observados nos frames.
