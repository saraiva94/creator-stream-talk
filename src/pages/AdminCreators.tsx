import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";

type CreatorRow = {
  id: string;
  email: string | null;
  username: string | null;
  isApprovedForLive: boolean;
  createdAt: string;
};

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const backendBase = import.meta.env.VITE_BACKEND_URL ?? "";

const getAuthHeaders = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const AdminCreators = () => {
  const [creators, setCreators] = useState<CreatorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchCreators = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      };
      const res = await fetch(`${backendBase}/admin/creators`, { headers });
      const body = (await res.json()) as ApiResponse<CreatorRow[]>;
      if (!res.ok || !body.success || !body.data) {
        throw new Error(body.error || "Não foi possível carregar os criadores");
      }
      setCreators(body.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreators();
  }, []);

  const toggleApproval = async (creatorId: string, nextValue: boolean) => {
    setUpdatingId(creatorId);
    setError(null);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      };
      const res = await fetch(`${backendBase}/admin/creators/${creatorId}/approval`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ isApproved: nextValue }),
      });
      const body = (await res.json()) as ApiResponse<CreatorRow>;
      if (!res.ok || !body.success || !body.data) {
        throw new Error(body.error || "Falha ao atualizar aprovação");
      }
      setCreators((prev) => prev.map((c) => (c.id === creatorId ? body.data! : c)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (value: string) => new Date(value).toLocaleString();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Admin · Criadores</h1>
            <p className="text-muted-foreground">Aprovar ou revogar criadores para fazer lives.</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Lista de criadores</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <div className="text-sm text-muted-foreground">Carregando criadores...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Aprovado?</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creators.map((creator) => (
                    <TableRow key={creator.id}>
                      <TableCell>{creator.email || "-"}</TableCell>
                      <TableCell>{creator.username || "-"}</TableCell>
                      <TableCell>
                        {creator.isApprovedForLive ? (
                          <Badge variant="default">Aprovado</Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(creator.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={creator.isApprovedForLive ? "secondary" : "default"}
                          disabled={updatingId === creator.id}
                          onClick={() => toggleApproval(creator.id, !creator.isApprovedForLive)}
                        >
                          {updatingId === creator.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : creator.isApprovedForLive ? (
                            <>
                              <ShieldOff className="mr-1 h-4 w-4" /> Revogar
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="mr-1 h-4 w-4" /> Aprovar
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminCreators;
