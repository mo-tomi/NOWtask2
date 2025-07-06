import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskApp } from '../app.js';

describe('タスク完了機能 (DOMあり)', () => {
  let dom;
  let window;
  let document;

  beforeEach(() => {
    // JSDOMで仮想DOM環境をセットアップ
    // index.htmlのbody内を完全に再現
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="app-container">
            <div class="sidebar">
              <div class="sidebar-header">
                <h1>NowTask</h1>
                <div class="date-nav">
                  <button id="prev-day-btn">&lt;</button>
                  <span id="current-date">2024-01-01</span>
                  <button id="next-day-btn">&gt;</button>
                </div>
              </div>
              <div class="sidebar-section">
                <h2>クイック追加</h2>
                <form id="add-task-form" onsubmit="return false;">
                  <input id="quick-add-input" placeholder="タスク名を入力...">
                  <button id="add-button">追加</button>
                </form>
              </div>
              <div class="sidebar-section">
                <h2>フィルターと操作</h2>
                <div class="control-group">
                  <select id="priority-filter">
                    <option value="all">すべての優先度</option>
                  </select>
                  <button id="clear-completed-btn">完了済みを削除</button>
                </div>
              </div>
              <div class="sidebar-section">
                <h2>データ</h2>
                <div class="control-group">
                  <button id="export-btn">エクスポート</button>
                  <button id="import-btn">インポート</button>
                  <input type="file" id="import-file-input" style="display: none;" />
                </div>
              </div>
               <div class="sidebar-section">
                <h2>履歴</h2>
                <div class="control-group">
                  <button id="undo-btn" disabled>Undo</button>
                  <button id="redo-btn" disabled>Redo</button>
                </div>
              </div>
              <div class="sidebar-section">
                  <h2>統計</h2>
                  <div id="stats">
                      <div><div class="label">合計</div><div class="value" id="total-tasks">0</div></div>
                      <div><div class="label">完了</div><div class="value" id="completed-tasks">0</div></div>
                      <div><div class="label">達成率</div><div class="value" id="task-percentage">0%</div></div>
                  </div>
              </div>
            </div>
            <div class="main-content">
              <div id="timeline-container" class="timeline-container" style="height: 500px; overflow-y: scroll;">
                <div id="timeline" class="timeline"></div>
              </div>
            </div>
          </div>
          <div id="edit-dialog" style="display: none;">
             <!-- ダイアログの中身 -->
          </div>
        </body>
      </html>
    `, { url: "http://localhost" });
    
    window = dom.window;
    document = window.document;

    // vitestのグローバル空間にjsdomのオブジェクトをセット
    global.window = window;
    global.document = document;
    global.localStorage = window.localStorage;
    global.confirm = () => true;
    global.alert = () => {};
  });

  it('タスクをクリックすると完了状態とUIが切り替わる', async () => {
    // Arrange
    const app = new TaskApp(document);
    app.init(); // appを先に初期化

    const task = { id: 'task-1', title: '宿題', startTime: '09:00', endTime: '10:00', completed: false, priority: 'medium' };
    app.repository.save(task);
    app.renderer.renderTimeline(); // 手動でレンダリング

    const taskCard = document.getElementById('task-1');
    
    // Assert
    expect(taskCard).not.toBeNull();
    expect(taskCard.classList.contains('completed')).toBe(false);
    
    taskCard.click();

    const updatedTask = app.repository.findById('task-1');
    expect(updatedTask.completed).toBe(true);
    expect(taskCard.classList.contains('completed')).toBe(true);
  });
}); 