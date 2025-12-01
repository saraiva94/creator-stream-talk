import { vi } from "vitest";

export const toastMock = vi.fn();
export const navigateMock = vi.fn();

export const supabaseAuthMock = {
  getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  setSession: vi.fn(),
  onAuthStateChange: vi.fn().mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
    error: null,
  }),
};

export const supabaseClientMock = {
  auth: supabaseAuthMock,
  from: vi.fn(),
};

export const buildSelectEqSingleMock = (data: unknown, error: unknown = null) => ({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data, error }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
});

export const buildSelectEqOrderMock = (data: unknown, error: unknown = null) => ({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data, error }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
});

// Provide a safe default to avoid undefined access in tests that don't mock `.from` explicitly.
supabaseClientMock.from.mockImplementation(() => buildSelectEqSingleMock(null));
