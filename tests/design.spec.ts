import { test, expect } from '@playwright/test';

test('editorial layout fits its images and keeps room curation keyboard accessible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.editorial-product-grid .product-card')).toHaveCount(3);
  const photo = await page
    .getByRole('link', { name: 'Lihat Meja Nara', exact: true })
    .boundingBox();
  expect(photo).not.toBeNull();
  expect(photo!.height / photo!.width).toBeGreaterThan(0.9);
  expect(photo!.height / photo!.width).toBeLessThan(1.2);

  const room = page.getByRole('button', { name: 'Sudut pribadi', exact: true });
  await room.focus();
  await page.keyboard.press('Enter');
  await expect(room).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Ruang keluarga', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(
    page.locator('#room-panel-1').getByRole('link', { name: 'Kenali Kursi Laras' }).last(),
  ).toBeVisible();
  await page
    .locator('#room-panel-1')
    .getByRole('link', { name: 'Kenali Kursi Laras' })
    .last()
    .click();
  await expect(page).toHaveURL(/\/produk\/kursi-laras$/);
  await expect(page.getByRole('heading', { name: 'Kursi Laras', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile navigation and reduced motion remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.story-word').first()).toHaveCSS('opacity', '1');
  await expect(page.locator('.marquee-track')).toHaveCSS('animation-name', 'none');
  await expect(page.getByRole('button', { name: 'Jeda teks berjalan' })).toBeHidden();
  await page.getByRole('button', { name: 'Buka navigasi' }).click();
  await expect(page.getByRole('button', { name: 'Tutup navigasi' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .getByRole('link', { name: 'Katalog' })
    .click();
  await expect(page).toHaveURL(/\/katalog$/);
  await expect(page.getByRole('button', { name: 'Buka navigasi' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});
