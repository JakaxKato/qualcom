import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { money } from './api';
import { productImage } from './product-image';

export function Card({ product: p }: { product: any }) {
  return (
    <article className="product-card">
      <Link to={'/produk/' + p.slug} className="product-image">
        <img src={productImage(p.image)} alt={p.alt} loading="lazy" width="800" height="800" />
        {p.available === 0 && <span className="product-tag">Stok habis</span>}
        <span className="card-arrow" aria-hidden="true">
          <ArrowUpRight size={20} />
        </span>
      </Link>
      <div className="product-caption">
        <div className="product-title-row">
          <Link to={'/produk/' + p.slug}>
            <h3>{p.name}</h3>
          </Link>
          <span className="product-material">{p.variants[0]?.label}</span>
        </div>
        <div className="product-price-row">
          <span className="product-price">
            {p.variants.length > 1 && <small>Mulai </small>}
            {money(p.price)}
          </span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}
