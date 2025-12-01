import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import Affiliate from "@/pages/Affiliate";
import {
  buildSelectEqOrderMock,
  buildSelectEqSingleMock,
  supabaseAuthMock,
  supabaseClientMock,
  toastMock,
} from "@/test/mocks";

type MockFromReturn = {
  select: () => { eq: (col: string, value: string) => { single: () => Promise<{ data: unknown; error: null }> } };
  update?: () => { eq: () => Promise<unknown> };
};

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {},
  api: {
    affiliates: {
      code: vi.fn(),
      stats: vi.fn(),
      history: vi.fn(),
      saveCode: vi.fn(),
    },
  },
}));

describe("Affiliate page", () => {
  beforeEach(() => {
    supabaseAuthMock.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });
    supabaseClientMock.from.mockReset();
    supabaseClientMock.from.mockImplementation(() => buildSelectEqSingleMock(null));
    toastMock.mockClear();
  });

  it("loads affiliate data and pre-fills code", async () => {
    const profileCode = "abc123";
    const profileBalance = 2;
    const referralsData = [
      { id: "1", referred_id: "ref-1", commission_earned: 5, status: "paid", created_at: "" },
    ];
    supabaseClientMock.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return buildSelectEqSingleMock(
          { referral_code: profileCode, balance: profileBalance },
          null,
        ) as unknown as MockFromReturn;
      }
      if (table === "referrals") {
        return buildSelectEqOrderMock(referralsData, null) as unknown as MockFromReturn;
      }
      return buildSelectEqSingleMock(null) as unknown as MockFromReturn;
    });

    render(
      <MemoryRouter>
        <Affiliate />
      </MemoryRouter>,
    );

    const input = await screen.findByDisplayValue("abc123");
    expect(input).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 5.00/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/R\$ 2.00/i)).toBeInTheDocument();
    await waitFor(() => expect(supabaseClientMock.from).toHaveBeenCalledWith("profiles"));
  });

  it("saves updated code", async () => {
    const saveCodeMock = vi.fn().mockResolvedValue({ data: [{ referral_code: "newcode" }], error: null });
    supabaseClientMock.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          ...buildSelectEqSingleMock({ referral_code: "oldcode", balance: 0 }),
          update: () => ({ eq: () => saveCodeMock() }),
        } as unknown as MockFromReturn;
      }
      if (table === "referrals") {
        return buildSelectEqOrderMock([], null) as unknown as MockFromReturn;
      }
      if (table === "affiliate_codes") {
        return { upsert: () => saveCodeMock } as unknown as MockFromReturn;
      }
      return buildSelectEqSingleMock(null) as unknown as MockFromReturn;
    });

    render(
      <MemoryRouter>
        <Affiliate />
      </MemoryRouter>,
    );

    const input = await screen.findByDisplayValue("oldcode");
    fireEvent.change(input, { target: { value: "newcode" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar código/i }));

    await waitFor(() => expect(saveCodeMock).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalled();
  });
});
