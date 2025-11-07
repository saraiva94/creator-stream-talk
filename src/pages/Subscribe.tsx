import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";

const Subscribe = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useState(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    getUser();
  });

  const handleSubscribe = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_subscribed: true })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Assinatura ativada!",
        description: "Agora você tem acesso completo a todas as lives.",
      });

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (error: any) {
      toast({
        title: "Erro ao ativar assinatura",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Assine e Desbloqueie Tudo</h1>
            <p className="text-xl text-muted-foreground">
              Acesso ilimitado a todas as lives e interação com criadores
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Plano Gratuito */}
            <Card className="p-6 border-2">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Gratuito</h3>
                <div className="text-3xl font-bold">R$ 0</div>
                <p className="text-muted-foreground">Por mês</p>
              </div>

              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground">10 segundos de prévia nas lives</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <span className="text-muted-foreground">Visualização de perfis públicos</span>
                </li>
              </ul>

              <Button variant="outline" className="w-full" disabled>
                Plano Atual
              </Button>
            </Card>

            {/* Plano Premium */}
            <Card className="p-6 border-2 border-primary relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-semibold rounded-full">
                Recomendado
              </div>

              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Premium</h3>
                <div className="text-3xl font-bold">R$ 29,90</div>
                <p className="text-muted-foreground">Por mês</p>
              </div>

              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5" />
                  <span>Acesso ilimitado a todas as lives</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5" />
                  <span>Chat ao vivo com criadores</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5" />
                  <span>Sem anúncios</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-primary mt-0.5" />
                  <span>Badge exclusivo no chat</span>
                </li>
              </ul>

              <Button 
                className="w-full" 
                onClick={handleSubscribe}
                disabled={loading}
              >
                {loading ? "Ativando..." : "Assinar Agora"}
              </Button>
            </Card>
          </div>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>Cancele a qualquer momento. Sem compromisso.</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Subscribe;
