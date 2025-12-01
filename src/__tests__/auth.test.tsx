import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Auth from "@/pages/Auth";
import { supabaseAuthMock, navigateMock } from "@/test/mocks";

describe("Auth page", () => {
  beforeEach(() => {
    supabaseAuthMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    supabaseAuthMock.signInWithPassword.mockReset();
    supabaseAuthMock.resetPasswordForEmail.mockReset();
  });

  it("logs in and navigates to home", async () => {
    supabaseAuthMock.signInWithPassword.mockResolvedValue({
      data: { session: {} },
      error: null,
    });

    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@test.com" } });
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: "StrongPass1!" } });

    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

    await waitFor(() => expect(supabaseAuthMock.signInWithPassword).toHaveBeenCalled());
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("sends reset password email", async () => {
    supabaseAuthMock.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText(/esqueceu a senha/i));

    const emailInput = await screen.findByLabelText(/e-mail/i);
    fireEvent.change(emailInput, { target: { value: "reset@test.com" } });

    fireEvent.click(screen.getByRole("button", { name: /enviar link/i }));

    await waitFor(() => expect(supabaseAuthMock.resetPasswordForEmail).toHaveBeenCalled());
    const [, options] = supabaseAuthMock.resetPasswordForEmail.mock.calls[0] ?? [];
    expect(options?.redirectTo).toContain("/reset-password");
  });
});
