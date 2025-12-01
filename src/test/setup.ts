import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import {
  buildSelectEqSingleMock,
  navigateMock,
  supabaseClientMock,
  toastMock,
} from "./mocks";
import type React from "react";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseClientMock,
}));

vi.mock("@/components/Navbar", () => ({
  default: () => null,
}));

vi.mock("@/components/LanguageSelector", () => ({
  LanguageSelector: () => null,
}));

vi.mock("@/hooks/useLanguage", () => {
  const translations = {
    auth: {
      email: "Email",
      password: "Senha",
      forgotPassword: "Esqueceu a senha?",
      loading: "Carregando",
      loginButton: "Entrar",
      username: "Usuário",
      passwordRequirements: "Use uma senha forte",
      confirmPassword: "Confirmar senha",
      passwordMismatch: "As senhas não coincidem",
      passwordMismatchTitle: "Senhas não coincidem",
    },
    home: {
      search: "Buscar",
      onlineNow: "Ao vivo",
      offline: "Offline",
      noCreators: "Nenhum criador encontrado",
      loginToWatch: "Entre para assistir",
      loginButton: "Entrar",
    },
  };

    return {
      useLanguage: () => ({ language: "pt", setLanguage: vi.fn(), t: translations }),
      LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
    };
  });

afterEach(() => {
  cleanup();
  toastMock.mockClear();
  navigateMock.mockClear();
  supabaseClientMock.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  supabaseClientMock.from.mockReset();
  supabaseClientMock.from.mockImplementation(() => buildSelectEqSingleMock(null));
});
