import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { TaskApp } from '../app.js';

describe('タスクリサイズ機能', () => {
  let dom;
  let window;
  let document;
  let app;

  beforeEach(() => {
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div class="app-container">
            <div class="sidebar">
              <div class="sidebar-section">
                <input id="quick-add-input">
                <button id="add-button">追加</button>
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
            </div>
            <div class="main-content">
              <div id="timeline-container" class="timeline-container" style="height: 600px;">
                <div id="timeline" class="timeline"></div>
              </div>
            </div>
          </div>
          <div id="edit-dialog" class="dialog" style="display: none;">
            <div class="dialog-content">
              <input type="hidden" id="edit-task-id">
              <input type="text" id="edit-title">
              <input type="time" id="edit-startTime">
              <input type="time" id="edit-endTime">
              <select id="edit-priority">
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
              <button id="save-edit-btn">保存</button>
              <button id="cancel-edit-btn">キャンセル</button>
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

    // getBoundingClientRect をモック
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
  });

  it('タスクカードにリサイズハンドルが表示される', () => {
    // Arrange: テスト用のタスクを追加
    const task = { 
      id: 'task-resize-test', 
      title: 'リサイズテスト', 
      startTime: '10:00', 
      endTime: '11:00',
      priority: 'medium',
      completed: false
    };
    app.repository.save(task);
    app.renderer.renderTimeline();

    // Act: タスクカードを取得
    const taskCard = document.getElementById('task-resize-test');
    const resizeHandle = taskCard.querySelector('.resize-handle');

    // Assert: リサイズハンドルが存在する
    expect(resizeHandle).toBeTruthy();
    expect(resizeHandle.className).toBe('resize-handle');
  });

  it('リサイズハンドルが視覚的に識別できるスタイルを持つ', () => {
    // Arrange: テスト用のタスクを追加
    const task = { 
      id: 'task-style-test', 
      title: 'スタイルテスト', 
      startTime: '14:00', 
      endTime: '15:00',
      priority: 'medium',
      completed: false
    };
    app.repository.save(task);
    app.renderer.renderTimeline();

    // Act: リサイズハンドルを取得
    const taskCard = document.getElementById('task-style-test');
    const resizeHandle = taskCard.querySelector('.resize-handle');

    // Assert: 適切なCSSクラスが設定されている
    expect(resizeHandle).toBeTruthy();
    
    // Note: この時点ではCSSが未実装なので、このテストは失敗するはず
    // 実装後に、以下のようなスタイルプロパティをテストする：
    // - position: absolute
    // - bottom位置
    // - カーソルがresize系
    // - 視覚的な背景色やボーダー
  });

  it('リサイズハンドルをドラッグすると、タスクの終了時間が変更される', () => {
    // Arrange: テスト用のタスクを追加
    const task = { 
      id: 'task-resize-drag', 
      title: 'ドラッグリサイズ', 
      startTime: '09:00', 
      endTime: '10:00',
      priority: 'medium',
      completed: false
    };
    app.repository.save(task);
    app.renderer.renderTimeline();

    const taskCard = document.getElementById('task-resize-drag');
    const resizeHandle = taskCard.querySelector('.resize-handle');

    // Act: リサイズハンドルをポインターダウン -> 移動 -> アップ（MouseEventで代用）
    const pointerDownEvent = new window.MouseEvent('pointerdown', {
      bubbles: true,
      clientY: 100
    });
    resizeHandle.dispatchEvent(pointerDownEvent);

    // 30px下に移動（30分延長）
    const pointerMoveEvent = new window.MouseEvent('pointermove', {
      bubbles: true,
      clientY: 130
    });
    document.dispatchEvent(pointerMoveEvent);

    const pointerUpEvent = new window.MouseEvent('pointerup', {
      bubbles: true,
      clientY: 130
    });
    document.dispatchEvent(pointerUpEvent);

    // Assert: タスクの終了時間が延長されている
    const updatedTask = app.repository.findById('task-resize-drag');
    expect(updatedTask.startTime).toBe('09:00'); // 開始時間は変わらない
    expect(updatedTask.endTime).toBe('10:30'); // 30分延長
  });

  it('リサイズ操作をアンドゥ/リドゥできる', () => {
    // Arrange: テスト用のタスクを追加
    const task = { 
      id: 'task-undo-resize', 
      title: 'アンドゥリサイズ', 
      startTime: '16:00', 
      endTime: '17:00',
      priority: 'medium',
      completed: false
    };
    app.repository.save(task);
    app.renderer.renderTimeline();

    const taskCard = document.getElementById('task-undo-resize');
    const resizeHandle = taskCard.querySelector('.resize-handle');

    // Act 1: リサイズ操作（MouseEventで代用）
    const pointerDownEvent = new window.MouseEvent('pointerdown', {
      bubbles: true,
      clientY: 100
    });
    resizeHandle.dispatchEvent(pointerDownEvent);

    const pointerMoveEvent = new window.MouseEvent('pointermove', {
      bubbles: true,
      clientY: 145 // 45分延長
    });
    document.dispatchEvent(pointerMoveEvent);

    const pointerUpEvent = new window.MouseEvent('pointerup', {
      bubbles: true,
      clientY: 145
    });
    document.dispatchEvent(pointerUpEvent);

    // リサイズ後の確認
    let updatedTask = app.repository.findById('task-undo-resize');
    expect(updatedTask.endTime).toBe('17:45');

    // Act 2: アンドゥ
    app.undo();

    // Assert: 元の状態に戻る
    updatedTask = app.repository.findById('task-undo-resize');
    expect(updatedTask.endTime).toBe('17:00');

    // Act 3: リドゥ
    app.redo();

    // Assert: リサイズ後の状態に戻る
    updatedTask = app.repository.findById('task-undo-resize');
    expect(updatedTask.endTime).toBe('17:45');
  });
}); 