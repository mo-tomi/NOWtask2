// Helper to format Date->YYYY-MM-DD
const formatDate = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// 共通のユーティリティ関数
export class TimeUtils {
  static timeToMinutes(timeString) {
    if (!timeString || !TimeUtils.isValidTimeFormat(timeString)) return 0;
    // "09:30" → 9 * 60 + 30 = 570分
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  static minutesToTime(minutes) {
    // 570 → "09:30"
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  static isValidTimeFormat(timeString) {
    // HH:MM形式の時間が有効かチェック
    if (!timeString || typeof timeString !== 'string') return false;
    
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeString)) return false;
    
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  }
}

// アプリケーション設定
export class AppConfig {
  static get DEFAULT_TASK_DURATION() { return 60; } // 1時間（分）
  static get DEFAULT_START_TIME() { return '09:00'; }
  static get MINUTES_PER_HOUR() { return 60; }
  static get HOURS_PER_DAY() { return 24; }
}

export class TaskRepository {
  constructor(dateKey = 'tasks') {
    this.dateKey = dateKey;
    this._tasksCache = this._loadFromStorage();
  }

  _loadFromStorage() {
    try {
      const data = localStorage.getItem(this.dateKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to load or parse tasks from localStorage', e);
      return [];
    }
  }

  _commitToStorage() {
    try {
      localStorage.setItem(this.dateKey, JSON.stringify(this._tasksCache));
    } catch (e) {
      console.error('Failed to save tasks to localStorage', e);
    }
  }

  save(task) {
    if (!task || !task.id) {
      console.error('Cannot save invalid task', task);
      return;
    }
    const existingIndex = this._tasksCache.findIndex(t => t.id === task.id);
    if (existingIndex >= 0) {
      this._tasksCache[existingIndex] = task;
    } else {
      this._tasksCache.push(task);
    }
    this._commitToStorage();
  }

  findById(id) {
    return this._tasksCache.find(task => task.id === id);
  }

  findAll() {
    this._tasksCache = this._loadFromStorage();
    return [...this._tasksCache];
  }

  delete(taskId) {
    const index = this._tasksCache.findIndex(t => t.id === taskId);
    if (index === -1) return false;
    this._tasksCache.splice(index, 1);
    this._commitToStorage();
    return true;
  }

  clearCompleted() {
    const completedTasks = this._tasksCache.filter(t => t.completed);
    if (completedTasks.length === 0) return [];

    this._tasksCache = this._tasksCache.filter(t => !t.completed);
    this._commitToStorage();
    return completedTasks; // 削除されたタスクのリストを返す
  }

  // 追加: JSONエクスポート/インポート（互換性維持のため簡易実装）
  exportAsJson() {
    try {
      return JSON.stringify(this.findAll());
    } catch (e) {
      console.warn('exportAsJson failed', e);
      return '[]';
    }
  }

  importFromJson(json) {
    try {
      const data = JSON.parse(json);
      if (!Array.isArray(data)) return false;
      // 簡易バリデーション: id と title を持つオブジェクト配列
      if (!data.every(t => t && typeof t.id === 'string' && typeof t.title === 'string')) {
        return false;
      }
      this._tasksCache = data;
      this._commitToStorage();
      return true;
    } catch (e) {
      console.warn('importFromJson failed', e);
      return false;
    }
  }
}

export class LaneCalculator {
  calculateLanes(tasks) {
    // タスクのコピーを作成してlaneプロパティを追加
    const result = tasks.map(task => ({ ...task, lane: 0 }));
    
    // 各タスクに対してレーンを計算
    for (let i = 0; i < result.length; i++) {
      result[i].lane = this._findAvailableLane(result[i], result.slice(0, i));
    }
    
    return result;
  }

  _findAvailableLane(currentTask, previousTasks) {
    let lane = 1;
    
    // レーン1から順番に空いているレーンを探す
    while (true) {
      // 現在のレーンに重なるタスクがあるかチェック
      const hasConflict = previousTasks.some(task => 
        task.lane === lane && this._isTimeOverlap(currentTask, task)
      );
      
      if (!hasConflict) {
        return lane; // 空いているレーンが見つかった
      }
      
      lane++; // 次のレーンを試す
    }
  }

  _isTimeOverlap(task1, task2) {
    const toInterval = (task) => {
      let start = TimeUtils.timeToMinutes(task.startTime);
      let end = TimeUtils.timeToMinutes(task.endTime);
      // 日をまたぐ場合は終了を+24h して連続区間にする
      if (end <= start) end += 24 * 60;
      return [start, end];
    };

    const [s1, e1] = toInterval(task1);
    const [s2, e2] = toInterval(task2);

    const overlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

    // 同日判定 + ずらし判定（早朝タスクを+24h して比較）
    return (
      overlap(s1, e1, s2, e2) ||
      overlap(s1, e1, s2 + 1440, e2 + 1440) ||
      overlap(s1 + 1440, e1 + 1440, s2, e2)
    );
  }
}

export class DragUtils {
  /** ピクセル差分を分に変換（スケール対応） */
  static pixelDeltaToMinutes(deltaY, scale = 1) {
    if (scale === 0) return 0;
    return Math.round(deltaY / scale);
  }

  static clampTime(minutes) {
    if (minutes < 0) return 0;
    if (minutes > 1439) return 1439;
    return minutes;
  }
}

export class Renderer {
  constructor(app, doc) {
    this.app = app;
    this.document = doc || (typeof document !== 'undefined' ? document : null);
    this.observer = null;
    // px / minute の倍率 (デフォルト: 1)
    this.scale = 1;
  }

  /** スケールを変更しタイムラインを再描画 */
  setScale(mode) {
    const map = { second: 60, minute: 1, hour: 0.2, day: 0.05 };
    this.scale = map[mode] ?? 1;
    this.renderTimeline();
  }

  /** 分 → px 変換 */
  minutesToPixels(min) { return min * this.scale; }

  init() {
    this._setupIntersectionObserver();
    this._setupEventListeners();
    this._renderTimeMarkers();
    this.renderTimeline();
    this.renderTaskList();
    this.updateStats();
  }

