import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import Affiliate from "@/pages/Affiliate";
import { supabaseAuthMock, toastMock } from "@/test/mocks";

const { codeMock, statsMock, historyMock, saveCodeMock, MockApiError } = vi.hoisted(() => {
  const codeMock = vi.fn();
  const statsMock = vi.fn();
  const historyMock = vi.fn();
  const saveCodeMock = vi.fn();
  class MockApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  }
  return { codeMock, statsMock, historyMock, saveCodeMock, MockApiError };
});

vi.mock("@/lib/api", () => ({
  ApiError: MockApiError,
  api: {
    affiliates: {
      code: codeMock,
      stats: statsMock,
      history: historyMock,
      saveCode: saveCodeMock,
    },
  },
}));

describe("Affiliate page", () => {
  beforeEach(() => {
    supabaseAuthMock.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });
    codeMock.mockReset();
    statsMock.mockReset();
    historyMock.mockReset();
    saveCodeMock.mockReset();
    toastMock.mockClear();
  });

  it("loads affiliate data and pre-fills code", async () => {
    codeMock.mockResolvedValue({ code: "abc123" });
    statsMock.mockResolvedValue({ totalEarningsCents: 500, availableBalanceCents: 200, totalReferrals: 2 });
    historyMock.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <Affiliate />
      </MemoryRouter>,
    );

    const input = await screen.findByDisplayValue("abc123");
    expect(input).toBeInTheDocument();
    expect(screen.getByText(/R\$ 5.00/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 2.00/i)).toBeInTheDocument();
  });

  it("saves updated code", async () => {
    codeMock.mockResolvedValue({ code: "oldcode" });
    statsMock.mockResolvedValue({ totalEarningsCents: 0, availableBalanceCents: 0, totalReferrals: 0 });
    historyMock.mockResolvedValue([]);
    saveCodeMock.mockResolvedValue({ code: "newcode" });

    render(
      <MemoryRouter>
        <Affiliate />
      </MemoryRouter>,
    );

    const input = await screen.findByDisplayValue("oldcode");
    fireEvent.change(input, { target: { value: "newcode" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar código/i }));

    await waitFor(() => expect(saveCodeMock).toHaveBeenCalledWith("newcode"));
    expect(toastMock).toHaveBeenCalled();
  });
});
