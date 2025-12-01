import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import CreatorActivationCard from "@/components/creator/CreatorActivationCard";
import { supabaseAuthMock, supabaseClientMock, toastMock } from "@/test/mocks";

type MockFromReturn = {
  select: () => { eq: () => { single: () => Promise<{ data: unknown; error: null }> } };
  eq?: () => { single: () => Promise<{ data: unknown; error: null }> };
  upsert?: () => Promise<unknown>;
};

describe("CreatorActivationCard", () => {
  beforeEach(() => {
    supabaseAuthMock.getSession.mockResolvedValue({
      data: { session: { user: { id: "creator-1" } } },
      error: null,
    });
    supabaseClientMock.from.mockReset();
  });

  const setupSupabaseFrom = (options?: { upsertError?: string }) => {
    const singleMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const upsertMock = vi.fn().mockResolvedValue(
      options?.upsertError ? { error: { message: options.upsertError } } : { error: null },
    );

    supabaseClientMock.from.mockImplementation((table: string) => {
        if (table === "creator_profiles") {
          return {
            select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleMock }) }),
            eq: vi.fn().mockReturnValue({ single: singleMock }),
            upsert: upsertMock,
          } as MockFromReturn;
        }
        return { select: vi.fn() } as unknown as MockFromReturn;
      });

    return { upsertMock };
  };

  it("creates creator profile successfully", async () => {
    const { upsertMock } = setupSupabaseFrom();

    render(<CreatorActivationCard />);

    await screen.findByLabelText(/Nome de Exibição/i);
    fireEvent.change(screen.getByLabelText(/Nome de Exibição/i), { target: { value: "Creator" } });
    fireEvent.change(screen.getByLabelText(/Bio/i), { target: { value: "bio" } });
    fireEvent.change(screen.getByLabelText(/Tags/i), { target: { value: "tag1, tag2" } });

    fireEvent.click(screen.getByRole("button", { name: /Ativar Perfil de Criador/i }));

    await waitFor(() => expect(upsertMock).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalled();
  });

  it("handles supabase error gracefully", async () => {
    const { upsertMock } = setupSupabaseFrom({ upsertError: "fail" });

    render(<CreatorActivationCard />);

    await screen.findByLabelText(/Nome de Exibição/i);
    fireEvent.change(screen.getByLabelText(/Nome de Exibição/i), { target: { value: "Creator" } });
    fireEvent.click(screen.getByRole("button", { name: /Ativar Perfil de Criador/i }));

    await waitFor(() => expect(upsertMock).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalled();
  });
});
