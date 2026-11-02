import {
  StrictMode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import axios from 'axios'
import { api } from './services/api'
import { getSocket } from './services/socket'
import { imageSet, nfts, type NFT } from './data/catalog'
import { Button } from './components/ui/button'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Eye,
  Heart,
  House,
  LockKeyhole,
  LogIn,
  Menu,
  Minus,
  PackageCheck,
  Plus,
  Search,
  ShoppingCart,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserRound,
  WalletCards,
  X,
  Zap,
} from 'lucide-react'
import './styles.css'

type CartItem = { nftId: string; quantity: number }
type User = { email: string; username: string; displayName: string; avatar: string }
type Order = {
  id: string
  status: 'confirmed' | 'pending' | 'rejected'
  createdAt: string
  items: CartItem[]
  total: string
  wallet: string
  network?: string
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})
let networkReady: Promise<void> = Promise.resolve()
const waitForNetworkReady = () => networkReady

const readStorage = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as T
  } catch {
    return fallback
  }
}
const axiosErrorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? String(error.response?.data?.message ?? fallback) : fallback
const ETH_SCALE = 1_000_000n
const ethToUnits = (value: string | number) => {
  const normalized = String(value)
  const [whole, fraction = ''] = normalized.split('.')
  const padded = `${fraction}000000`.slice(0, 6)
  return BigInt(whole || '0') * ETH_SCALE + BigInt(padded || '0')
}
const unitsToEth = (units: bigint) => {
  const whole = units / ETH_SCALE
  const fraction = String(units % ETH_SCALE)
    .padStart(6, '0')
    .replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : String(whole)
}
const addEth = (...values: Array<string | number>) =>
  unitsToEth(values.reduce((total, value) => total + ethToUnits(value), 0n))
const subtractEth = (left: string | number, right: string | number) =>
  unitsToEth(ethToUnits(left) - ethToUnits(right))
const multiplyEth = (value: string, quantity: number) =>
  unitsToEth(ethToUnits(value) * BigInt(quantity))

type AppContextValue = {
  cart: CartItem[]
  favorites: string[]
  couponDiscount: string
  user: User | null
  order: Order | null
  authMode: 'login' | 'signup' | null
  toast: string | null
  addToCart: (nftId: string, quantity?: number) => void
  updateQuantity: (nftId: string, quantity: number) => void
  removeFromCart: (nftId: string) => void
  toggleFavorite: (nftId: string) => void
  setCouponDiscount: (value: string) => void
  login: (email: string, password: string) => Promise<string | null>
  signup: (username: string, email: string, password: string) => Promise<string | null>
  logout: () => void
  updateUser: (patch: Partial<User>) => void
  setAuthMode: (mode: 'login' | 'signup' | null) => void
  checkout: (wallet: string, network: string) => Promise<string | null>
  clearToast: () => void
}

const AppContext = createContext<AppContextValue | null>(null)
const useApp = () => {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppProvider')
  return value
}

