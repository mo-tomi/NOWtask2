import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskApp } from '../app.js';

// index.htmlの内容を読み込む（ここでは簡略化のため定数として持つ）
// 実際はfs.readFileSyncなどで読み込むのが望ましいが、テストの自己完結性を高める
const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NowTask</title>
</head>
<body>
    <div class="app-container">
        <aside class="sidebar">
            <div class="sidebar-header">
                <h1>NowTask</h1>
                <div class="date-nav">
                    <button id="prev-day-btn">‹</button>
                    <span id="current-date"></span>
                    <button id="next-day-btn">›</button>
                </div>
            </div>
            <div class="sidebar-section">
                <h2>クイック追加</h2>
                <input type="text" id="quick-add-input" placeholder="タスク名 @10:00-11:00 #タグ">
                <button id="add-button">タスクを追加</button>
            </div>
            <!-- 他のUI要素... -->
        </aside>
        <main class="main-content">
            <div id="timeline-container">
                <div id="timeline"></div>
            </div>
        </main>
    </div>
    <div id="task-context-menu" class="context-menu" style="display: none;">
        <ul>
            <li id="menu-edit">編集</li>
            <li id="menu-duplicate">複製</li>
            <li id="menu-delete">削除</li>
        </ul>
    </div>
</body>
</html>
`;

describe('URL共有機能', () => {
  let window;
  let document;

  // JSDOMのセットアップを共通化
  const setupDOM = (url) => {
    const dom = new JSDOM(html, { url });
    window = dom.window;
    document = dom.window.document;
    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;
    global.URLSearchParams = window.URLSearchParams; // JSDOM v12+ では不要だが念のため
    global.IntersectionObserver = vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  };

  it('URLに ?date=YYYY-MM-DD が指定されている場合、その日付でアプリが初期化される', () => {
    // Arrange
    setupDOM("http://localhost/?date=2025-10-20");
    const app = new TaskApp(document);

    // Act
    app.init();

    // Assert
    expect(app.currentDate).toBe('2025-10-20');
    const dateEl = document.getElementById('current-date');
    expect(dateEl.textContent).toBe('2025-10-20');
  });

  it('URLにdateパラメータがない場合、今日の日付で初期化される', () => {
    // Arrange
    setupDOM("http://localhost/");
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;
    
    // Act
    const app = new TaskApp(global.document);
    app.init();

    // Assert
    expect(app.currentDate).toBe(todayStr);
    const dateEl = document.getElementById('current-date');
    expect(dateEl.textContent).toBe(todayStr);
  });
}); 