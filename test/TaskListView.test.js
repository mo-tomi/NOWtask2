import { describe, it, beforeEach, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskApp } from '../app.js';

// タスク一覧ビューの統合テスト

describe('タスク一覧ビュー', () => {
  let dom;
  let document;
  let app;

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div class="app-container">
        <div class="sidebar">
          <input id="quick-add-input">
          <button id="add-button">追加</button>
          <button id="undo-btn"></button>
          <button id="redo-btn"></button>
          <button id="clear-completed-btn"></button>
          <select id="priority-filter"></select>
          <ul id="task-list"></ul>
        </div>
        <div class="timeline-wrapper"><div id="timeline" class="timeline"></div></div>
      </div>
      <!-- ダイアログ類 -->
      <div id="edit-dialog" style="display:none;">
        <input id="edit-task-id" type="hidden">
        <input id="edit-title">
        <input id="edit-startTime">
        <input id="edit-endTime">
        <select id="edit-priority"></select>
        <button id="save-edit-btn"></button>
        <button id="cancel-edit-btn"></button>
      </div>
    </body></html>`, { url: 'http://localhost' });

    document = dom.window.document;
    global.window = dom.window;
    global.document = document;
    global.localStorage = dom.window.localStorage;
    global.confirm = () => true;
    global.alert = () => {};

    app = new TaskApp(document);
    app.init();
  });

  it('QuickAdd で追加したタスクが一覧に表示される', () => {
    const quickInput = document.getElementById('quick-add-input');
    quickInput.value = '08:00-09:00 朝会';
    document.getElementById('add-button').click();

    // タスク一覧を取得
    const listItems = document.querySelectorAll('#task-list li');
    expect(listItems.length).toBe(1);
    expect(listItems[0].textContent).toContain('08:00-09:00');
    expect(listItems[0].textContent).toContain('朝会');
  });
}); 