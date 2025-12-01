import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "@/pages/Home";
import { vi } from "vitest";
import { supabaseAuthMock } from "@/test/mocks";

const { livesMock, ApiError } = vi.hoisted(() => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  }

  return { livesMock: vi.fn(), ApiError };
});

vi.mock("@/lib/api", () => ({
  ApiError,
  api: {
    lives: {
      getPublic: livesMock,
    },
  },
}));

vi.mock("@/components/LivePreviewCard", () => ({
  default: () => <div data-testid="live-card">live</div>,
}));

vi.mock("@/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

const renderHome = () =>
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );

describe("Home page", () => {
  beforeEach(() => {
    livesMock.mockReset();
    supabaseAuthMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    supabaseAuthMock.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
      error: null,
    });
  });

  it("renders empty state when no lives", async () => {
    livesMock.mockResolvedValue({ lives: [] });

    renderHome();

    await waitFor(() => expect(livesMock).toHaveBeenCalled());
    expect(screen.getByText(/Nenhum criador encontrado/i)).toBeInTheDocument();
  });

  it("shows friendly error on failure", async () => {
    livesMock.mockRejectedValue(new ApiError("fail", 500));

    renderHome();

    await waitFor(() => expect(livesMock).toHaveBeenCalled());
    expect(await screen.findByText(/Não foi possível carregar os criadores agora./i)).toBeInTheDocument();
    expect(screen.queryByText(/\[object Object]/i)).not.toBeInTheDocument();
  });
});
