import { delay, http, HttpResponse } from 'msw'
import { nfts, type NFT } from '../data/catalog'

type DemoUser = { email: string; username: string; displayName: string; avatar: string }
type CartItem = { nftId: string; quantity: number }

const users = new Map<string, DemoUser>()
const carts = new Map<string, CartItem[]>()
const profiles = new Map<string, DemoUser>()
const wallets = new Map<string, Array<Record<string, string>>>()
const favoriteSets = new Map<string, string[]>()
const ordersByIdempotency = new Map<
  string,
  { fingerprint: string; order: Record<string, unknown> }
>()
const ETH_SCALE = 1_000_000n
const ethToUnits = (value: string | number) => {
  const [whole, fraction = ''] = String(value).split('.')
  return BigInt(whole || '0') * ETH_SCALE + BigInt(`${fraction}000000`.slice(0, 6) || '0')
}
const unitsToEth = (units: bigint) => {
  const whole = units / ETH_SCALE
  const fraction = String(units % ETH_SCALE)
    .padStart(6, '0')
    .replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : String(whole)
}

const getUserKey = (request: Request) => request.headers.get('X-Demo-User') || 'guest'
const getNft = (id: string) => nfts.find((nft) => nft.id === id)
const getHeader = (request: Request | undefined, name: string) => request?.headers.get(name) ?? ''
const shouldFail = (request?: Request) =>
  import.meta.env.VITE_MOCK_FAILURE === 'true' || getHeader(request, 'X-Demo-Failure') === 'true'
const wait = (request?: Request) => {
  const latency = getHeader(request, 'X-Demo-Latency')
  return delay(
    latency === 'timeout' || import.meta.env.VITE_MOCK_LATENCY === 'timeout'
      ? 8_000
      : latency === 'slow' || import.meta.env.VITE_MOCK_LATENCY === 'slow'
        ? 1_400
        : 120,
  )
}
const waitOrder = (request?: Request) =>
  delay(
    getHeader(request, 'X-Demo-Order-Timeout') === 'true' ||
      import.meta.env.VITE_MOCK_ORDER_TIMEOUT === 'true'
      ? 8_000
      : 120,
  )

