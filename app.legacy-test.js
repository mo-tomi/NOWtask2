const { strict: assert } = require('assert');
import {
  TimeUtils,
  AppConfig,
  TaskRepository,
  LaneCalculator,
  DragUtils,
  Renderer,
  TaskApp,
} from './app.js';

// =================================================================
// Legacy Node.js Test Runner
// =================================================================

// ------------------- Mock DOM and localStorage -------------------
let mockDom;
const resetMockDom = () => {
  // インメモリ DOM と localStorage の超簡易モック
  const elementsById = {};

  const createElement = (tag) => {
    const el = {
      _tag: tag,
      _id: '',
      className: '',
      get classList(){
        const self=this;
        return {
          add(cls){ if(!self.className.includes(cls)){ self.className = (self.className+ ' '+cls).trim();}},
          remove(cls){ self.className = self.className.split(' ').filter(c=>c!==cls).join(' ');},
          contains(cls){ return self.className.split(' ').includes(cls);},
          toggle(cls){ this.contains(cls)?this.remove(cls):this.add(cls);} 
        }
      },
      children: [],
      style: {},
      _text: '',
      parentElement: null,
      set id(v){ this._id = v; elementsById[v]=this; },
      get id(){ return this._id; },
      set textContent(v){ this._text=String(v); },
      get textContent(){ return this._text; },
      setAttribute(){},
      getAttribute(){ return null; },
      _listeners:{},
      addEventListener(type,fn){
        if(!this._listeners[type]) this._listeners[type]=[];
        this._listeners[type].push(fn);
      },
      removeEventListener(type,fn){ if(this._listeners[type]) this._listeners[type]=this._listeners[type].filter(f=>f!==fn);},
      click(){
        // イベントバブリングをシミュレート
        const event = { target: this, preventDefault: ()=>{} };
        let current = this;
        while(current) {
            (current._listeners['click']||[]).forEach(fn=>fn(event));
            current = current.parentElement;
        }
      },
      dispatchEvent(event) {
        // Ensure event.target is set on the first dispatch
        if (!event.target) {
          event.target = this;
        }
        
        // Trigger listeners on the current element
        (this._listeners[event.type] || []).forEach(fn => fn(event));
        
        // Bubble up to the parent
        if (event.bubbles && this.parentElement) {
            this.parentElement.dispatchEvent(event);
        }
      },
      focus(){},
      select(){},
      appendChild(child){ this.children.push(child); child.parentElement = this; },
      removeChild(child){
        this.children = this.children.filter(c => c !== child);
        if(child) child.parentElement = null;
      },
      querySelectorAll(sel){
        const results = [];
        const findInChildren = (element) => {
            for (const child of element.children) {
                // simple class selector check
                if (sel.startsWith('.') && child.className && child.className.includes(sel.slice(1))) {
                    results.push(child);
                }
                // simple tag name check
                else if (!sel.startsWith('.') && !sel.startsWith('[') && child._tag === sel) {
                    results.push(child);
                }
                findInChildren(child); // recursive search
            }
        };
        findInChildren(this);
        return results;
      },
      querySelector(sel){
        const arr = this.querySelectorAll(sel);
        return arr.length ? arr[0] : null;
      },
      closest(selector) {
        let el = this;
        const classSelector = selector.startsWith('.') ? selector.substring(1) : null;
    
        while (el) {
            if (classSelector && el.className && el.className.includes(classSelector)) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
      },
      remove(){}
    };
    return el;
  };

  mockDom = {
    createElement,
    getById: (id) => elementsById[id] || (elementsById[id]=createElement('div'))
  };

  const mockEventListeners = {
      _listeners:{},
      addEventListener(type,fn){
        if(!this._listeners[type]) this._listeners[type]=[];
        this._listeners[type].push(fn);
      },
      removeEventListener(type,fn){ if(this._listeners[type]) this._listeners[type]=this._listeners[type].filter(f=>f!==fn);},
      // Helper for tests to dispatch events
      _dispatchEvent(type, eventObj) {
        (this._listeners[type]||[]).forEach(fn=>fn(eventObj));
      },
      dispatchEvent(event) {
        if (!event.target) {
          event.target = this;
        }
        (this._listeners[event.type] || []).forEach(fn => fn(event));
        if (event.bubbles && this.parentElement) {
            this.parentElement.dispatchEvent(event);
        }
      }
  };

  global.document = {
    createElement,
    getElementById: (id) => elementsById[id] || (elementsById[id]=createElement('div')),
    ...mockEventListeners,
    querySelectorAll(sel){
      if (sel === '.task-card') {
        const timeline = elementsById['timeline'];
        return timeline ? timeline.children.filter(c=>c.className.includes('task-card')) : [];
      }
      const laneMatch = sel.match(/\[data-lane="(\d+)"\]/);
      if (laneMatch) {
        const lane = laneMatch[1];
        const timeline = elementsById['timeline'];
        return timeline ? timeline.children.filter(c=>c.getAttribute && c.getAttribute('data-lane')===lane) : [];
      }
      return [];
    },
    querySelector(sel){
      const arr = this.querySelectorAll(sel);
      return arr.length?arr[0]:null;
    },
    body: createElement('body')
  };

  global.localStorage = {
    _data:{},
    getItem(k){ return this._data[k]??null; },
    setItem(k,v){ this._data[k]=String(v); },
    clear(){ this._data={}; }
  };

  global.confirm = () => true;
  global.alert = () => {}; // alertをダミー関数に置き換え

  // 主要要素を生成
  ['timeline','quick-add-input','add-button', 'sidebar'].forEach(id=>{
     mockDom.getById(id);
  });
};

// ------------------- mockDOM を初期化し app.js を読み込む -------------------
resetMockDom();

// 最低限の document スタブ（addEventListener だけ）
if (typeof global.document === 'undefined') {
  global.document = {};
}
if (typeof global.document.addEventListener !== 'function') {
  global.document.addEventListener = () => {};
}

// Node.js と E2E で共通して使うクラスを読み込む（ここで document が定義済み）
// const { TaskRepository, LaneCalculator, TaskApp, DragUtils, Renderer } = require('./app.js'); // この行を削除

// ------------------- Legacy Test Runner Setup -------------------
const testResults_legacy = { passed: 0, failed: 0, errors: [] };
let beforeEachCallback_legacy = null;

const describe_legacy = (name, fn) => {
  console.log(`\n📁 ${name}`);
  const parentBeforeEach_legacy = beforeEachCallback_legacy;
  beforeEachCallback_legacy = null;
  fn();
  beforeEachCallback_legacy = parentBeforeEach_legacy;
};

const beforeEach_legacy = (fn) => {
  beforeEachCallback_legacy = fn;
};

const test_legacy = (name, fn) => {
  if (typeof beforeEachCallback_legacy === 'function') {
    beforeEachCallback_legacy();
  }
  try {
    fn();
    console.log(`  ✅ ${name}`);
    testResults_legacy.passed++;
  } catch (e) {
    console.error(`  ❌ ${name}`);
    console.error(e);
    testResults_legacy.failed++;
    testResults_legacy.errors.push({ name, error: e });
  }
};
const it_legacy = test_legacy;
global.test_legacy = test_legacy;

global.expect_legacy = (actual) => ({
  toEqual: (expected) => assert.deepStrictEqual(actual, expected),
  toBe: (expected) => assert.strictEqual(actual, expected),
  toBeUndefined: () => assert.strictEqual(actual, undefined),
  toHaveLength: (expected) => assert.strictEqual(actual.length, expected),
  toContain: (expected) => assert.ok(actual.includes(expected)),
  toBeDefined: () => assert.notStrictEqual(actual, undefined)
});
// ------------------- End Legacy Test Runner Setup -------------------


// ------------------- Legacy Test Definitions Start -------------------

// describe_legacy('統合フロー: QuickAdd→編集→削除→Undo/Redo', () => { ... }); // このブロックを削除

describe_legacy('ドラッグ＆ドロップ機能', () => {
  test_legacy('タスクカードを下に60pxドラッグすると、時間が60分後に移動する', () => {
    const app = new TaskApp();
    const task = { id: 'task-drag-1', title: 'ドラッグテスト', startTime: '09:00', endTime: '10:00', completed: false, priority: 'medium' };
    app.repository.save(task);
    app.init();

    const card = document.getElementById(task.id);
    expect_legacy(card).toBeDefined();

    // イベントリスナーを直接呼び出す
    const pointerDownEvent = { clientY: 100, preventDefault: () => {}, target: card };
    card._listeners['pointerdown'][0](pointerDownEvent);

    // document に move/up リスナーが登録されたはず
    const pointerMoveEvent = { clientY: 160, preventDefault: () => {} };
    document._dispatchEvent('pointermove', pointerMoveEvent);

    const pointerUpEvent = { clientY: 160 };
    document._dispatchEvent('pointerup', pointerUpEvent);

    const updatedTask = app.repository.findById(task.id);
    expect_legacy(updatedTask.startTime).toBe('10:00');
    expect_legacy(updatedTask.endTime).toBe('11:00');
  });
});

describe_legacy('リサイズ機能', () => {
  test_legacy('タスクカードの下端を30px下にドラッグすると、終了時間が30分延長される', () => {
    const app = new TaskApp();
    const task = { id: 'task-resize-1', title: 'リサイズテスト', startTime: '11:00', endTime: '12:00', completed: false, priority: 'low' };
    app.repository.save(task);
    app.init();

    const card = document.getElementById(task.id);
    const handle = card.querySelector('.resize-handle');
    expect_legacy(handle).toBeDefined();

    // リサイズハンドルをドラッグ
    const pointerDownEvent = { clientY: 200, preventDefault: () => {}, stopPropagation: () => {} };
    handle._listeners['pointerdown'][0](pointerDownEvent);

    const pointerMoveEvent = { clientY: 230, preventDefault: () => {} };
    document._dispatchEvent('pointermove', pointerMoveEvent);

    const pointerUpEvent = { clientY: 230 };
    document._dispatchEvent('pointerup', pointerUpEvent);

    const updatedTask = app.repository.findById(task.id);
    expect_legacy(updatedTask.startTime).toBe('11:00'); // 開始時間は変わらない
    expect_legacy(updatedTask.endTime).toBe('12:30'); // 終了時間が30分延長
  });
});

describe_legacy('完了済みタスクの一括削除', () => {
  test_legacy('「完了済みを削除」ボタンを押すと、完了タスクのみが削除される', () => {
    const app = new TaskApp();
    app.repository.save({ id: 'task-c-1', title: '完了1', startTime: '09:00', endTime: '10:00', completed: true });
    app.repository.save({ id: 'task-uc-1', title: '未完了1', startTime: '10:00', endTime: '11:00', completed: false });
    app.repository.save({ id: 'task-c-2', title: '完了2', startTime: '11:00', endTime: '12:00', completed: true });
    app.init();

    // ボタンを mock DOM に追加
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-completed-btn';
    document.getElementById('sidebar').appendChild(clearBtn); // 仮の親
    app._setupEventListeners(); // ボタンにリスナーを再設定

    clearBtn.click();

    const remainingTasks = app.repository.findAll();
    expect_legacy(remainingTasks).toHaveLength(1);
    expect_legacy(remainingTasks[0].id).toBe('task-uc-1');
  });
});

describe_legacy('エクスポート／インポート機能', () => {
  test_legacy('エクスポートしたJSONをインポートするとデータが復元される', () => {
    const app = new TaskApp();
    const task = { id: 'task-exp-1', title: 'エクスポートテスト', startTime: '13:00', endTime: '14:00', completed: false, priority: 'high' };
    app.repository.save(task);

    // 1. エクスポート処理を直接呼び出す
    const jsonToExport = app._handleExport();
    expect_legacy(JSON.parse(jsonToExport)).toHaveLength(1);

    // 2. 別のアプリインスタンス（クリーンな状態）を用意
    localStorage.clear();
    const app2 = new TaskApp();
    expect_legacy(app2.repository.findAll()).toHaveLength(0);

    // 3. インポート処理を直接呼び出す
    app2._handleImport(jsonToExport);

    // 4. データが復元されたか確認
    const restoredTasks = app2.repository.findAll();
    expect_legacy(restoredTasks).toHaveLength(1);
    expect_legacy(restoredTasks[0].title).toBe('エクスポートテスト');
  });
});

describe_legacy('詳細編集ダイアログ', () => {
  let app;
  let mockDocument;
  let timeline;
  let dialog;
  let saveBtn;
  let cancelBtn;
  let titleInput, startTimeInput, endTimeInput, prioritySelect;

  beforeEach_legacy(() => {
    // ... localStorageのモック ...
    const mockLocalStorage = (() => {
      let store = {};
      return {
        getItem: (key) => store[key] || null,
        setItem: (key, value) => store[key] = value.toString(),
        clear: () => store = {},
        removeItem: (key) => delete store[key],
      };
    })();
    global.localStorage = mockLocalStorage;


    // --- 仮想DOMのセットアップ ---
    mockDocument = createMockElement('div');
    mockDocument.body = createMockElement('body');
    mockDocument.appendChild(mockDocument.body);

    timeline = createMockElement('div', 'timeline');
    mockDocument.body.appendChild(timeline);

    // ダイアログとその要素
    dialog = createMockElement('div', 'edit-dialog');
    dialog.style.display = 'none';
    mockDocument.body.appendChild(dialog);

    titleInput = createMockElement('input', 'edit-title');
    startTimeInput = createMockElement('input', 'edit-startTime');
    endTimeInput = createMockElement('input', 'edit-endTime');
    prioritySelect = createMockElement('select', 'edit-priority');
    saveBtn = createMockElement('button', 'save-edit-btn');
    cancelBtn = createMockElement('button', 'cancel-edit-btn');
    dialog.appendChild(titleInput);
    dialog.appendChild(startTimeInput);
    dialog.appendChild(endTimeInput);
    dialog.appendChild(prioritySelect);
    dialog.appendChild(saveBtn);
    dialog.appendChild(cancelBtn);

    const quickAddForm = createMockElement('form', 'add-task-form');
    quickAddForm.appendChild(createMockElement('input', 'new-task-title'));
    quickAddForm.appendChild(createMockElement('button'));
    mockDocument.body.appendChild(quickAddForm);
    
    // 他のUI要素
    mockDocument.body.appendChild(createMockElement('div', 'total-tasks'));
    mockDocument.body.appendChild(createMockElement('div', 'completed-tasks'));
    mockDocument.body.appendChild(createMockElement('div', 'task-percentage'));
    mockDocument.body.appendChild(createMockElement('button', 'clear-completed-btn'));
    mockDocument.body.appendChild(createMockElement('button', 'export-btn'));
    mockDocument.body.appendChild(createMockElement('button', 'import-btn'));
    mockDocument.body.appendChild(createMockElement('input', 'import-file-input'));
    mockDocument.body.appendChild(createMockElement('button', 'undo-btn'));
    mockDocument.body.appendChild(createMockElement('button', 'redo-btn'));


    mockDocument.getElementById = (id) => {
        const find = (el) => {
            if (el.id === id) return el;
            for(const child of el.children) {
                const found = find(child);
                if(found) return found;
            }
            return null;
        };
        return find(mockDocument);
    };
    mockDocument.querySelector = (selector) => {
        // querySelectorの簡易版。このテストではIDセレクタで十分
        if (selector.startsWith('#')) {
            return mockDocument.getElementById(selector.substring(1));
        }
        return null;
    };
     mockDocument.querySelectorAll = (selector) => {
        const results = [];
        const searchClass = selector.startsWith('.') ? selector.substring(1) : '';
        const find = (el) => {
            if (el.className && el.className.includes(searchClass)) {
                results.push(el);
            }
            el.children.forEach(find);
        };
        find(mockDocument);
        return results;
    };


    global.document = mockDocument;
    global.confirm = () => true;
    global.alert = () => {};


    // Appの初期化
    app = new TaskApp();
    app.init();
  });

  it_legacy('✅ ダブルクリックでダイアログを開き、優先度を変更して保存できる', () => {
    // Arrange: タスクを1つ追加
    const task = app._createDefaultTask("テストタスク");
    app.repository.save(task);
    app.renderer.renderTimeline();

    // Act: タスクカードをダブルクリックしてダイアログを開く
    const taskCard = mockDocument.getElementById(task.id);
    expect_legacy(taskCard).toBeDefined(); // カードが存在することを確認

    // dblclickイベントをディスパッチ
    taskCard.dispatchEvent({ type: 'dblclick', target: taskCard });


    // Assert: ダイアログが表示され、値がセットされている
    expect_legacy(dialog.style.display).toBe('flex');
    expect_legacy(titleInput.value).toBe('テストタスク');
    expect_legacy(prioritySelect.value).toBe('medium');

    // Act: 優先度を変更して保存
    prioritySelect.value = 'high';
    saveBtn.dispatchEvent({ type: 'click' });

    // Assert: ダイアログが閉じて、タスクの優先度が更新されている
    expect_legacy(dialog.style.display).toBe('none');
    const updatedTask = app.repository.findById(task.id);
    expect_legacy(updatedTask.priority).toBe('high');

    // Assert: UIも更新されている
    const updatedCard = mockDocument.getElementById(task.id);
    expect_legacy(updatedCard.getAttribute('data-priority')).toBe('high');
  });
});

// ------------------- Legacy Test Definitions End -------------------

// NO MORE CODE AFTER THIS LINE.
// The async runner and the duplicate createMockElement are GONE. 