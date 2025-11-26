import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Load envs from the repository root so that the root `.env` is applied when
  // running the editor from the workspace root. This lets us keep shared .env
  // values (e.g., VITE_API_BASE_URL) in one place.
  const envDir = resolve(__dirname, '..', '..');
  const env = loadEnv(mode, envDir);
  // Merge into process.env for any code that reads process.env during build.
  process.env = { ...process.env, ...env };

  return {
    plugins: [react()],
    // Tells Vite where to read .env files from
    envDir,
    server: {
      port: 5173
    }
  };
});
