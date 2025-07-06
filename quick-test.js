const { test, expect } = require('@playwright/test');
const path = require('path');

const url = 'file://' + path.resolve(__dirname, 'index.html');

test.describe('超・最小限テスト', () => {

  test('ページが正しく読み込まれ、ボタンが存在することを確認する', async ({ page }) => {
    
    // ページに移動
    await page.goto(url);

    // ヘッダーのタイトルが表示されていることを確認
    await expect(page.locator('h1')).toHaveText('NowTask');
    
    // 追加ボタンが存在し、クリック可能であることを確認
    const addButton = page.locator('#add-button');
    await expect(addButton).toBeVisible();
    await expect(addButton).toBeEnabled();

    console.log('✅ 超・最小限テストは成功しました。Playwrightの基本動作は問題ありません。');
  });

});