  _setupEventListeners() {
    const timeline = this.document.getElementById('timeline');
    if (!timeline) return; // テスト環境などでtimelineがない場合は何もしない

    // クリックイベントを委任
    timeline.addEventListener('click', (e) => {
      const card = e.target.closest('.task-card');
      if (card && !card.classList.contains('editing')) {
        this.app._toggleTaskCompletion(card.id);
      }
    });

    // ダブルクリックイベントを委任
    timeline.addEventListener('dblclick', (e) => {
      const card = e.target.closest('.task-card');
      if (card && !card.classList.contains('editing')) {
        this.startInlineEdit(card);
      }
    });

    // ドラッグ&ドロップのイベントリスナーを追加
    timeline.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    timeline.addEventListener('drop', (e) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('text/plain');
      if (!data) return;

      // ドロップ位置の計算
      const rect = timeline.getBoundingClientRect();
      const dropY = e.clientY - rect.top;
      let newStartMinutes = Math.max(0, Math.min(1439, Math.round(dropY)));

      // テンプレートからのドロップかタスクからのドロップかを判別
      if (data.startsWith('template:')) {
        // テンプレートからのドロップ
        const templateKey = data.replace('template:', '');
        if (templateKey === 'sleep') {
          // 睡眠テンプレートの場合は専用ダイアログを表示
          this.app._showSleepDialog(newStartMinutes);
        } else {
          this.app.addTemplateTask(templateKey, newStartMinutes);
        }

      } else {
        // 既存タスクからのドロップ
        const taskId = data;
        const task = this.app.repository.findById(taskId);
        if (!task) return;

        // 既存の期間を維持
        const currentStartMin = TimeUtils.timeToMinutes(task.startTime);
        const currentEndMin = TimeUtils.timeToMinutes(task.endTime);
        const duration = currentEndMin - currentStartMin;
        
        let newEndMinutes = newStartMinutes + duration;
        if (newEndMinutes > 1439) {
          newEndMinutes = 1439;
          newStartMinutes = newEndMinutes - duration;
        }

        // タスクを更新（履歴も記録）
        const previousTask = { ...task };
        const updatedTask = {
          ...task,
          startTime: TimeUtils.minutesToTime(newStartMinutes),
          endTime: TimeUtils.minutesToTime(newEndMinutes)
        };

        // 履歴に追加
        this.app._pushHistory({
          type: 'drag',
          taskId: taskId,
          previousTask: previousTask,
          newTask: updatedTask
        });

        this.app.repository.save(updatedTask);
        this.app.renderer.renderTimeline();
        this.app.renderer.updateStats();
      }
    });

    // 完了済みタスク削除ボタン
    const clearBtn = this.document.getElementById('clear-completed-btn');
    if(clearBtn) {
      clearBtn.addEventListener('click', () => this.app._clearCompletedTasks());
    }

    // 現在時刻へジャンプボタン
    const jumpToNowBtn = this.document.getElementById('jump-to-now-btn');
    if (jumpToNowBtn) {
      jumpToNowBtn.addEventListener('click', () => this.app.jumpToCurrentTime());
    }

    // アンドゥ／リドゥボタン
    const undoBtn = this.document.getElementById('undo-btn');
    const redoBtn = this.document.getElementById('redo-btn');
    if (undoBtn && redoBtn) {
      undoBtn.addEventListener('click', () => this.app.undo());
      redoBtn.addEventListener('click', () => this.app.redo());
    }

    // スケール切替
    const scaleSelect = this.document.getElementById('scale-select');
    if (scaleSelect) {
      scaleSelect.addEventListener('change', (e) => {
        this.setScale(e.target.value);
      });
    }

    // --- ダイアログのイベントリスナー ---
    const saveBtn = this.document.getElementById('save-edit-btn');
    if(saveBtn){
        saveBtn.addEventListener('click', () => this.app._handleDialogSave());
    }
    const cancelBtn = this.document.getElementById('cancel-edit-btn');
    if(cancelBtn){
        cancelBtn.addEventListener('click', () => this.app._hideEditDialog());
    }
    const dialog = this.document.getElementById('edit-dialog');
    if(dialog){
        dialog.addEventListener('click', (e) => {
            if (e.target.id === 'edit-dialog') { // オーバーレイのクリックを検出
                this.app._hideEditDialog();
            }
        });
    }

