import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true, // describe / it / expect が自動で生える
    include: ['**/*.test.js'], // .test.js で終わるファイルのみを対象にする
  },
}); 