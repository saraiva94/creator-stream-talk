import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import Subscribe from "@/pages/Subscribe";
import { supabaseAuthMock } from "@/test/mocks";

const { validateCodeMock, checkoutMock, MockApiError } = vi.hoisted(() => {
  const validateCodeMock = vi.fn();
  const checkoutMock = vi.fn();
  class MockApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  }
  return { validateCodeMock, checkoutMock, MockApiError };
});

vi.mock("@/lib/api", () => ({
  ApiError: MockApiError,
  api: {
    affiliates: {
      validateCode: validateCodeMock,
    },
    registration: {
      checkout: checkoutMock,
    },
  },
}));

describe("Subscribe page", () => {
  beforeEach(() => {
    supabaseAuthMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    validateCodeMock.mockReset();
    checkoutMock.mockReset();
  });

  it("submits with valid data and redirects to checkout", async () => {
    validateCodeMock.mockResolvedValue({ valid: true });
    checkoutMock.mockResolvedValue({ init_point: "https://pay.test" });
    const assignSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", { value: { assign: assignSpy } });

    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Nome completo/i), { target: { value: "User Test" } });
    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "user@test.com" } });
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: "StrongPass1!" } });
    fireEvent.change(screen.getByLabelText(/Confirmar senha/i), { target: { value: "StrongPass1!" } });
    fireEvent.change(screen.getByLabelText(/Código de indicação/i), { target: { value: "ref123" } });
    fireEvent.click(screen.getByLabelText(/aceito os termos/i));

    fireEvent.click(screen.getByRole("button", { name: /concluir cadastro/i }));

    await waitFor(() => expect(validateCodeMock).toHaveBeenCalledWith("ref123"));
    await waitFor(() =>
      expect(checkoutMock).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "user@test.com",
          password: "StrongPass1!",
          referralCode: "ref123",
          fullName: "User Test",
          acceptTerms: true,
        }),
      ),
    );
    expect(assignSpy).toHaveBeenCalledWith("https://pay.test");
    Object.defineProperty(window, "location", { value: originalLocation });
  });

  it("prevents submit without referral code", async () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Nome completo/i), { target: { value: "User Test" } });
    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "user@test.com" } });
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: "StrongPass1!" } });
    fireEvent.change(screen.getByLabelText(/Confirmar senha/i), { target: { value: "StrongPass1!" } });
    fireEvent.click(screen.getByLabelText(/aceito os termos/i));

    fireEvent.click(screen.getByRole("button", { name: /concluir cadastro/i }));

    expect(await screen.findByText(/código de indicação para se cadastrar/i)).toBeInTheDocument();
    expect(validateCodeMock).not.toHaveBeenCalled();
  });

  it("shows error for invalid referral code", async () => {
    validateCodeMock.mockResolvedValue({ valid: false });

    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Nome completo/i), { target: { value: "User Test" } });
    fireEvent.change(screen.getByLabelText(/E-mail/i), { target: { value: "user@test.com" } });
    fireEvent.change(screen.getByLabelText(/^Senha/i), { target: { value: "StrongPass1!" } });
    fireEvent.change(screen.getByLabelText(/Confirmar senha/i), { target: { value: "StrongPass1!" } });
    fireEvent.change(screen.getByLabelText(/Código de indicação/i), { target: { value: "badcode" } });
    fireEvent.click(screen.getByLabelText(/aceito os termos/i));

    fireEvent.click(screen.getByRole("button", { name: /concluir cadastro/i }));

    expect(await screen.findByText(/Código de indicação inválido/i)).toBeInTheDocument();
  });
});
