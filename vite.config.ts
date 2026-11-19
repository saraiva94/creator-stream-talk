import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd());
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() || "";
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY?.trim() || env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  const urlProjectId = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i)?.[1];
  const projectId = env.VITE_SUPABASE_PROJECT_ID?.trim() || urlProjectId || "";

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