    // テンプレートカード（クリック & ドラッグ）
    Object.keys(this.app.templates).forEach((key) => {
      const card = this.document.getElementById(`template-${key}`);
      if (card) {
        // クリックでタスク追加（睡眠は特別処理）
        card.addEventListener('click', () => {
          if (key === 'sleep') {
            this.app._showSleepDialog();
          } else {
            this.app.addTemplateTask(key);
          }
        });
        
        // ドラッグ開始
        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', `template:${key}`);
          e.dataTransfer.effectAllowed = 'copy';
          card.classList.add('dragging');
        });
        
        // ドラッグ終了
        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
        });
      }
    });

    // 睡眠ダイアログのイベントリスナー
    const saveSleepBtn = this.document.getElementById('save-sleep-btn');
    const cancelSleepBtn = this.document.getElementById('cancel-sleep-btn');
    const sleepDialog = this.document.getElementById('sleep-dialog');
    const sleepDuration = this.document.getElementById('sleep-duration');
    const sleepStartTime = this.document.getElementById('sleep-startTime');
    const sleepEndTime = this.document.getElementById('sleep-endTime');

    if (saveSleepBtn) {
      saveSleepBtn.addEventListener('click', () => this.app._handleSleepDialogSave());
    }
    if (cancelSleepBtn) {
      cancelSleepBtn.addEventListener('click', () => this.app._hideSleepDialog());
    }
    if (sleepDialog) {
      sleepDialog.addEventListener('click', (e) => {
        if (e.target.id === 'sleep-dialog') {
          this.app._hideSleepDialog();
        }
      });
    }

    // 睡眠時間変更時の終了時刻自動計算
    if (sleepDuration && sleepStartTime && sleepEndTime) {
      const updateEndTime = () => {
        const duration = parseInt(sleepDuration.value);
        const startTime = sleepStartTime.value;
        if (startTime) {
          const startMinutes = TimeUtils.timeToMinutes(startTime);
          const endMinutes = (startMinutes + duration * 60) % (24 * 60);
          sleepEndTime.value = TimeUtils.minutesToTime(endMinutes);
        }
      };
      sleepDuration.addEventListener('change', updateEndTime);
      sleepStartTime.addEventListener('change', updateEndTime);
      updateEndTime(); // 初期値設定
    }
  }

  _setupIntersectionObserver() {
    // id="timeline-container" が無いテスト環境も考慮し、class でも検索する
    const timelineContainer =
      this.document.querySelector('#timeline-container') ||
      this.document.querySelector('.timeline-container');

    if (!timelineContainer || typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver(
      this.app._handleSentinelIntersection.bind(this.app),
      { root: timelineContainer, threshold: 0.1 }
    );
    this._renderSentinels();
  }

  _renderSentinels() {
    const timeline = this.document.getElementById('timeline');
    if(!timeline) return;

    // 既存の番兵を削除
    timeline.querySelectorAll('.sentinel').forEach(el => el.remove());

    // 上部番兵
    const topSentinel = this.document.createElement('div');
    topSentinel.className = 'sentinel sentinel-top';
    topSentinel.dataset.date = this.app.currentDate; // デバッグ用に日付を持たせる
    timeline.prepend(topSentinel);
    if (this.observer) this.observer.observe(topSentinel);

    // 下部番兵
    const bottomSentinel = this.document.createElement('div');
    bottomSentinel.className = 'sentinel sentinel-bottom';
    bottomSentinel.dataset.date = this.app.currentDate;
    timeline.appendChild(bottomSentinel);
    if (this.observer) this.observer.observe(bottomSentinel);
  }

  renderTimeline() {
    const timeline = this.document.getElementById('timeline');
    if (!timeline) return; // ガード節

    // タイムライン全体の高さをスケールに合わせて設定
    timeline.style.position = 'relative';
    timeline.style.height = this.minutesToPixels(AppConfig.HOURS_PER_DAY * AppConfig.MINUTES_PER_HOUR) + 'px';

    timeline.innerHTML = ''; // 一旦中身をクリア
    const tasks = this.app.repository.findAll()
      .filter(task => {
        if (this.app.priorityFilter === 'all') return true;
        return task.priority === this.app.priorityFilter;
      });

    // レーン計算
    const tasksWithLanes = this.app.laneCalculator.calculateLanes(tasks);
    
    // 描画
    tasksWithLanes.forEach(task => {
      const card = this._renderTaskCard(task);
      timeline.appendChild(card);
    });

    this._renderTimeMarkers(); // 時間マーカーを再描画
    this._renderSentinels();

    // タスク一覧も更新
    this.renderTaskList();
  }

  _renderTaskCard(task) {
    const card = this.document.createElement('div');
    card.className = 'task-card';
    card.id = task.id;
    if (task.completed) card.classList.add('completed');

    card.setAttribute('data-task-id', task.id);
    card.setAttribute('data-lane', task.lane);
    card.setAttribute('data-priority', task.priority);
    card.setAttribute('draggable', 'true');

    const titleEl = this.document.createElement('span');
    titleEl.className = 'task-title';
    titleEl.textContent = task.title;
    card.appendChild(titleEl);

    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (confirm('このタスクを削除しますか？')) this.app._deleteTask(task.id);
    });

    this._setCardPosition(card, task);
    this._addDragAndResizeListeners(card);
    return card;
  }
  
  _setCardPosition(card, task) {
    // 位置サイズ
    const startMin = TimeUtils.timeToMinutes(task.startTime);
    const endMin = TimeUtils.timeToMinutes(task.endTime);
    const dur = endMin - startMin;
    card.style.top = this.minutesToPixels(startMin) + 'px';
    card.style.height = this.minutesToPixels(dur) + 'px';

    // ドラッグ
    card.style.touchAction = 'none';
    card.addEventListener('pointerdown', (e) => {
      e.preventDefault(); 
      const startY = e.clientY;
      const originTop = parseFloat(card.style.top);
      let moved = false; 

      const onMove = (mEvt) => {
        if (!moved) {
          card.style.opacity = 0.6;
          moved = true;
        }
        const deltaY = mEvt.clientY - startY;
        card.style.top = originTop + deltaY + 'px';
      };

      const onUp = (uEvt) => {
        this.document.removeEventListener('pointermove', onMove);
        this.document.removeEventListener('pointerup', onUp);
        if (moved) {
          card.style.opacity = 1;
          const deltaY = uEvt.clientY - startY;
          this.app._applyDrag(card.id, deltaY);
        }
      };

      this.document.addEventListener('pointermove', onMove);
      this.document.addEventListener('pointerup', onUp);
    });
  }

  _addDragAndResizeListeners(card) {
    card.addEventListener('dragstart', (evt) => {
      evt.dataTransfer.setData('text/plain', card.id);
      evt.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });

    // --- ドラッグ移動 ---
    card.style.touchAction = 'none';
    card.addEventListener('pointerdown', (e) => {
      e.preventDefault(); 
      const startY = e.clientY;
      const originTop = parseFloat(card.style.top);
      let moved = false; 

      const onMove = (mEvt) => {
        if (!moved) {
          card.style.opacity = 0.6;
          moved = true;
        }
        const deltaY = mEvt.clientY - startY;
        card.style.top = originTop + deltaY + 'px';
      };

      const onUp = (uEvt) => {
        this.document.removeEventListener('pointermove', onMove);
        this.document.removeEventListener('pointerup', onUp);
        if (moved) {
          card.style.opacity = 1;
          const deltaY = uEvt.clientY - startY;
          this.app._applyDrag(card.id, deltaY);
        }
      };

      this.document.addEventListener('pointermove', onMove);
      this.document.addEventListener('pointerup', onUp);
    });

    // --- リサイズ ---
    const bottomHandle = this.document.createElement('div');
    bottomHandle.className = 'resize-handle';
    card.appendChild(bottomHandle);

    bottomHandle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startHeight = parseFloat(card.style.height);

      const onMove = (mEvt) => {
        const deltaY = mEvt.clientY - startY;
        card.style.height = Math.max(15, startHeight + deltaY) + 'px'; // 最低15分
      };

      const onUp = (uEvt) => {
        this.document.removeEventListener('pointermove', onMove);
        this.document.removeEventListener('pointerup', onUp);
        const totalDelta = uEvt.clientY - startY;
        if (Math.abs(totalDelta) < 1) return;
        this.app._applyResize(card.id, totalDelta, 'end');
      };
      
      this.document.addEventListener('pointermove', onMove);
      this.document.addEventListener('pointerup', onUp);
    });

    // --- 上部リサイズハンドル ---
    const topHandle = this.document.createElement('div');
    topHandle.className = 'resize-handle top';
    card.appendChild(topHandle);

    topHandle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startY = e.clientY;
      const startTop = parseFloat(card.style.top);
      const startHeight = parseFloat(card.style.height);

      const onMove = (mEvt) => {
        const deltaY = mEvt.clientY - startY;
        const newHeight = Math.max(15, startHeight - deltaY);
        const newTop = startTop + deltaY;
        card.style.height = newHeight + 'px';
        card.style.top = newTop + 'px';
      };

      const onUp = (uEvt) => {
        this.document.removeEventListener('pointermove', onMove);
        this.document.removeEventListener('pointerup', onUp);
        const totalDelta = uEvt.clientY - startY;
        if (Math.abs(totalDelta) < 1) return;
        this.app._applyResize(card.id, totalDelta, 'start');
      };

      this.document.addEventListener('pointermove', onMove);
      this.document.addEventListener('pointerup', onUp);
    });
  }

  startInlineEdit(card) {
    card.classList.add('editing');

    const titleEl = card.querySelector('.task-title');
    if (titleEl) {
        titleEl.style.display = 'none';

        const input = this.document.createElement('input');
        input.type = 'text';
        input.className = 'edit-input';
        input.value = titleEl.textContent;
        
        card.appendChild(input);
        input.focus();

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.stopInlineEdit(card, input.value, true);
            } else if (e.key === 'Escape') {
                this.stopInlineEdit(card, null, false);
            }
        });

        input.addEventListener('blur', () => {
            this.stopInlineEdit(card, input.value, true);
        });
    }
  }

  stopInlineEdit(card, newTitle, shouldSave) {
    if (!card.classList.contains('editing')) return;

    const input = card.querySelector('input.edit-input');
    if (input) {
      input.remove();
    }

    card.classList.remove('editing');

    const titleEl = card.querySelector('.task-title');
    if (titleEl) {
      titleEl.style.display = '';

      if (shouldSave) {
        titleEl.textContent = newTitle;
        this.app._editTask(card.id, { title: newTitle });
      }
    }
  }

  _renderTimeMarkers() {
    const timeline = this.document.getElementById('timeline');
    // 重複描画防止
    if (timeline.querySelector('.time-marker')) return;
    for (let h = 0; h < AppConfig.HOURS_PER_DAY; h++) {
      const m = this.document.createElement('div');
      m.className = 'time-marker';
      m.textContent = h.toString().padStart(2, '0') + ':00';
      m.style.top = this.minutesToPixels(h * AppConfig.MINUTES_PER_HOUR) + 'px';
      timeline.appendChild(m);
    }

    // 現在時刻の線を表示
    this._renderCurrentTimeLine();
  }

  _renderCurrentTimeLine() {
    const timeline = this.document.getElementById('timeline');
    if (!timeline) return;

    // 既存の現在時刻線を削除
    const existingLine = timeline.querySelector('.current-time-line');
    if (existingLine) {
      existingLine.remove();
    }

    // 今日の日付でない場合は表示しない
    const today = this.app._getTodayString();
    if (this.app.currentDate !== today) return;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const currentTimeLine = this.document.createElement('div');
    currentTimeLine.className = 'current-time-line';
    currentTimeLine.style.position = 'absolute';
    currentTimeLine.style.left = '0';
    currentTimeLine.style.top = this.minutesToPixels(currentMinutes) + 'px';
    currentTimeLine.style.height = '2px';
    currentTimeLine.style.width = '100%';
    currentTimeLine.style.backgroundColor = '#ff4444';
    currentTimeLine.style.zIndex = '10';
    currentTimeLine.style.boxShadow = '0 0 4px rgba(255, 68, 68, 0.5)';
    
    // 現在時刻のテキストを表示
    const timeText = this.document.createElement('div');
    timeText.style.position = 'absolute';
    timeText.style.left = '4px';
    timeText.style.top = '-10px';
    timeText.style.fontSize = '12px';
    timeText.style.color = '#ff4444';
    timeText.style.fontWeight = 'bold';
    timeText.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    timeText.style.padding = '2px 4px';
    timeText.style.borderRadius = '2px';
    timeText.textContent = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    currentTimeLine.appendChild(timeText);
    
    timeline.appendChild(currentTimeLine);
  }

  updateStats() {
    const tasks = this.app.repository.findAll();
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const remaining = total - completed;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

    const doc = this.document;
    const set = (id, val) => {
      const el = doc.getElementById(id);
      if (el) el.textContent = val;
    };
    set('task-count', total);
    set('completed-count', completed);
    set('remaining-count', remaining);
    set('completion-rate', rate + '%');
  }

  renderTimelineForDate(dateStr, position) {
    const timeline = this.document.getElementById('timeline');
    if (!timeline) return;
  
    const dateRepo = new TaskRepository(`tasks-${dateStr}`);
    const tasks = dateRepo.findAll();
  
    // 日付ヘッダーの表示を無効化（UI崩壊を防ぐため）
    const dateHeader = this.document.createElement('div');
    dateHeader.className = 'date-header-indicator';
    dateHeader.textContent = dateStr;
    dateHeader.style.display = 'none'; // レイアウト崩れを防ぐため非表示
  
    const container = this.document.createElement('div');
    container.className = 'date-section';
    container.dataset.date = dateStr;
    container.appendChild(dateHeader);
  
    const tasksWithLanes = this.app.laneCalculator.calculateLanes(tasks);
    tasksWithLanes.forEach(task => {
      const card = this._renderTaskCard(task);
      container.appendChild(card);
    });
  
    if (position === 'append') {
      // sentinel-bottomの手前に挿入
      const sentinelBottom = timeline.querySelector('.sentinel-bottom');
      if(sentinelBottom) {
        timeline.insertBefore(container, sentinelBottom);
      } else {
        timeline.appendChild(container);
      }
    } else { // prepend
      // sentinel-topの直後に挿入
      const sentinelTop = timeline.querySelector('.sentinel-top');
      timeline.insertBefore(container, sentinelTop ? sentinelTop.nextSibling : timeline.firstChild);
    }
    
    // 番兵は常に監視下にあるべきなので、再設定は不要かもしれない
    this._renderSentinels();
  }

  /** タスク一覧をサイドバーにレンダリング */
  renderTaskList() {
    const listEl = this.document.getElementById('task-list');
    if (!listEl) return; // テストやUI無し環境

    listEl.innerHTML = '';

    // フィルタリングと並び替え
    const tasks = this.app.repository.findAll()
      .filter(task => {
        if (this.app.priorityFilter === 'all') return true;
        return task.priority === this.app.priorityFilter;
      })
      .sort((a, b) => TimeUtils.timeToMinutes(a.startTime) - TimeUtils.timeToMinutes(b.startTime));

    tasks.forEach(task => {
      const li = this.document.createElement('li');
      li.className = 'task-list-item';
      if (task.completed) li.classList.add('completed');
      li.textContent = `${task.startTime}-${task.endTime} ${task.title}`;
      listEl.appendChild(li);
    });
  }
}

