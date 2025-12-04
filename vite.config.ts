import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      // Fallback values for Supabase configuration
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        env.VITE_SUPABASE_URL || 'https://enacciilzvifhqpenhlz.supabase.co'
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYWNjaWlsenZpZmhxcGVuaGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NTE1MDIsImV4cCI6MjA3ODAyNzUwMn0.klH_no3rPZ1TPQbnfly9HhVogqRMpJf3_dhYfmusIX0'
      ),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYWNjaWlsenZpZmhxcGVuaGx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0NTE1MDIsImV4cCI6MjA3ODAyNzUwMn0.klH_no3rPZ1TPQbnfly9HhVogqRMpJf3_dhYfmusIX0'
      ),
      'import.meta.env.VITE_SUPABASE_PROJECT_ID': JSON.stringify(
        env.VITE_SUPABASE_PROJECT_ID || 'enacciilzvifhqpenhlz'
      ),
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
    },
  };
});
