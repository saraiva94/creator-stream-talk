import PayoutsSummary from "@/components/creator/payouts/PayoutsSummary";
import PayoutsTable from "@/components/creator/payouts/PayoutsTable";

const CreatorPayouts = () => {
  const summary = { balance: 820.5, pending: 210.0, paid: 3400.75 };
  const payouts = [
    { id: "p1", amount: 150.0, status: "pending" as const, requestedAt: "2024-11-06T12:00:00Z" },
    { id: "p2", amount: 320.0, status: "approved" as const, requestedAt: "2024-11-02T09:30:00Z" },
    { id: "p3", amount: 200.5, status: "paid" as const, requestedAt: "2024-10-28T16:15:00Z" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Payouts</h1>
            <p className="text-muted-foreground text-sm">Mock para testes de UI.</p>
          </div>
        </div>

        <PayoutsSummary summary={summary} />

        <PayoutsTable payouts={payouts} />
      </main>
    </div>
  );
};

export default CreatorPayouts;
