import { test, expect } from '@playwright/test';
test('customer selects a variant, signs up, confirms shipping and sees verified payment', async ({
  page,
}) => {
  await page.goto('/produk/kasur-senja');
  await page.getByRole('button', { name: '160 × 200 cm', exact: true }).click();
  await expect(page.getByText('SKU: RT-01-2')).toBeVisible();
  await page.getByRole('button', { name: 'Tambah ke keranjang' }).click();
  await page.getByRole('link', { name: 'Lihat keranjang', exact: true }).click();
  await page.getByRole('link', { name: 'Lanjut ke checkout' }).click();
  await page.getByRole('button', { name: 'Belum punya akun? Daftar' }).click();
  await page.getByLabel('Nama lengkap').fill('Pembeli Browser');
  await page.getByLabel('Email', { exact: true }).fill(`browser-${Date.now()}@example.test`);
  await page.getByLabel('Kata sandi', { exact: true }).fill('BrowserPassword!123');
  await page.getByRole('button', { name: 'Buat akun', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Menuju rumah Anda.' })).toBeVisible();
  await page.getByLabel('Nama penerima').fill('Pembeli Browser');
  await page.getByLabel('Nomor telepon').fill('081234567890');
  await page.getByLabel('Kota', { exact: true }).fill('Jakarta');
  await page.getByLabel('Kode pos').fill('12110');
  await page.getByLabel('Alamat lengkap').fill('Jalan Uji Browser Nomor 10');
  await page.getByRole('button', { name: 'Cek ongkir' }).click();
  await expect(page.getByText('Rp 3.440.000', { exact: true })).toBeVisible();
  let loseResponse = true;
  await page.route('**/api/v1/orders', async (route) => {
    if (loseResponse && route.request().method() === 'POST') {
      loseResponse = false;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Konfirmasi & bayar' }).click();
  await expect(page.getByRole('button', { name: 'Lanjutkan checkout', exact: true })).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: 'Lanjutkan checkout', exact: true }).click();
  const orders = await (await page.request.get('/api/v1/orders')).json();
  expect(orders).toHaveLength(1);

  await expect(page.getByRole('heading', { name: 'Pilihan Anda tersimpan.' })).toBeVisible();
  await page.getByRole('button', { name: 'Simulasikan pembayaran' }).click();
  await expect(page.getByRole('heading', { name: 'Terima kasih.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pembayaran diterima' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Terima kasih.' })).toBeVisible();
});
test('catalog URL restores category, price and empty-state filters', async ({ page }) => {
  await page.goto('/katalog?category=bantal&stock=true&sort=price-asc');
  await expect(page.getByRole('heading', { name: 'Bantal Awan', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bantal Embun', exact: true })).toHaveCount(0);
  await page.locator('aside.filters').getByLabel('Maksimum (Rp)').fill('1000');
  await expect(page.getByRole('heading', { name: 'Belum ada yang cocok.' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Belum ada yang cocok.' })).toBeVisible();
  await page.getByRole('button', { name: 'Hapus filter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kasur Senja', exact: true })).toBeVisible();
});
for (const width of [1440, 390, 320])
  test(`responsive storefront at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['/', '/katalog', '/produk/kasur-senja', '/keranjang']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      // The catalog request can add lazy images after the initial document load.
      // Decode every asset explicitly before checking it, including offscreen images.
      await page.locator('img').evaluateAll((imgs) =>
        Promise.all(
          imgs.map(async (element) => {
            const img = element as HTMLImageElement;
            img.loading = 'eager';
            await img.decode();
          }),
        ),
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      expect(
        await page
          .locator('img')
          .evaluateAll((imgs) =>
            imgs.every(
              (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      ).toBe(true);
      if (path === '/')
        await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
      if (path === '/katalog' && width < 760) {
        const button = page.getByRole('button', { name: 'Filter', exact: true });
        await button.click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.getByRole('button', { name: 'Tutup filter' }).click();
        await expect(button).toBeFocused();
      }
    }
  });

test('core public pages have no automated WCAG A/AA violations', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  for (const path of ['/', '/katalog', '/produk/kasur-senja', '/akun']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
      path,
    ).toEqual([]);
  }
});
