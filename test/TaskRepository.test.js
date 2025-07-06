import { describe, it, expect, beforeEach } from 'vitest';
import { TaskRepository } from '../app.js';

describe('TaskRepository', () => {
  beforeEach(() => {
    // jsdomがlocalStorageを自動的にモックしてくれるので、手動クリアでOK
    localStorage.clear();
  });

  it('タスクを保存して取得できる', () => {
    const repository = new TaskRepository();
    const task = { id: 'task-1', title: '宿題をする', startTime: '09:00', endTime: '11:00', priority: 'medium', completed: false };
    repository.save(task);
    const saved = repository.findById('task-1');
    expect(saved).toEqual(task);
  });

  it('findAll で追加したタスクが配列に含まれる', () => {
    const repository = new TaskRepository();
    repository.save({ id: 'task-findall', title: '読書', startTime: '12:00', endTime: '13:00', priority: 'low', completed: false });
    const all = repository.findAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('task-findall');
  });

  it('同じ ID で save するとタスクが上書きされる', () => {
    const repository = new TaskRepository();
    const original = { id: 'task-update', title: 'ランチ', startTime: '12:00', endTime: '13:00', priority: 'low', completed: false };
    const updated = { ...original, title: '昼ごはん' };
    repository.save(original);
    repository.save(updated);
    const result = repository.findById('task-update');
    expect(result.title).toBe('昼ごはん');
  });

  it('新しいインスタンスでも localStorage から復元される', () => {
    const repo1 = new TaskRepository();
    const task = { id: 'task-persist', title: '散歩', startTime: '15:00', endTime: '16:00', priority: 'medium', completed: false };
    repo1.save(task);

    // 別のインスタンスを生成
    const repo2 = new TaskRepository();
    const restored = repo2.findById('task-persist');
    expect(restored).toEqual(task);
  });

  it('delete は存在する ID なら true を返し削除され、存在しない ID なら false', () => {
    const repository = new TaskRepository();
    const task = { id: 'task-delete', title: '掃除', startTime: '09:00', endTime: '10:00', priority: 'high', completed: false };
    repository.save(task);
    
    const firstDelete = repository.delete('task-delete');
    expect(firstDelete).toBe(true);
    expect(repository.findById('task-delete')).toBeUndefined();

    const secondDelete = repository.delete('task-delete');
    expect(secondDelete).toBe(false);
  });

  it('exportAsJson と importFromJson でデータをバックアップ／復元できる', () => {
    const repo1 = new TaskRepository();
    const task = { id: 'task-backup', title: '英語勉強', startTime: '18:00', endTime: '19:00', priority: 'medium', completed: false };
    repo1.save(task);
    const json = repo1.exportAsJson();

    const repo2 = new TaskRepository();
    repo2.importFromJson(json);
    const restored = repo2.findById('task-backup');
    expect(restored).toEqual(task);
  });

  it('不正な JSON を importFromJson すると false を返し既存データは変化しない', () => {
    const repository = new TaskRepository();
    const task = { id: 'task-existing', title: '既存', startTime: '10:00', endTime: '11:00', priority: 'low', completed: false };
    repository.save(task);

    const result = repository.importFromJson('{ invalid json }');
    expect(result).toBe(false);
    // データが変わっていないこと
    expect(repository.findById('task-existing')).toEqual(task);
  });
}); 