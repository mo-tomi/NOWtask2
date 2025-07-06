const { chromium } = require('playwright');
(async () => {
 const browser = await chromium.launch({ args:['--allow-file-access-from-files'] });
 const page = await browser.newPage({ viewport:{ width:1280, height:720 } });
 const url = 'file://' + require('path').resolve(__dirname, 'index.html');
 await page.goto(url);
 await page.fill('#quick-add-input','ドラッグテスト');
 await page.click('#add-button');
 const card = page.locator('.task-card',{hasText:'ドラッグテスト'});
 await card.waitFor({state:'visible',timeout:5000});
 const beforeTop = await card.evaluate(el=>parseInt(el.style.top,10));
 const box = await card.boundingBox();
 const startX = box.x + box.width / 2;
 const startY = box.y + box.height / 2;
 await page.mouse.move(startX, startY);
 await page.mouse.down();
 await page.mouse.move(startX, startY + 60);
 await page.mouse.up();
 const afterTop = await card.evaluate(el=>parseInt(el.style.top,10));
 console.log('before', beforeTop, 'after', afterTop);
 await page.click('#undo-btn');
 await page.waitForTimeout(500);
 const cardAfterUndo = page.locator('.task-card',{hasText:'ドラッグテスト'});
 const count = await cardAfterUndo.count();
 console.log('after undo cards', count);
 if(count>0){
   const undoTop = await cardAfterUndo.evaluate(el=>parseInt(el.style.top,10));
   console.log('undo top', undoTop);
 }
 await browser.close();
})(); 