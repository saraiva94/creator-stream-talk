import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const retiredSupabaseUrl = "https://enacciilzvifhqpenhlz.supabase.co";

// The browser can use this anon key under Supabase Row Level Security.
const streamStarSupabase = {
  url: "https://wtqsbhuvlvapwqmzcaxf.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cXNiaHV2bHZhcHdxbXpjYXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzNjc0NTIsImV4cCI6MjA3ODk0MzQ1Mn0.6pF6IqljhKYVw_GBvtTzHsuWJhOYXhsfKmTjtxGKuMc",
};

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd());
  const configuredUrl = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "") || "";
  const configuredKey = env.VITE_SUPABASE_ANON_KEY?.trim() || env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  const usesRetiredProject = configuredUrl === retiredSupabaseUrl;
  const supabaseUrl = usesRetiredProject ? streamStarSupabase.url : configuredUrl;
  const supabaseKey = usesRetiredProject ? streamStarSupabase.anonKey : configuredKey;
  const urlProjectId = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co$/i)?.[1];
  const projectId = urlProjectId || env.VITE_SUPABASE_PROJECT_ID?.trim() || "";

  if (command === "build" && (!supabaseUrl || !supabaseKey)) {
    throw new Error("Defina VITE_SUPABASE_URL e a chave pública do mesmo projeto antes de compilar.");
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabaseKey),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabaseKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(projectId),
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
    },
  };
});