export class TaskApp {
  constructor(doc) {
    this.document = doc || document;
    this.repository = new TaskRepository();
    this.renderer = new Renderer(this, this.document);
    this.laneCalculator = new LaneCalculator();
    this.currentDate = this._getTodayString();
    this.undoStack = [];
    this.redoStack = [];
    this.history = [];
    this.historyIndex = -1;
    this.activeDrag = null;
    this.activeResize = null;
    this.loadedDates = new Set([this.currentDate]);
    this.priorityFilter = 'all'; // フィルターを初期化
    this.templates = {
      nightshift: { title: '夜勤', startTime: '17:00', endTime: '09:00' },
      travel: { title: '移動', startTime: '09:00', endTime: '09:10' },
      meal: { title: '食事', startTime: '12:00', endTime: '12:30' },
      sleep: { title: '睡眠', startTime: '22:00', endTime: '06:00' },
      lunch: { title: '昼ごはん', startTime: '12:00', endTime: '13:00' },
      breakfast: { title: '朝ごはん', startTime: '08:00', endTime: '08:30' },
      dinner: { title: '夕ごはん', startTime: '19:00', endTime: '19:30' },
    };
  }

  init() {
    this._initializeDateFromURL(); // URLから日付を読み込む
    this._setupEventListeners();
    this.renderer.init();
    this.setDate(this.currentDate);
    this._startCurrentTimeUpdater();
  }

