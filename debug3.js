const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({ args:['--allow-file-access-from-files'] });
 const context = await browser.newContext({ viewport:{width:1280,height:720} });
 const url = 'file://' + require('path').resolve(__dirname,'index.html');
 // first test
 let page = await context.newPage();
 await page.goto(url);
 await page.fill('#quick-add-input', '完了テスト');
 await page.click('#add-button');
 const card1 = page.locator('.task-card',{hasText:'完了テスト'});
 await card1.waitFor({state:'visible',timeout:5000});
 await card1.click();
 await page.close();
 // second test new page
 page = await context.newPage();
 await page.goto(url);
 await page.fill('#quick-add-input', 'ドラッグテスト');
 await page.click('#add-button');
 const card2 = page.locator('.task-card',{hasText:'ドラッグテスト'});
 try {
   await card2.waitFor({state:'visible',timeout:5000});
   console.log('card2 visible');
 } catch(e){ console.error('card2 timeout'); }
 await browser.close();
})(); 