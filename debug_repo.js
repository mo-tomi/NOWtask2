const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const url = 'file://' + require('path').resolve(__dirname, 'index.html');
  await page.goto(url);
  await page.fill('#quick-add-input', 'ドラッグテスト');
  await page.click('#add-button');

  const card = page.locator('.task-card', { hasText: 'ドラッグテスト' });
  await card.waitFor({ state: 'visible' });
  const originalTop = await card.evaluate(el => el.style.top);

  // Drag +60px
  const box = await card.boundingBox();
  await page.mouse.move(box.x + 130, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 130, box.y + 90);
  await page.mouse.up();
  const afterTop = await card.evaluate(el => el.style.top);

  const dataAfterDrag = await page.evaluate(() => window.taskApp.repository.findAll().map(t => ({ id: t.id, start: t.startTime, end: t.endTime })));
  console.log('afterDrag', dataAfterDrag);

  // Undo
  await page.click('#undo-btn');
  await page.waitForTimeout(300);
  const undoTop = await card.evaluate(el => el.style.top);
  const dataAfterUndo = await page.evaluate(() => window.taskApp.repository.findAll().map(t => ({ id: t.id, start: t.startTime, end: t.endTime })));
  console.log('afterUndo', dataAfterUndo);
  console.log({ originalTop, afterTop, undoTop });
  await browser.close();
})(); 