  _startCurrentTimeUpdater() {
    // 現在時刻の線を1分ごとに更新
    setInterval(() => {
      if (this.currentDate === this._getTodayString()) {
        this.renderer._renderCurrentTimeLine();
      }
    }, 60000); // 1分ごと
  }

  _initializeDateFromURL() {
    try {
      const params = new URLSearchParams(this.document.location.search);
      const dateParam = params.get('date');
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        // 簡単なサニタイズとして、Dateオブジェクトに変換して正当性を確認
        const d = new Date(dateParam);
        if (!isNaN(d.getTime())) {
          this.currentDate = dateParam;
        }
      }
    } catch (e) {
      console.error("URLの解析に失敗しました:", e);
      // フォールバックして通常通り今日の日付を使う
    }
  }

  _getTodayString() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  _setupEventListeners() {
    const addButton = this.document.getElementById('add-button');
    const quickInput = this.document.getElementById('quick-add-input');

    if(addButton) {
      addButton.addEventListener('click', () => {
        this._handleQuickAdd();
      });
    }

    if(quickInput) {
      quickInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this._handleQuickAdd();
        }
      });
    }

    // フィルターのイベントリスナー
    const filterSelect = this.document.getElementById('priority-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.setPriorityFilter(e.target.value);
      });
    }

    // 日付ナビゲーション
    const prevBtn = this.document.getElementById('prev-day');
    const nextBtn = this.document.getElementById('next-day');
    if (prevBtn && nextBtn) {
      prevBtn.addEventListener('click', () => this.goToPrevDay());
      nextBtn.addEventListener('click', () => this.goToNextDay());
    }

    // アンドゥ／リドゥボタン
    const undoBtn = this.document.getElementById('undo-btn');
    const redoBtn = this.document.getElementById('redo-btn');
    if (undoBtn && redoBtn) {
      undoBtn.addEventListener('click', () => this.undo());
      redoBtn.addEventListener('click', () => this.redo());
    }

    // スケール切替
    const scaleSelect = this.document.getElementById('scale-select');
    if (scaleSelect) {
      scaleSelect.addEventListener('change', (e) => {
        this.renderer.setScale(e.target.value);
      });
    }

    // 完了済みタスク削除ボタン
    const clearBtn = this.document.getElementById('clear-completed-btn');
    if(clearBtn) {
      clearBtn.addEventListener('click', () => this._clearCompletedTasks());
    }

    // リセットボタン
    const resetBtn = this.document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('すべてのタスクを削除しますか？')) {
          this._resetAllTasks();
        }
      });
    }

    // テンプレートボタンの処理はRendererで行う
  }

  setPriorityFilter(priority) {
    this.priorityFilter = priority;
    this.renderer.renderTimeline();
    this.renderer.updateStats();
  }

  _handleQuickAdd() {
    const quickInput = this.document.getElementById('quick-add-input');
    const raw = quickInput.value.trim();

    if (!raw) return;

    // 文字列を解析してタイトル・時間を抽出
    const parsed = parseQuickAddInput(raw);

    // 開始・終了時刻を計算（未指定ならデフォルト）
    let startTime = parsed.startTime ?? AppConfig.DEFAULT_START_TIME;
    let endTime = parsed.endTime;

    if (!endTime) {
      const startMinutes = TimeUtils.timeToMinutes(startTime);
      const endMinutes = startMinutes + AppConfig.DEFAULT_TASK_DURATION;
      endTime = TimeUtils.minutesToTime(endMinutes);
    }

    const task = {
      id: `task-${Date.now()}`,
      title: parsed.title,
      startTime,
      endTime,
      date: this.currentDate,
      priority: parsed.priority ?? 'medium',
      completed: false,
      lane: 1,
    };

    // 履歴に追加
    this._pushHistory({
      type: 'add',
      task: { ...task },
    });

    this.repository.save(task);
    quickInput.value = '';
    this.renderer.renderTimeline();
    this.renderer.updateStats();
  }

  _toggleTaskCompletion(taskId) {
    const task = this.repository.findById(taskId);
    if (task) {
      this._pushHistory({
        type: 'toggle',
        taskId: taskId,
        previousState: task.completed
      });
      task.completed = !task.completed;
      this.repository.save(task);
      
      const card = this.document.getElementById(taskId);
      if (card) {
        card.classList.toggle('completed');
      }
      this.renderer.updateStats();
    }
  }

  _showEditDialog(task) {
    const dialog = this.document.getElementById('edit-dialog');
    this.document.getElementById('edit-task-id').value = task.id;
    this.document.getElementById('edit-title').value = task.title;
    this.document.getElementById('edit-startTime').value = task.startTime;
    this.document.getElementById('edit-endTime').value = task.endTime;
    this.document.getElementById('edit-priority').value = task.priority;
    const repeatSel = this.document.getElementById('edit-repeat');
    if (repeatSel) repeatSel.value = task.repeat || 'none';
    dialog.style.display = 'block';
  }

  _hideEditDialog() {
    const dialog = this.document.getElementById('edit-dialog');
    dialog.style.display = 'none';
  }

  _showSleepDialog(dropPosition = null) {
    this.pendingSleepDropPosition = dropPosition; // ドロップ位置を保存
    const dialog = this.document.getElementById('sleep-dialog');
    if (dialog) {
      dialog.style.display = 'flex';
      
      // ドロップ位置が指定されている場合、開始時刻を設定
      if (dropPosition !== null) {
        const sleepStartTime = this.document.getElementById('sleep-startTime');
        if (sleepStartTime) {
          sleepStartTime.value = TimeUtils.minutesToTime(dropPosition);
          // 終了時刻も再計算
          this._updateSleepEndTime();
        }
      }
    }
  }

  _hideSleepDialog() {
    const dialog = this.document.getElementById('sleep-dialog');
    if (dialog) dialog.style.display = 'none';
    this.pendingSleepDropPosition = null;
  }

  _updateSleepEndTime() {
    const sleepDuration = this.document.getElementById('sleep-duration');
    const sleepStartTime = this.document.getElementById('sleep-startTime');
    const sleepEndTime = this.document.getElementById('sleep-endTime');
    
    if (sleepDuration && sleepStartTime && sleepEndTime) {
      const duration = parseInt(sleepDuration.value);
      const startTime = sleepStartTime.value;
      if (startTime) {
        const startMinutes = TimeUtils.timeToMinutes(startTime);
        const endMinutes = (startMinutes + duration * 60) % (24 * 60);
        sleepEndTime.value = TimeUtils.minutesToTime(endMinutes);
      }
    }
  }

  _handleSleepDialogSave() {
    const sleepDuration = this.document.getElementById('sleep-duration');
    const sleepStartTime = this.document.getElementById('sleep-startTime');
    
    if (sleepDuration && sleepStartTime) {
      const duration = parseInt(sleepDuration.value);
      const startTime = sleepStartTime.value;
      
      if (startTime) {
        const startMinutes = TimeUtils.timeToMinutes(startTime);
        const endMinutes = (startMinutes + duration * 60) % (24 * 60);
        const endTime = TimeUtils.minutesToTime(endMinutes);
        
        // カスタム睡眠タスクを作成
        const task = {
          id: `task-sleep-${Date.now()}`,
          title: `睡眠（${duration}時間）`,
          startTime: startTime,
          endTime: endTime,
          date: this.currentDate,
          priority: 'medium',
          completed: false,
          lane: 1
        };

        // 適切なレーン計算を行う
        const allTasks = this.repository.findAll();
        const tasksWithLanes = this.laneCalculator.calculateLanes([...allTasks, task]);
        const calculatedTask = tasksWithLanes.find(t => t.id === task.id);
        task.lane = calculatedTask.lane;

        // 履歴に追加
        this._pushHistory({
          type: 'add',
          task: { ...task }
        });

        this.repository.save(task);
        this.renderer.renderTimeline();
        this.renderer.updateStats();
        
        this._hideSleepDialog();
      }
    }
  }

  _handleDialogSave() {
    const id = this.document.getElementById('edit-task-id').value;
    const title = this.document.getElementById('edit-title').value.trim();
    const startTime = this.document.getElementById('edit-startTime').value;
    const endTime = this.document.getElementById('edit-endTime').value;
    const priority = this.document.getElementById('edit-priority').value;
    const repeatSel = this.document.getElementById('edit-repeat');
    const repeat = repeatSel ? repeatSel.value : 'none';
    const editData = { title, startTime, endTime, priority, repeat };
    if (this._editTask(id, editData)) {
      this._hideEditDialog();
    }
  }

  _deleteTask(taskId) {
    const task = this.repository.findById(taskId);
    if (!task) return false;
    
    // 履歴に追加
    this._pushHistory({
      type: 'delete',
      task: { ...task } // コピーを保存
    });
    
    const deleted = this.repository.delete(taskId);
    if (deleted) {
      this.renderer.renderTimeline(); // renderTimelineがsentinelを再描画する
      this.renderer.updateStats();
    }
    return deleted;
  }

  _applyDrag(taskId, deltaY) {
    const task = this.repository.findById(taskId);
    if (!task) return false;

    const deltaMinutes = DragUtils.pixelDeltaToMinutes(deltaY, this.renderer.scale);
    const startMinOrig = TimeUtils.timeToMinutes(task.startTime);
    const endMinOrig = TimeUtils.timeToMinutes(task.endTime);

    let startMin = DragUtils.clampTime(startMinOrig + deltaMinutes);
    const duration = endMinOrig - startMinOrig;
    let endMin = startMin + duration;
    
    // 終了時間が24:00を超える場合は開始時間も調整
    if (endMin > 24 * 60) {
        endMin = 24 * 60;
        startMin = endMin - duration;
    }

    const updatedTask = {
      ...task,
      startTime: TimeUtils.minutesToTime(startMin),
      endTime:   TimeUtils.minutesToTime(endMin)
    };

    // 履歴に追加（変更前・変更後のタスクを保存）
    this._pushHistory({
      type: 'drag',
      taskId: taskId,
      previousTask: { ...task },
      newTask: { ...updatedTask }
    });

    // 保存してリフレッシュ
    this.repository.save(updatedTask);
    this.renderer.renderTimeline();
    this.renderer.updateStats();
    return true;
  }

  _applyResize(taskId, deltaY, edge) {
    const task = this.repository.findById(taskId);
    if (!task) return false;

    const deltaMinutes = DragUtils.pixelDeltaToMinutes(deltaY, this.renderer.scale);
    const startMin = TimeUtils.timeToMinutes(task.startTime);
    let endMin = TimeUtils.timeToMinutes(task.endTime);

    if (edge === 'end') {
      endMin = DragUtils.clampTime(endMin + deltaMinutes);
      if (endMin <= startMin) {
        endMin = startMin + 15; // 最低15分
      }
    }
    
    const updatedTask = {
      ...task,
      endTime: TimeUtils.minutesToTime(endMin),
    };

    this._pushHistory({
      type: 'resize',
      taskId: taskId,
      previousTask: { ...task },
      newTask: { ...updatedTask },
    });
    
    this.repository.save(updatedTask);
    this.renderer.renderTimeline();
    this.renderer.updateStats();
    return true;
  }

  _recreateRepository() {
    this.repository = new TaskRepository(`tasks-${this.currentDate}`);
  }

  setDate(newDateStr){
    this.currentDate = newDateStr;
    const dateEl = this.document.getElementById('current-date');
    if(dateEl) dateEl.textContent = this.currentDate;
    this._recreateRepository();
    
    // IntersectionObserverを完全に停止
    if (this.renderer.observer) {
      this.renderer.observer.disconnect();
      this.renderer.observer = null;
    }
    
    // loadedDatesをリセット（新しい日付のみ含む）
    this.loadedDates = new Set([newDateStr]);
    
    // リピートタスク (daily) の自動生成
    this._generateRepeatTasks(newDateStr);
    this.renderer.renderTimeline();
    this.renderer.updateStats();
    
    // IntersectionObserverを再設定
    this.renderer._setupIntersectionObserver();
  }

  goToPrevDay(){
    const current = new Date(this.currentDate);
    current.setDate(current.getDate() - 1);
    this.setDate(formatDate(current));
  }
  
  goToNextDay(){
    const current = new Date(this.currentDate);
    current.setDate(current.getDate() + 1);
    this.setDate(formatDate(current));
  }

  _editTask(taskId, editData) {
    const originalTask = this.repository.findById(taskId);
    if (!originalTask) {
      console.warn(`Task with id ${taskId} not found`);
      return false;
    }

    // バリデーション
    if (!this._validateEditData(editData)) {
      console.warn('Invalid edit data provided');
      return false;
    }

    const updatedTask = { ...originalTask, ...editData };

    this._pushHistory({
      type: 'edit',
      taskId: taskId,
      before: { ...originalTask },
      after: { ...updatedTask }
    });

    this.repository.save(updatedTask);
    this.renderer.renderTimeline();
    this.renderer.updateStats();

    return true;
  }

  _validateEditData(editData) {
    // 必須フィールドのチェック
    if (!editData || typeof editData !== 'object') return false;
    if (!editData.title || typeof editData.title !== 'string') return false;
    if (!editData.startTime || !editData.endTime) return false;
    if (!editData.priority) return false;

    // 時間フォーマットのチェック
    if (!TimeUtils.isValidTimeFormat(editData.startTime)) return false;
    if (!TimeUtils.isValidTimeFormat(editData.endTime)) return false;

    // 優先度の値チェック
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(editData.priority)) return false;

    // 開始時間が終了時間より前かチェック
    const startMinutes = TimeUtils.timeToMinutes(editData.startTime);
    const endMinutes = TimeUtils.timeToMinutes(editData.endTime);
    if (startMinutes >= endMinutes) return false;

    // リピートの値チェック (存在する場合のみ)
    const validRepeats = ['none', 'daily'];
    if (editData.repeat && !validRepeats.includes(editData.repeat)) return false;

    return true;
  }

  // アンドゥ／リドゥ機能
  _pushHistory(action) {
    this.undoStack.push(action);
    this.redoStack = []; // 新しいアクションでリドゥ履歴をクリア
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    
    const action = this.undoStack.pop();
    this.redoStack.push(action);
    
    // アクションを逆実行
    this._executeAction(action, true);
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    
    const action = this.redoStack.pop();
    this.undoStack.push(action);
    
    // アクションを再実行
    this._executeAction(action, false);
    return true;
  }

  _executeAction(action, isUndo) {
    switch (action.type) {
      case 'delete':
        if (isUndo) {
          // 削除を取り消し（復元）
          this.repository.save(action.task);
        } else {
          // 削除を再実行
          this.repository.delete(action.task.id);
        }
        break;
      case 'toggle':
        if (isUndo) {
          // 完了状態を元に戻す
          const task = this.repository.findById(action.taskId);
          if (task) {
            task.completed = action.previousState;
            this.repository.save(task);
          }
        } else {
          // 完了状態を再変更
          const task = this.repository.findById(action.taskId);
          if (task) {
            task.completed = !action.previousState;
            this.repository.save(task);
          }
        }
        break;
      case 'edit':
        if (isUndo) {
          // 編集を取り消し
          this.repository.save(action.before);
        } else {
          // 編集を再実行
          this.repository.save(action.after);
        }
        break;
      case 'drag':
        if (isUndo) {
          // ドラッグを取り消し
          this.repository.save(action.previousTask);
        } else {
          // ドラッグを再実行
          this.repository.save(action.newTask);
        }
        break;
      case 'resize':
        if (isUndo) {
          this.repository.save(action.previousTask);
        } else {
          this.repository.save(action.newTask);
        }
        break;
      case 'add':
        if (isUndo) {
          // 追加を取り消し（削除）
          this.repository.delete(action.task.id);
        } else {
          // 追加を再実行
          this.repository.save(action.task);
        }
        break;
      case 'clearCompleted':
        if (isUndo) {
          // 削除されたタスクをすべて復元
          action.deletedTasks.forEach(task => this.repository.save(task));
        } else {
          // 再度、完了済みを削除
          this.repository.clearCompleted();
        }
        break;
    }
    
    // UI更新
    this.renderer.renderTimeline();
    this.renderer.updateStats();
  }

  _clearCompletedTasks() {
    if (!confirm('完了済みのタスクをすべて削除しますか？')) return;
    
    const deletedTasks = this.repository.clearCompleted();
    
    if (deletedTasks.length > 0) {
      this._pushHistory({
        type: 'clearCompleted',
        deletedTasks: deletedTasks,
      });
      this.renderer.renderTimeline(); // renderTimelineがsentinelを再描画する
      this.renderer.updateStats();
    }
  }

  _resetAllTasks() {
    // 現在ロード済みの日付キーをすべて削除
    const keys = Object.keys(localStorage);
    keys.forEach(k => {
      if (k === 'tasks' || k.startsWith('tasks-')) {
        localStorage.removeItem(k);
      }
    });
    this.repository = new TaskRepository(); // 再生成して空状態に
    this.renderer.renderTimeline();
    this.renderer.updateStats();
    this.loadedDates = new Set([this.currentDate]);
  }

  jumpToCurrentTime() {
    const timelineContainer = this.document.getElementById('timeline-container');
    if (!timelineContainer) return;

    // 今日の日付でない場合は、まず今日の日付に変更
    const today = this._getTodayString();
    if (this.currentDate !== today) {
      this.setDate(today);
    }

    // 現在時刻の位置を計算
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // 現在時刻の位置（px）を計算
    const targetPosition = currentMinutes * this.renderer.scale;
    
    // 画面の中央に表示するために、半分の高さ分を引く
    const containerHeight = timelineContainer.clientHeight;
    const adjustedPosition = Math.max(0, targetPosition - containerHeight / 2);
    
    // スムーズにスクロール
    timelineContainer.scrollTo({
      top: adjustedPosition,
      behavior: 'smooth'
    });
  }

  _handleSentinelIntersection(entries) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const target = entry.target;
      if (!target) return;

      if (target.classList.contains('sentinel-bottom')) {
        const current = new Date(this.currentDate);
        current.setDate(current.getDate() + 1);
        const nextDateStr = formatDate(current);

        if (!this.loadedDates.has(nextDateStr)) {
          this.loadedDates.add(nextDateStr);
          this.renderer.renderTimelineForDate(nextDateStr, 'append');
        }
      } else if (target.classList.contains('sentinel-top')) {
        const current = new Date(this.currentDate);
        current.setDate(current.getDate() - 1);
        const prevDateStr = formatDate(current);

        if (!this.loadedDates.has(prevDateStr)) {
          this.loadedDates.add(prevDateStr);
          this.renderer.renderTimelineForDate(prevDateStr, 'prepend');
        }
      }
    });
  }

  _createDefaultTask(title) {
    const startTime = AppConfig.DEFAULT_START_TIME;
    const startMinutes = TimeUtils.timeToMinutes(startTime);
    const endMinutes = startMinutes + AppConfig.DEFAULT_TASK_DURATION;
    const endTime = TimeUtils.minutesToTime(endMinutes);

    return {
      id: `task-${Date.now()}`,
      title,
      startTime,
      endTime,
      date: this.currentDate, // タスクに日付を持たせる
      priority: 'medium',
      completed: false,
      lane: 1
    };
  }

  /**
   * 指定されたテンプレート名でタスクを作成し repository に保存する
   * @param {string} name テンプレートキー
   * @returns {boolean} 追加に成功したか
   */
  addTemplateTask(name, dropPosition = null) {
    const tpl = this.templates[name];
    if (!tpl) return false;

    let startTime, endTime;

    if (dropPosition !== null) {
        const templateStartMin = TimeUtils.timeToMinutes(tpl.startTime);
        const templateEndMin = TimeUtils.timeToMinutes(tpl.endTime);
        const dur = templateEndMin - templateStartMin <=0 ? templateEndMin - templateStartMin + 1440 : templateEndMin - templateStartMin;
        let newEnd = dropPosition + dur;
        if(newEnd>1439){ newEnd=1439; dropPosition=newEnd-dur; }
        startTime = TimeUtils.minutesToTime(dropPosition);
        endTime = TimeUtils.minutesToTime(newEnd);
    } else {
        startTime=tpl.startTime; endTime=tpl.endTime;
    }

    const durationMinutes = TimeUtils.timeToMinutes(endTime) - TimeUtils.timeToMinutes(startTime);
    const taskList = [];
    if(durationMinutes<=0){
       // split
       const todayEnd='23:59';
       taskList.push({id:`task-${name}-a-${Date.now()}`,title:tpl.title,startTime,startTime:startTime,endTime:todayEnd,date:this.currentDate,priority:'medium',completed:false,lane:1});
       const nextDate=new Date(this.currentDate);nextDate.setDate(nextDate.getDate()+1);const nextStr=formatDate(nextDate);
       taskList.push({id:`task-${name}-b-${Date.now()}`,title:tpl.title,startTime:'00:00',endTime:endTime,date:nextStr,priority:'medium',completed:false,lane:1});
    } else {
       taskList.push({id:`task-${name}-${Date.now()}`,title:tpl.title,startTime,endTime,date:this.currentDate,priority:'medium',completed:false,lane:1});
    }

    taskList.forEach(task=>{this._pushHistory({type:'add',task:{...task}});const repo=task.date===this.currentDate?this.repository:new TaskRepository(`tasks-${task.date}`);repo.save(task);});
    this.renderer.renderTimeline();this.renderer.updateStats();return true;
  }

  /**
   * 前日以前のタスクで repeat==='daily' のものをコピーして今日の日付で生成する
   * 現状は「毎日」だけ対応し、重複生成防止として同じタイトルのタスクが既にある場合はスキップ
   */
  _generateRepeatTasks(targetDateStr){
    try {
      const targetDate = new Date(targetDateStr);
      const prevDate = new Date(targetDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = formatDate(prevDate);

      const prevKey = `tasks-${prevDateStr}`;
      const json = localStorage.getItem(prevKey);
      if(!json) return;
      const prevTasks = JSON.parse(json);
      if(!Array.isArray(prevTasks)) return;

      // すでに今日の repository に存在するタイトル一覧 (重複防止の簡易策)
      const existingTitles = new Set(this.repository.findAll().map(t=>t.title));

      prevTasks.forEach(pt => {
        if(pt.repeat === 'daily' && !existingTitles.has(pt.title)){
          const newTask = { ...pt };
          newTask.id = `${pt.id}-${targetDateStr}`;
          newTask.date = targetDateStr;
          newTask.completed = false;
          // レーンは計算し直すので初期値 1
          newTask.lane = 1;
          this.repository.save(newTask);
        }
      });
    } catch(e){
      console.warn('Failed to generate repeat tasks', e);
    }
  }
}

