import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { useStore, Message } from './main';
import { api, money, paymentLabel, shippingLabel } from './api';
import { productImage } from './product-image';
const permissions: Record<string, string> = {
  products: 'catalog',
  variants: 'catalog',
  zones: 'catalog',
  orders: 'operations',
  cases: 'finance',
  audit: 'finance',
};
const labels: Record<string, string> = {
  products: 'Produk',
  variants: 'Varian & stok',
  zones: 'Area pengiriman',
  orders: 'Pesanan',
  cases: 'Kasus pembayaran',
  audit: 'Riwayat audit',
};
export function Admin() {
  const { user } = useStore();
  if (!user) return <Navigate to="/akun?next=/admin" replace />;
  if (!user.mfa || !user.permissions.length)
    return (
      <main className="page">
        <h1>Akses terbatas.</h1>
        <p>Akun admin dengan verifikasi MFA diperlukan.</p>
      </main>
    );
  return <AdminPanel />;
}
function AdminPanel() {
  const { user, notify } = useStore();
  const available = Object.keys(permissions).filter((k) =>
    user.permissions.includes(permissions[k]),
  );
  const [tab, setTab] = useState(available[0]),
    [data, setData] = useState<any>(null),
    [edit, setEdit] = useState<any>(null),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setData(null);
    setError('');
    setEdit(null);
    api('/admin/' + (tab === 'variants' ? 'products' : tab))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [tab, revision]);
  async function mutation(path: string, method: string, body: any) {
    setBusy(true);
    setError('');
    try {
      await api(path, method, body);
      notify('Perubahan tersimpan.');
      setEdit(null);
      setRevision((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page admin">
      <div className="section-heading">
        <div>
          <p className="eyebrow">RUANG KERJA</p>
          <h1>Kelola toko.</h1>
        </div>
        <button className="button secondary" onClick={() => setRevision((r) => r + 1)}>
          <RefreshCw size={16} />
          Muat ulang
        </button>
      </div>
      <div className="tabs">
        {available.map((k) => (
          <button key={k} className={tab === k ? 'selected' : ''} onClick={() => setTab(k)}>
            {labels[k]}
          </button>
        ))}
      </div>
      <Message error={error} />
      {['products', 'variants', 'zones'].includes(tab) && (
        <button
          className="button"
          onClick={() =>
            setEdit(
              tab === 'products'
                ? {
                    slug: '',
                    name: '',
                    category: 'kasur',
                    description: '',
                    care: '',
                    image: '/images/mattress.svg',
                    alt: '',
                    published: false,
                    featured: false,
                  }
                : tab === 'variants'
                  ? {
                      sku: '',
                      product: '',
                      label: '',
                      price: 0,
                      physical: 0,
                      shippingClass: 'large',
                      attributes: {},
                    }
                  : {
                      name: '',
                      city: '',
                      postalPrefixes: [],
                      active: true,
                      rates: { small: 0, medium: 0, large: 0 },
                    },
            )
          }
        >
          <Plus size={16} />
          Tambah {tab === 'products' ? 'produk' : tab === 'variants' ? 'varian' : 'area'}
        </button>
      )}
      {edit && (
        <section className="editor">
          <h2>{labels[tab]}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (tab === 'products') {
                const { slug, name, category, description, care, image, alt, published, featured } =
                  edit;
                void mutation('/admin/products/' + slug, 'PUT', {
                  slug,
                  name,
                  category,
                  description,
                  care,
                  image,
                  alt,
                  published,
                  featured,
                });
              }
              if (tab === 'variants') {
                const { sku, product, label, price, physical, shippingClass, attributes } = edit;
                void mutation('/admin/variants/' + sku, 'PUT', {
                  sku,
                  product,
                  label,
                  price: Number(price),
                  physical: Number(physical),
                  shippingClass,
                  attributes,
                });
              }
              if (tab === 'zones') {
                const { name, city, postalPrefixes, active, rates } = edit;
                void mutation('/admin/zones/' + encodeURIComponent(name), 'PUT', {
                  name,
                  city,
                  postalPrefixes,
                  active,
                  rates,
                });
              }
            }}
          >
            <div className="form-grid">
              {(tab === 'products'
                ? [
                    ['slug', 'Alamat produk'],
                    ['name', 'Nama'],
                    ['description', 'Deskripsi'],
                    ['care', 'Perawatan'],
                    ['image', 'Lokasi gambar'],
                    ['alt', 'Deskripsi gambar'],
                  ]
                : tab === 'variants'
                  ? [
                      ['sku', 'SKU'],
                      ['product', 'Alamat produk induk'],
                      ['label', 'Nama varian'],
                      ['price', 'Harga (Rp)'],
                      ['physical', 'Stok fisik'],
                    ]
                  : [
                      ['name', 'Nama area'],
                      ['city', 'Kota'],
                    ]
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    required
                    value={edit[key] ?? ''}
                    type={['price', 'physical'].includes(key) ? 'number' : 'text'}
                    min="0"
                    onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
                  />
                </label>
              ))}
              {tab === 'products' && (
                <>
                  <label>
                    Kategori
                    <select
                      value={edit.category}
                      onChange={(e) => setEdit({ ...edit, category: e.target.value })}
                    >
                      {['kasur', 'bantal', 'furnitur'].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label className="radio">
                    <input
                      type="checkbox"
                      checked={edit.published}
                      onChange={(e) => setEdit({ ...edit, published: e.target.checked })}
                    />
                    Terbitkan (perlu varian)
                  </label>
                  <label className="radio">
                    <input
                      type="checkbox"
                      checked={edit.featured}
                      onChange={(e) => setEdit({ ...edit, featured: e.target.checked })}
                    />
                    Produk pilihan
                  </label>
                </>
              )}
              {tab === 'variants' && (
                <>
                  <label>
                    Kelas pengiriman
                    <select
                      value={edit.shippingClass}
                      onChange={(e) => setEdit({ ...edit, shippingClass: e.target.value })}
                    >
                      {['small', 'medium', 'large'].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  {[
                    ['size', 'Ukuran'],
                    ['firmness', 'Kekerasan'],
                    ['thickness', 'Ketebalan'],
                    ['fill', 'Isi'],
                    ['height', 'Tinggi'],
                    ['material', 'Bahan'],
                    ['finish', 'Finishing'],
                    ['dimensions', 'Dimensi'],
                  ].map(([k, label]) => (
                    <label key={k}>
                      {label}
                      <input
                        value={edit.attributes?.[k] || ''}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            attributes: { ...edit.attributes, [k]: e.target.value },
                          })
                        }
                      />
                    </label>
                  ))}
                </>
              )}
              {tab === 'zones' && (
                <>
                  <label>
                    Awalan kode pos (pisahkan dengan koma)
                    <input
                      required
                      value={edit.postalPrefixes.join(',')}
                      onChange={(e) =>
                        setEdit({
                          ...edit,
                          postalPrefixes: e.target.value.split(',').map((s) => s.trim()),
                        })
                      }
                    />
                  </label>
                  {['small', 'medium', 'large'].map((k) => (
                    <label key={k}>
                      Tarif kelas {k} (Rp)
                      <input
                        required
                        type="number"
                        min="0"
                        value={edit.rates[k]}
                        onChange={(e) =>
                          setEdit({
                            ...edit,
                            rates: { ...edit.rates, [k]: Number(e.target.value) },
                          })
                        }
                      />
                    </label>
                  ))}
                  <label className="radio">
                    <input
                      type="checkbox"
                      checked={edit.active}
                      onChange={(e) => setEdit({ ...edit, active: e.target.checked })}
                    />
                    Area aktif
                  </label>
                </>
              )}
            </div>
            <div className="inline-actions">
              <button disabled={busy} className="button">
                Simpan
              </button>
              <button type="button" className="button secondary" onClick={() => setEdit(null)}>
                Batal
              </button>
            </div>
            <Message error={error} />
          </form>
        </section>
      )}
      {!data ? (
        <p role="status">Memuat…</p>
      ) : (
        <div className="admin-list">
          {tab === 'products' &&
            data.products.map((p: any) => (
              <div className="admin-row" key={p.slug}>
                <img src={productImage(p.image)} alt={p.alt} />
                <div>
                  <h3>{p.name}</h3>
                  <p>
                    {p.category} · {p.published ? 'Terbit' : 'Draf'}
                  </p>
                </div>
                <button className="button secondary" onClick={() => setEdit(p)}>
                  Edit
                </button>
              </div>
            ))}
          {tab === 'variants' &&
            data.variants.map((v: any) => (
              <div className="admin-row" key={v.sku}>
                <div>
                  <h3>
                    {v.sku} · {v.label}
                  </h3>
                  <p>
                    {money(v.price)} · Fisik {v.physical} · Ditahan {v.held} · Alokasi {v.allocated}
                  </p>
                </div>
                <button className="button secondary" onClick={() => setEdit(v)}>
                  Edit
                </button>
              </div>
            ))}
          {tab === 'zones' &&
            data.map((z: any) => (
              <div className="admin-row" key={z._id}>
                <div>
                  <h3>{z.name}</h3>
                  <p>
                    {z.city} · {z.postalPrefixes.join(', ')} · Versi {z.version} ·{' '}
                    {z.active ? 'Aktif' : 'Nonaktif'}
                  </p>
                </div>
                <button className="button secondary" onClick={() => setEdit(z)}>
                  Edit
                </button>
              </div>
            ))}
          {tab === 'orders' &&
            data.map((o: any) => (
              <div className="admin-row wrap" key={o.number}>
                <div>
                  <h3>{o.number}</h3>
                  <p>
                    {paymentLabel[o.payment]} · {shippingLabel[o.fulfillment]} · {money(o.total)}
                  </p>
                  <p>
                    {o.address.name} · {o.address.street}, {o.address.city} {o.address.postalCode}
                  </p>
                  <p>{o.items.map((i: any) => `${i.sku} × ${i.quantity}`).join(', ')}</p>
                </div>
                {o.payment === 'paid' &&
                  ['unprocessed', 'ready', 'shipped'].includes(o.fulfillment) && (
                    <form
                      className="inline-actions"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const tracking = new FormData(e.currentTarget).get('tracking');
                        void mutation('/admin/orders/' + o.number + '/fulfill', 'POST', {
                          status: (
                            { unprocessed: 'ready', ready: 'shipped', shipped: 'delivered' } as any
                          )[o.fulfillment],
                          ...(tracking ? { tracking } : {}),
                        });
                      }}
                    >
                      {o.fulfillment === 'ready' && (
                        <label>
                          Resi / referensi
                          <input name="tracking" required minLength={3} />
                        </label>
                      )}
                      <button className="button secondary" disabled={busy}>
                        {
                          (
                            {
                              unprocessed: 'Siap kirim',
                              ready: 'Tandai dikirim',
                              shipped: 'Tandai diterima',
                            } as any
                          )[o.fulfillment]
                        }
                      </button>
                    </form>
                  )}
              </div>
            ))}
          {tab === 'cases' &&
            data.map((c: any) => (
              <div className="case-row" key={c._id}>
                <h3>
                  {c.order} · {c.reason}
                </h3>
                <p>
                  {c.status} · Penanggung jawab: {c.owner || 'Belum ditentukan'}
                </p>
                {c.notes.map((n: any, i: number) => (
                  <p key={i}>
                    {new Date(n.at).toLocaleString('id-ID')} — {n.text}
                  </p>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutation(
                      '/admin/cases/' + c._id,
                      'POST',
                      Object.fromEntries(new FormData(e.currentTarget)),
                    );
                  }}
                >
                  <div className="form-grid">
                    <label>
                      Penanggung jawab
                      <input name="owner" required minLength={2} defaultValue={c.owner} />
                    </label>
                    <label>
                      Status
                      <select name="status" defaultValue={c.status}>
                        <option value="open">Terbuka</option>
                        <option value="investigating">Ditinjau</option>
                        <option value="closed">Ditutup</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Catatan & referensi bukti
                    <textarea name="note" required minLength={5} />
                  </label>
                  <div className="inline-actions">
                    <button disabled={busy} className="button secondary">
                      Simpan tindak lanjut
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        mutation('/admin/orders/' + c.order + '/reconcile', 'POST', {})
                      }
                    >
                      Periksa gateway
                    </button>
                  </div>
                </form>
                <p className="muted">
                  Penutupan kasus mencatat keputusan operator. Penahanan pengiriman tetap berlaku
                  sampai ditinjau melalui prosedur operasional.
                </p>
              </div>
            ))}
          {tab === 'audit' &&
            data.map((a: any) => (
              <div className="admin-row" key={a._id}>
                <div>
                  <h3>{a.action}</h3>
                  <p>
                    {a.target} · Pelaku: {a.actor}
                  </p>
                </div>
                <time>{new Date(a.createdAt).toLocaleString('id-ID')}</time>
              </div>
            ))}
          {Array.isArray(data) && !data.length && <p>Belum ada data.</p>}
        </div>
      )}
    </main>
  );
}