function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const expiry = Number(localStorage.getItem('kurio-session-expires') ?? 0)
    return expiry && expiry < Date.now() ? null : readStorage<User | null>('kurio-user', null)
  })
  const sessionKey = user?.email ?? 'guest'
  const [cart, setCart] = useState<CartItem[]>(() =>
    readStorage(`kurio-cart:${sessionKey}`, [
      { nftId: 'emerald-ape-042', quantity: 1 },
      { nftId: 'violet-nomad-314', quantity: 1 },
    ]),
  )
  const [favorites, setFavorites] = useState<string[]>(() =>
    readStorage(`kurio-favorites:${sessionKey}`, ['emerald-ape-042']),
  )
  const [couponDiscount, setCouponDiscount] = useState<string>(() =>
    readStorage(`kurio-discount:${sessionKey}`, '0'),
  )
  const [order, setOrder] = useState<Order | null>(() =>
    readStorage<Order | null>(`kurio-order:${sessionKey}`, null),
  )
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const nftVersions = useRef(new Map<string, number>())
  const orderVersions = useRef(new Map<string, number>())
  useEffect(() => {
    orderVersions.current.clear()
  }, [sessionKey])

  useEffect(() => {
    localStorage.setItem(`kurio-cart:${sessionKey}`, JSON.stringify(cart))
  }, [cart, sessionKey])
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void waitForNetworkReady()
        .then(() => api.put('/cart', { items: cart }, { headers: { 'X-Demo-User': sessionKey } }))
        .catch(() => undefined)
    }, 1_200)
    return () => window.clearTimeout(timeout)
  }, [cart, sessionKey])
  useEffect(() => {
    localStorage.setItem(`kurio-favorites:${sessionKey}`, JSON.stringify(favorites))
  }, [favorites, sessionKey])
  useEffect(() => {
    localStorage.setItem(`kurio-discount:${sessionKey}`, JSON.stringify(couponDiscount))
  }, [couponDiscount, sessionKey])
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void waitForNetworkReady()
        .then(() =>
          api.put('/favorites', { items: favorites }, { headers: { 'X-Demo-User': sessionKey } }),
        )
        .catch(() => undefined)
    }, 1_200)
    return () => window.clearTimeout(timeout)
  }, [favorites, sessionKey])
  useEffect(() => {
    localStorage.setItem('kurio-user', JSON.stringify(user))
  }, [user])
  useEffect(() => {
    if (!user) return
    const expiresAt = Number(localStorage.getItem('kurio-session-expires') ?? 0)
    if (!expiresAt) return
    const timeout = window.setTimeout(
      () => {
        setUser(null)
        setOrder(null)
        setToast('Sua sessão expirou. Entre novamente para continuar.')
      },
      Math.max(0, expiresAt - Date.now()),
    )
    return () => window.clearTimeout(timeout)
  }, [user])
  useEffect(() => {
    localStorage.setItem(`kurio-order:${sessionKey}`, JSON.stringify(order))
  }, [order, sessionKey])
  useEffect(() => {
    const handleUpdate = (payload: {
      resourceId: string
      version: number
      price: string | number
      stock?: number
    }) => {
      const item = nfts.find((nft) => nft.id === payload.resourceId)
      const previousVersion = nftVersions.current.get(payload.resourceId) ?? 0
      if (!item || payload.version <= previousVersion) return
      nftVersions.current.set(payload.resourceId, payload.version)
      item.price = String(payload.price)
      if (typeof payload.stock === 'number') item.stock = payload.stock
      queryClient.invalidateQueries({ queryKey: ['nfts'] })
      queryClient.invalidateQueries({ queryKey: ['nft', payload.resourceId] })
      setToast(`${item.name} teve uma atualização de preço`)
    }
    const handleOrderUpdate = (payload: {
      resourceId: string
      version: number
      status: Order['status']
      userId?: string
    }) => {
      if (payload.userId !== sessionKey || order?.id !== payload.resourceId) return
      const previousVersion = orderVersions.current.get(payload.resourceId) ?? 0
      if (payload.version <= previousVersion) return
      orderVersions.current.set(payload.resourceId, payload.version)
      if (payload.status !== order.status)
        setOrder((current) => (current ? { ...current, status: payload.status } : current))
    }
    const handleReconnect = () => {
      queryClient.invalidateQueries({ queryKey: ['nfts'] })
      if (order)
        void waitForNetworkReady()
          .then(() =>
            api.get<Order>(`/orders/${order.id}`, { headers: { 'X-Demo-User': sessionKey } }),
          )
          .then(({ data }) => setOrder(data))
          .catch(() => undefined)
    }
    let disposed = false
    let started = false
    let client: Awaited<ReturnType<typeof getSocket>> | null = null
    const connectSocket = () => {
      if (started) return
      started = true
      window.removeEventListener('pointerdown', connectSocket)
      window.removeEventListener('keydown', connectSocket)
      void waitForNetworkReady()
        .then(() => getSocket())
        .then((socket) => {
          if (disposed) return
          client = socket
          socket.on('nft.updated', handleUpdate)
          socket.on('order.updated', handleOrderUpdate)
          socket.on('connect', handleReconnect)
          socket.connect()
        })
    }
    window.addEventListener('pointerdown', connectSocket, { once: true, passive: true })
    window.addEventListener('keydown', connectSocket, { once: true, passive: true })
    const fallback = window.setTimeout(connectSocket, 15_000)
    return () => {
      disposed = true
      window.clearTimeout(fallback)
      window.removeEventListener('pointerdown', connectSocket)
      window.removeEventListener('keydown', connectSocket)
      if (client) {
        client.off('nft.updated', handleUpdate)
        client.off('order.updated', handleOrderUpdate)
        client.off('connect', handleReconnect)
      }
    }
  }, [order])

  const actions: AppContextValue = {
    cart,
    favorites,
    couponDiscount,
    user,
    order,
    authMode,
    toast,
    addToCart: (nftId, quantity = 1) => {
      setCart((current) => {
        const existing = current.find((item) => item.nftId === nftId)
        return existing
          ? current.map((item) =>
              item.nftId === nftId
                ? {
                    ...item,
                    quantity: Math.min(
                      item.quantity + quantity,
                      nfts.find((nft) => nft.id === nftId)?.stock ?? 1,
                    ),
                  }
                : item,
            )
          : [...current, { nftId, quantity }]
      })
      setToast('NFT adicionado ao carrinho')
    },
    updateQuantity: (nftId, quantity) =>
      setCart((current) =>
        current.map((item) =>
          item.nftId === nftId
            ? {
                ...item,
                quantity: Math.max(
                  1,
                  Math.min(quantity, nfts.find((nft) => nft.id === nftId)?.stock ?? 1),
                ),
              }
            : item,
        ),
      ),
    removeFromCart: (nftId) => {
      setCart((current) => current.filter((item) => item.nftId !== nftId))
      setToast('Item removido do carrinho')
    },
    toggleFavorite: (nftId) => {
      const previous = favorites
      const next = previous.includes(nftId)
        ? previous.filter((id) => id !== nftId)
        : [...previous, nftId]
      setFavorites(next)
      void api
        .put('/favorites', { items: next }, { headers: { 'X-Demo-User': sessionKey } })
        .catch(() => {
          setFavorites(previous)
          setToast('Não foi possível atualizar os favoritos.')
        })
    },
    setCouponDiscount,
    login: async (email, password) => {
      try {
        const response = await api.post<{ user: User; expiresAt: number }>('/session/login', {
          email,
          password,
        })
        const nextUser = response.data.user
        const guestCart = readStorage<CartItem[]>('kurio-cart:guest', [])
        const savedCart = readStorage<CartItem[]>(`kurio-cart:${email}`, [])
        const guestFavorites = readStorage<string[]>('kurio-favorites:guest', [])
        const savedFavorites = readStorage<string[]>(`kurio-favorites:${email}`, [])
        setCart([
          ...savedCart,
          ...guestCart.filter((guest) => !savedCart.some((saved) => saved.nftId === guest.nftId)),
        ])
        setFavorites([...new Set([...savedFavorites, ...guestFavorites])])
        setCouponDiscount(readStorage(`kurio-discount:${email}`, '0'))
        setOrder(readStorage<Order | null>(`kurio-order:${email}`, null))
        localStorage.setItem('kurio-session-expires', String(response.data.expiresAt))
        localStorage.setItem('kurio-user', JSON.stringify(nextUser))
        setUser(nextUser)
        setAuthMode(null)
        setToast('Bem-vindo de volta à Kurio')
        return null
      } catch (error) {
        return axiosErrorMessage(error, 'Não foi possível entrar agora.')
      }
    },
    signup: async (username, email, password) => {
      try {
        const response = await api.post<{ user: User; expiresAt: number }>('/session/signup', {
          username,
          email,
          password,
        })
        const nextUser = response.data.user
        setCart(readStorage<CartItem[]>('kurio-cart:guest', []))
        setFavorites(readStorage<string[]>('kurio-favorites:guest', []))
        setCouponDiscount('0')
        localStorage.setItem('kurio-session-expires', String(response.data.expiresAt))
        localStorage.setItem('kurio-user', JSON.stringify(nextUser))
        setUser(nextUser)
        setAuthMode(null)
        setToast('Perfil criado com sucesso')
        return null
      } catch (error) {
        return axiosErrorMessage(error, 'Não foi possível criar a conta.')
      }
    },
    logout: () => {
      void waitForNetworkReady()
        .then(() => api.post('/session/logout'))
        .catch(() => undefined)
      localStorage.setItem('kurio-cart:guest', JSON.stringify(cart))
      localStorage.setItem('kurio-favorites:guest', JSON.stringify(favorites))
      localStorage.removeItem('kurio-session-expires')
      localStorage.removeItem('kurio-user')
      queryClient.removeQueries({ queryKey: ['profile'] })
      queryClient.removeQueries({ queryKey: ['wallets'] })
      setCouponDiscount('0')
      setUser(null)
      setOrder(null)
      setToast('Sessão encerrada')
    },
    updateUser: (patch) => setUser((current) => (current ? { ...current, ...patch } : current)),
    setAuthMode,
    checkout: async (wallet, network) => {
      if (!cart.length) return 'Seu carrinho está vazio.'
      const subtotal = addEth(
        ...cart.map((item) =>
          multiplyEth(nfts.find((nft) => nft.id === item.nftId)?.price ?? '0', item.quantity),
        ),
      )
      const total = addEth(subtractEth(subtotal, couponDiscount), '0.016')
      const idempotencyKey = `checkout:${sessionKey}:${cart.map((item) => `${item.nftId}:${item.quantity}`).join('|')}:${wallet}:${network}:${couponDiscount}`
      try {
        const response = await api.post<Order>(
          '/orders',
          { items: cart, total, discount: couponDiscount, wallet, network },
          { headers: { 'Idempotency-Key': idempotencyKey, 'X-Demo-User': sessionKey } },
        )
        setOrder(response.data)
        if (response.data.status !== 'confirmed')
          return response.data.status === 'pending'
            ? 'Pagamento pendente. Atualize a página para recuperar o pedido.'
            : 'Pagamento recusado. Seus itens foram preservados.'
        setCart([])
        setCouponDiscount('0')
        setToast('Compra confirmada — seus NFTs estão na carteira')
        return null
      } catch (error) {
        return axiosErrorMessage(
          error,
          'Não foi possível confirmar a compra. Seus itens foram preservados.',
        )
      }
    },
    clearToast: () => setToast(null),
  }
  return <AppContext.Provider value={actions}>{children}</AppContext.Provider>
}

