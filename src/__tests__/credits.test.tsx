import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import UserCreditsWalletPanel from "@/components/user/wallet/UserCreditsWalletPanel";

const { balanceMock, purchaseMock } = vi.hoisted(() => ({
  balanceMock: vi.fn(),
  purchaseMock: vi.fn(),
}));

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  }

  return {
    ApiError,
    api: {
      credits: {
        balance: balanceMock,
        purchase: purchaseMock,
      },
    },
  };
});

describe("UserCreditsWalletPanel", () => {
  beforeEach(() => {
    balanceMock.mockReset();
  });

  it("renders balance and estimated time", async () => {
    balanceMock.mockResolvedValue({ balance_credits: 120 });

    render(<UserCreditsWalletPanel />);

    await waitFor(() => expect(balanceMock).toHaveBeenCalled());
    expect(screen.getByText(/120 créditos/i)).toBeInTheDocument();
    expect(screen.getByText(/20 min/i)).toBeInTheDocument();
  });

  it("shows friendly error when balance fails", async () => {
    balanceMock.mockRejectedValue(new Error("boom"));

    render(<UserCreditsWalletPanel />);

    const alert = await screen.findByText(/Não foi possível carregar o saldo/i);
    expect(alert).toBeInTheDocument();
  });
});
