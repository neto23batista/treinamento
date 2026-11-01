import { StrictMode, createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
import { createRootRoute, createRoute, createRouter, Link, Outlet, RouterProvider, useLocation, useNavigate } from '@tanstack/react-router'
import axios from 'axios'
import { io } from 'socket.io-client'
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, CircleUserRound, Clock3, Copy, Eye, Heart,
  ImagePlus, LockKeyhole, LogIn, Menu, Minus, PackageCheck, Plus, Search, ShoppingCart,
  SlidersHorizontal, Sparkles, Trash2, UserRound, WalletCards, X, Zap,
} from 'lucide-react'
import './styles.css'

type NFT = {
  id: string
  name: string
  number: string
  price: number
  collection: string
  edition: string
  stock: number
  category: string
  rarity: string
  image: string
  description: string
  attributes: string[]
  rating: number
  reviews: number
}

type CartItem = { nftId: string; quantity: number }
type User = { email: string; username: string; displayName: string; avatar: string }
type Order = { id: string; status: 'confirmed' | 'pending' | 'rejected'; createdAt: string; items: CartItem[]; total: number; wallet: string }

const imageSet = {
  emerald: 'https://images.unsplash.com/photo-1540573133985-87b6da6d54a9?auto=format&fit=crop&w=900&q=85',
  violet: 'https://images.unsplash.com/photo-1535338454770-8be927b5a00b?auto=format&fit=crop&w=900&q=85',
  ivory: 'https://images.unsplash.com/photo-1484406566174-9da000fda645?auto=format&fit=crop&w=900&q=85',
  golden: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=900&q=85',
  coral: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=85',
}

const nfts: NFT[] = [
  { id: 'emerald-ape-042', name: 'Emerald Ape', number: '#042', price: 1.19, collection: 'Kurio Apes', edition: '1/50', stock: 12, category: 'Arte digital', rarity: 'Raro', image: imageSet.emerald, description: 'Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para colecionadores.', attributes: ['Óculos', 'Esmeralda', 'Raro'], rating: 4.8, reviews: 19 },
  { id: 'violet-nomad-314', name: 'Violet Nomad', number: '#314', price: 1.39, collection: 'Kurio Nomads', edition: '1/10', stock: 9, category: 'Arte digital', rarity: 'Comum', image: imageSet.violet, description: 'Uma peça de edição limitada para quem carrega sua identidade digital por todos os lugares.', attributes: ['Bucket hat', 'Violeta', 'Nômade'], rating: 4.6, reviews: 12 },
  { id: 'ivory-baron-088', name: 'Ivory Baron', number: '#088', price: 1.79, collection: 'Kurio Apes', edition: '1/10', stock: 4, category: 'Colecionáveis', rarity: 'Raro', image: imageSet.ivory, description: 'A elegância clássica encontra a irreverência da cultura digital em uma edição numerada e verificável.', attributes: ['Marfim', 'Barão', 'Limitado'], rating: 4.9, reviews: 31 },
  { id: 'golden-beat-207', name: 'Golden Beat', number: '#207', price: 0.99, collection: 'Kurio Beats', edition: '1/50', stock: 17, category: 'Música', rarity: 'Comum', image: imageSet.golden, description: 'Uma vibração dourada para colecionar, compartilhar e levar para sua próxima playlist on-chain.', attributes: ['Headphones', 'Dourado', 'Beat'], rating: 4.5, reviews: 9 },
  { id: 'coral-dream-119', name: 'Coral Dream', number: '#119', price: 2.12, collection: 'Kurio Dreams', edition: '1/1', stock: 1, category: 'Fotografia', rarity: 'Lendário', image: imageSet.coral, description: 'Um momento único transformado em peça digital, com certificado de autenticidade e edição única.', attributes: ['Coral', 'Dream', '1/1'], rating: 5, reviews: 7 },
  { id: 'sage-nomad-009', name: 'Sage Nomad', number: '#009', price: 1.69, collection: 'Kurio Nomads', edition: '1/10', stock: 5, category: 'Arte digital', rarity: 'Raro', image: imageSet.violet, description: 'O espírito de quem está sempre em movimento, renderizado em tons suaves e profundos.', attributes: ['Sage', 'Nomad', 'Green'], rating: 4.7, reviews: 15 },
]

