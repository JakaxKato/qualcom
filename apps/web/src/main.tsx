import React, { useState, useEffect, createContext, useContext, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
  useSearchParams,
  useParams,
  useLocation,
  Navigate,
} from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  ShoppingBag,
  UserRound,
  Search,
  Menu,
  X,
  Plus,
  Minus,
  Check,
  SlidersHorizontal,
  ChevronDown,
  Truck,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { api, ApiError, money, paymentLabel, shippingLabel } from './api';
import { Admin } from './pages-admin';
import { Home as StorefrontHome } from './home';
import { Card } from './product-card';
import { productImage } from './product-image';
import '@fontsource-variable/outfit';
import './style.css';
import './storefront.css';
type CartItem = {
  sku: string;
  quantity: number;
  name: string;
  label: string;
  price: number;
  image: string;
};
type Context = {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  add: (p: any, v: any) => void;
  user: any;
  refresh: () => Promise<void>;
  config: any;
  notify: (s: string) => void;
  ready: boolean;
};
const Store = createContext<Context>(null!);
export const useStore = () => useContext(Store);
function Provider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const data = JSON.parse(localStorage.getItem('rt.cart') || '[]');
      return Array.isArray(data)
        ? data.filter(
            (i) => typeof i.sku === 'string' && Number.isInteger(i.quantity) && i.quantity > 0,
          )
        : [];
    } catch {
      return [];
    }
  });
  const [user, setUser] = useState<any>(null),
    [config, setConfig] = useState<any>({ brand: 'Ruang Teduh', demo: true }),
    [notice, notify] = useState(''),
    [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    const s = await api('/auth/session');
    setUser(s.user);
    setReady(true);
  }, []);
  useEffect(() => {
    void refresh().catch(() => notify('Tidak dapat terhubung. Muat ulang untuk mencoba lagi.'));
    void api('/config')
      .then(setConfig)
      .catch(() => {});
  }, [refresh]);
  useEffect(() => localStorage.setItem('rt.cart', JSON.stringify(cart)), [cart]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => notify(''), 4000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const add = (p: any, v: any) => {
    const current = cart.find((i) => i.sku === v.sku);
    if ((current?.quantity || 0) >= v.available) {
      notify('Jumlah dalam keranjang sudah mencapai stok tersedia.');
      return;
    }
    setCart((c) =>
      current
        ? c.map((i) => (i.sku === v.sku ? { ...i, quantity: i.quantity + 1 } : i))
        : [
            ...c,
            {
              sku: v.sku,
              quantity: 1,
              name: p.name,
              label: v.label,
              price: v.price,
              image: v.image || p.image,
            },
          ],
    );
    notify(p.name + ' ditambahkan ke keranjang.');
  };
  return (
    <Store.Provider value={{ cart, setCart, add, user, refresh, config, notify, ready }}>
      {children}
      <div className={'toast ' + (notice ? 'show' : '')} role="status">
        <Check size={18} />
        {notice}
      </div>
    </Store.Provider>
  );
}
function Logo() {
  const { config } = useStore();
  return (
    <Link to="/" className="logo" aria-label={config.brand + ', beranda'}>
      <span>
        {config.brand === 'Ruang Teduh' ? (
          <>
            Ruang<span className="logo-light">.Teduh</span>
          </>
        ) : (
          config.brand
        )}
      </span>
    </Link>
  );
}
function Header() {
  const { cart, user, config } = useStore();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => setMenu(false), [location]);
  return (
    <>
      <div className="announcement">
        {config.demo
          ? 'Koleksi demo · Furnitur & kenyamanan untuk ruang Anda'
          : 'Furnitur & kenyamanan untuk ruang Anda'}
        <Link to="/katalog">
          Temukan koleksi <ArrowRight size={12} />
        </Link>
      </div>
      <header className="site-header">
        <Logo />
        <nav className={menu ? 'open' : ''} aria-label="Navigasi utama">
          <NavLink to="/" end>
            Beranda
          </NavLink>
          <NavLink to="/katalog">
            Katalog <ChevronDown size={12} />
          </NavLink>
          <NavLink to="/panduan">Panduan ukuran</NavLink>
          <NavLink to="/tentang">Tentang kami</NavLink>
        </nav>
        <div className="header-actions">
          <Link to="/katalog?search=true" aria-label="Cari produk">
            <Search size={21} />
          </Link>
          <Link to="/akun" aria-label="Akun saya">
            <UserRound size={21} />
          </Link>
          <Link
            className="bag"
            to="/keranjang"
            aria-label={'Keranjang, ' + cart.reduce((n, i) => n + i.quantity, 0) + ' barang'}
          >
            <ShoppingBag size={21} />
            <span>{cart.reduce((n, i) => n + i.quantity, 0)}</span>
          </Link>
          <button
            className="icon mobile-only"
            onClick={() => setMenu(!menu)}
            aria-label={menu ? 'Tutup navigasi' : 'Buka navigasi'}
            aria-expanded={menu}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
        {user?.permissions.length > 0 && (
          <Link className="admin-link" to="/admin">
            Admin
          </Link>
        )}
      </header>
    </>
  );
}
function Footer() {
  const { config } = useStore();
  return (
    <footer>
      <div className="footer-top">
        <div>
          <Logo />
          <p>
            Pilihan sederhana untuk ruang
            <br />
            yang Anda sebut rumah.
          </p>
        </div>
        <div>
          <h4>Jelajahi</h4>
          <Link to="/katalog?category=kasur">Kasur</Link>
          <Link to="/katalog?category=bantal">Bantal</Link>
          <Link to="/katalog?category=furnitur">Furnitur</Link>
        </div>
        <div>
          <h4>Kami membantu</h4>
          <Link to="/panduan">Panduan ukuran</Link>
          <Link to="/pesanan">Pesanan saya</Link>
          <Link to="/tentang">Tentang toko</Link>
        </div>
        <div>
          <h4>Ruang yang terus bertumbuh.</h4>
          <p>
            {config.demo
              ? 'Katalog ini menggunakan data demo. Identitas, produk, dan area layanan perlu dikonfirmasi sebelum rilis.'
              : config.support}
          </p>
          <Link to="/katalog" className="text-link">
            Temukan pilihan Anda <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {config.brand}
        </span>
        <span>
          {config.demo ? 'DEMO STORE · BUKAN TRANSAKSI PRODUKSI' : 'Dibuat untuk keseharian.'}
        </span>
        <span>Indonesia · IDR</span>
      </div>
    </footer>
  );
}
function Scroll() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
export function Message({ error }: { error: unknown }) {
  return error ? (
    <p className="error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </p>
  ) : null;
}
function Loading() {
  return (
    <div className="loading" role="status">
      <span />
      Menyiapkan pilihan untuk Anda…
    </div>
  );
}
function Home() {
  const { config } = useStore();
  return <StorefrontHome brand={config.brand} />;
}
const facets: Record<string, [string, string, string[]][]> = {
  kasur: [
    ['size', 'Ukuran', ['90 × 200', '160 × 200', '180 × 200']],
    ['firmness', 'Kekerasan', ['Medium', 'Firm']],
    ['thickness', 'Ketebalan (cm)', ['24', '28']],
  ],
  bantal: [
    ['fill', 'Isi bantal', ['Microfiber', 'Lateks']],
    ['height', 'Tinggi (cm)', ['10', '12', '16']],
  ],
  furnitur: [
    ['material', 'Bahan', ['Kayu oak', 'Kain tenun']],
    ['finish', 'Finishing', ['Natural', 'Pasir']],
    [
      'dimensions',
      'Dimensi (cm)',
      ['72 × 78 × 80', '210 × 90 × 78', '45 × 45 × 50', '110 × 35 × 45', '100 × 55 × 38'],
    ],
  ],
};
function Catalog() {
  const [params, setParams] = useSearchParams(),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null),
    filterButton = useRef<HTMLButtonElement>(null);
  const query = params.toString();
  const category = params.get('category') || '';
  const change = (key: string, value: string) => {
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.delete('search');
      if (value) n.set(key, value);
      else n.delete(key);
      if (key !== 'page') n.delete('page');
      if (key === 'category')
        Object.values(facets)
          .flat()
          .forEach(([k]) => n.delete(k));
      return n;
    });
  };
  useEffect(() => {
    const q = new URLSearchParams(query);
    q.delete('search');
    let active = true;
    setLoading(true);
    setError('');
    api('/products?' + q)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query]);
  const filters = (
    <>
      <div className="filter-title">
        <h3>Filter produk</h3>
        <button className="text-button" onClick={() => setParams({})}>
          Reset
        </button>
      </div>
      <fieldset>
        <legend>Kategori</legend>
        {[
          ['', 'Semua produk'],
          ['kasur', 'Kasur'],
          ['bantal', 'Bantal'],
          ['furnitur', 'Furnitur'],
        ].map(([v, l]) => (
          <label className="radio" key={v}>
            <input
              type="radio"
              name="category"
              checked={category === v}
              onChange={() => change('category', v)}
            />
            {l}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Harga</legend>
        <label>
          Minimum (Rp)
          <input
            type="number"
            min="0"
            placeholder="0"
            value={params.get('min') || ''}
            onChange={(e) => change('min', e.target.value)}
          />
        </label>
        <label>
          Maksimum (Rp)
          <input
            type="number"
            min="0"
            placeholder="Tanpa batas"
            value={params.get('max') || ''}
            onChange={(e) => change('max', e.target.value)}
          />
        </label>
      </fieldset>
      {(facets[category] || []).map(([key, label, options]) => (
        <fieldset key={key}>
          <legend>{label}</legend>
          <select
            aria-label={label}
            value={params.get(key) || ''}
            onChange={(e) => change(key, e.target.value)}
          >
            <option value="">Semua</option>
            {options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </fieldset>
      ))}
      <fieldset>
        <legend>Ketersediaan</legend>
        <label className="radio">
          <input
            type="checkbox"
            checked={params.has('stock')}
            onChange={(e) => change('stock', e.target.checked ? 'true' : '')}
          />
          Tersedia saja
        </label>
      </fieldset>
    </>
  );
  return (
    <main className="catalog page">
      <div className="breadcrumb">
        <Link to="/">Beranda</Link>
        <span>/</span>Katalog
      </div>
      <div className="catalog-intro">
        <div>
          <p className="eyebrow">RUANG ANDA, PILIHAN ANDA</p>
          <h1>
            Katalog<span>.</span>
          </h1>
        </div>
        <p>
          Kasur, bantal, dan furnitur.
          <br />
          Temukan yang pas, satu pilihan pada satu waktu.
        </p>
      </div>
      <div className="catalog-layout">
        <aside className="filters desktop">{filters}</aside>
        <div className="catalog-results">
          <div className="catalog-toolbar">
            <form
              className="search-field"
              onSubmit={(e) => {
                e.preventDefault();
                change('q', new FormData(e.currentTarget).get('q') as string);
              }}
            >
              <Search size={18} />
              <input
                name="q"
                aria-label="Cari produk"
                placeholder="Cari pilihan Anda…"
                defaultValue={params.get('q') || ''}
                key={params.get('q')}
              />
              <button className="text-button">Cari</button>
            </form>
            <label className="sort">
              Urutkan
              <select
                value={params.get('sort') || 'featured'}
                onChange={(e) => change('sort', e.target.value)}
              >
                <option value="featured">Pilihan kami</option>
                <option value="price-asc">Harga terendah</option>
                <option value="price-desc">Harga tertinggi</option>
                <option value="name">Nama A–Z</option>
              </select>
            </label>
          </div>
          <div className="result-line">
            <p aria-live="polite">
              {data?.total ?? '…'} produk{category ? ' · ' + category : ''}
            </p>
            <button
              className="text-button mobile-only"
              ref={filterButton}
              onClick={() => dialog.current?.showModal()}
            >
              <SlidersHorizontal size={16} /> Filter
            </button>
          </div>
          <Message error={error} />
          {error && (
            <button onClick={() => setParams(new URLSearchParams(params))}>Coba lagi</button>
          )}
          {loading ? (
            <Loading />
          ) : data?.products.length ? (
            <>
              <div className="catalog-grid">
                {data.products.map((p: any) => (
                  <Card key={p.slug} product={p} />
                ))}
              </div>
              {data.total > 9 && (
                <div className="pagination">
                  {Array.from({ length: Math.ceil(data.total / 9) }, (_, i) => (
                    <button
                      className={data.page === i + 1 ? 'selected' : ''}
                      key={i}
                      onClick={() => change('page', String(i + 1))}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            !error && (
              <div className="empty">
                <Search />
                <h2>Belum ada yang cocok.</h2>
                <p>Coba kata lain atau hapus beberapa filter.</p>
                <button onClick={() => setParams({})} className="button">
                  Hapus filter
                </button>
              </div>
            )
          )}
        </div>
      </div>
      <dialog
        ref={dialog}
        className="filter-dialog"
        aria-label="Filter produk"
        onClose={() => filterButton.current?.focus()}
      >
        <button
          className="icon close"
          onClick={() => dialog.current?.close()}
          aria-label="Tutup filter"
        >
          <X />
        </button>
        {filters}
        <button className="button full" onClick={() => dialog.current?.close()}>
          Lihat produk
        </button>
      </dialog>
    </main>
  );
}
function Product() {
  const { slug } = useParams(),
    { add, config } = useStore();
  const [p, setP] = useState<any>(null),
    [selected, setSelected] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    setP(null);
    setSelected('');
    api('/products/' + slug)
      .then(setP)
      .catch((e) => setError(e.message));
  }, [slug]);
  if (error)
    return (
      <main className="page">
        <Message error={error} />
        <Link to="/katalog">Kembali ke katalog</Link>
      </main>
    );
  if (!p) return <Loading />;
  const v = p.variants.find((v: any) => v.sku === selected);
  return (
    <main className="page">
      <div className="breadcrumb">
        <Link to="/">Beranda</Link>
        <span>/</span>
        <Link to="/katalog">Katalog</Link>
        <span>/</span>
        {p.name}
      </div>
      <title>{p.name + ' | ' + config.brand}</title>
      <meta name="description" content={p.description} />
      <link rel="canonical" href={new URL('/produk/' + p.slug, window.location.origin).href} />
      <div className="detail-layout">
        <div className="detail-image">
          <img src={productImage(v?.image || p.image)} alt={p.alt} width="800" height="650" />
          {config.demo && <span>ILUSTRASI PRODUK DEMO</span>}
        </div>
        <div className="detail-copy">
          <p className="eyebrow">{p.category} / KOLEKSI RUANG TEDUH</p>
          <h1>{p.name}</h1>
          <p className="detail-price">
            {!v && p.variants.length > 1 ? 'Mulai ' : ''}
            {money(v?.price ?? Math.min(...p.variants.map((v: any) => v.price)))}
          </p>
          <p>{p.description}</p>
          <fieldset className="variants">
            <legend>Pilih {p.category === 'kasur' ? 'ukuran' : 'varian'}</legend>
            {p.variants.map((option: any) => (
              <button
                key={option.sku}
                aria-pressed={selected === option.sku}
                className={selected === option.sku ? 'selected' : ''}
                onClick={() => setSelected(option.sku)}
              >
                {option.label}
                {option.available === 0 ? ' · Habis' : ''}
              </button>
            ))}
          </fieldset>
          <div className="availability" aria-live="polite">
            {v ? (
              <>
                <span className={v.available ? 'dot' : 'dot muted'} />
                {v.available ? `${v.available} tersedia` : 'Stok habis'}
                <small>SKU: {v.sku}</small>
              </>
            ) : (
              'Pilih varian untuk melihat stok dan spesifikasi.'
            )}
          </div>
          <button className="button full" disabled={!v || !v.available} onClick={() => add(p, v)}>
            <ShoppingBag size={18} />
            {!v
              ? 'Pilih varian terlebih dahulu'
              : v.available
                ? 'Tambah ke keranjang'
                : 'Stok habis'}
          </button>
          <Link to="/keranjang" className="text-link center">
            Lihat keranjang <ArrowRight size={16} />
          </Link>
          <div className="detail-info">
            <details open>
              <summary>
                Detail & ukuran <Plus size={16} />
              </summary>
              {v ? (
                <dl>
                  {Object.entries(v.attributes || {}).map(([k, value]) => (
                    <div key={k}>
                      <dt>
                        {(
                          {
                            size: 'Ukuran (cm)',
                            firmness: 'Kekerasan',
                            thickness: 'Ketebalan (cm)',
                            fill: 'Isi',
                            height: 'Tinggi (cm)',
                            material: 'Bahan',
                            finish: 'Finishing',
                            dimensions: 'Dimensi (cm)',
                          } as any
                        )[k] || k}
                      </dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>Pilih varian di atas untuk melihat detail.</p>
              )}
            </details>
            <details>
              <summary>
                Petunjuk perawatan <Plus size={16} />
              </summary>
              <p>{p.care}</p>
            </details>
            <details>
              <summary>
                Pengiriman <Plus size={16} />
              </summary>
              <p>
                Cek ongkir menggunakan alamat Anda saat checkout.{' '}
                {config.demo && 'Zona demo: Jakarta, kode pos berawalan 10–14.'}
              </p>
            </details>
          </div>
        </div>
      </div>
    </main>
  );
}
function Cart() {
  const { cart, setCart } = useStore();
  const subtotal = cart.reduce((n, i) => n + i.price * i.quantity, 0);
  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">PILIHAN ANDA</p>
        <h1>
          Keranjang<span>.</span>
        </h1>
      </div>
      {cart.length ? (
        <div className="checkout-layout">
          <div>
            {cart.map((i) => (
              <article className="cart-row" key={i.sku}>
                <img src={productImage(i.image)} alt={i.name} width="150" height="125" />
                <div>
                  <h3>{i.name}</h3>
                  <p>{i.label}</p>
                  <div className="quantity">
                    <button
                      aria-label={'Kurangi ' + i.name}
                      disabled={i.quantity <= 1}
                      onClick={() =>
                        setCart((c) =>
                          c.map((x) => (x.sku === i.sku ? { ...x, quantity: x.quantity - 1 } : x)),
                        )
                      }
                    >
                      <Minus size={14} />
                    </button>
                    <span>{i.quantity}</span>
                    <button
                      aria-label={'Tambah ' + i.name}
                      disabled={i.quantity >= 20}
                      onClick={() =>
                        setCart((c) =>
                          c.map((x) => (x.sku === i.sku ? { ...x, quantity: x.quantity + 1 } : x)),
                        )
                      }
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
                <div className="cart-cost">
                  <strong>{money(i.price * i.quantity)}</strong>
                  <button
                    className="text-button"
                    onClick={() => setCart((c) => c.filter((x) => x.sku !== i.sku))}
                  >
                    Hapus
                  </button>
                </div>
              </article>
            ))}
            <Link to="/katalog" className="text-link">
              Lanjutkan mencari <ArrowRight size={16} />
            </Link>
          </div>
          <aside className="summary">
            <h2>Ringkasan</h2>
            <div>
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <div>
              <span>Ongkos kirim</span>
              <span>Dihitung di checkout</span>
            </div>
            <p>Harga dan stok diperiksa kembali sebelum pembayaran.</p>
            <Link to="/checkout" className="button full">
              Lanjut ke checkout <ArrowRight size={18} />
            </Link>
          </aside>
        </div>
      ) : (
        <Empty
          title="Masih ada ruang untuk pilihan Anda."
          text="Temukan sesuatu yang pas di katalog."
        />
      )}
    </main>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <ShoppingBag size={35} strokeWidth={1} />
      <h2>{title}</h2>
      <p>{text}</p>
      <Link className="button" to="/katalog">
        Jelajahi katalog <ArrowUpRight size={18} />
      </Link>
    </div>
  );
}
function Account() {
  const { user, refresh, notify } = useStore(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  const [mode, setMode] = useState('login'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const next = params.get('next');
  const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/pesanan';
  if (user && next) return <Navigate to={destination} replace />;
  if (user)
    return (
      <main className="page">
        <p className="eyebrow">AKUN ANDA</p>
        <h1>Halo, {user.name}.</h1>
        <p>{user.email}</p>
        <div className="inline-actions">
          <Link to="/pesanan" className="button">
            Pesanan saya <ArrowRight size={18} />
          </Link>
          <button
            className="button secondary"
            onClick={async () => {
              await api('/auth/logout', 'POST');
              await refresh();
              notify('Anda sudah keluar.');
            }}
          >
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </main>
    );
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    if (!data.code) delete data.code;
    try {
      await api(
        '/auth/' + (mode === 'register' ? 'register' : mode === 'forgot' ? 'forgot' : 'login'),
        'POST',
        data,
      );
      if (mode === 'forgot') {
        notify('Jika email terdaftar, tautan pengaturan ulang akan dikirim.');
        setMode('login');
      } else {
        await refresh();
        navigate(destination);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-art">
        <img src="/images/room.svg" alt="Ilustrasi ruang keluarga" />
        <div>
          <p className="eyebrow">SELAMAT DATANG DI RUANG TEDUH</p>
          <h2>
            Satu langkah
            <br />
            lebih dekat
            <br />
            <em>ke rumah.</em>
          </h2>
        </div>
      </div>
      <div className="auth-form">
        <p className="eyebrow">RUANG UNTUK ANDA</p>
        <h1>
          {mode === 'register'
            ? 'Mari berkenalan.'
            : mode === 'forgot'
              ? 'Mulai kembali.'
              : 'Senang Anda kembali.'}
        </h1>
        <p>
          {mode === 'register'
            ? 'Buat akun untuk menyimpan dan melacak pesanan.'
            : mode === 'forgot'
              ? 'Kami akan mengirim tautan untuk mengganti kata sandi.'
              : 'Masuk untuk melanjutkan pilihan Anda.'}
        </p>
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Nama lengkap
              <input name="name" autoComplete="name" required minLength={2} />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          {mode !== 'forgot' && (
            <label>
              Kata sandi
              <input
                aria-label="Kata sandi"
                aria-describedby="password-hint"
                name="password"
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={10}
                maxLength={128}
                required
              />
              <small id="password-hint">Minimal 10 karakter</small>
            </label>
          )}
          {mode === 'login' && (
            <details>
              <summary>Masuk sebagai admin</summary>
              <label>
                Kode autentikator
                <input
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                />
              </label>
            </details>
          )}
          <Message error={error} />
          <button disabled={busy} className="button full">
            {busy
              ? 'Sebentar…'
              : mode === 'register'
                ? 'Buat akun'
                : mode === 'forgot'
                  ? 'Kirim tautan'
                  : 'Masuk'}
            <ArrowRight size={18} />
          </button>
        </form>
        <div className="auth-links">
          <button
            className="text-button"
            onClick={() => {
              setMode(mode === 'register' ? 'login' : 'register');
              setError('');
            }}
          >
            {mode === 'register' ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
          </button>
          {mode === 'login' && (
            <button className="text-button" onClick={() => setMode('forgot')}>
              Lupa kata sandi?
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
function Reset() {
  const [params] = useSearchParams(),
    [error, setError] = useState(''),
    [done, setDone] = useState(false);
  return (
    <main className="page narrow">
      <h1>Kata sandi baru.</h1>
      {done ? (
        <>
          <p>Kata sandi diperbarui. Silakan masuk kembali.</p>
          <Link to="/akun" className="button">
            Masuk
          </Link>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api('/auth/reset', 'POST', {
                token: params.get('token'),
                password: new FormData(e.currentTarget).get('password'),
              });
              setDone(true);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <label>
            Kata sandi
            <input
              type="password"
              name="password"
              required
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <Message error={error} />
          <button className="button">Simpan kata sandi</button>
        </form>
      )}
    </main>
  );
}
function Checkout() {
  const { user, cart, setCart, config } = useStore(),
    navigate = useNavigate();
  const [address, setAddress] = useState({
      name: '',
      phone: '',
      street: '',
      city: '',
      postalCode: '',
    }),
    [q, setQ] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const storageKey = 'rt.pending-checkout.' + (user?.id || 'guest');
  const [pending, setPending] = useState<any>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    } catch {
      return null;
    }
  });
  const request = useRef<any>(pending?.body || null);
  if (pending) key.current = pending.key;
  if (!user) return <Navigate to="/akun?next=/checkout" replace />;
  const items = cart.map(({ sku, quantity }) => ({ sku, quantity }));
  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setQ(await api('/checkout/quote', 'POST', { items, address }));
      key.current = crypto.randomUUID();
      request.current = null;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pay = async () => {
    setBusy(true);
    setError('');
    try {
      request.current ||= { items, address, quoteHash: q.hash };
      const attempt = { key: key.current, body: request.current };
      sessionStorage.setItem(storageKey, JSON.stringify(attempt));
      setPending(attempt);
      const o = await api('/orders', 'POST', request.current, { 'idempotency-key': key.current });
      sessionStorage.removeItem(storageKey);
      setPending(null);
      setCart((current) =>
        current.flatMap((i) => {
          const bought =
            request.current.items.find((item: any) => item.sku === i.sku)?.quantity || 0;
          return i.quantity > bought ? [{ ...i, quantity: i.quantity - bought }] : [];
        }),
      );
      navigate('/pesanan/' + o.number);
    } catch (e) {
      setError((e as Error).message);
      if (
        e instanceof ApiError &&
        [
          'QUOTE_CHANGED',
          'OUT_OF_STOCK',
          'PAYMENTS_NOT_CONFIGURED',
          'CHECKOUT_PAUSED',
          'INVALID_INPUT',
          'SHIPPING_UNAVAILABLE',
        ].includes(e.code)
      ) {
        sessionStorage.removeItem(storageKey);
        setPending(null);
        setQ(null);
        request.current = null;
      }
    } finally {
      setBusy(false);
    }
  };
  if (pending)
    return (
      <main className="page narrow">
        <p className="eyebrow">CHECKOUT ANDA</p>
        <h1>Melanjutkan pesanan.</h1>
        <p>
          Permintaan sebelumnya tersimpan. Lanjutkan untuk melihat hasilnya tanpa membuat pesanan
          baru.
        </p>
        <Message error={error} />
        <button className="button" disabled={busy} onClick={pay}>
          {busy ? 'Sedang memproses…' : 'Lanjutkan checkout'}
        </button>
        <Link className="text-link" to="/pesanan">
          Lihat pesanan saya
        </Link>
      </main>
    );
  if (!cart.length)
    return (
      <main className="page">
        <Empty title="Keranjang Anda masih kosong." text="Pilih produk sebelum checkout." />
      </main>
    );
  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">LANGKAH TERAKHIR</p>
        <h1>Menuju rumah Anda.</h1>
      </div>
      <div className="checkout-layout">
        <section>
          <h2>Alamat pengiriman</h2>
          {config.demo && <p className="muted">Zona demo: Jakarta, kode pos berawalan 10–14.</p>}
          <form
            onSubmit={check}
            onChange={() => {
              sessionStorage.removeItem(storageKey);
              setPending(null);
              setQ(null);
              request.current = null;
            }}
          >
            <div className="form-grid">
              {[
                ['name', 'Nama penerima', 'name'],
                ['phone', 'Nomor telepon', 'tel'],
                ['city', 'Kota', 'address-level2'],
                ['postalCode', 'Kode pos', 'postal-code'],
              ].map(([key, label, autocomplete]) => (
                <label key={key}>
                  {label}
                  <input
                    required
                    autoComplete={autocomplete}
                    value={address[key as keyof typeof address]}
                    onChange={(e) => setAddress((a) => ({ ...a, [key]: e.target.value }))}
                    pattern={
                      key === 'postalCode'
                        ? '[0-9]{5}'
                        : key === 'phone'
                          ? '[+0-9 -]{9,18}'
                          : undefined
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              Alamat lengkap
              <textarea
                required
                minLength={8}
                maxLength={300}
                autoComplete="street-address"
                value={address.street}
                onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))}
              />
            </label>
            <button className="button secondary" disabled={busy}>
              Cek ongkir <Truck size={18} />
            </button>
          </form>
          <Message error={error} />
        </section>
        <aside className="summary">
          <h2>Ringkasan pesanan</h2>
          {(q?.items || cart).map((i: any) => (
            <div className="summary-item" key={i.sku}>
              <span>
                {i.name}
                <small>
                  {i.label} · {i.quantity} buah
                </small>
              </span>
              <strong>{money(i.price * i.quantity)}</strong>
            </div>
          ))}
          <div>
            <span>Subtotal</span>
            <span>{money(q?.subtotal ?? cart.reduce((n, i) => n + i.quantity * i.price, 0))}</span>
          </div>
          <div>
            <span>Ongkos kirim</span>
            <span>{q ? money(q.shipping) : 'Cek alamat dahulu'}</span>
          </div>
          {q && (
            <div className="summary-total">
              <span>Total</span>
              <strong>{money(q.total)}</strong>
            </div>
          )}
          <p>
            {q
              ? 'Dengan melanjutkan, Anda mengonfirmasi alamat dan rincian biaya di atas.'
              : 'Lengkapi alamat dan cek ongkir untuk melihat total.'}
          </p>
          <button className="button full" disabled={!q || busy} onClick={pay}>
            {busy ? 'Sedang memproses…' : 'Konfirmasi & bayar'}
            <ArrowRight size={18} />
          </button>
        </aside>
      </div>
    </main>
  );
}
function Orders() {
  const { user } = useStore();
  const [orders, setOrders] = useState<any[] | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    if (user)
      api('/orders')
        .then(setOrders)
        .catch((e) => setError(e.message));
  }, [user]);
  if (!user) return <Navigate to="/akun?next=/pesanan" replace />;
  return (
    <main className="page">
      <div className="page-heading">
        <p className="eyebrow">AKUN ANDA</p>
        <h1>Pesanan saya.</h1>
      </div>
      <Message error={error} />
      {!orders && !error ? (
        <Loading />
      ) : orders?.length ? (
        orders.map((o) => (
          <Link className="order-row" to={'/pesanan/' + o.number} key={o.number}>
            <div>
              <h3>{o.number}</h3>
              <p>
                {new Date(o.createdAt).toLocaleDateString('id-ID')} · {o.items.length} produk
              </p>
            </div>
            <span className="badge">{paymentLabel[o.payment]}</span>
            <strong>{money(o.total)}</strong>
            <ArrowUpRight size={20} />
          </Link>
        ))
      ) : (
        !error && (
          <Empty
            title="Cerita pertama Anda dimulai di sini."
            text="Pesanan Anda akan muncul setelah checkout."
          />
        )
      )}
    </main>
  );
}
function OrderDetail() {
  const { number } = useParams(),
    { user, config } = useStore();
  const [o, setO] = useState<any>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = useCallback(() => api('/orders/' + number).then(setO), [number]);
  useEffect(() => {
    if (!user) return;
    void load().catch((e) => setError(e.message));
    const timer = setInterval(() => void load().catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, [load, user]);
  if (!user) return <Navigate to={'/akun?next=/pesanan/' + number} replace />;
  if (error && !o)
    return (
      <main className="page">
        <Message error={error} />
      </main>
    );
  if (!o) return <Loading />;
  const act = async (test = false) => {
    setBusy(true);
    try {
      await api(
        test ? '/testing/orders/' + number + '/pay' : '/orders/' + number + '/check',
        'POST',
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="page">
      <div className="breadcrumb">
        <Link to="/pesanan">Pesanan saya</Link>
        <span>/</span>
        {number}
      </div>
      <div className="page-heading">
        <p className="eyebrow">{number}</p>
        <h1>{o.payment === 'paid' ? 'Terima kasih.' : 'Pilihan Anda tersimpan.'}</h1>
        <p role="status">{paymentLabel[o.payment]}</p>
      </div>
      <div className="checkout-layout">
        <section>
          <div className="order-status">
            <ShieldCheck />
            <div>
              <h3>{paymentLabel[o.payment]}</h3>
              <p>
                Status pengiriman: {shippingLabel[o.fulfillment]}
                {o.tracking ? ' · ' + o.tracking : ''}
              </p>
            </div>
          </div>
          {o.items.map((i: any) => (
            <div className="cart-row" key={i.sku}>
              <img src={productImage(i.image)} alt={i.name} />
              <div>
                <h3>{i.name}</h3>
                <p>
                  {i.label} · {i.quantity} buah
                </p>
              </div>
              <strong>{money(i.price * i.quantity)}</strong>
            </div>
          ))}
          <h3>Alamat pengiriman</h3>
          <p>
            {o.address.name} · {o.address.phone}
            <br />
            {o.address.street}
            <br />
            {o.address.city}, {o.address.postalCode}
          </p>
        </section>
        <aside className="summary">
          <h2>Rincian pembayaran</h2>
          <div>
            <span>Subtotal</span>
            <strong>{money(o.subtotal)}</strong>
          </div>
          <div>
            <span>Pengiriman</span>
            <strong>{money(o.shipping)}</strong>
          </div>
          <div className="summary-total">
            <span>Total</span>
            <strong>{money(o.total)}</strong>
          </div>
          {o.paymentUrl && config.payments === 'midtrans' && (
            <a href={o.paymentUrl} className="button full">
              Lanjutkan pembayaran <ArrowUpRight size={18} />
            </a>
          )}
          {config.payments === 'simulated' && o.payment === 'pending' && (
            <>
              <p>Mode pengujian. Tidak ada uang yang ditagihkan.</p>
              <button className="button full" disabled={busy} onClick={() => act(true)}>
                Simulasikan pembayaran
              </button>
            </>
          )}
          <button className="button secondary full" disabled={busy} onClick={() => act()}>
            Periksa status
          </button>
          <Message error={error} />
        </aside>
      </div>
    </main>
  );
}
function Info() {
  const { pathname } = useLocation(),
    { config } = useStore();
  return (
    <main className="page narrow">
      <p className="eyebrow">RUANG TEDUH</p>
      <h1>{pathname === '/panduan' ? 'Ukur dulu. Pilih kemudian.' : 'Tentang ruang ini.'}</h1>
      {pathname === '/panduan' ? (
        <>
          <p>
            Ukuran yang sesuai dimulai dari ruang dan kebiasaan Anda. Gunakan meteran sebelum
            memilih produk.
          </p>
          <h2>Kasur</h2>
          <p>
            Ukur bagian dalam rangka tempat tidur. Cocokkan panjang dan lebar dalam sentimeter
            dengan varian kasur. Periksa juga ketebalan kasur agar sesuai dengan rangka.
          </p>
          <h2>Bantal</h2>
          <p>
            Perhatikan ukuran sarung, tinggi bantal, dan bahan isi pada detail varian. Pilih
            berdasarkan preferensi Anda.
          </p>
          <h2>Furnitur</h2>
          <p>
            Ukur area penempatan serta jalur masuk, pintu, tangga, dan lift. Sisakan ruang untuk
            bergerak dan membuka pintu atau laci.
          </p>
          <Link to="/katalog" className="button">
            Lihat ukuran produk <ArrowRight size={18} />
          </Link>
        </>
      ) : (
        <>
          <p>
            {config.brand} adalah toko demo untuk kasur, bantal, dan furnitur. Semua katalog, harga,
            tarif pengiriman, dan ilustrasi saat ini merupakan contoh untuk pengembangan.
          </p>
          <p>
            Foto produk, kontak resmi, area layanan, serta kebijakan pengiriman, retur, garansi, dan
            privasi akan tersedia setelah dikonfirmasi oleh pemilik toko.
          </p>
          {config.support && <a href={'mailto:' + config.support}>{config.support}</a>}
        </>
      )}
    </main>
  );
}
function Ready({ children }: { children: React.ReactNode }) {
  const { ready } = useStore();
  return ready ? <>{children}</> : <Loading />;
}
function App() {
  return (
    <BrowserRouter>
      <Provider>
        <Scroll />
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/katalog" element={<Catalog />} />
          <Route path="/produk/:slug" element={<Product />} />
          <Route path="/keranjang" element={<Cart />} />
          <Route path="/akun" element={<Account />} />
          <Route path="/reset" element={<Reset />} />
          <Route
            path="/checkout"
            element={
              <Ready>
                <Checkout />
              </Ready>
            }
          />
          <Route
            path="/pesanan"
            element={
              <Ready>
                <Orders />
              </Ready>
            }
          />
          <Route
            path="/pesanan/:number"
            element={
              <Ready>
                <OrderDetail />
              </Ready>
            }
          />
          <Route
            path="/admin"
            element={
              <Ready>
                <Admin />
              </Ready>
            }
          />
          <Route path="/panduan" element={<Info />} />
          <Route path="/tentang" element={<Info />} />
          <Route
            path="*"
            element={
              <main className="page">
                <h1>Halaman tidak ditemukan.</h1>
                <Link to="/">Kembali ke beranda</Link>
              </main>
            }
          />
        </Routes>
        <Footer />
      </Provider>
    </BrowserRouter>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