// ===========================
// Quick Add 文字列パーサー
// ===========================
export function parseQuickAddInput(input) {
  if (!input || typeof input !== 'string') {
    return { title: '', startTime: undefined, endTime: undefined, priority: 'medium' };
  }
  const trimmed = input.trim();

  // 1. "HH:MM-HH:MM タイトル" パターン
  const rangeMatch = trimmed.match(/^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s+(.+)$/);
  if (rangeMatch) {
    let [, start, end, title] = rangeMatch;
    // ゼロ埋め
    const pad = (t) => {
      const [h, m] = t.split(':').map(Number);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };
    start = pad(start);
    end = pad(end);
    return { title: title.trim(), startTime: start, endTime: end, priority: 'medium' };
  }

  // 2. "HH:MM タイトル" パターン（終了時刻は DEFAULT_TASK_DURATION で計算）
  const startOnlyMatch = trimmed.match(/^\s*(\d{1,2}:\d{2})\s+(.+)$/);
  if (startOnlyMatch) {
    let [, start, title] = startOnlyMatch;
    const [h, m] = start.split(':').map(Number);
    const startPad = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    const startMinutes = TimeUtils.timeToMinutes(startPad);
    const endMinutes = startMinutes + AppConfig.DEFAULT_TASK_DURATION;
    const endPad = TimeUtils.minutesToTime(endMinutes);
    return { title: title.trim(), startTime: startPad, endTime: endPad, priority: 'medium' };
  }

  // 3. 時間が含まれない
  return { title: trimmed, startTime: undefined, endTime: undefined, priority: 'medium' };
}

// ブラウザ環境でのみ実行
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new TaskApp(document);
    app.init();
    window.taskApp = app;
  });
} 