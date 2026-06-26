import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Single webview entry: the main window. (Add more rollup inputs here if you
// introduce extra windows, e.g. a frameless HUD/toast window.)
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
});
