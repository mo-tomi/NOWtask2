import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskApp } from '../app.js';

describe('ドラッグ＆ドロップ機能', () => {
  let dom;
  let window;
  let document;
  let app;
  let timeline;

  beforeEach(() => {
    // JSDOMのセットアップを先に行う
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
              <div id="timeline-container" class="timeline-container" style="height: 600px;">
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
    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.localStorage = dom.window.localStorage;
    global.confirm = () => true;

    // JSDOM生成後に getBoundingClientRect をモック
    vi.spyOn(window.HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      left: 0,
      top: 0,
      right: 1440,
      bottom: 200,
      width: 1440,
      height: 200,
    }));

    app = new TaskApp(document);
    app.init();
    timeline = document.getElementById('timeline');
    
    // テスト用のタスクを追加
    const task = { id: 'task-dnd-1', title: 'DND Test', startTime: '09:00', endTime: '10:00' };
    app.repository.save(task);
    app.renderer.renderTimeline(); // タイムラインを描画
    app.renderer.updateStats();   // 統計情報を更新
  });

  it('タスクをドラッグ＆ドロップすると開始時刻と終了時刻が更新される', () => {
    const taskCard = document.getElementById('task-dnd-1');
    
    // jsdomではDataTransferが未実装なため、シンプルなモックを作成
    const mockDataTransfer = {
      data: {},
      setData(format, data) { this.data[format] = data; },
      getData(format) { return this.data[format]; }
    };

    // 1. dragstartイベントを発火 (MouseEventで代用)
    const dragStartEvent = new window.MouseEvent('dragstart', {
      bubbles: true,
      cancelable: true,
    });
    dragStartEvent.dataTransfer = mockDataTransfer;
    taskCard.dispatchEvent(dragStartEvent);
    expect(mockDataTransfer.getData('text/plain')).toBe('task-dnd-1');

    // 2. dragoverイベントを発火させてdropを有効にする
    const dragOverEvent = new window.MouseEvent('dragover', {
      bubbles: true,
      cancelable: true
    });
    timeline.dispatchEvent(dragOverEvent);

    // 3. dropイベントを発火 (10:00の位置にドロップ)
    const timelineRect = timeline.getBoundingClientRect(); // モックされた値が返る
    const dropY = timelineRect.top + (10 * 60); // 10時にドロップ (10h * 60min = 600px)

    const dropEvent = new window.MouseEvent('drop', {
      bubbles: true,
      cancelable: true,
      clientY: dropY
    });
    dropEvent.dataTransfer = mockDataTransfer;
    timeline.dispatchEvent(dropEvent);

    // 4. アサーション
    const updatedTask = app.repository.findById('task-dnd-1');
    expect(updatedTask.startTime).toBe('10:00');
    expect(updatedTask.endTime).toBe('11:00');
  });
}); 