const fakeLatency = (value: unknown, delay = 260) => new Promise<typeof value>((resolve) => setTimeout(() => resolve(value), delay))
const api = axios.create({ baseURL: '/api', adapter: async (config) => {
  const url = config.url ?? ''
  if (url.startsWith('/nfts/')) {
    const item = nfts.find((nft) => nft.id === url.split('/').pop())
    if (!item) return { data: { message: 'NFT não encontrado' }, status: 404, statusText: 'Not Found', headers: {}, config }
    return { data: await fakeLatency(item), status: 200, statusText: 'OK', headers: {}, config }
  }
  return { data: await fakeLatency(nfts), status: 200, statusText: 'OK', headers: {}, config }
} })

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })
const socket = io('http://localhost:3001', { autoConnect: false })

const readStorage = <T,>(key: string, fallback: T): T => {
  try { return JSON.parse(localStorage.getItem(key) ?? '') as T } catch { return fallback }
}

type AppContextValue = {
  cart: CartItem[]
  favorites: string[]
  user: User | null
  order: Order | null
  authMode: 'login' | 'signup' | null
  toast: string | null
  addToCart: (nftId: string, quantity?: number) => void
  updateQuantity: (nftId: string, quantity: number) => void
  removeFromCart: (nftId: string) => void
  toggleFavorite: (nftId: string) => void
  login: (email: string, password: string) => Promise<string | null>
  signup: (username: string, email: string, password: string) => Promise<string | null>
  logout: () => void
  setAuthMode: (mode: 'login' | 'signup' | null) => void
  checkout: (wallet: string) => void
  clearToast: () => void
}

const AppContext = createContext<AppContextValue | null>(null)
const useApp = () => { const value = useContext(AppContext); if (!value) throw new Error('useApp must be used inside AppProvider'); return value }

function AppProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => readStorage('kurio-cart', [{ nftId: 'emerald-ape-042', quantity: 1 }, { nftId: 'violet-nomad-314', quantity: 1 }]))
  const [favorites, setFavorites] = useState<string[]>(() => readStorage('kurio-favorites', ['emerald-ape-042']))
  const [user, setUser] = useState<User | null>(() => readStorage<User | null>('kurio-user', null))
  const [order, setOrder] = useState<Order | null>(() => readStorage<Order | null>('kurio-order', null))
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { localStorage.setItem('kurio-cart', JSON.stringify(cart)) }, [cart])
  useEffect(() => { localStorage.setItem('kurio-favorites', JSON.stringify(favorites)) }, [favorites])
  useEffect(() => { localStorage.setItem('kurio-user', JSON.stringify(user)) }, [user])
  useEffect(() => { localStorage.setItem('kurio-order', JSON.stringify(order)) }, [order])
  useEffect(() => {
    const handleUpdate = (payload: { nftId: string; price: number }) => {
      const item = nfts.find((nft) => nft.id === payload.nftId)
      if (item) { item.price = payload.price; queryClient.invalidateQueries({ queryKey: ['nfts'] }); setToast(`${item.name} teve uma atualização de preço`) }
    }
    socket.on('nft.updated', handleUpdate)
    return () => { socket.off('nft.updated', handleUpdate) }
  }, [])

  const actions: AppContextValue = {
    cart, favorites, user, order, authMode, toast,
    addToCart: (nftId, quantity = 1) => { setCart((current) => { const existing = current.find((item) => item.nftId === nftId); return existing ? current.map((item) => item.nftId === nftId ? { ...item, quantity: Math.min(item.quantity + quantity, nfts.find((nft) => nft.id === nftId)?.stock ?? 1) } : item) : [...current, { nftId, quantity }] }); setToast('NFT adicionado ao carrinho') },
    updateQuantity: (nftId, quantity) => setCart((current) => current.map((item) => item.nftId === nftId ? { ...item, quantity: Math.max(1, Math.min(quantity, nfts.find((nft) => nft.id === nftId)?.stock ?? 1)) } : item)),
    removeFromCart: (nftId) => { setCart((current) => current.filter((item) => item.nftId !== nftId)); setToast('Item removido do carrinho') },
    toggleFavorite: (nftId) => setFavorites((current) => current.includes(nftId) ? current.filter((id) => id !== nftId) : [...current, nftId]),
    login: async (email, password) => { await fakeLatency(null, 550); if (!email.includes('@') || password.length < 6) return 'Confira seu e-mail e use uma senha com pelo menos 6 caracteres.'; setUser({ email, username: email.split('@')[0], displayName: 'Colecionador Kurio', avatar: 'K' }); setAuthMode(null); setToast('Bem-vindo de volta à Kurio'); return null },
    signup: async (username, email, password) => { await fakeLatency(null, 700); if (username.length < 3 || !email.includes('@') || password.length < 6) return 'Preencha os campos com dados válidos para criar sua conta.'; setUser({ email, username, displayName: username, avatar: username.slice(0, 1).toUpperCase() }); setAuthMode(null); setToast('Perfil criado com sucesso'); return null },
    logout: () => { setUser(null); setToast('Sessão encerrada') },
    setAuthMode,
    checkout: (wallet) => { const total = cart.reduce((sum, item) => sum + (nfts.find((nft) => nft.id === item.nftId)?.price ?? 0) * item.quantity, 0) + 0.016; const next: Order = { id: '0xA91F…E82C', status: 'confirmed', createdAt: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }), items: cart, total, wallet }; setOrder(next); setCart([]); setToast('Compra confirmada — seus NFTs estão na carteira') },
    clearToast: () => setToast(null),
  }
  return <AppContext.Provider value={actions}>{children}</AppContext.Provider>
}

