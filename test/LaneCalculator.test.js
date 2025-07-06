import { describe, it, expect } from 'vitest';
import { LaneCalculator } from '../app.js';

describe('LaneCalculator', () => {
  it('時間が重複しないタスクは同じレーンに配置される', () => {
    const calc = new LaneCalculator();
    const tasks = [
      { id: 't1', startTime: '09:00', endTime: '10:00' },
      { id: 't2', startTime: '10:00', endTime: '11:00' },
      { id: 't3', startTime: '11:00', endTime: '12:00' }
    ];
    const withLanes = calc.calculateLanes(tasks);
    withLanes.forEach(t => expect(t.lane).toBe(1));
  });

  it('時間が重複するタスクは異なるレーンに配置される', () => {
    const calc = new LaneCalculator();
    const tasks = [
      { id: 't1', startTime: '09:00', endTime: '11:00' }, // 09-11
      { id: 't2', startTime: '10:30', endTime: '12:00' }, // 10:30-12 overlaps
      { id: 't3', startTime: '10:45', endTime: '11:15' }  // overlaps both
    ];
    const withLanes = calc.calculateLanes(tasks);
    expect(withLanes[0].lane).toBe(1);
    expect(withLanes[1].lane).toBe(2);
    // t3 should be placed in lane 3 because it overlaps with both lane1&2
    expect(withLanes[2].lane).toBe(3);
  });

  it('日をまたぐタスクは翌朝のタスクと重なるので別レーンに配置される', () => {
    const calc = new LaneCalculator();
    const tasks = [
      { id: 'sleep', startTime: '22:00', endTime: '08:00' }, // crosses midnight
      { id: 'breakfast', startTime: '07:00', endTime: '09:00' } // overlaps with sleep
    ];
    const lanes = calc.calculateLanes(tasks);
    expect(lanes[0].lane).toBe(1);
    expect(lanes[1].lane).toBe(2);
  });

  it('日をまたぐタスクでも終了時間と他タスク開始時間が同じなら重ならない', () => {
    const calc = new LaneCalculator();
    const tasks = [
      { id: 'nightshift', startTime: '23:00', endTime: '01:00' }, // 23-25 (翌1時)
      { id: 'earlywork', startTime: '01:00', endTime: '02:00' }
    ];
    const lanes = calc.calculateLanes(tasks);
    expect(lanes[0].lane).toBe(1);
    expect(lanes[1].lane).toBe(1); // 重なっていないので同じレーン
  });
}); 