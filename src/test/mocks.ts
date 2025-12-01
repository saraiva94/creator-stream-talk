import { vi } from "vitest";

export const toastMock = vi.fn();
export const navigateMock = vi.fn();

export const supabaseAuthMock = {
  getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  setSession: vi.fn(),
};

export const supabaseClientMock = {
  auth: supabaseAuthMock,
  from: vi.fn(),
};
