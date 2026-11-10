import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Pause, Play } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { api } from './api';
import { Card } from './product-card';
import { productImage } from './product-image';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const edits = [
  {
    title: 'Ruang keluarga',
    description: 'Tempat cerita bertemu. Sofa lembut dan meja kayu untuk waktu bersama.',
    image: '/images/studio/sofa.jpg',
    alt: 'Visual demo sofa berwarna pasir',
    to: '/katalog?category=furnitur',
    link: 'Jelajahi furnitur',
  },
  {
    title: 'Sudut pribadi',
    description: 'Satu kursi, buku favorit, dan waktu untuk diri sendiri.',
    image: '/images/studio/chair.jpg',
    alt: 'Visual demo kursi kayu dengan dudukan oatmeal',
    to: '/produk/kursi-laras',
    link: 'Kenali Kursi Laras',
  },
  {
    title: 'Ruang istirahat',
    description:
      'Awali hari dari istirahat yang nyaman. Temukan kasur yang sesuai dengan ruang Anda.',
    image: '/images/studio/mattress.jpg',
    alt: 'Visual demo kasur putih berlapis kain rajut',
    to: '/katalog?category=kasur',
    link: 'Jelajahi kasur',
  },
];

const story =
  'Bentuk yang sederhana. Tekstur yang terasa. Pilihan kecil yang membuat Anda ingin tinggal lebih lama.';

