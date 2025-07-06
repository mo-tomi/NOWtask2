import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { Renderer, TaskApp } from '../app.js'; // Rendererを直接インポート

describe('インライン編集機能のロジック', () => {
    let renderer;
    let document;
    let window;

    beforeEach(() => {
        const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
            url: "http://localhost/",
        });
        document = dom.window.document;
        window = dom.window;
        global.document = document;
        
        // RendererはTaskAppのインスタンスを要求するため、ダミーのappを渡す
        const mockApp = {
            _deleteTask: vi.fn(),
            _applyDrag: vi.fn(),
            _applyResize: vi.fn(),
            _editTask: vi.fn(),
        };
        renderer = new Renderer(mockApp, document);
    });

    it('startInlineEditは、カード要素を編集モードに切り替える', () => {
        // Arrange
        const card = document.createElement('div');
        card.className = 'task-card';
        const titleEl = document.createElement('div');
        titleEl.className = 'task-title';
        titleEl.textContent = '元のタスク名';
        card.appendChild(titleEl);

        // Act
        renderer.startInlineEdit(card);

        // Assert
        // 1. editingクラスが付与されるか
        expect(card.classList.contains('editing')).toBe(true);

        // 2. タイトル要素が非表示になるか
        expect(titleEl.style.display).toBe('none');
        
        // 3. input要素が作成され、値がタスク名と一致し、フォーカスされるか
        const input = card.querySelector('input.edit-input');
        expect(input).not.toBeNull();
        expect(input.value).toBe('元のタスク名');
    });

    it('編集中のinputでEnterキーを押すと、タスクが更新されて表示が元に戻る', () => {
        // Arrange
        const card = document.createElement('div');
        card.id = 'task-123'; // 更新するためにIDが必要
        const titleEl = document.createElement('div');
        titleEl.className = 'task-title';
        titleEl.textContent = '元のタスク名';
        card.appendChild(titleEl);
        
        renderer.startInlineEdit(card); // まず編集モードにする
        const input = card.querySelector('input.edit-input');
        input.value = '更新後のタスク名'; // ユーザーが入力したとする

        // Act
        const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter' });
        input.dispatchEvent(enterEvent);

        // Assert
        // 1. inputが消えているか
        expect(card.querySelector('input.edit-input')).toBeNull();
        
        // 2. editingクラスが外れているか
        expect(card.classList.contains('editing')).toBe(false);

        // 3. title要素が再表示され、内容が更新されているか
        expect(titleEl.style.display).not.toBe('none');
        expect(titleEl.textContent).toBe('更新後のタスク名');

        // 4. appの更新メソッドが呼ばれたか (スパイを使用)
        expect(renderer.app._editTask).toHaveBeenCalledWith('task-123', { title: '更新後のタスク名' });
    });

    it('編集中のinputでEscapeキーを押すと、変更は保存されずに表示が元に戻る', () => {
        // Arrange
        const card = document.createElement('div');
        card.id = 'task-456';
        const titleEl = document.createElement('div');
        titleEl.className = 'task-title';
        titleEl.textContent = '元のタスク名';
        card.appendChild(titleEl);
        
        renderer.startInlineEdit(card);
        const input = card.querySelector('input.edit-input');
        input.value = 'この変更は保存されない';

        // Act
        const escapeEvent = new window.KeyboardEvent('keydown', { key: 'Escape' });
        input.dispatchEvent(escapeEvent);

        // Assert
        expect(card.querySelector('input.edit-input')).toBeNull();
        expect(card.classList.contains('editing')).toBe(false);
        expect(titleEl.style.display).not.toBe('none');
        // ★内容が元に戻っていることを確認
        expect(titleEl.textContent).toBe('元のタスク名');
        // ★更新メソッドが呼ばれていないことを確認
        expect(renderer.app._editTask).not.toHaveBeenCalled();
    });

    it('編集中のinputからフォーカスが外れたら（blur）、タスクが更新されて表示が元に戻る', () => {
        // Arrange
        const card = document.createElement('div');
        card.id = 'task-789';
        const titleEl = document.createElement('div');
        titleEl.className = 'task-title';
        titleEl.textContent = '元のタスク名';
        card.appendChild(titleEl);
        
        renderer.startInlineEdit(card);
        const input = card.querySelector('input.edit-input');
        input.value = '更新後のタスク名';

        // Act
        const blurEvent = new window.Event('blur');
        input.dispatchEvent(blurEvent);

        // Assert (Enterキーのテストとほぼ同じ)
        expect(card.querySelector('input.edit-input')).toBeNull();
        expect(card.classList.contains('editing')).toBe(false);
        expect(titleEl.textContent).toBe('更新後のタスク名');
        expect(renderer.app._editTask).toHaveBeenCalledWith('task-789', { title: '更新後のタスク名' });
    });
}); 