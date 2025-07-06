const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const messages = [];
  page.on('console', msg => messages.push(`${msg.type()}: ${msg.text()}`));

  await page.goto('file://' + require('path').resolve(__dirname, 'index.html'));
  await page.fill('#quick-add-input', '完了テスト');
  await page.click('#add-button');
  await page.waitForTimeout(1000);
  const count = await page.locator('.task-card').count();
  console.log('task-card count', count);
  const html = await page.content();
  console.log('console logs', messages);

  await page.fill('#quick-add-input', 'ドラッグテスト');
  await page.click('#add-button');
  await page.waitForTimeout(500);
  console.log('count after second add', await page.locator('.task-card').count());

  const dragCard = page.locator('.task-card', { hasText: 'ドラッグテスト' });
  console.log('drag Visible', await dragCard.isVisible());

  await browser.close();
})(); 