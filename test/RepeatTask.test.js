import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskApp } from '../app.js';

/**
 * リピートタスク (毎日) 自動生成の統合テスト
 * 失敗するテスト (Red) として追加する。
 */

describe('リピートタスク自動生成 (daily)', () => {
  let window;
  let document;
  let app;

  beforeEach(() => {
    // 前日のデータを localStorage に直接保存しておく
    const prevDate = '2025-01-01';
    const repeatTask = {
      id: 'task-repeat-1',
      title: 'ストレッチ',
      startTime: '07:00',
      endTime: '07:15',
      repeat: 'daily',
      date: prevDate,
      priority: 'medium',
      completed: false,
      lane: 1,
    };
    const prevKey = `tasks-${prevDate}`;
    global.localStorage = {
      _data: { [prevKey]: JSON.stringify([repeatTask]) },
      getItem(k) { return this._data[k] ?? null; },
      setItem(k, v) { this._data[k] = String(v); },
      clear() { this._data = {}; },
    };

    // JSDOM セットアップ (最小の DOM )
    const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="timeline"></div></body></html>`, {
      url: 'http://localhost/',
    });
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;

    // IntersectionObserver モック (Renderer 内で参照されるため)
    global.IntersectionObserver = vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    // confirm/alert をダミー置き換え
    global.confirm = () => true;
    global.alert = () => {};

    app = new TaskApp(document);
    app.init();
  });

  it('setDate で翌日に切り替えた際、daily タスクがコピーされる', () => {
    // Arrange: 翌日へ切り替え
    const nextDate = '2025-01-02';

    // Act
    app.setDate(nextDate);

    // Assert: repository にタスクが 1 件生成されている
    const tasks = app.repository.findAll();
    expect(tasks).toHaveLength(1);
    const t = tasks[0];
    expect(t.title).toBe('ストレッチ');
    expect(t.date).toBe(nextDate);
    expect(t.repeat).toBe('daily');
  });
}); 