export const handlers = [
  http.get('/api/nfts', async ({ request }) => {
    await wait(request)
    if (shouldFail(request))
      return HttpResponse.json(
        { message: 'Catálogo indisponível no cenário de falha.' },
        { status: 503 },
      )
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const category = url.searchParams.get('category') ?? ''
    const sort = url.searchParams.get('sort') ?? 'recent'
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const pageSize = Math.max(1, Math.min(24, Number(url.searchParams.get('pageSize') ?? 6)))
    const maxPrice = Number(url.searchParams.get('maxPrice') ?? 10)
    const filtered = nfts
      .filter((nft) => `${nft.name} ${nft.collection} ${nft.category}`.toLowerCase().includes(q))
      .filter((nft) => !category || nft.category === category)
      .filter((nft) => Number(nft.price) <= maxPrice)
    const sorted = [...filtered].sort((a, b) =>
      sort === 'price'
        ? Number(a.price) - Number(b.price)
        : sort === 'popular'
          ? b.reviews - a.reviews
          : a.id.localeCompare(b.id),
    )
    const start = (page - 1) * pageSize
    return HttpResponse.json({
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
      hasNext: start + pageSize < sorted.length,
    })
  }),
  http.get('/api/nfts/:id', async ({ request, params }) => {
    await wait(request)
    if (shouldFail(request))
      return HttpResponse.json(
        { message: 'Detalhe indisponível no cenário de falha.' },
        { status: 503 },
      )
    const nft = getNft(String(params.id))
    return nft
      ? HttpResponse.json(nft)
      : HttpResponse.json(
          { code: 'NFT_NOT_FOUND', message: 'NFT não encontrado.' },
          { status: 404 },
        )
  }),
  http.post('/api/session/login', async ({ request }) => {
    await wait()
    const body = (await request.json()) as { email?: string; password?: string }
    if (!body.email?.includes('@') || (body.password?.length ?? 0) < 6)
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'E-mail ou senha inválidos.' },
        { status: 422 },
      )
    const user: DemoUser = users.get(body.email) ?? {
      email: body.email,
      username: body.email.split('@')[0],
      displayName: 'Colecionador Kurio',
      avatar: body.email.slice(0, 1).toUpperCase(),
    }
    users.set(user.email, user)
    profiles.set(user.email, user)
    return HttpResponse.json({ user, expiresAt: Date.now() + 60 * 60 * 1_000 })
  }),
  http.get('/api/session', async ({ request }) => {
    await wait()
    const key = getUserKey(request)
    const user = users.get(key)
    return user
      ? HttpResponse.json({ user, expiresAt: Date.now() + 60 * 60 * 1_000 })
      : HttpResponse.json(
          { code: 'UNAUTHENTICATED', message: 'Sessão não encontrada.' },
          { status: 401 },
        )
  }),
  http.post('/api/session/logout', async () => {
    await wait()
    return HttpResponse.json({ ok: true })
  }),
  http.post('/api/session/signup', async ({ request }) => {
    await wait()
    const body = (await request.json()) as { username?: string; email?: string; password?: string }
    if (
      !body.username ||
      body.username.length < 3 ||
      !body.email?.includes('@') ||
      (body.password?.length ?? 0) < 6
    )
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Preencha os campos com dados válidos.' },
        { status: 422 },
      )
    if (users.has(body.email))
      return HttpResponse.json(
        { code: 'CONFLICT', message: 'Este e-mail já possui uma conta.' },
        { status: 409 },
      )
    const user: DemoUser = {
      email: body.email,
      username: body.username,
      displayName: body.username,
      avatar: body.username.slice(0, 1).toUpperCase(),
    }
    users.set(user.email, user)
    profiles.set(user.email, user)
    return HttpResponse.json({ user, expiresAt: Date.now() + 60 * 60 * 1_000 }, { status: 201 })
  }),
  http.get('/api/cart', async ({ request }) => {
    await wait()
    return HttpResponse.json({ items: carts.get(getUserKey(request)) ?? [] })
  }),
  http.put('/api/cart', async ({ request }) => {
    await wait()
    const body = (await request.json()) as { items?: CartItem[] }
    carts.set(getUserKey(request), body.items ?? [])
    return HttpResponse.json({ items: body.items ?? [] })
  }),
  http.get('/api/favorites', async ({ request }) => {
    await wait()
    return HttpResponse.json({ items: favoriteSets.get(getUserKey(request)) ?? [] })
  }),
  http.put('/api/favorites', async ({ request }) => {
    await wait(request)
    if (getHeader(request, 'X-Demo-Favorites-Failure') === 'true')
      return HttpResponse.json(
        { code: 'FAVORITES_UNAVAILABLE', message: 'Favoritos indisponíveis no cenário de falha.' },
        { status: 503 },
      )
    const body = (await request.json()) as { items?: string[] }
    favoriteSets.set(getUserKey(request), body.items ?? [])
    return HttpResponse.json({ items: body.items ?? [] })
  }),
  http.post('/api/coupons/validate', async ({ request }) => {
    await wait()
    const body = (await request.json()) as { code?: string }
    if (body.code?.toUpperCase() !== 'KURIO10')
      return HttpResponse.json(
        { code: 'INVALID_COUPON', message: 'Código inválido ou expirado.' },
        { status: 422 },
      )
    return HttpResponse.json({ code: 'KURIO10', discountRate: '0.1' })
  }),
  http.post('/api/orders', async ({ request }) => {
    const key = request.headers.get('Idempotency-Key')
    const body = (await request.json()) as {
      items?: CartItem[]
      wallet?: string
      network?: string
      total?: string
      discount?: string
    }
    const userId = getUserKey(request)
    const fingerprint = JSON.stringify(body)
    if (!key)
      return HttpResponse.json(
        { code: 'IDEMPOTENCY_REQUIRED', message: 'A chave de idempotência é obrigatória.' },
        { status: 400 },
      )
    const previous = ordersByIdempotency.get(key)
    if (previous && previous.fingerprint !== fingerprint)
      return HttpResponse.json(
        {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'A chave foi reutilizada com conteúdo diferente.',
        },
        { status: 409 },
      )
    if (previous) return HttpResponse.json(previous.order)
    const items = body.items ?? []
    const unavailable = items.find((item) => {
      const nft = getNft(item.nftId)
      return !nft || item.quantity < 1 || item.quantity > nft.stock
    })
    if (unavailable)
      return HttpResponse.json(
        { code: 'OUT_OF_STOCK', message: 'A disponibilidade de um NFT mudou. Revise o carrinho.' },
        { status: 409 },
      )
    const subtotalUnits = items.reduce(
      (sum, item) => sum + ethToUnits(getNft(item.nftId)?.price ?? '0') * BigInt(item.quantity),
      0n,
    )
    const expectedUnits =
      subtotalUnits - ethToUnits(body.discount ?? '0') + (items.length ? ethToUnits('0.016') : 0n)
    if (ethToUnits(body.total ?? '0') !== expectedUnits)
      return HttpResponse.json(
        {
          code: 'QUOTE_EXPIRED',
          message: 'A cotação mudou. Revise os valores antes de confirmar.',
        },
        { status: 409 },
      )
    const requestedStatus =
      getHeader(request, 'X-Demo-Order-Status') || import.meta.env.VITE_MOCK_ORDER_STATUS
    const status =
      requestedStatus === 'pending'
        ? 'pending'
        : requestedStatus === 'rejected'
          ? 'rejected'
          : 'confirmed'
    const order = {
      id: '0xA91F…E82C',
      status,
      createdAt: new Date().toISOString(),
      items,
      total: unitsToEth(expectedUnits),
      wallet: body.wallet ?? 'MetaMask',
      network: body.network ?? 'Ethereum',
      userId,
    }
    ordersByIdempotency.set(key, { fingerprint, order })
    await waitOrder(request)
    return HttpResponse.json(order, { status: 201 })
  }),
  http.get('/api/orders/:id', async ({ request, params }) => {
    await wait(request)
    const userId = getUserKey(request)
    const order = [...ordersByIdempotency.values()].find(
      (entry) => entry.order.id === String(params.id) && entry.order.userId === userId,
    )?.order
    return order
      ? HttpResponse.json(order)
      : HttpResponse.json(
          { code: 'ORDER_NOT_FOUND', message: 'Pedido não encontrado.' },
          { status: 404 },
        )
  }),
  http.get('/api/profile', async ({ request }) => {
    await wait()
    return HttpResponse.json(profiles.get(getUserKey(request)) ?? null)
  }),
  http.put('/api/profile', async ({ request }) => {
    await wait()
    const body = (await request.json()) as DemoUser
    const key = getUserKey(request)
    profiles.set(key, body)
    return HttpResponse.json(body)
  }),
  http.put('/api/profile/password', async ({ request }) => {
    await wait()
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string }
    if ((body.currentPassword?.length ?? 0) < 6 || (body.newPassword?.length ?? 0) < 6)
      return HttpResponse.json(
        { code: 'VALIDATION_ERROR', message: 'As senhas precisam ter pelo menos 6 caracteres.' },
        { status: 422 },
      )
    return HttpResponse.json({ ok: true })
  }),
  http.get('/api/wallets', async ({ request }) => {
    await wait()
    return HttpResponse.json(wallets.get(getUserKey(request)) ?? [])
  }),
  http.post('/api/wallets', async ({ request }) => {
    await wait()
    const key = getUserKey(request)
    const body = (await request.json()) as Record<string, string>
    const next = [
      ...(wallets.get(key) ?? []),
      { ...body, id: `wallet-${(wallets.get(key)?.length ?? 0) + 1}` },
    ]
    wallets.set(key, next)
    return HttpResponse.json(next[next.length - 1], { status: 201 })
  }),
  http.put('/api/wallets/:id', async ({ request, params }) => {
    await wait()
    const key = getUserKey(request)
    const body = (await request.json()) as Record<string, string>
    const current = wallets.get(key) ?? []
    const index = current.findIndex((wallet) => wallet.id === String(params.id))
    if (index < 0)
      return HttpResponse.json(
        { code: 'WALLET_NOT_FOUND', message: 'Carteira não encontrada.' },
        { status: 404 },
      )
    const updated = { ...current[index], ...body, id: String(params.id) }
    current[index] = updated
    wallets.set(key, current)
    return HttpResponse.json(updated)
  }),
]

export const resetMockState = () => {
  users.clear()
  carts.clear()
  profiles.clear()
  wallets.clear()
  favoriteSets.clear()
  ordersByIdempotency.clear()
  nfts.forEach((nft, index) => {
    nft.price = ['1.19', '1.39', '1.79', '0.99', '2.12', '1.69', '0.74', '1.12'][index]
  })
}
