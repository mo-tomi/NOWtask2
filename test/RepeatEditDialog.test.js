import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskApp } from '../app.js';

describe('ダイアログでリピート設定を編集', () => {
  let window;
  let document;
  let app;

  beforeEach(() => {
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="app-container">
            <div class="sidebar">
              <div class="sidebar-section">
                <input id="quick-add-input">
                <button id="add-button">追加</button>
              </div>
            </div>
            <div class="main-content">
              <div id="timeline"></div>
            </div>
          </div>
          <div id="edit-dialog" style="display:none;">
            <input type="hidden" id="edit-task-id">
            <input type="text" id="edit-title">
            <input type="time" id="edit-startTime">
            <input type="time" id="edit-endTime">
            <select id="edit-priority">
              <option value="medium">中</option>
            </select>
            <!-- 新規リピートフィールド -->
            <select id="edit-repeat">
              <option value="none">なし</option>
              <option value="daily">毎日</option>
            </select>
            <button id="save-edit-btn">保存</button>
            <button id="cancel-edit-btn">キャンセル</button>
          </div>
        </body>
      </html>
    `, { url: 'http://localhost/' });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;
    global.confirm = () => true;

    // IntersectionObserver モック
    global.IntersectionObserver = vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));

    app = new TaskApp(document);
    app.init();

    // テスト用タスク追加
    const task = {
      id: 'task-rep-edit',
      title: '読書',
      startTime: '08:00',
      endTime: '09:00',
      priority: 'medium',
      repeat: 'none',
      completed: false,
      lane: 1,
      date: app.currentDate,
    };
    app.repository.save(task);
  });

  it('repeat を daily に変更して保存すると repository に反映される', () => {
    const task = app.repository.findById('task-rep-edit');
    app._showEditDialog(task);

    // repeat select を daily に変更
    const repeatSel = document.getElementById('edit-repeat');
    repeatSel.value = 'daily';

    // save ボタンクリック
    document.getElementById('save-edit-btn').click();

    const updated = app.repository.findById('task-rep-edit');
    expect(updated.repeat).toBe('daily');
  });
}); 