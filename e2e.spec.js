const { test, expect } = require('@playwright/test');
const path = require('path');

test.use({
  launchOptions: {
    args: ['--allow-file-access-from-files']
  }
});

const url = 'file://' + path.resolve(__dirname, 'index.html');

test.describe('Playwright E2E: タスク完了とアンドゥ／リドゥ', () => {

  test('タスクをクリックすると完了状態になり、再度クリックで元に戻る', async ({ page }) => {
    
    await page.goto(url);

    // 現時点では、ボタンの存在確認のみ
    await expect(page.locator('h1')).toHaveText('NowTask');
    const addButton = page.locator('#add-button');
    await expect(addButton).toBeVisible();

    // ★ステップ2：タスクを追加する
    await page.fill('#quick-add-input', '完了テスト');
    await page.click('#add-button');

    // ★ステップ3：追加したタスクが表示されていることを確認
    const card = page.locator('.task-card', { hasText: '完了テスト' });
    await expect(card).toBeVisible();

    // ★ステップ4：カードをクリックし、クラスが変更されることを確認
    await card.click();
    await expect(card).toHaveClass(/completed/);

    // 2. 再度クリックして未完了状態に戻す
    await card.click();
    await expect(card).not.toHaveClass(/completed/);

    console.log('✅ 全てのテストが成功しました！');
  });

  test('タスクカードをドラッグして時間を変更し、Undo/Redo で元に戻る', async ({ page }) => {
    await page.goto(url);

    // タスクを追加
    await page.fill('#quick-add-input', 'ドラッグテスト');
    await page.click('#add-button');

    const card = page.locator('.task-card', { hasText: 'ドラッグテスト' });
    await expect(card).toBeVisible();

    const beforeTop = await card.evaluate(el => parseInt(el.style.top, 10));

    // カード中央を 60px 下へドラッグ
    const box = await card.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + 60);
    await page.mouse.up();

    const afterTop = await card.evaluate(el => parseInt(el.style.top, 10));
    await expect(afterTop).toBe(beforeTop + 60);

    // Undo
    await page.click('#undo-btn');
    const undoTop = await card.evaluate(el => parseInt(el.style.top, 10));
    await expect(undoTop).toBe(beforeTop);

    // Redo
    await page.click('#redo-btn');
    const redoTop = await card.evaluate(el => parseInt(el.style.top, 10));
    await expect(redoTop).toBe(beforeTop + 60);
  });

  test('タスクカードのリサイズで長さを変更し、Undo/Redo で元に戻る', async ({ page }) => {
    await page.goto(url);

    // タスクを追加
    await page.fill('#quick-add-input', 'リサイズテスト');
    await page.click('#add-button');
    const card = page.locator('.task-card', { hasText: 'リサイズテスト' });
    await expect(card).toBeVisible();

    const beforeHeight = await card.evaluate(el => parseInt(el.style.height, 10));

    // リサイズハンドルを掴んで +60px
    const box = await card.boundingBox();
    const handleY = box.y + box.height - 2; // ハンドル近辺
    const handleX = box.x + box.width / 2;
    await page.mouse.move(handleX, handleY);
    await page.mouse.down();
    await page.mouse.move(handleX, handleY + 60);
    await page.mouse.up();

    const afterHeight = await card.evaluate(el => parseInt(el.style.height, 10));
    await expect(afterHeight).toBe(beforeHeight + 60);

    // Undo
    await page.click('#undo-btn');
    const undoHeight = await card.evaluate(el => parseInt(el.style.height, 10));
    await expect(undoHeight).toBe(beforeHeight);

    // Redo
    await page.click('#redo-btn');
    const redoHeight = await card.evaluate(el => parseInt(el.style.height, 10));
    await expect(redoHeight).toBe(beforeHeight + 60);
  });

});

// ＝＝＝＝＝＝ Playwright E2E: レスポンシブ表示テスト追加 ＝＝＝＝＝＝

test.describe('Playwright E2E: レスポンシブ表示', () => {
  test('スマホ幅ではサイドバーが非表示になる', async ({ page }) => {
    // iPhone 12 / 13 相当のビューポート
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(url);

    // タイトル要素が表示されていること（ページが正常に描画）
    await expect(page.locator('h1')).toHaveText('NowTask');

    // サイドバーが非表示（visibility: hidden / display:none / 画面外）を期待
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).not.toBeVisible();
  });
});