function useNFTs() { return useQuery({ queryKey: ['nfts'], queryFn: async () => (await api.get<NFT[]>('/nfts')).data }) }
function useNFT(id: string) { return useQuery({ queryKey: ['nft', id], queryFn: async () => { const response = await api.get<NFT>(`/nfts/${id}`); return response.data } }) }

const formatEth = (value: number) => `${value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} ETH`
const getNFT = (id: string) => nfts.find((nft) => nft.id === id) ?? nfts[0]

function AppShell() {
  const { cart, user, authMode, toast, setAuthMode, clearToast } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(clearToast, 4200); return () => window.clearTimeout(timeout) }, [toast, clearToast])
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
    <header className="site-header">
      <Link to="/" className="brand" aria-label="Kurio, início">KURIO</Link>
      <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Navegação principal">
        <Link to="/" activeProps={{ className: 'active' }}>Início</Link>
        <Link to="/market" activeProps={{ className: 'active' }}>Mercado</Link>
        <Link to="/profile" activeProps={{ className: 'active' }}>Criadores</Link>
        <a href="#about">Aprenda</a>
      </nav>
      <div className="header-actions">
        <Link to="/market" className="icon-button desktop-only" aria-label="Buscar NFTs"><Search size={21} /></Link>
        <Link to="/cart" className="cart-button" aria-label={`Carrinho com ${totalItems} itens`}><ShoppingCart size={21} /><span>{totalItems}</span></Link>
        {user ? <Link className="account-chip" to="/profile"><span className="avatar">{user.avatar}</span><span className="desktop-only">{user.username}</span></Link> : <button className="button button-small desktop-only" onClick={() => setAuthMode('login')}><LogIn size={16} /> Entrar</button>}
        <button className="icon-button menu-toggle" aria-label="Abrir menu" onClick={() => setMenuOpen((open) => !open)}><Menu size={22} /></button>
      </div>
    </header>
    <main id="main-content" key={location.pathname}><Outlet /></main>
    <footer className="site-footer"><span>© 2026 KURIO</span><span>Arte digital com procedência.</span><span className="footer-links"><a href="#about">Manifesto</a><a href="#about">Termos</a><a href="#about">Suporte</a></span></footer>
    {authMode && <AuthModal />}
    {toast && <div className="toast" role="status"><Check size={18} /> {toast}<button onClick={clearToast} aria-label="Fechar aviso"><X size={16} /></button></div>}
  </div>
}

function Hero() {
  const navigate = useNavigate()
  return <section className="hero section-container">
    <div className="hero-copy"><p className="eyebrow">Bem-vindo à Kurio</p><h1>SEJA DONO DO<br /><span>FUTURO</span> DA ARTE<br />DIGITAL</h1><p className="hero-description">Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.</p><button className="button" onClick={() => navigate({ to: '/market' })}>Explorar <ArrowRight size={17} /></button><div className="hero-dots"><i className="active" /><i /><i /></div></div>
    <div className="hero-art"><img src={imageSet.emerald} alt="Retrato de um macaco colecionável com jaqueta verde e óculos" /><span className="hero-stamp"><Sparkles size={14} /> EDIÇÃO SELECIONADA</span></div>
  </section>
}

