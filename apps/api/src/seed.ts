import { connect, Product, Variant, Zone, mongoose } from './models.js';
import { config } from './config.js';
export async function seed() {
  if (config.prod || !config.demo)
    throw Error('Demo seed requires a non-production demo environment');
  const products = [
    {
      slug: 'kasur-senja',
      name: 'Kasur Senja',
      category: 'kasur',
      description:
        'Kasur busa dengan lapisan atas berlapis kain rajut. Pilih ukuran yang sesuai dengan rangka tempat tidur Anda.',
      care: 'Gunakan pelindung kasur. Bersihkan permukaan dengan kain lembap dan keringkan sebelum digunakan.',
      image: '/images/mattress.svg',
      alt: 'Ilustrasi kasur berlapis kain putih',
      featured: true,
      variants: [
        ['90 × 200 cm', 1890000, 12, { size: '90 × 200', firmness: 'Medium', thickness: '24' }],
        ['160 × 200 cm', 3290000, 8, { size: '160 × 200', firmness: 'Medium', thickness: '24' }],
        ['180 × 200 cm', 3790000, 3, { size: '180 × 200', firmness: 'Medium', thickness: '24' }],
      ],
    },
    {
      slug: 'bantal-awan',
      name: 'Bantal Awan',
      category: 'bantal',
      description:
        'Bantal isi microfiber dengan sarung katun yang dapat dilepas. Tersedia dalam dua pilihan tinggi.',
      care: 'Cuci sarung secara terpisah pada suhu rendah. Keringkan isi bantal sepenuhnya.',
      image: '/images/pillow.svg',
      alt: 'Ilustrasi dua bantal berwarna putih tulang',
      featured: true,
      variants: [
        ['50 × 70 cm · 12 cm', 249000, 30, { fill: 'Microfiber', height: '12' }],
        ['50 × 70 cm · 16 cm', 289000, 15, { fill: 'Microfiber', height: '16' }],
      ],
    },
    {
      slug: 'kursi-laras',
      name: 'Kursi Laras',
      category: 'furnitur',
      description:
        'Kursi santai dengan rangka kayu dan dudukan kain berwarna oatmeal. Dimensi 72 × 78 × 80 cm.',
      care: 'Lap rangka dengan kain kering. Gunakan penyedot debu untuk membersihkan dudukan.',
      image: '/images/chair.svg',
      alt: 'Ilustrasi kursi santai kayu dan kain oatmeal',
      featured: true,
      variants: [
        [
          'Oak · Oatmeal',
          2150000,
          6,
          { material: 'Kayu oak', finish: 'Natural', dimensions: '72 × 78 × 80' },
        ],
      ],
    },
    {
      slug: 'sofa-rana',
      name: 'Sofa Rana',
      category: 'furnitur',
      description: 'Sofa tiga dudukan berlapis kain tenun warna pasir. Dimensi 210 × 90 × 78 cm.',
      care: 'Bersihkan dengan penyedot debu dan hindarkan dari sinar matahari langsung.',
      image: '/images/sofa.svg',
      alt: 'Ilustrasi sofa tiga dudukan berwarna pasir',
      featured: true,
      variants: [
        [
          '210 cm · Pasir',
          6490000,
          4,
          { material: 'Kain tenun', finish: 'Pasir', dimensions: '210 × 90 × 78' },
        ],
      ],
    },
    {
      slug: 'meja-sela',
      name: 'Meja Sela',
      category: 'furnitur',
      description: 'Meja samping bundar dari kayu dengan diameter 45 cm dan tinggi 50 cm.',
      care: 'Gunakan alas gelas dan bersihkan tumpahan segera.',
      image: '/images/table.svg',
      alt: 'Ilustrasi meja samping bundar dari kayu',
      variants: [
        [
          'Ø 45 × 50 cm',
          890000,
          10,
          { material: 'Kayu oak', finish: 'Natural', dimensions: '45 × 45 × 50' },
        ],
      ],
    },
    {
      slug: 'kasur-fajar',
      name: 'Kasur Fajar',
      category: 'kasur',
      description:
        'Kasur dengan penopang pegas dan lapisan busa. Permukaan lebih padat dengan ketebalan 28 cm.',
      care: 'Putar kasur secara berkala. Gunakan pelindung yang dapat dicuci.',
      image: '/images/bed.svg',
      alt: 'Ilustrasi kasur tebal di atas rangka tempat tidur',
      variants: [
        ['160 × 200 cm', 4590000, 7, { size: '160 × 200', firmness: 'Firm', thickness: '28' }],
        ['180 × 200 cm', 5190000, 0, { size: '180 × 200', firmness: 'Firm', thickness: '28' }],
      ],
    },
    {
      slug: 'bantal-embun',
      name: 'Bantal Embun',
      category: 'bantal',
      description: 'Bantal lateks dengan profil rendah. Ukuran 40 × 60 cm dan tinggi 10 cm.',
      care: 'Bersihkan dengan kain lembap. Jangan rendam isi bantal.',
      image: '/images/pillow-green.svg',
      alt: 'Ilustrasi bantal dengan sarung hijau sage',
      variants: [['40 × 60 cm · 10 cm', 399000, 0, { fill: 'Lateks', height: '10' }]],
    },
    {
      slug: 'bangku-temu',
      name: 'Bangku Temu',
      category: 'furnitur',
      description:
        'Bangku kayu untuk area masuk atau ujung tempat tidur. Dimensi 110 × 35 × 45 cm.',
      care: 'Lap dengan kain kering dan hindari genangan air.',
      image: '/images/bench.svg',
      alt: 'Ilustrasi bangku kayu natural',
      variants: [
        [
          '110 cm · Natural',
          1490000,
          5,
          { material: 'Kayu oak', finish: 'Natural', dimensions: '110 × 35 × 45' },
        ],
      ],
    },
    {
      slug: 'meja-nara',
      name: 'Meja Nara',
      category: 'furnitur',
      description: 'Meja rendah berbentuk oval. Permukaan kayu dengan finishing natural.',
      care: 'Gunakan alas untuk benda panas dan lap dengan kain lembut.',
      image: '/images/coffee.svg',
      alt: 'Ilustrasi meja kopi oval dari kayu',
      variants: [
        [
          '100 × 55 × 38 cm',
          1790000,
          8,
          { material: 'Kayu oak', finish: 'Natural', dimensions: '100 × 55 × 38' },
        ],
      ],
    },
  ];
  for (const [index, p] of products.entries()) {
    const { variants, ...data } = p;
    await Product.updateOne(
      { slug: p.slug },
      { $setOnInsert: { ...data, published: true } },
      { upsert: true },
    );
    for (const [i, v] of variants.entries()) {
      const [label, price, physical, attributes] = v;
      await Variant.updateOne(
        { sku: `RT-${String(index + 1).padStart(2, '0')}-${i + 1}` },
        {
          $setOnInsert: {
            product: p.slug,
            label,
            price,
            physical,
            held: 0,
            allocated: 0,
            shippingClass:
              p.category === 'bantal' ? 'small' : p.slug === 'meja-sela' ? 'medium' : 'large',
            attributes,
          },
        },
        { upsert: true },
      );
    }
  }
  await Zone.updateOne(
    { name: 'Jakarta Demo' },
    {
      $setOnInsert: {
        city: 'jakarta',
        postalPrefixes: ['10', '11', '12', '13', '14'],
        rates: { small: 20000, medium: 75000, large: 150000 },
        active: true,
        version: 1,
      },
    },
    { upsert: true },
  );
}
if (process.argv[1]?.endsWith('seed.ts')) {
  await connect();
  await seed();
  console.log('Demo catalog seeded; existing records preserved.');
  await mongoose.disconnect();
}
