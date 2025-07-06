import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskApp } from '../app.js';

/**
 * テンプレートタスク追加機能のテスト
 */

describe('テンプレートタスク追加機能', () => {
  let window;
  let document;
  let app;

  beforeEach(() => {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="app-container">
            <aside class="sidebar">
              <button id="template-lunch">昼ごはんテンプレ</button>
            </aside>
            <main>
              <div id="timeline"></div>
            </main>
          </div>
        </body>
      </html>
    `, { url: 'http://localhost/' });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;

    localStorage.clear();

    app = new TaskApp(document);
    // テストでは UI 初期化が不要なので repository などだけ使う
  });

  it('テンプレート名 "lunch" を追加すると 12:00-13:00 のタスクが作成される', () => {
    // Act: テンプレートタスクを追加
    app.addTemplateTask('lunch');

    // Assert: repository にタスクが保存されている
    const tasks = app.repository.findAll();
    expect(tasks).toHaveLength(1);

    const t = tasks[0];
    expect(t.title).toBe('昼ごはん');
    expect(t.startTime).toBe('12:00');
    expect(t.endTime).toBe('13:00');
  });
}); 