export function Home({ brand }: { brand: string }) {
  const root = useRef<HTMLElement>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [activeEdit, setActiveEdit] = useState(0);
  const [marqueePaused, setMarqueePaused] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api('/products?category=furnitur')
      .then((data) => {
        if (!active) return;
        const preferred = ['kursi-laras', 'sofa-rana', 'meja-nara'];
        const sorted = [...data.products].sort((a, b) => {
          const rank = (slug: string) => (preferred.includes(slug) ? preferred.indexOf(slug) : 99);
          return rank(a.slug) - rank(b.slug);
        });
        setProducts(sorted.slice(0, 3));
      })
      .catch(() => {
        if (active) setError('Koleksi belum dapat dimuat. Silakan coba lagi.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.editorial-hero .hero-enter', {
          y: 24,
          duration: 1,
          stagger: 0.12,
          ease: 'power2.out',
          clearProps: 'all',
        });
        gsap.fromTo(
          '.story-word',
          // Keep the resting text readable while revealing words on scroll.
          { opacity: 0.65 },
          {
            opacity: 1,
            stagger: 0.12,
            ease: 'none',
            scrollTrigger: {
              trigger: '.studio-story',
              start: 'top 75%',
              end: 'bottom 65%',
              scrub: 0.6,
            },
          },
        );
      });
      media.add('(min-width: 1000px) and (prefers-reduced-motion: no-preference)', () => {
        ScrollTrigger.create({
          trigger: '.material-layout',
          start: 'top 24%',
          end: 'bottom 66%',
          pin: '.material-copy',
          pinSpacing: false,
        });
      });
      return () => media.revert();
    },
    { scope: root },
  );

  useEffect(() => {
    ScrollTrigger.refresh();
  }, [loading]);

  return (
    <main ref={root} className="home-page overflow-x-hidden w-full max-w-full">
      <section className="editorial-hero" aria-labelledby="home-title">
        <div className="editorial-hero-copy">
          <div className="hero-object" aria-hidden="true">
            <img src="/images/studio/chair.jpg" alt="" width="1254" height="1254" />
          </div>
          <h1 id="home-title" className="max-w-6xl hero-enter">
            {brand === 'Ruang Teduh' ? (
              <>
                Ruang<span>.Teduh</span>
              </>
            ) : (
              brand
            )}
          </h1>
          <p className="hero-intro hero-enter">Ada rasa pulang di setiap sudut.</p>
          <p className="hero-body hero-enter">
            Furnitur, kasur, dan detail kecil untuk ruang yang nyaman. Temukan yang terasa seperti
            Anda.
          </p>
          <div className="hero-cta hero-enter">
            <Link to="/katalog" className="button">
              Jelajahi koleksi <ArrowRight size={17} />
            </Link>
            <a href="#kurasi" className="text-link">
              Temukan inspirasi <ArrowRight size={17} />
            </a>
          </div>
        </div>
        <div className="editorial-hero-visual hero-enter">
          <span className="hero-edition">Bentuk sederhana. Cerita baru.</span>
          <Link to="/produk/meja-nara" className="hero-photo" aria-label="Lihat Meja Nara">
            <img
              src="/images/studio/coffee.jpg"
              alt="Visual demo Meja Nara, meja kayu oval dengan dua cangkir keramik"
              width="1254"
              height="1254"
              fetchPriority="high"
            />
            <span className="hero-photo-arrow" aria-hidden="true">
              <ArrowUpRight size={25} />
            </span>
          </Link>
          <div className="hero-photo-caption">
            <span>Meja Nara</span>
            <span>Kayu natural, bentuk organik</span>
          </div>
        </div>
      </section>

      <section className="editorial-section exclusive" aria-labelledby="collection-title">
        <div className="editorial-heading">
          <h2 id="collection-title">Pilihan untuk keseharian.</h2>
          <Link to="/katalog" className="text-link">
            Semua produk <ArrowRight size={18} />
          </Link>
        </div>
        {error ? (
          <div className="collection-feedback" role="alert">
            <p>{error}</p>
            <button className="text-link" onClick={() => setAttempt((v) => v + 1)}>
              Coba lagi <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <div className="editorial-product-grid" aria-busy={loading}>
            {loading
              ? [0, 1, 2].map((i) => (
                  <div key={i} className="product-skeleton" aria-hidden="true">
                    <div />
                    <span />
                    <span />
                  </div>
                ))
              : products.map((product) => <Card key={product.slug} product={product} />)}
          </div>
        )}
        {!loading && !error && !products.length && (
          <p>
            Koleksi baru sedang disiapkan.{' '}
            <Link className="text-link" to="/katalog">
              Jelajahi katalog <ArrowRight size={16} />
            </Link>
          </p>
        )}
      </section>

      <section id="kurasi" className="editorial-section room-edit" aria-labelledby="edit-title">
        <div className="editorial-heading">
          <h2 id="edit-title">
            Ruang Anda.
            <br />
            Pilihan kami.
          </h2>
          <p>
            Mulai dari sudut
            <br />
            yang paling Anda sukai.
          </p>
        </div>
        <div className="room-accordion">
          {edits.map((edit, i) => (
            <article
              key={edit.title}
              className={'room-panel ' + (activeEdit === i ? 'is-active' : '')}
            >
              <button
                className="room-toggle"
                aria-expanded={activeEdit === i}
                aria-controls={'room-panel-' + i}
                onClick={() => setActiveEdit(i)}
                onMouseEnter={() => setActiveEdit(i)}
              >
                <span>{edit.title}</span>
                <ArrowUpRight size={21} aria-hidden="true" />
              </button>
              <div id={'room-panel-' + i} className="room-panel-content" hidden={activeEdit !== i}>
                <Link
                  to={edit.to}
                  className="room-image"
                  tabIndex={activeEdit === i ? 0 : -1}
                  aria-label={edit.link}
                >
                  <img src={edit.image} alt={edit.alt} width="800" height="800" loading="lazy" />
                </Link>
                <div className="room-panel-caption">
                  <p>{edit.description}</p>
                  <Link to={edit.to} className="text-link" tabIndex={activeEdit === i ? 0 : -1}>
                    {edit.link}
                    <ArrowRight size={17} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="editorial-section studio-story" aria-labelledby="story-title">
        <h2 id="story-title">
          Lebih dari sekadar{' '}
          <span className="inline-studio-image">
            <img src="/images/studio/coffee.jpg" alt="" loading="lazy" width="140" height="70" />
          </span>{' '}
          mengisi ruang.
        </h2>
        <div className="studio-story-layout">
          <Link to="/produk/kursi-laras" className="story-chair" aria-label="Lihat Kursi Laras">
            <img
              src="/images/studio/chair.jpg"
              alt="Visual demo Kursi Laras berbahan kayu dan kain oatmeal"
              width="1254"
              height="1254"
              loading="lazy"
            />
          </Link>
          <div className="story-copy">
            <p>
              {story.split(' ').map((word, i) => (
                <span key={i} className="story-word">
                  {word}{' '}
                </span>
              ))}
            </p>
            <Link to="/tentang" className="text-link">
              Kenali Ruang Teduh <ArrowRight size={18} />
            </Link>
          </div>
          <div className="story-detail" aria-hidden="true">
            <img src="/images/studio/coffee.jpg" alt="" width="1254" height="1254" loading="lazy" />
          </div>
        </div>
      </section>

      <div className={'editorial-marquee ' + (marqueePaused ? 'is-paused' : '')}>
        <div className="marquee-window">
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <div className="marquee-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
                <span>Bentuk sederhana</span>
                <span className="marquee-dot" />
                <span>Warna yang hangat</span>
                <span className="marquee-dot" />
                <span>Ruang untuk pulang</span>
                <span className="marquee-dot" />
              </div>
            ))}
          </div>
        </div>
        <button
          className="marquee-control"
          aria-label={marqueePaused ? 'Putar teks berjalan' : 'Jeda teks berjalan'}
          onClick={() => setMarqueePaused((v) => !v)}
        >
          {marqueePaused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>

      <section className="editorial-section design-series" aria-labelledby="series-title">
        <div className="editorial-heading">
          <h2 id="series-title">Satu rumah, banyak cerita.</h2>
          <p>Temukan koleksi Anda.</p>
        </div>
        <div className="series-grid">
          {[
            {
              title: 'Furnitur',
              note: 'Bentuk yang menemani',
              image: '/images/studio/chair.jpg',
              slug: 'furnitur',
            },
            {
              title: 'Kasur',
              note: 'Awal istirahat yang nyaman',
              image: '/images/mattress.svg',
              slug: 'kasur',
            },
            {
              title: 'Bantal',
              note: 'Detail kecil, rasa berbeda',
              image: '/images/pillow.svg',
              slug: 'bantal',
            },
          ].map((item) => (
            <Link to={'/katalog?category=' + item.slug} className="series-card" key={item.slug}>
              <div className="series-image">
                <img
                  src={productImage(item.image)}
                  alt={'Koleksi ' + item.title}
                  loading="lazy"
                  width="800"
                  height="800"
                />
              </div>
              <div className="series-caption">
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.note}</p>
                </div>
                <ArrowRight size={18} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="editorial-section material-layout" aria-labelledby="material-title">
        <div className="material-copy">
          <h2 id="material-title">
            Nyaman dilihat.
            <br />
            Nyaman dihuni.
          </h2>
          <p>
            Dari serat kayu hingga lembutnya kain, setiap detail memberi rasa pada ruang. Padukan
            bahan dan ukuran yang sesuai dengan cara Anda menikmati rumah.
          </p>
          <Link to="/panduan" className="text-link">
            Temukan ukuran yang pas <ArrowRight size={18} />
          </Link>
        </div>
        <div className="material-gallery">
          <Link
            to="/produk/meja-nara"
            className="material-closeup"
            aria-label="Lihat detail Meja Nara"
          >
            <img
              src="/images/studio/coffee.jpg"
              alt="Detail serat kayu dan tepian membulat pada Meja Nara"
              width="1254"
              height="1254"
              loading="lazy"
            />
          </Link>
          <Link
            to="/produk/kursi-laras"
            className="material-fabric"
            aria-label="Lihat detail Kursi Laras"
          >
            <img
              src="/images/studio/chair.jpg"
              alt="Detail tekstur kain oatmeal dan sandaran kayu Kursi Laras"
              width="1254"
              height="1254"
              loading="lazy"
            />
          </Link>
        </div>
      </section>

      <section className="home-invitation">
        <h2>
          Sisakan ruang
          <br />
          untuk yang Anda suka.
        </h2>
        <Link to="/katalog" className="button">
          Temukan pilihan Anda <ArrowUpRight size={20} />
        </Link>
      </section>
    </main>
  );
}