type CatalogResponse = {
  items: NFT[]
  total: number
  page: number
  pageSize: number
  hasNext: boolean
}
type CatalogFilters = { q: string; category: string; sort: string; page: number; maxPrice: number }
const getLocalCatalog = ({
  q,
  category,
  sort,
  page,
  maxPrice,
}: CatalogFilters): CatalogResponse => {
  const filtered = nfts
    .filter((nft) =>
      `${nft.name} ${nft.collection} ${nft.category}`.toLowerCase().includes(q.toLowerCase()),
    )
    .filter((nft) => !category || nft.category === category)
    .filter((nft) => Number(nft.price) <= maxPrice)
  const sorted = [...filtered].sort((a, b) =>
    sort === 'price'
      ? Number(a.price) - Number(b.price)
      : sort === 'popular'
        ? b.reviews - a.reviews
        : a.id.localeCompare(b.id),
  )
  const pageSize = 6
  const start = (Math.max(1, page) - 1) * pageSize
  return {
    items: sorted.slice(start, start + pageSize),
    total: sorted.length,
    page: Math.max(1, page),
    pageSize,
    hasNext: start + pageSize < sorted.length,
  }
}
function useNFTs(filters: CatalogFilters) {
  const localLatency = localStorage.getItem('kurio-mock-latency')
  const localFailure = localStorage.getItem('kurio-mock-failure')
  const useLocalPlaceholder =
    import.meta.env.VITE_MOCK_LATENCY !== 'slow' &&
    import.meta.env.VITE_MOCK_FAILURE !== 'true' &&
    localLatency !== 'slow' &&
    localFailure !== 'true'
  return useQuery({
    queryKey: ['nfts', filters],
    queryFn: async () => {
      await waitForNetworkReady()
      return (await api.get<CatalogResponse>('/nfts', { params: { ...filters, pageSize: 6 } })).data
    },
    placeholderData: useLocalPlaceholder ? () => getLocalCatalog(filters) : undefined,
  })
}
function useNFT(id: string) {
  const useLocalPlaceholder =
    import.meta.env.VITE_MOCK_LATENCY !== 'slow' &&
    import.meta.env.VITE_MOCK_FAILURE !== 'true' &&
    localStorage.getItem('kurio-mock-latency') !== 'slow' &&
    localStorage.getItem('kurio-mock-failure') !== 'true'
  return useQuery({
    queryKey: ['nft', id],
    queryFn: async () => {
      await waitForNetworkReady()
      const response = await api.get<NFT>(`/nfts/${id}`)
      return response.data
    },
    placeholderData: useLocalPlaceholder ? () => nfts.find((item) => item.id === id) : undefined,
  })
}

const formatEth = (value: string | number) =>
  `${Number(value).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} ETH`
const getNFT = (id: string) => nfts.find((nft) => nft.id === id) ?? nfts[0]

function AppShell() {
  const { cart, user, authMode, toast, setAuthMode, clearToast } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(clearToast, 4200)
    return () => window.clearTimeout(timeout)
  }, [toast, clearToast])
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="Kurio, início">
          KURIO
        </Link>
        <nav
          className={menuOpen ? 'main-nav is-open' : 'main-nav'}
          aria-label="Navegação principal"
        >
          <Link to="/" activeProps={{ className: 'active' }}>
            Início
          </Link>
          <Link to="/market" activeProps={{ className: 'active' }}>
            Mercado
          </Link>
          <Link to="/profile" activeProps={{ className: 'active' }}>
            Criadores
          </Link>
          <a href="#about">Aprenda</a>
        </nav>
        <div className="header-actions">
          <Link to="/market" className="icon-button desktop-only" aria-label="Buscar NFTs">
            <Search size={21} />
          </Link>
          <Link to="/cart" className="cart-button" aria-label={`Carrinho com ${totalItems} itens`}>
            <ShoppingCart size={21} />
            <span>{totalItems}</span>
          </Link>
          {user ? (
            <Link className="account-chip" to="/profile">
              <span className="avatar">{user.avatar}</span>
              <span className="desktop-only">{user.username}</span>
            </Link>
          ) : (
            <button
              className="button button-small desktop-only"
              onClick={() => setAuthMode('login')}
            >
              <LogIn size={16} /> Entrar
            </button>
          )}
          <button
            className="icon-button menu-toggle"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu size={22} />
          </button>
        </div>
      </header>
      <main id="main-content" key={location.pathname}>
        <Outlet />
      </main>
      <nav className="mobile-bottom-nav" aria-label="Navegação mobile">
        <Link
          to="/"
          className="mobile-bottom-nav__item"
          activeProps={{ className: 'mobile-bottom-nav__item is-active' }}
          aria-label="Início"
        >
          <House size={18} />
        </Link>
        <Link to="/profile" className="mobile-bottom-nav__item" aria-label="Favoritos">
          <Heart size={18} />
        </Link>
        <Link to="/market" className="mobile-bottom-nav__scan" aria-label="Explorar mercado">
          <ScanLine size={19} />
        </Link>
        <Link
          to="/cart"
          className="mobile-bottom-nav__item"
          aria-label={`Carrinho com ${totalItems} itens`}
        >
          <ShoppingCart size={18} />
          <span className="mobile-bottom-nav__badge">{totalItems}</span>
        </Link>
        <Link to="/profile" className="mobile-bottom-nav__item" aria-label="Meu perfil">
          <UserRound size={18} />
        </Link>
      </nav>
      <footer className="site-footer">
        <span>© 2026 KURIO</span>
        <span>Arte digital com procedência.</span>
        <span className="footer-links">
          <a href="#about">Manifesto</a>
          <a href="#about">Termos</a>
          <a href="#about">Suporte</a>
        </span>
      </footer>
      {authMode && <AuthModal />}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} /> {toast}
          <button onClick={clearToast} aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

function Hero() {
  const navigate = useNavigate()
  return (
    <section className="hero section-container">
      <div className="hero-copy">
        <p className="eyebrow">Bem-vindo à Kurio</p>
        <h1>
          SEJA DONO DO
          <br />
          <span>FUTURO</span> DA ARTE
          <br />
          DIGITAL
        </h1>
        <p className="hero-description">
          Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital
          rara, apoie artistas e tenha uma parte da cultura da internet.
        </p>
        <Button type="button" onClick={() => navigate({ to: '/market' })}>
          Explorar <ArrowRight size={17} />
        </Button>
        <div className="hero-dots">
          <i className="active" />
          <i />
          <i />
        </div>
      </div>
      <div className="hero-art">
        <img
          src={imageSet.emerald}
          alt="Retrato de um macaco colecionável com jaqueta verde e óculos"
          width="900"
          height="900"
          {...{ fetchpriority: 'high' }}
        />
        <span className="hero-stamp">
          <Sparkles size={14} /> EDIÇÃO SELECIONADA
        </span>
      </div>
    </section>
  )
}

function NFTCard({ nft, compact = false }: { nft: NFT; compact?: boolean }) {
  const { favorites, toggleFavorite } = useApp()
  const isFavorite = favorites.includes(nft.id)
  return (
    <article className={compact ? 'nft-card compact' : 'nft-card'}>
      <div className="card-image-wrap">
        <Link to="/nft/$nftId" params={{ nftId: nft.id }}>
          <img src={nft.image} alt={`${nft.name} ${nft.number}`} loading="lazy" />
        </Link>
        <button
          className={isFavorite ? 'heart-button is-active' : 'heart-button'}
          onClick={() => toggleFavorite(nft.id)}
          aria-label={
            isFavorite ? `Remover ${nft.name} dos favoritos` : `Adicionar ${nft.name} aos favoritos`
          }
        >
          <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
        {nft.rarity === 'Raro' && <span className="rarity-tag">RARO</span>}
      </div>
      <div className="card-info">
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="card-title">
          {nft.name} <span>{nft.number}</span>
        </Link>
        <div className="card-meta">
          <span>{nft.collection}</span>
          <strong>{formatEth(nft.price)}</strong>
        </div>
      </div>
    </article>
  )
}

