import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskApp } from '../app.js';

describe('統合フロー: QuickAdd→編集→削除→Undo/Redo', () => {
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
              <div class="sidebar-header"><h1>NowTask</h1></div>
              <div class="sidebar-section">
                <form id="add-task-form" onsubmit="return false;">
                  <input id="quick-add-input">
                  <button id="add-button">追加</button>
                </form>
              </div>
              <div class="sidebar-section">
                <select id="priority-filter"></select>
                <button id="clear-completed-btn"></button>
              </div>
              <div class="sidebar-section">
                <button id="export-btn"></button>
                <button id="import-btn"></button>
                <input type="file" id="import-file-input" style="display: none;" />
              </div>
               <div class="sidebar-section">
                <button id="undo-btn" disabled></button>
                <button id="redo-btn" disabled></button>
              </div>
              <div class="sidebar-section">
                  <div id="stats">
                      <div id="total-tasks">0</div>
                      <div id="completed-tasks">0</div>
                      <div id="task-percentage">0%</div>
                  </div>
              </div>
            </div>
            <div class="main-content">
              <div id="timeline-container" class="timeline-container" style="height: 500px; overflow-y: scroll;">
                <div id="timeline" class="timeline"></div>
              </div>
            </div>
          </div>
          <div id="edit-dialog" class="dialog" style="display: none;">
            <div class="dialog-content">
              <h3>タスクの編集</h3>
              <input type="hidden" id="edit-task-id">
              <label>タイトル: <input type="text" id="edit-title"></label>
              <label>開始時刻: <input type="time" id="edit-startTime"></label>
              <label>終了時刻: <input type="time" id="edit-endTime"></label>
              <label>優先度:
                <select id="edit-priority">
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </label>
              <button id="save-edit-btn">保存</button>
              <button id="cancel-edit-btn">キャンセル</button>
              <button id="delete-task-btn">削除</button>
            </div>
          </div>
        </body>
      </html>
    `, { url: "http://localhost" });
    document = dom.window.document;
    global.window = dom.window;
    global.document = document;
    global.localStorage = dom.window.localStorage;
    global.confirm = () => true;
    // JSDOM が未実装の requestSubmit をモンキーパッチ
    if (!window.HTMLFormElement.prototype.requestSubmit) {
      window.HTMLFormElement.prototype.requestSubmit = () => {};
    }
    app = new TaskApp(document);
    app.init();
  });

  it('一連の操作が repository と履歴に正しく反映される', () => {
    // 1) Quick Add でタスク追加
    const quickInput = document.getElementById('quick-add-input');
    const addBtn = document.getElementById('add-button');
    quickInput.value = '朝のミーティング';
    addBtn.click();

    let tasks = app.repository.findAll();
    expect(tasks).toHaveLength(1);
    const taskId = tasks[0].id;
    const card = document.querySelector('.task-card');
    expect(card).not.toBeNull();

    // 2) ダイアログで編集 (タイトル変更)
    app._showEditDialog(tasks[0]);
    const titleInput = document.getElementById('edit-title');
    expect(titleInput.value).toBe('朝のミーティング');
    titleInput.value = '朝会 (更新)';
    document.getElementById('save-edit-btn').click();

    const updated = app.repository.findById(taskId);
    expect(updated.title).toBe('朝会 (更新)');

    // 3) タスク削除
    app._deleteTask(taskId);
    expect(app.repository.findById(taskId)).toBeUndefined();

    // 4) Undo で復活
    app.undo();
    expect(app.repository.findById(taskId)).not.toBeUndefined();

    // 5) Redo で再削除
    app.redo();
    expect(app.repository.findById(taskId)).toBeUndefined();
  });
}); 