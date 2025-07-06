import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskApp } from '../app.js';

/**
 * sentinel-top が交差したとき、前日のタスクが存在しなくても
 * 日付ヘッダーが prepend されることを検証する統合テスト。
 */

describe('日付スクロール機能 (IntersectionObserver) - sentinel-top', () => {
  let dom;
  let window;
  let document;
  let app;
  let intersectionObserverCallback;
  let observedElements = [];
  let renderSpy;

  beforeEach(async () => {
    // 現在日付を 2024-01-02 に固定
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-02'));

    dom = new JSDOM(
      `<!DOCTYPE html>
      <html>
        <body>
          <div class="app-container">
            <div class="sidebar"></div>
            <div class="main-content">
              <div id="timeline-container" class="timeline-container" style="height: 500px; overflow-y: scroll;">
                <div id="timeline"></div>
              </div>
            </div>
          </div>
        </body>
      </html>`,
      { url: 'http://localhost/', resources: 'usable' }
    );

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;

    // localStorage をクリア
    localStorage.clear();

    // Mock IntersectionObserver
    const MockIntersectionObserver = vi.fn((callback) => {
      intersectionObserverCallback = callback;
      return {
        observe: vi.fn((el) => observedElements.push(el)),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    });
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    // アプリ初期化
    app = new TaskApp(document);
    renderSpy = vi.spyOn(app.renderer, 'renderTimelineForDate');

    // 現在日 (2024-01-02) にダミータスクを保存してタイムラインを構築
    const todayTask = {
      id: 'task-today',
      title: 'テストタスク',
      startTime: '09:00',
      endTime: '10:00',
      priority: 'medium',
    };
    app.repository.save(todayTask);

    // レンダラー開始
    app.renderer.init();
    await vi.runAllTicks();

    // loadedDates を初期化
    app.loadedDates = new Set([app.currentDate]);
  });

  afterEach(() => {
    vi.useRealTimers();
    observedElements = [];
  });

  it('トップ番兵が見えたら、前日の日付ヘッダーが描画される', () => {
    // Arrange: sentinel-top を取得
    const sentinelTop = observedElements.find((el) => el.classList.contains('sentinel-top'));
    expect(sentinelTop).not.toBeNull();

    renderSpy.mockClear();

    // Act: IntersectionObserver コールバックを発火させる
    intersectionObserverCallback?.([{ isIntersecting: true, target: sentinelTop }]);

    // Assert: renderTimelineForDate が呼ばれ、引数に 2024-01-01, prepend が渡される
    expect(renderSpy).toHaveBeenCalledWith('2024-01-01', 'prepend');

    // Assert: DOM に日付ヘッダーが存在 (タスクがなくてもヘッダーだけは追加される)
    const dateHeaders = document.querySelectorAll('.date-header-indicator');
    const prevHeader = Array.from(dateHeaders).find((h) => h.textContent.includes('2024-01-01'));
    expect(prevHeader).not.toBeUndefined();
  });
}); 