import { describe, it, expect } from 'vitest';
import { parseQuickAddInput } from '../app.js';

// 日本語で具体的なテスト名を記述

describe('parseQuickAddInput 関数', () => {
  it('時間範囲とタイトルを含む文字列を正しく解析する', () => {
    const input = '10:00-11:30 企画会議';
    const result = parseQuickAddInput(input);
    expect(result).toEqual({
      title: '企画会議',
      startTime: '10:00',
      endTime: '11:30',
      priority: 'medium', // デフォルト優先度
    });
  });

  it('開始時刻のみを含む場合、デフォルトの 1 時間タスクを生成する', () => {
    const input = '9:00 朝会';
    const result = parseQuickAddInput(input);
    expect(result).toEqual({
      title: '朝会',
      startTime: '09:00',
      endTime: '10:00', // 1時間後
      priority: 'medium',
    });
  });

  it('時間が含まれない場合、タイトルのみを返し時間は undefined', () => {
    const input = '買い物';
    const result = parseQuickAddInput(input);
    expect(result).toEqual({
      title: '買い物',
      startTime: undefined,
      endTime: undefined,
      priority: 'medium',
    });
  });
}); 