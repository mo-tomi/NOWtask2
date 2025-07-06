import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskApp } from '../app.js';

describe('日付スクロール機能 (IntersectionObserver)', () => {
  let dom;
  let window;
  let document;
  let app;
  let intersectionObserverCallback;
  let renderSpy; // renderSpyをここで宣言
  let observedElements = []; // Moved here

  beforeEach(async () => {
    // 日付を '2024-01-01' に固定する
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01'));

    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="app-container">
            <div class="sidebar">
              <h1 id="current-date"></h1>
            </div>
            <div class="main-content">
              <div id="timeline-container" class="timeline-container" style="height: 500px; overflow-y: scroll;">
                <div id="timeline"></div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `, { url: "http://localhost/", resources: "usable" });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;

    // Clear localStorage for a clean slate
    localStorage.clear();

    const MockIntersectionObserver = vi.fn((callback, options) => {
      intersectionObserverCallback = callback;
      return {
        observe: vi.fn(element => observedElements.push(element)),
        unobserve: vi.fn(element => {
          observedElements = observedElements.filter(el => el !== element);
        }),
        disconnect: vi.fn(() => {
          observedElements = [];
        }),
        root: null,
        rootMargin: '',
        thresholds: [],
      };
    });
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    // アプリのインスタンスを作成
    app = new TaskApp(document);
    renderSpy = vi.spyOn(app.renderer, 'renderTimelineForDate');

    // データの設定
    const todayTask = { id: 'task-today', title: '今日の会議', startTime: '10:00', endTime: '11:00', priority: 'medium' };
    app.repository.save(todayTask);
    
    const tomorrowTask = { id: 'task-tomorrow', title: '明日のプレゼン準備', startTime: '14:00', endTime: '15:30', priority: 'medium' };
    localStorage.setItem('tasks-2024-01-02', JSON.stringify([tomorrowTask]));

    // レンダラーを初期化して監視を開始
    app.renderer.init();

    // DOMの更新を待機
    await vi.runAllTicks();

    // Ensure loadedDates is clean for the test
    app.loadedDates = new Set([app.currentDate]);
  });

  afterEach(() => {
    vi.useRealTimers();
    observedElements = []; // Clear for next test
  });

  it('タイムライン下部の番兵が見えたら、翌日のタスクが描画される', async () => {
    // Arrange
    // Get the sentinel from the observedElements array
    const sentinelBottom = observedElements.find(el => el.classList.contains('sentinel-bottom'));
    expect(sentinelBottom).not.toBeNull();

    renderSpy.mockClear(); // スパイの呼び出し履歴をクリア

    // Act: IntersectionObserverのコールバックを直接トリガー
    if (intersectionObserverCallback) {
      intersectionObserverCallback([{ isIntersecting: true, target: sentinelBottom }]);
    }
    
    // Assert: メソッド呼び出しを検証
    expect(renderSpy).toHaveBeenCalledWith('2024-01-02', 'append');

    // Assert: DOMの状態を検証
    const tomorrowTaskEl = document.getElementById('task-tomorrow');
    expect(tomorrowTaskEl).not.toBeNull();
    const dateHeaders = document.querySelectorAll('.date-header-indicator');
    const tomorrowHeader = Array.from(dateHeaders).find(h => h.textContent.includes('2024-01-02'));
    expect(tomorrowHeader).not.toBeUndefined();
  });
}); 