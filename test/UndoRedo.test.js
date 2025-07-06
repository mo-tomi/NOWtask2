import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskApp } from '../app.js';

describe('アンドゥ／リドゥ機能', () => {
  let dom;
  let window;
  let document;
  let app;

  beforeEach(() => {
    // JSDOMで仮想DOM環境をセットアップ (index.htmlのbody内を完全に再現)
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
              <div id="timeline-container" class="timeline-container">
                <div id="timeline" class="timeline"></div>
              </div>
            </div>
          </div>
          <div id="edit-dialog" style="display: none;"></div>
        </body>
      </html>
    `, { url: "http://localhost" });
    
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;
    global.confirm = () => true;

    app = new TaskApp(document);
    app.init();
  });

  it('タスク追加後に Undo するとタスクが削除され、Redoで復活する', () => {
    // Arrange: タスクを1件追加し、履歴に積む
    const task = { id: 'task-undo-1', title: '買い物', startTime: '10:00', endTime: '11:00', priority: 'medium', completed: false };
    app.repository.save(task);
    app._pushHistory({ type: 'add', task: { ...task } });

    // Act: Undo 実行
    const undoResult = app.undo();

    // Assert: Undoが成功し、タスクが消える
    expect(undoResult).toBe(true);
    const afterUndo = app.repository.findById(task.id);
    expect(afterUndo).toBeUndefined();

    // Act: Redo 実行
    const redoResult = app.redo();

    // Assert: Redoが成功し、タスクが復活する
    expect(redoResult).toBe(true);
    const afterRedo = app.repository.findById(task.id);
    expect(afterRedo).toEqual(task);
  });
}); 