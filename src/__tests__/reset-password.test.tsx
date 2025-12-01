import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResetPassword from "@/pages/ResetPassword";
import { supabaseAuthMock, navigateMock } from "@/test/mocks";
import { vi } from "vitest";

describe("ResetPassword page", () => {
  beforeEach(() => {
    supabaseAuthMock.setSession.mockReset();
    supabaseAuthMock.updateUser.mockReset();
  });

  it("updates password when recovery token is present", async () => {
    supabaseAuthMock.setSession.mockResolvedValue({ data: { session: {} }, error: null });
    supabaseAuthMock.updateUser.mockResolvedValue({ data: {}, error: null });

    window.location.hash = "#access_token=test-token&type=recovery&refresh_token=ref-token";
    render(
      <MemoryRouter initialEntries={["/reset-password"]}>
        <ResetPassword />
      </MemoryRouter>,
    );

    await waitFor(() => expect(supabaseAuthMock.setSession).toHaveBeenCalled());
    const passwordInput = screen.getByLabelText(/Nova senha/i);

    fireEvent.change(passwordInput, { target: { value: "StrongPass1!" } });
    fireEvent.change(screen.getByLabelText(/Confirmar senha/i), { target: { value: "StrongPass1!" } });

    fireEvent.click(screen.getByRole("button", { name: /Atualizar senha/i }));

    await waitFor(() => expect(supabaseAuthMock.updateUser).toHaveBeenCalled());
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/auth"));
  }, 10000);
});
