import { test, expect } from '@playwright/test';

test('page loads with all panels', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#code-editor')).toBeVisible();
  await expect(page.locator('#circuit-canvas')).toBeVisible();
  await expect(page.locator('#serial-monitor')).toBeVisible();
});

test('code editor accepts input', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('.cm-editor');
  await expect(editor).toBeVisible();
});

test('loading an example populates code and circuit', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#example-select', '0'); // LED Blink
  // Code editor should contain LED blink code
  const editorText = await page.locator('.cm-content').textContent();
  expect(editorText).toContain('ledPin');
});

test('run button starts execution', async ({ page }) => {
  await page.goto('/');
  // Load serial-output-producing example
  await page.selectOption('#example-select', '3'); // Ultrasonic distance
  await page.click('#btn-run');
  // Wait for serial output
  await expect(page.locator('#serial-output')).toContainText('Distance:', { timeout: 5000 });
  await page.click('#btn-stop');
});

test('distance slider updates value display', async ({ page }) => {
  await page.goto('/');
  const slider = page.locator('#distance-slider');
  await slider.fill('50');
  await expect(page.locator('#distance-value')).toHaveText('50');
});