function useUrlQuery() {
  const [, refresh] = useState(0)
  useEffect(() => {
    const onPopState = () => refresh((value) => value + 1)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const params = new URLSearchParams(window.location.search)
  const update = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(window.location.search)
    Object.entries(changes).forEach(([key, value]) =>
      value === undefined || value === '' ? next.delete(key) : next.set(key, String(value)),
    )
    window.history.pushState(
      null,
      '',
      `${window.location.pathname}${next.toString() ? `?${next}` : ''}`,
    )
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  return { params, update }
}

function HomePage() {
  const { params, update } = useUrlQuery()
  const search = params.get('q') ?? ''
  const activeTab = params.get('tab') ?? 'Todos os NFTs'
  const sort = params.get('sort') ?? 'recent'
  const category = params.get('category') ?? ''
  const page = Number(params.get('page') ?? 1)
  const maxPrice = Number(params.get('maxPrice') ?? 10)
  const {
    data: catalog,
    isPending,
    isFetching,
    isFetched,
    isError,
    refetch,
  } = useNFTs({
    q: search,
    category,
    sort: activeTab === 'Em alta' ? 'popular' : sort,
    page,
    maxPrice,
  })
  const items = catalog?.items ?? []
  const [searchInput, setSearchInput] = useState(search)
  useEffect(() => setSearchInput(search), [search])
  const filtered = useMemo(
    () =>
      items
        .filter((nft) => activeTab !== 'Novos lançamentos' || nft.id !== 'emerald-ape-042')
        .filter((nft) => activeTab !== 'Em alta' || nft.rarity === 'Raro'),
    [items, activeTab],
  )
  const updateSearch = (value: string) => {
    setSearchInput(value)
    update({ q: value, page: 1 })
  }
  return (
    <>
      <Hero />
      <section className="catalog section-container" id="catalog">
        <div className="catalog-toolbar">
          <div className="mobile-search">
            <Search size={17} />
            <input
              value={searchInput}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Explorar coleções"
              aria-label="Buscar NFTs"
            />
          </div>
          <div className="tabs" role="tablist">
            {['Todos os NFTs', 'Novos lançamentos', 'Em alta'].map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={activeTab === tab ? 'active' : ''}
                onClick={() => update({ tab: tab === 'Todos os NFTs' ? undefined : tab, page: 1 })}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="sort-control">
            <label htmlFor="sort">Ordenar por:</label>
            <select
              id="sort"
              value={sort}
              onChange={(event) => update({ sort: event.target.value, page: 1 })}
            >
              <option value="recent">Listados recentemente</option>
              <option value="price">Menor preço</option>
            </select>
            <ChevronDown size={15} />
          </div>
          <button className="filter-button mobile-only" aria-label="Abrir filtros">
            <SlidersHorizontal size={18} />
          </button>
        </div>
        <div className="catalog-layout">
          <aside className="filters-panel">
            <div className="filter-heading">
              <h2>Coleções</h2>
              <SlidersHorizontal size={16} />
            </div>
            {['Arte digital', 'Fotografia', 'Música', 'Colecionáveis'].map((collection, index) => (
              <button
                key={collection}
                className={category === collection ? 'filter-row active' : 'filter-row'}
                onClick={() =>
                  update({ category: category === collection ? undefined : collection, page: 1 })
                }
              >
                <span>{collection}</span>
                <span>({[33, 12, 8, 22][index]})</span>
              </button>
            ))}
            <div className="filter-divider" />
            <p className="filter-label">Faixa de preço</p>
            <div className="price-range">
              <span>0 ETH</span>
              <span>{maxPrice} ETH</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={maxPrice}
              onChange={(event) => update({ maxPrice: event.target.value, page: 1 })}
              aria-label="Preço máximo"
            />
          </aside>
          <div className="catalog-grid">
            {isPending ? (
              Array.from({ length: 6 }).map((_, index) => (
                <div className="nft-card skeleton-card" key={index}>
                  <div className="skeleton" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line short" />
                </div>
              ))
            ) : isError ? (
              <div className="empty-state">
                <Zap size={30} />
                <h3>Não foi possível carregar o catálogo</h3>
                <p>Verifique a conexão e tente novamente.</p>
                <button className="button" onClick={() => refetch()}>
                  Tentar novamente
                </button>
              </div>
            ) : (
              filtered.map((nft) => <NFTCard key={nft.id} nft={nft} />)
            )}
            {!isPending && !isError && filtered.length === 0 && (
              <div className="empty-state">
                <Search size={30} />
                <h3>Nenhuma peça encontrada</h3>
                <p>Tente buscar por outra coleção ou categoria.</p>
                <button
                  className="button button-outline"
                  onClick={() =>
                    update({
                      q: undefined,
                      category: undefined,
                      tab: undefined,
                      sort: undefined,
                      page: undefined,
                      maxPrice: undefined,
                    })
                  }
                >
                  Limpar busca
                </button>
              </div>
            )}
          </div>
        </div>
        {!isError && !isPending && (
          <nav className="pagination" aria-label="Paginação do catálogo">
            <button
              className="button button-outline button-small"
              disabled={page <= 1}
              onClick={() => update({ page: page - 1 })}
            >
              <ArrowLeft size={15} /> Anterior
            </button>
            <span>
              Página {page} de{' '}
              {Math.max(1, Math.ceil((catalog?.total ?? 0) / (catalog?.pageSize ?? 6)))}
            </span>
            <button
              className="button button-outline button-small"
              disabled={!catalog?.hasNext}
              onClick={() => update({ page: page + 1 })}
            >
              Próxima <ArrowRight size={15} />
            </button>
          </nav>
        )}
        {isFetching && isFetched && !isPending && (
          <p className="catalog-refresh" role="status">
            Atualizando catálogo…
          </p>
        )}
      </section>
    </>
  )
}

function MarketPage() {
  return (
    <div className="page section-container market-page">
      <div className="breadcrumb">
        <Link to="/">Início</Link>
        <span>/</span>
        <strong>Mercado</strong>
      </div>
      <h1 className="page-title">Explore o mercado</h1>
      <p className="page-lede">
        Peças digitais escolhidas para quem coleciona cultura, não apenas pixels.
      </p>
      <HomePage />
    </div>
  )
}

function DetailPage() {
  const { nftId } = detailRoute.useParams()
  const { data: fetchedNft, isPending, isError } = useNFT(nftId)
  const localNft = nfts.find((item) => item.id === nftId)
  const localPlaceholderEnabled =
    import.meta.env.VITE_MOCK_LATENCY !== 'slow' &&
    import.meta.env.VITE_MOCK_FAILURE !== 'true' &&
    localStorage.getItem('kurio-mock-latency') !== 'slow' &&
    localStorage.getItem('kurio-mock-failure') !== 'true'
  const nft = fetchedNft ?? (localPlaceholderEnabled ? localNft : undefined)
  const { favorites, toggleFavorite, addToCart } = useApp()
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  if (!localNft && isPending) return <NotFound title="Esta peça não existe" />
  if (isPending && !nft)
    return (
      <div
        className="page detail-page section-container detail-skeleton"
        aria-label="Carregando detalhes do NFT"
      >
        <div className="skeleton detail-skeleton-image" />
        <div>
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
          <div className="skeleton detail-skeleton-copy" />
        </div>
      </div>
    )
  if (isError || !nft) return <NotFound title="Esta peça não existe" />
  const gallery = [nft.image, imageSet.emerald, imageSet.ivory]
  const isFavorite = favorites.includes(nft.id)
  return (
    <div className="page detail-page section-container">
      <div className="breadcrumb">
        <Link to="/">Início</Link>
        <span>/</span>
        <Link to="/market">Mercado</Link>
        <span>/</span>
        <strong>{nft.name}</strong>
      </div>
      <div className="detail-layout">
        <div className="detail-gallery">
          <div className="gallery-thumbs">
            {gallery.map((image, index) => (
              <button
                key={`${nft.id}-${index}`}
                aria-label={`Ver imagem ${index + 1} de ${nft.name}`}
                aria-pressed={index === activeImage}
                className={index === activeImage ? 'active' : ''}
                onClick={() => setActiveImage(index)}
              >
                <img src={image} alt="" width="120" height="120" />
              </button>
            ))}
          </div>
          <div className="detail-image">
            <img
              src={gallery[activeImage]}
              alt={`${nft.name}, obra digital`}
              width="900"
              height="900"
              {...{ fetchpriority: 'high' }}
            />
            <button className="zoom-button" aria-label="Ampliar imagem">
              <Eye size={18} />
            </button>
          </div>
        </div>
        <div className="detail-copy">
          <div className="detail-title-row">
            <div>
              <p className="eyebrow">{nft.collection}</p>
              <h1>
                {nft.name} <span>{nft.number}</span>
              </h1>
            </div>
            <div className="rating">
              <Sparkles size={17} fill="currentColor" /> {nft.rating.toFixed(1)}{' '}
              <small>({nft.reviews})</small>
            </div>
          </div>
          <div className="detail-price">{formatEth(nft.price)}</div>
          <div className="rule" />
          <h2>Sobre este NFT:</h2>
          <p className="detail-description">{nft.description}</p>
          <h2>Edição:</h2>
          <div className="edition-pills">
            <span>1/1</span>
            <span>1/10</span>
            <span className="selected">{nft.edition}</span>
            <span className="open-pill">ABERTA</span>
          </div>
          <div className="purchase-row">
            <div className="quantity">
              <button
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                aria-label="Diminuir quantidade"
              >
                <Minus size={17} />
              </button>
              <strong>{quantity}</strong>
              <button
                onClick={() => setQuantity((current) => Math.min(nft.stock, current + 1))}
                aria-label="Aumentar quantidade"
              >
                <Plus size={17} />
              </button>
            </div>
            <button className="button" onClick={() => addToCart(nft.id, quantity)}>
              Comprar
            </button>
            <button
              aria-label={
                isFavorite
                  ? `Remover ${nft.name} dos favoritos`
                  : `Adicionar ${nft.name} aos favoritos`
              }
              className={isFavorite ? 'button button-outline is-favorite' : 'button button-outline'}
              onClick={() => toggleFavorite(nft.id)}
            >
              <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />{' '}
              <span className="desktop-only">Favoritar</span>
            </button>
          </div>
          <div className="detail-facts">
            <p>
              ID do token: <strong>{nft.number}</strong>
            </p>
            <p>
              Coleção: <strong>{nft.collection}</strong>
            </p>
            <p>
              Atributos: <strong>{nft.attributes.join(', ')}</strong>
            </p>
          </div>
          <div className="share-line">
            Compartilhar este NFT:{' '}
            <button aria-label="Copiar link">
              <Copy size={15} />
            </button>
            <button aria-label="𝕏, compartilhar no X">𝕏</button>
          </div>
        </div>
      </div>
      <section className="detail-tabs">
        <button className="active">Detalhes do NFT</button>
        <button>Avaliações de colecionadores ({nft.reviews})</button>
      </section>
    </div>
  )
}

function CartPage() {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    user,
    setAuthMode,
    couponDiscount,
    setCouponDiscount,
  } = useApp()
  const navigate = useNavigate()
  const [coupon, setCoupon] = useState('')
  const [couponError, setCouponError] = useState('')
  const [couponLoading, setCouponLoading] = useState(false)
  const subtotal = cart.reduce(
    (sum, item) => addEth(sum, multiplyEth(getNFT(item.nftId).price, item.quantity)),
    '0',
  )
  const total = addEth(subtractEth(subtotal, couponDiscount), cart.length ? '0.016' : '0')
  const applyCoupon = async () => {
    setCouponLoading(true)
    setCouponError('')
    try {
      const response = await api.post<{ discountRate: string }>('/coupons/validate', {
        code: coupon,
      })
      const rateUnits = ethToUnits(response.data.discountRate)
      setCouponDiscount(unitsToEth((ethToUnits(subtotal) * rateUnits) / ETH_SCALE))
    } catch (error) {
      setCouponDiscount('0')
      setCouponError(axiosErrorMessage(error, 'Código inválido ou expirado.'))
    } finally {
      setCouponLoading(false)
    }
  }
  const removeCoupon = () => {
    setCouponDiscount('0')
    setCoupon('')
    setCouponError('')
  }
  return (
    <div className="page section-container cart-page">
      <div className="breadcrumb">
        <Link to="/">Início</Link>
        <span>/</span>
        <Link to="/market">Mercado</Link>
        <span>/</span>
        <strong>Carrinho</strong>
      </div>
      <div className="cart-layout">
        <section>
          <div className="section-heading">
            <h1>Carrinho de NFTs</h1>
            <span>{cart.length} peças</span>
          </div>
          <div className="cart-table-head">
            <span>NFTs</span>
            <span>Preço</span>
            <span>Edições</span>
            <span>Total</span>
            <span />
          </div>
          {cart.length === 0 ? (
            <div className="empty-state cart-empty">
              <PackageCheck size={38} />
              <h2>Seu carrinho está leve</h2>
              <p>Explore o mercado e encontre sua próxima peça.</p>
              <Link className="button" to="/market">
                Explorar mercado
              </Link>
            </div>
          ) : (
            <div className="cart-items">
              {cart.map((item) => {
                const nft = getNFT(item.nftId)
                return (
                  <div className="cart-item" key={item.nftId}>
                    <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="cart-art">
                      <img src={nft.image} alt="" />
                    </Link>
                    <div className="cart-name">
                      <strong>
                        {nft.name} {nft.number}
                      </strong>
                      <small>ID do token: {nft.number}</small>
                    </div>
                    <span className="cart-price">{formatEth(nft.price)}</span>
                    <div className="quantity small">
                      <button
                        onClick={() => updateQuantity(nft.id, item.quantity - 1)}
                        aria-label="Diminuir quantidade"
                      >
                        <Minus size={14} />
                      </button>
                      <strong>{item.quantity}</strong>
                      <button
                        onClick={() => updateQuantity(nft.id, item.quantity + 1)}
                        aria-label="Aumentar quantidade"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <strong className="cart-total">
                      {formatEth(multiplyEth(nft.price, item.quantity))}
                    </strong>
                    <button
                      className="icon-button remove-button"
                      onClick={() => removeFromCart(nft.id)}
                      aria-label={`Remover ${nft.name}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>
        <aside className="summary-card">
          <h2>Resumo da carteira</h2>
          <label className="summary-label" htmlFor="coupon">
            Código promocional
          </label>
          <div className="coupon-row">
            <input
              id="coupon"
              placeholder="Digite o código promocional..."
              value={coupon}
              onChange={(event) => setCoupon(event.target.value)}
            />
            <button disabled={couponLoading || !coupon.trim()} onClick={applyCoupon}>
              {couponLoading ? 'Validando…' : 'Aplicar'}
            </button>
            {couponDiscount !== '0' && (
              <button type="button" onClick={removeCoupon}>
                Remover
              </button>
            )}
          </div>
          {couponError && (
            <p className="coupon-error" role="alert">
              {couponError}
            </p>
          )}
          <div className="summary-lines">
            <div>
              <span>Subtotal</span>
              <strong>{formatEth(subtotal)}</strong>
            </div>
            <div>
              <span>Desconto do lançamento</span>
              <strong>(-) {formatEth(couponDiscount)}</strong>
            </div>
            <div>
              <span>
                Taxa de rede <small>Taxa estimada</small>
              </span>
              <strong>{formatEth(cart.length ? '0.016' : '0')}</strong>
            </div>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <strong>{formatEth(total)}</strong>
          </div>
          <button
            className="button full"
            disabled={!cart.length}
            onClick={() => {
              if (!user) {
                setAuthMode('login')
                return
              }
              navigate({ to: '/checkout' })
            }}
          >
            {user ? 'Conectar e finalizar' : 'Entrar para finalizar'}
          </button>
          <Link className="continue-link" to="/market">
            Continuar explorando
          </Link>
        </aside>
      </div>
      <section className="recommendations">
        <div className="section-heading">
          <h2>Colecionadores também viram</h2>
          <ArrowRight size={18} />
        </div>
        <div className="recommendation-grid">
          {nfts.slice(2, 6).map((nft) => (
            <NFTCard key={nft.id} nft={nft} compact />
          ))}
        </div>
      </section>
    </div>
  )
}

function CheckoutPage() {
  const { user, cart, checkout, setAuthMode, couponDiscount } = useApp()
  const navigate = useNavigate()
  const userKey = user?.email ?? 'guest'
  const { data: savedWallets = [] } = useQuery({
    queryKey: ['wallets', userKey],
    queryFn: async () => {
      await waitForNetworkReady()
      return (
        await api.get<Array<Record<string, string>>>('/wallets', {
          headers: { 'X-Demo-User': userKey },
        })
      ).data
    },
    enabled: Boolean(user),
  })
  const [wallet, setWallet] = useState('MetaMask')
  const [network, setNetwork] = useState('Ethereum')
  const [walletConnected, setWalletConnected] = useState(() => {
    const scenario = localStorage.getItem('kurio-mock-wallet-status')
    return scenario !== 'rejected' && scenario !== 'disconnected'
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  if (!user)
    return (
      <div className="page section-container auth-required">
        <LockKeyhole size={34} />
        <h1>Entre para concluir sua compra</h1>
        <p>Seu carrinho está salvo. Faça login e retome o checkout de onde parou.</p>
        <button className="button" onClick={() => setAuthMode('login')}>
          Entrar na Kurio
        </button>
      </div>
    )
  const subtotal = cart.reduce(
    (sum, item) => addEth(sum, multiplyEth(getNFT(item.nftId).price, item.quantity)),
    '0',
  )
  const total = addEth(subtractEth(subtotal, couponDiscount), '0.016')
  const walletOptions = [
    ...new Set([
      ...savedWallets.map((saved) => saved.label).filter(Boolean),
      'MetaMask',
      'WalletConnect',
      'Coinbase Wallet',
    ]),
  ]
  const confirmPurchase = async () => {
    if (!walletConnected) {
      setError('Conecte uma carteira antes de confirmar a compra.')
      return
    }
    setSubmitting(true)
    setError('')
    const result = await checkout(wallet, network)
    setSubmitting(false)
    if (result) {
      setError(result)
      return
    }
    navigate({ to: '/order-confirmation' })
  }
  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void confirmPurchase()
  }
  const connectWallet = () => {
    if (localStorage.getItem('kurio-mock-wallet-status') === 'rejected') {
      setWalletConnected(false)
      setError('A carteira recusou a conexão. Escolha outra carteira ou tente novamente.')
      return
    }
    setWalletConnected(true)
    setError('')
  }
  return (
    <div className="page section-container checkout-page">
      <div className="breadcrumb">
        <Link to="/cart">Carrinho</Link>
        <span>/</span>
        <strong>Pagamento</strong>
      </div>
      <form className="checkout-layout" onSubmit={submitForm}>
        <section className="checkout-form">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Etapa 1 de 2</p>
              <h1>Perfil do colecionador</h1>
            </div>
            <span className="checkout-status">
              <Check size={15} /> Sessão ativa
            </span>
          </div>
          <div className="form-grid">
            <Field label="Nome de exibição" value={user.displayName} />
            <Field label="Nome de usuário" value={user.username} />
            <Field
              label="Rede"
              as="select"
              value={network}
              onChange={(event) => setNetwork(event.target.value)}
              options={['Ethereum', 'Polygon', 'Base']}
            />
            <Field label="Nome do perfil" placeholder="Como você quer ser encontrado?" />
            <Field label="Endereço da carteira" placeholder="Endereço 0x da carteira" />
            <Field required={false} label="ENS ou carteira secundária" placeholder="Opcional" />
            <Field
              label="Tipo de carteira"
              as="select"
              options={['MetaMask', 'WalletConnect', 'Coinbase Wallet']}
            />
            <Field required={false} label="Código de indicação" placeholder="Opcional" />
            <Field label="E-mail" value={user.email} type="email" />
            <Field required={false} label="Nome ENS" placeholder="Seu nome .eth" />
          </div>
          <label className="check-row">
            <input type="checkbox" defaultChecked /> Usar minha carteira principal para esta compra.
          </label>
          <label className="field full-field">
            <span>
              Observação do colecionador <small>(opcional)</small>
            </span>
            <textarea rows={4} placeholder="Escreva uma mensagem para acompanhar seu pedido..." />
          </label>
        </section>
        <aside className="checkout-summary">
          <h2>Seus NFTs</h2>
          {cart.map((item) => {
            const nft = getNFT(item.nftId)
            return (
              <div className="checkout-item" key={item.nftId}>
                <img src={nft.image} alt="" />
                <div>
                  <strong>
                    {nft.name} <small>(x {item.quantity})</small>
                  </strong>
                  <span>ID do token: {nft.number}</span>
                </div>
                <b>{formatEth(multiplyEth(nft.price, item.quantity))}</b>
              </div>
            )
          })}
          <div className="summary-lines">
            <div>
              <span>Subtotal</span>
              <strong>{formatEth(subtotal)}</strong>
            </div>
            <div>
              <span>Desconto do lançamento</span>
              <strong>(-) {formatEth(couponDiscount)}</strong>
            </div>
            <div>
              <span>
                Taxa de rede <small>Taxa estimada</small>
              </span>
              <strong>0.016 ETH</strong>
            </div>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <strong>{formatEth(total)}</strong>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="button full"
            disabled={submitting || !cart.length || !walletConnected}
          >
            <WalletCards size={18} /> {submitting ? 'Confirmando…' : 'Confirmar compra'}
          </button>
          <p className="secure-note">
            <LockKeyhole size={14} /> Simulação segura. Nenhuma transação real será enviada.
          </p>
          <div className="wallet-picker">
            <p>Carteira e rede</p>
            {walletOptions.map((name) => (
              <button
                type="button"
                key={name}
                className={wallet === name ? 'selected' : ''}
                onClick={() => {
                  setWallet(name)
                  setWalletConnected(false)
                }}
              >
                <span>{name.slice(0, 1)}</span>
                {name}
                <i />
              </button>
            ))}
            <div
              className={walletConnected ? 'wallet-connection connected' : 'wallet-connection'}
              role="status"
            >
              <span>{walletConnected ? 'Carteira conectada' : 'Carteira desconectada'}</span>
              {walletConnected ? (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setWalletConnected(false)}
                >
                  Desconectar
                </button>
              ) : (
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={connectWallet}
                >
                  Conectar {wallet}
                </button>
              )}
            </div>
          </div>
        </aside>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  placeholder,
  type = 'text',
  as,
  options,
  required = true,
  onChange,
}: {
  label: string
  value?: string
  placeholder?: string
  type?: string
  as?: 'select'
  options?: string[]
  required?: boolean
  onChange?: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <em>*</em>}
      </span>
      {as === 'select' ? (
        <select
          required={required}
          value={value}
          onChange={onChange}
          defaultValue={value ? undefined : options?.[0]}
        >
          {options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input required={required} type={type} defaultValue={value} placeholder={placeholder} />
      )}
    </label>
  )
}

function ConfirmationPage() {
  const { order } = useApp()
  if (!order) return <NotFound title="Nenhum pedido recente" />
  if (order.status !== 'confirmed')
    return (
      <NotFound title={order.status === 'pending' ? 'Pedido pendente' : 'Pagamento recusado'} />
    )
  return (
    <div className="page section-container confirmation-page">
      <div className="confirmation-card">
        <div className="thank-you">
          <span>
            THANK
            <br />
            YOU
          </span>
        </div>
        <h1>Seus NFTs agora estão na sua carteira</h1>
        <div className="receipt-meta">
          <div>
            <small>ID da transação</small>
            <strong>{order.id}</strong>
          </div>
          <div>
            <small>Data</small>
            <strong>{order.createdAt}</strong>
          </div>
          <div>
            <small>Total</small>
            <strong>{formatEth(order.total)}</strong>
          </div>
          <div>
            <small>Carteira</small>
            <strong>{order.wallet}</strong>
          </div>
        </div>
        <div className="receipt-body">
          <h2>Detalhes da transação</h2>
          {order.items.map((item) => {
            const nft = getNFT(item.nftId)
            return (
              <div className="receipt-item" key={item.nftId}>
                <img src={nft.image} alt="" />
                <div>
                  <strong>
                    {nft.name} {nft.number}
                  </strong>
                  <span>ID do token: {nft.number}</span>
                </div>
                <span>(x {item.quantity})</span>
                <b>{formatEth(multiplyEth(nft.price, item.quantity))}</b>
              </div>
            )
          })}
          <div className="summary-total">
            <span>Total</span>
            <strong>{formatEth(order.total)}</strong>
          </div>
        </div>
        <div className="confirmation-actions">
          <Link className="button" to="/market">
            Continuar explorando
          </Link>
          <button
            className="button button-outline"
            onClick={() => navigator.clipboard?.writeText(order.id)}
          >
            <Copy size={17} /> Copiar transação
          </button>
        </div>
      </div>
    </div>
  )
}

function AuthModal() {
  const { authMode, setAuthMode, login, signup } = useApp()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState(authMode ?? 'login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    setMode(authMode ?? 'login')
    window.setTimeout(() => dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus(), 0)
  }, [authMode])
  const keepFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return
    const elements = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>('button, input, [href], select, textarea'),
    ).filter((element) => !element.hasAttribute('disabled'))
    const first = elements[0]
    const last = elements[elements.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const result =
      mode === 'login'
        ? await login(email, password)
        : confirmation !== password
          ? 'As senhas não conferem.'
          : await signup(username, email, password)
    setLoading(false)
    if (result) setError(result)
  }
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setAuthMode(null)
      }}
    >
      <div
        ref={dialogRef}
        onKeyDown={keepFocus}
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <button className="modal-close" onClick={() => setAuthMode(null)} aria-label="Fechar">
          <X size={20} />
        </button>
        <div className="auth-brand">KURIO</div>
        <h2 className="auth-mobile-title">
          {mode === 'login' ? 'Entrar' : 'Criar perfil de colecionador'}
        </h2>
        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>
            Entrar
          </button>
          <span>|</span>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>
            Criar conta
          </button>
        </div>
        <p id="auth-title" className="auth-intro">
          {mode === 'login'
            ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.'
            : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
        </p>
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <input
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Nome de usuário"
              aria-label="Nome de usuário"
            />
          )}
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="contato@email.com"
            aria-label="E-mail"
          />
          <input
            required
            minLength={6}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Senha"
            aria-label="Senha"
          />
          {mode === 'signup' && (
            <input
              required
              minLength={6}
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Confirmar senha"
              aria-label="Confirmar senha"
            />
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button full" disabled={loading}>
            {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        {mode === 'login' && <button className="forgot-password">Esqueceu a senha?</button>}
        <button
          type="button"
          className="auth-switch"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? 'Novo na Kurio? Crie uma conta' : 'Já tem uma conta? Entre'}
        </button>
        <div className="social-divider">
          <span>Ou continue com</span>
        </div>
        <button className="social-button">
          G <span>Continuar com Google</span>
        </button>
        <button className="social-button">
          f <span>Continuar com Facebook</span>
        </button>
      </div>
    </div>
  )
}

function ProfilePage({ wallets = false }: { wallets?: boolean }) {
  const { user, logout, setAuthMode } = useApp()
  const [saved, setSaved] = useState(false)
  if (!user)
    return (
      <div className="page section-container auth-required">
        <UserRound size={34} />
        <h1>Seu perfil começa aqui</h1>
        <p>Entre para editar seus dados, carteiras e favoritos.</p>
        <button className="button" onClick={() => setAuthMode('login')}>
          Entrar na Kurio
        </button>
      </div>
    )
  return (
    <div className="page section-container profile-page">
      <div className="profile-layout">
        <aside className="profile-sidebar">
          <h2>Meu perfil</h2>
          {[
            'Dados do perfil',
            'Carteiras',
            'Atividade',
            'Lista de interesse',
            'Ofertas',
            'Arquivos baixados',
            'Suporte',
          ].map((item, index) => (
            <Link
              key={item}
              className={wallets === (index === 1) ? 'active' : ''}
              to={index === 1 ? '/wallets' : '/profile'}
            >
              {index === 0 ? (
                <UserRound size={17} />
              ) : index === 1 ? (
                <WalletCards size={17} />
              ) : (
                <Sparkles size={17} />
              )}
              {item}
            </Link>
          ))}
          <button onClick={logout}>
            <LogIn size={17} /> Sair
          </button>
        </aside>
        <section className="profile-content">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Minha conta</p>
              <h1>{wallets ? 'Carteira principal' : 'Perfil do colecionador'}</h1>
              <p className="page-lede">
                {wallets
                  ? 'Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.'
                  : 'Mantenha seus dados e preferências sempre atualizados.'}
              </p>
            </div>
          </div>
          {wallets ? (
            <WalletForm onSaved={() => setSaved(true)} />
          ) : (
            <ProfileForm user={user} onSaved={() => setSaved(true)} />
          )}
          {saved && (
            <p className="save-message">
              <Check size={16} /> Alterações salvas nesta sessão.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
function ProfileForm({ user, onSaved }: { user: User; onSaved: () => void }) {
  const { updateUser } = useApp()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [username, setUsername] = useState(user.username)
  const [avatar, setAvatar] = useState(user.avatar)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const requestConfig = { headers: { 'X-Demo-User': user.email } }
    try {
      const response = await api.put<User>(
        '/profile',
        { ...user, displayName, username, avatar },
        requestConfig,
      )
      updateUser(response.data)
      if (newPassword)
        await api.put('/profile/password', { currentPassword, newPassword }, requestConfig)
      onSaved()
    } catch (requestError) {
      setError(axiosErrorMessage(requestError, 'Não foi possível salvar as alterações.'))
    } finally {
      setLoading(false)
    }
  }
  return (
    <form className="profile-form" onSubmit={save}>
      <div className="form-grid">
        <label className="field">
          <span>
            Nome de exibição<em>*</em>
          </span>
          <input
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>
            Nome de usuário<em>*</em>
          </span>
          <input
            required
            minLength={3}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input value={user.email} readOnly />
        </label>
        <label className="field">
          <span>Avatar</span>
          <input maxLength={2} value={avatar} onChange={(event) => setAvatar(event.target.value)} />
        </label>
      </div>
      <h2 className="form-section-title">Alterar senha</h2>
      <div className="form-grid">
        <label className="field">
          <span>Senha atual</span>
          <input
            type="password"
            minLength={6}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Nova senha</span>
          <input
            type="password"
            minLength={6}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={loading}>
        {loading ? 'Salvando…' : 'Salvar alterações'}
      </button>
    </form>
  )
}
function WalletForm({ onSaved }: { onSaved: () => void }) {
  const { user } = useApp()
  const userKey = user?.email ?? 'guest'
  const requestConfig = { headers: { 'X-Demo-User': userKey } }
  const { data: savedWallets = [], refetch } = useQuery({
    queryKey: ['wallets', userKey],
    queryFn: async () => {
      await waitForNetworkReady()
      return (await api.get<Array<Record<string, string>>>('/wallets', requestConfig)).data
    },
  })
  const [editingId, setEditingId] = useState('')
  const [label, setLabel] = useState('')
  const [network, setNetwork] = useState('Ethereum')
  const [address, setAddress] = useState('')
  const [walletType, setWalletType] = useState('MetaMask')
  const [ens, setEns] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const reset = () => {
    setEditingId('')
    setLabel('')
    setNetwork('Ethereum')
    setAddress('')
    setWalletType('MetaMask')
    setEns('')
  }
  const edit = (wallet: Record<string, string>) => {
    setEditingId(wallet.id ?? '')
    setLabel(wallet.label ?? '')
    setNetwork(wallet.network ?? 'Ethereum')
    setAddress(wallet.address ?? '')
    setWalletType(wallet.type ?? 'MetaMask')
    setEns(wallet.ens ?? '')
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    const payload = { label, network, address, type: walletType, ens }
    try {
      if (editingId) await api.put(`/wallets/${editingId}`, payload, requestConfig)
      else await api.post('/wallets', payload, requestConfig)
      await refetch()
      onSaved()
      reset()
    } catch (requestError) {
      setError(axiosErrorMessage(requestError, 'Não foi possível salvar a carteira.'))
    } finally {
      setLoading(false)
    }
  }
  return (
    <div>
      {savedWallets.length > 0 && (
        <div className="saved-wallets" aria-label="Carteiras cadastradas">
          {savedWallets.map((wallet) => (
            <div className="saved-wallet" key={wallet.id}>
              <div>
                <strong>{wallet.label}</strong>
                <span>
                  {wallet.network} · {wallet.address}
                </span>
              </div>
              <button type="button" className="text-button" onClick={() => edit(wallet)}>
                Editar
              </button>
            </div>
          ))}
        </div>
      )}
      <form className="profile-form" onSubmit={save}>
        <div className="form-grid">
          <label className="field">
            <span>
              Nome da carteira<em>*</em>
            </span>
            <input
              required
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ex.: Principal"
            />
          </label>
          <label className="field">
            <span>
              Rede<em>*</em>
            </span>
            <select value={network} onChange={(event) => setNetwork(event.target.value)}>
              <option>Ethereum</option>
              <option>Polygon</option>
              <option>Base</option>
            </select>
          </label>
          <label className="field">
            <span>
              Endereço da carteira<em>*</em>
            </span>
            <input
              required
              pattern="0x[a-fA-F0-9]{6,}"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="Endereço 0x da carteira"
            />
          </label>
          <label className="field">
            <span>Tipo de carteira</span>
            <select value={walletType} onChange={(event) => setWalletType(event.target.value)}>
              <option>MetaMask</option>
              <option>WalletConnect</option>
              <option>Coinbase Wallet</option>
            </select>
          </label>
          <label className="field">
            <span>Nome ENS</span>
            <input
              value={ens}
              onChange={(event) => setEns(event.target.value)}
              placeholder="Seu nome .eth"
            />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" disabled={loading}>
          {loading ? 'Salvando…' : editingId ? 'Atualizar carteira' : 'Salvar carteira'}
        </button>
        {editingId && (
          <button type="button" className="text-button" onClick={reset}>
            Cancelar edição
          </button>
        )}
      </form>
    </div>
  )
}

function NotFound({ title = 'Página não encontrada' }: { title?: string }) {
  return (
    <div className="page section-container not-found">
      <Sparkles size={34} />
      <h1>{title}</h1>
      <p>Essa rota não existe ou a peça não está mais disponível.</p>
      <Link className="button" to="/">
        Voltar para o início
      </Link>
    </div>
  )
}

function RootLayout() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
const rootRoute = createRootRoute({ component: RootLayout })
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage })
const marketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/market',
  component: MarketPage,
})
const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  component: DetailPage,
})
const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cart',
  component: CartPage,
})
const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  component: CheckoutPage,
})
const confirmationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/order-confirmation',
  component: ConfirmationPage,
})
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: () => <ProfilePage />,
})
const walletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wallets',
  component: () => <ProfilePage wallets />,
})
const routeTree = rootRoute.addChildren([
  indexRoute,
  marketRoute,
  detailRoute,
  cartRoute,
  checkoutRoute,
  confirmationRoute,
  profileRoute,
  walletsRoute,
])
const router = createRouter({ routeTree, defaultNotFoundComponent: () => <NotFound /> })
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const renderApp = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
const bootstrap = async () => {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    networkReady = new Promise<void>((resolve, reject) => {
      let started = false
      const startMocks = () => {
        if (started) return
        started = true
        window.removeEventListener('pointerdown', startMocks)
        window.removeEventListener('keydown', startMocks)
        void import('./mocks/browser')
          .then(({ worker }) =>
            worker.start({
              onUnhandledRequest: 'bypass',
              serviceWorker: { url: '/mockServiceWorker.js' },
            }),
          )
          .then(() => resolve())
          .catch(reject)
      }
      const scenarioNeedsMocks =
        Boolean(
          localStorage.getItem('kurio-mock-latency') ||
            localStorage.getItem('kurio-mock-failure') ||
            localStorage.getItem('kurio-mock-favorites-failure') ||
            localStorage.getItem('kurio-mock-order-timeout') ||
            localStorage.getItem('kurio-mock-order-status') ||
            localStorage.getItem('kurio-mock-wallet-status'),
        ) ||
        import.meta.env.VITE_MOCK_LATENCY ||
        import.meta.env.VITE_MOCK_FAILURE === 'true' ||
        import.meta.env.VITE_MOCK_FAVORITES_FAILURE === 'true' ||
        import.meta.env.VITE_MOCK_ORDER_TIMEOUT === 'true' ||
        Boolean(import.meta.env.VITE_MOCK_ORDER_STATUS)
      if (scenarioNeedsMocks) startMocks()
      else {
        window.addEventListener('pointerdown', startMocks, { once: true, passive: true })
        window.addEventListener('keydown', startMocks, { once: true, passive: true })
      }
      window.setTimeout(startMocks, 15_000)
    })
  }
  renderApp()
}
void bootstrap()
