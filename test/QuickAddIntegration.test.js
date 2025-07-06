import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskApp } from '../app.js';

// 統合テスト: Quick Add で時間入力した場合の挙動

describe('統合テスト: Quick Add の時間入力', () => {
  let dom;
  let document;
  let app;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="app-container">
            <div class="sidebar">
              <input id="quick-add-input">
              <button id="add-button">追加</button>
              <button id="undo-btn"></button>
              <button id="redo-btn"></button>
              <button id="clear-completed-btn"></button>
              <select id="priority-filter"></select>
            </div>
            <div class="timeline-wrapper">
              <div id="timeline" class="timeline"></div>
            </div>
          </div>
          <!-- 必要なダイアログ -->
          <div id="edit-dialog" style="display:none;">
            <input id="edit-task-id" type="hidden">
            <input id="edit-title">
            <input id="edit-startTime">
            <input id="edit-endTime">
            <select id="edit-priority"></select>
            <button id="save-edit-btn"></button>
            <button id="cancel-edit-btn"></button>
          </div>
        </body>
      </html>
    `, { url: 'http://localhost' });
    document = dom.window.document;
    global.window = dom.window;
    global.document = document;
    global.localStorage = dom.window.localStorage;
    global.confirm = () => true;
    global.alert = () => {};

    app = new TaskApp(document);
    app.init();
  });

  it('"10:00-11:30 企画会議" を入力すると repository と UI が正しく更新される', () => {
    const quickInput = document.getElementById('quick-add-input');
    quickInput.value = '10:00-11:30 企画会議';
    document.getElementById('add-button').click();

    // Repository に 1 件追加され、時間が正しい
    const tasks = app.repository.findAll();
    expect(tasks).toHaveLength(1);
    const task = tasks[0];
    expect(task.title).toBe('企画会議');
    expect(task.startTime).toBe('10:00');
    expect(task.endTime).toBe('11:30');

    // Timeline にカードが描画されている
    const card = document.querySelector('.task-card');
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('企画会議');
    // lane データ属性が設定されている
    expect(card.getAttribute('data-lane')).toBeDefined();
  });
}); 