function NFTCard({ nft, compact = false }: { nft: NFT; compact?: boolean }) {
  const { favorites, toggleFavorite } = useApp()
  const isFavorite = favorites.includes(nft.id)
  return <article className={compact ? 'nft-card compact' : 'nft-card'}><div className="card-image-wrap"><Link to="/nft/$nftId" params={{ nftId: nft.id }}><img src={nft.image} alt={`${nft.name} ${nft.number}`} loading="lazy" /></Link><button className={isFavorite ? 'heart-button is-active' : 'heart-button'} onClick={() => toggleFavorite(nft.id)} aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Adicionar ${nft.name} aos favoritos`}><Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} /></button>{nft.rarity === 'Raro' && <span className="rarity-tag">RARO</span>}</div><div className="card-info"><Link to="/nft/$nftId" params={{ nftId: nft.id }} className="card-title">{nft.name} <span>{nft.number}</span></Link><div className="card-meta"><span>{nft.collection}</span><strong>{formatEth(nft.price)}</strong></div></div></article>
}

function HomePage() {
  const { data: items = [], isLoading } = useNFTs()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('Todos os NFTs')
  const [sort, setSort] = useState('recent')
  const filtered = useMemo(() => items.filter((nft) => `${nft.name} ${nft.collection} ${nft.category}`.toLowerCase().includes(search.toLowerCase())).filter((nft) => activeTab === 'Todos os NFTs' || (activeTab === 'Novos lançamentos' ? nft.id !== 'emerald-ape-042' : nft.rarity === 'Raro')).sort((a, b) => sort === 'price' ? a.price - b.price : b.reviews - a.reviews), [items, search, activeTab, sort])
  const updateUrl = (value: string) => { setSearch(value); const params = new URLSearchParams(window.location.search); value ? params.set('q', value) : params.delete('q'); window.history.replaceState(null, '', `${window.location.pathname}${params.toString() ? `?${params}` : ''}`) }
  return <><Hero /><section className="catalog section-container" id="catalog"><div className="catalog-toolbar"><div className="mobile-search"><Search size={17} /><input value={search} onChange={(event) => updateUrl(event.target.value)} placeholder="Explorar coleções" aria-label="Buscar NFTs" /></div><div className="tabs" role="tablist">{['Todos os NFTs', 'Novos lançamentos', 'Em alta'].map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div><div className="sort-control"><label htmlFor="sort">Ordenar por:</label><select id="sort" value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Listados recentemente</option><option value="price">Menor preço</option></select><ChevronDown size={15} /></div><button className="filter-button mobile-only" aria-label="Abrir filtros"><SlidersHorizontal size={18} /></button></div><div className="catalog-layout"><aside className="filters-panel"><div className="filter-heading"><h2>Coleções</h2><SlidersHorizontal size={16} /></div>{['Arte digital', 'Fotografia', 'Música', 'Colecionáveis'].map((category, index) => <button key={category} className="filter-row" onClick={() => setSearch(category)}><span>{category}</span><span>({[33, 12, 8, 22][index]})</span></button>)}<div className="filter-divider" /><p className="filter-label">Faixa de preço</p><div className="price-range"><span>0 ETH</span><span>10 ETH</span></div><input type="range" min="0" max="10" defaultValue="10" aria-label="Preço máximo" /></aside><div className="catalog-grid">{isLoading ? Array.from({ length: 6 }).map((_, index) => <div className="nft-card skeleton-card" key={index}><div className="skeleton" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>) : filtered.map((nft) => <NFTCard key={nft.id} nft={nft} />)}{!isLoading && filtered.length === 0 && <div className="empty-state"><Search size={30} /><h3>Nenhuma peça encontrada</h3><p>Tente buscar por outra coleção ou categoria.</p><button className="button button-outline" onClick={() => updateUrl('')}>Limpar busca</button></div>}</div></div></section></>
}

function MarketPage() { return <div className="page section-container market-page"><div className="breadcrumb"><Link to="/">Início</Link><span>/</span><strong>Mercado</strong></div><h1 className="page-title">Explore o mercado</h1><p className="page-lede">Peças digitais escolhidas para quem coleciona cultura, não apenas pixels.</p><HomePage /></div> }

function DetailPage() {
  const { nftId } = detailRoute.useParams()
  const { data: nft, isLoading } = useNFT(nftId)
  const { favorites, toggleFavorite, addToCart } = useApp()
  const [quantity, setQuantity] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  if (isLoading) return <DetailSkeleton />
  if (!nft) return <NotFound title="Esta peça não existe" />
  const gallery = [nft.image, imageSet.emerald, imageSet.ivory]
  const isFavorite = favorites.includes(nft.id)
  return <div className="page detail-page section-container"><div className="breadcrumb"><Link to="/">Início</Link><span>/</span><Link to="/market">Mercado</Link><span>/</span><strong>{nft.name}</strong></div><div className="detail-layout"><div className="detail-gallery"><div className="gallery-thumbs">{gallery.map((image, index) => <button key={image} className={index === activeImage ? 'active' : ''} onClick={() => setActiveImage(index)}><img src={image} alt="" /></button>)}</div><div className="detail-image"><img src={gallery[activeImage]} alt={`${nft.name}, obra digital`} /><button className="zoom-button" aria-label="Ampliar imagem"><Eye size={18} /></button></div></div><div className="detail-copy"><div className="detail-title-row"><div><p className="eyebrow">{nft.collection}</p><h1>{nft.name} <span>{nft.number}</span></h1></div><div className="rating"><Sparkles size={17} fill="currentColor" /> {nft.rating.toFixed(1)} <small>({nft.reviews})</small></div></div><div className="detail-price">{formatEth(nft.price)}</div><div className="rule" /><h2>Sobre este NFT:</h2><p className="detail-description">{nft.description}</p><h2>Edição:</h2><div className="edition-pills"><span>1/1</span><span>1/10</span><span className="selected">{nft.edition}</span><span className="open-pill">ABERTA</span></div><div className="purchase-row"><div className="quantity"><button onClick={() => setQuantity((current) => Math.max(1, current - 1))} aria-label="Diminuir quantidade"><Minus size={17} /></button><strong>{quantity}</strong><button onClick={() => setQuantity((current) => Math.min(nft.stock, current + 1))} aria-label="Aumentar quantidade"><Plus size={17} /></button></div><button className="button" onClick={() => addToCart(nft.id, quantity)}>Comprar</button><button className={isFavorite ? 'button button-outline is-favorite' : 'button button-outline'} onClick={() => toggleFavorite(nft.id)}><Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} /> <span className="desktop-only">Favoritar</span></button></div><div className="detail-facts"><p>ID do token: <strong>{nft.number}</strong></p><p>Coleção: <strong>{nft.collection}</strong></p><p>Atributos: <strong>{nft.attributes.join(', ')}</strong></p></div><div className="share-line">Compartilhar este NFT: <button aria-label="Copiar link"><Copy size={15} /></button><button aria-label="Compartilhar no X">𝕏</button></div></div></div><section className="detail-tabs"><button className="active">Detalhes do NFT</button><button>Avaliações de colecionadores ({nft.reviews})</button></section></div>
}

function DetailSkeleton() { return <div className="page section-container detail-skeleton"><div className="skeleton hero-skeleton" /><div><div className="skeleton-line" /><div className="skeleton-line" /><div className="skeleton-line short" /></div></div> }

function CartPage() {
  const { cart, updateQuantity, removeFromCart, user, setAuthMode } = useApp()
  const navigate = useNavigate()
  const [coupon, setCoupon] = useState('')
  const [discount, setDiscount] = useState(0)
  const subtotal = cart.reduce((sum, item) => sum + getNFT(item.nftId).price * item.quantity, 0)
  const total = subtotal - discount + (cart.length ? 0.016 : 0)
  return <div className="page section-container cart-page"><div className="breadcrumb"><Link to="/">Início</Link><span>/</span><Link to="/market">Mercado</Link><span>/</span><strong>Carrinho</strong></div><div className="cart-layout"><section><div className="section-heading"><h1>Carrinho de NFTs</h1><span>{cart.length} peças</span></div><div className="cart-table-head"><span>NFTs</span><span>Preço</span><span>Edições</span><span>Total</span><span /></div>{cart.length === 0 ? <div className="empty-state cart-empty"><PackageCheck size={38} /><h2>Seu carrinho está leve</h2><p>Explore o mercado e encontre sua próxima peça.</p><Link className="button" to="/market">Explorar mercado</Link></div> : <div className="cart-items">{cart.map((item) => { const nft = getNFT(item.nftId); return <div className="cart-item" key={item.nftId}><Link to="/nft/$nftId" params={{ nftId: nft.id }} className="cart-art"><img src={nft.image} alt="" /></Link><div className="cart-name"><strong>{nft.name} {nft.number}</strong><small>ID do token: {nft.number}</small></div><span className="cart-price">{formatEth(nft.price)}</span><div className="quantity small"><button onClick={() => updateQuantity(nft.id, item.quantity - 1)} aria-label="Diminuir quantidade"><Minus size={14} /></button><strong>{item.quantity}</strong><button onClick={() => updateQuantity(nft.id, item.quantity + 1)} aria-label="Aumentar quantidade"><Plus size={14} /></button></div><strong className="cart-total">{formatEth(nft.price * item.quantity)}</strong><button className="icon-button remove-button" onClick={() => removeFromCart(nft.id)} aria-label={`Remover ${nft.name}`}><Trash2 size={18} /></button></div> })}</div>}</section><aside className="summary-card"><h2>Resumo da carteira</h2><label className="summary-label" htmlFor="coupon">Código promocional</label><div className="coupon-row"><input id="coupon" placeholder="Digite o código promocional..." value={coupon} onChange={(event) => setCoupon(event.target.value)} /><button onClick={() => setDiscount(coupon.toUpperCase() === 'KURIO10' ? subtotal * 0.1 : 0)}>Aplicar</button></div>{coupon && coupon.toUpperCase() !== 'KURIO10' && discount === 0 && <p className="coupon-error">Código inválido ou expirado.</p>}<div className="summary-lines"><div><span>Subtotal</span><strong>{formatEth(subtotal)}</strong></div><div><span>Desconto do lançamento</span><strong>(-) {formatEth(discount)}</strong></div><div><span>Taxa de rede <small>Taxa estimada</small></span><strong>{formatEth(cart.length ? 0.016 : 0)}</strong></div></div><div className="summary-total"><span>Total</span><strong>{formatEth(total)}</strong></div><button className="button full" disabled={!cart.length} onClick={() => { if (!user) { setAuthMode('login'); return } navigate({ to: '/checkout' }) }}>{user ? 'Conectar e finalizar' : 'Entrar para finalizar'}</button><Link className="continue-link" to="/market">Continuar explorando</Link></aside></div><section className="recommendations"><div className="section-heading"><h2>Colecionadores também viram</h2><ArrowRight size={18} /></div><div className="recommendation-grid">{nfts.slice(2, 6).map((nft) => <NFTCard key={nft.id} nft={nft} compact />)}</div></section></div>
}

function CheckoutPage() {
  const { user, cart, checkout, setAuthMode } = useApp()
  const navigate = useNavigate()
  const [wallet, setWallet] = useState('MetaMask')
  if (!user) return <div className="page section-container auth-required"><LockKeyhole size={34} /><h1>Entre para concluir sua compra</h1><p>Seu carrinho está salvo. Faça login e retome o checkout de onde parou.</p><button className="button" onClick={() => setAuthMode('login')}>Entrar na Kurio</button></div>
  const total = cart.reduce((sum, item) => sum + getNFT(item.nftId).price * item.quantity, 0) + 0.016
  return <div className="page section-container checkout-page"><div className="breadcrumb"><Link to="/cart">Carrinho</Link><span>/</span><strong>Pagamento</strong></div><div className="checkout-layout"><section className="checkout-form"><div className="section-heading"><div><p className="eyebrow">Etapa 1 de 2</p><h1>Perfil do colecionador</h1></div><span className="checkout-status"><Check size={15} /> Sessão ativa</span></div><div className="form-grid"><Field label="Nome de exibição" value={user.displayName} /><Field label="Nome de usuário" value={user.username} /><Field label="Rede" as="select" options={['Ethereum', 'Polygon', 'Base']} /><Field label="Nome do perfil" placeholder="Como você quer ser encontrado?" /><Field label="Endereço da carteira" placeholder="Endereço 0x da carteira" /><Field label="ENS ou carteira secundária" placeholder="Opcional" /><Field label="Tipo de carteira" as="select" options={['MetaMask', 'WalletConnect', 'Coinbase Wallet']} /><Field label="Código de indicação" placeholder="Opcional" /><Field label="E-mail" value={user.email} type="email" /><Field label="Nome ENS" placeholder="Seu nome .eth" /></div><label className="check-row"><input type="checkbox" defaultChecked /> Usar minha carteira principal para esta compra.</label><label className="field full-field"><span>Observação do colecionador <small>(opcional)</small></span><textarea rows={4} placeholder="Escreva uma mensagem para acompanhar seu pedido..." /></label></section><aside className="checkout-summary"><h2>Seus NFTs</h2>{cart.map((item) => { const nft = getNFT(item.nftId); return <div className="checkout-item" key={item.nftId}><img src={nft.image} alt="" /><div><strong>{nft.name} <small>(x {item.quantity})</small></strong><span>ID do token: {nft.number}</span></div><b>{formatEth(nft.price * item.quantity)}</b></div> })}<div className="summary-lines"><div><span>Subtotal</span><strong>{formatEth(total - 0.016)}</strong></div><div><span>Taxa de rede <small>Taxa estimada</small></span><strong>0.016 ETH</strong></div></div><div className="summary-total"><span>Total</span><strong>{formatEth(total)}</strong></div><button className="button full" onClick={() => { checkout(wallet); navigate({ to: '/order-confirmation' }) }}><WalletCards size={18} /> Confirmar compra</button><p className="secure-note"><LockKeyhole size={14} /> Simulação segura. Nenhuma transação real será enviada.</p><div className="wallet-picker"><p>Carteira e rede</p>{['MetaMask', 'WalletConnect', 'Coinbase Wallet'].map((name) => <button key={name} className={wallet === name ? 'selected' : ''} onClick={() => setWallet(name)}><span>{name.slice(0, 1)}</span>{name}<i /></button>)}</div></aside></div></div>
}

function Field({ label, value, placeholder, type = 'text', as, options }: { label: string; value?: string; placeholder?: string; type?: string; as?: 'select'; options?: string[] }) { return <label className="field"><span>{label}<em>*</em></span>{as === 'select' ? <select defaultValue={options?.[0]}>{options?.map((option) => <option key={option}>{option}</option>)}</select> : <input type={type} defaultValue={value} placeholder={placeholder} />}</label> }

function ConfirmationPage() { const { order } = useApp(); if (!order) return <NotFound title="Nenhum pedido recente" />; return <div className="page section-container confirmation-page"><div className="confirmation-card"><div className="thank-you"><span>THANK<br />YOU</span></div><h1>Seus NFTs agora estão na sua carteira</h1><div className="receipt-meta"><div><small>ID da transação</small><strong>{order.id}</strong></div><div><small>Data</small><strong>{order.createdAt}</strong></div><div><small>Total</small><strong>{formatEth(order.total)}</strong></div><div><small>Carteira</small><strong>{order.wallet}</strong></div></div><div className="receipt-body"><h2>Detalhes da transação</h2>{order.items.map((item) => { const nft = getNFT(item.nftId); return <div className="receipt-item" key={item.nftId}><img src={nft.image} alt="" /><div><strong>{nft.name} {nft.number}</strong><span>ID do token: {nft.number}</span></div><span>(x {item.quantity})</span><b>{formatEth(nft.price * item.quantity)}</b></div> })}<div className="summary-total"><span>Total</span><strong>{formatEth(order.total)}</strong></div></div><div className="confirmation-actions"><Link className="button" to="/market">Continuar explorando</Link><button className="button button-outline" onClick={() => navigator.clipboard?.writeText(order.id)}><Copy size={17} /> Copiar transação</button></div></div></div> }

function AuthModal() { const { authMode, setAuthMode, login, signup } = useApp(); const [mode, setMode] = useState(authMode ?? 'login'); const [email, setEmail] = useState(''); const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); useEffect(() => { setMode(authMode ?? 'login') }, [authMode]); const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); setError(''); const result = mode === 'login' ? await login(email, password) : confirmation !== password ? 'As senhas não conferem.' : await signup(username, email, password); setLoading(false); if (result) setError(result) }; return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthMode(null) }}><div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close" onClick={() => setAuthMode(null)} aria-label="Fechar"><X size={20} /></button><div className="auth-brand">KURIO</div><div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Entrar</button><span>|</span><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Criar conta</button></div><p id="auth-title" className="auth-intro">{mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}</p><form onSubmit={submit}>{mode === 'signup' && <input required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Nome de usuário" aria-label="Nome de usuário" /> }<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="contato@email.com" aria-label="E-mail" /><input required minLength={6} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha" aria-label="Senha" />{mode === 'signup' && <input required minLength={6} type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirmar senha" aria-label="Confirmar senha" />}{error && <p className="form-error" role="alert">{error}</p>}<button className="button full" disabled={loading}>{loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button></form>{mode === 'login' && <button className="forgot-password">Esqueceu a senha?</button>}<div className="social-divider"><span>Ou continue com</span></div><button className="social-button">G <span>Continuar com Google</span></button><button className="social-button">f <span>Continuar com Facebook</span></button></div></div> }

function ProfilePage({ wallets = false }: { wallets?: boolean }) { const { user, logout, setAuthMode } = useApp(); const [saved, setSaved] = useState(false); if (!user) return <div className="page section-container auth-required"><UserRound size={34} /><h1>Seu perfil começa aqui</h1><p>Entre para editar seus dados, carteiras e favoritos.</p><button className="button" onClick={() => setAuthMode('login')}>Entrar na Kurio</button></div>; return <div className="page section-container profile-page"><div className="profile-layout"><aside className="profile-sidebar"><h2>Meu perfil</h2>{['Dados do perfil', 'Carteiras', 'Atividade', 'Lista de interesse', 'Ofertas', 'Arquivos baixados', 'Suporte'].map((item, index) => <Link key={item} className={wallets === (index === 1) ? 'active' : ''} to={index === 1 ? '/wallets' : '/profile'}>{index === 0 ? <UserRound size={17} /> : index === 1 ? <WalletCards size={17} /> : <Sparkles size={17} />}{item}</Link>)}<button onClick={logout}><LogIn size={17} /> Sair</button></aside><section className="profile-content"><div className="section-heading"><div><p className="eyebrow">Minha conta</p><h1>{wallets ? 'Carteira principal' : 'Perfil do colecionador'}</h1><p className="page-lede">{wallets ? 'Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.' : 'Mantenha seus dados e preferências sempre atualizados.'}</p></div>{wallets && <button className="text-button"><Plus size={16} /> Adicionar</button>}</div>{wallets ? <WalletForm onSaved={() => setSaved(true)} /> : <ProfileForm user={user} onSaved={() => setSaved(true)} />}{saved && <p className="save-message"><Check size={16} /> Alterações salvas nesta sessão.</p>}</section></div></div> }
function ProfileForm({ user, onSaved }: { user: User; onSaved: () => void }) { return <form className="profile-form" onSubmit={(event) => { event.preventDefault(); onSaved() }}><div className="form-grid"><Field label="Nome de exibição" value={user.displayName} /><Field label="Nome de usuário" value={user.username} /><Field label="E-mail" value={user.email} type="email" /><Field label="Nome ENS" placeholder="Seu nome" /><Field label="Apelido da carteira" placeholder="Como devemos chamá-la?" /><div className="avatar-field"><span>Avatar</span><div className="profile-avatar">{user.avatar}</div><button type="button" className="button button-small">Alterar</button><button type="button" className="text-button">Remover</button></div></div><h2 className="form-section-title">Alterar senha</h2><div className="form-grid"><Field label="Senha atual" type="password" /><Field label="Nova senha" type="password" /></div><button className="button">Salvar alterações</button></form> }
function WalletForm({ onSaved }: { onSaved: () => void }) { return <form className="profile-form" onSubmit={(event) => { event.preventDefault(); onSaved() }}><div className="form-grid"><Field label="Nome de exibição" placeholder="Ex.: Principal" /><Field label="Apelido da carteira" placeholder="Ex.: Minha wallet" /><Field label="Rede" as="select" options={['Ethereum', 'Polygon', 'Base']} /><Field label="Nome do perfil" placeholder="Como você quer ser encontrado?" /><Field label="Endereço da carteira" placeholder="Endereço 0x da carteira" /><Field label="ENS ou carteira secundária" placeholder="Opcional" /><Field label="Tipo de carteira" as="select" options={['MetaMask', 'WalletConnect', 'Coinbase Wallet']} /><Field label="Código de indicação" placeholder="Opcional" /><Field label="E-mail" type="email" placeholder="contato@email.com" /><Field label="Nome ENS" placeholder="Seu nome .eth" /></div><button className="button">Salvar carteira</button></form> }

function NotFound({ title = 'Página não encontrada' }: { title?: string }) { return <div className="page section-container not-found"><Sparkles size={34} /><h1>{title}</h1><p>Essa rota não existe ou a peça não está mais disponível.</p><Link className="button" to="/">Voltar para o início</Link></div> }

function RootLayout() { return <AppProvider><AppShell /></AppProvider> }
const rootRoute = createRootRoute({ component: RootLayout })
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage })
const marketRoute = createRoute({ getParentRoute: () => rootRoute, path: '/market', component: MarketPage })
const detailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/nft/$nftId', component: DetailPage })
const cartRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cart', component: CartPage })
const checkoutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/checkout', component: CheckoutPage })
const confirmationRoute = createRoute({ getParentRoute: () => rootRoute, path: '/order-confirmation', component: ConfirmationPage })
const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/profile', component: () => <ProfilePage /> })
const walletsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/wallets', component: () => <ProfilePage wallets /> })
const routeTree = rootRoute.addChildren([indexRoute, marketRoute, detailRoute, cartRoute, checkoutRoute, confirmationRoute, profileRoute, walletsRoute])
const router = createRouter({ routeTree, defaultNotFoundComponent: () => <NotFound /> })
declare module '@tanstack/react-router' { interface Register { router: typeof router } }

createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></StrictMode>)
