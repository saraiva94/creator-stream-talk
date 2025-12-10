import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Tag, Plus, X, Save, Loader2 } from "lucide-react";

const SUGGESTED_TAGS = [
  "Gaming", "Music", "Art", "Cooking", "Fitness", "Tech", "Comedy", 
  "Education", "Travel", "Fashion", "Sports", "News", "Podcast", 
  "Dance", "Beauty", "DIY", "Vlog", "ASMR", "Anime", "Movies"
];

const CreatorTags = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    checkCreatorAndLoadTags();
  }, []);

  const checkCreatorAndLoadTags = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user is a creator
      const { data: creatorProfile } = await supabase
        .from("creator_profiles")
        .select("id, tags")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!creatorProfile) {
        toast({
          title: "Acesso negado",
          description: "Você precisa ser um criador para gerenciar tags.",
          variant: "destructive",
        });
        navigate("/profile");
        return;
      }

      setIsCreator(true);
      setCurrentTags(creatorProfile.tags || []);
    } catch (error) {
      console.error("Error loading tags:", error);
    } finally {
      setLoading(false);
    }
  };

  const addTag = (tag: string) => {
    const normalizedTag = tag.trim();
    if (!normalizedTag) return;
    if (currentTags.includes(normalizedTag)) {
      toast({
        title: "Tag já existe",
        description: "Esta tag já foi adicionada.",
        variant: "destructive",
      });
      return;
    }
    if (currentTags.length >= 5) {
      toast({
        title: "Limite atingido",
        description: "Você pode ter no máximo 5 tags.",
        variant: "destructive",
      });
      return;
    }
    setCurrentTags([...currentTags, normalizedTag]);
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    setCurrentTags(currentTags.filter(t => t !== tag));
  };

  const saveTags = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("creator_profiles")
        .update({ tags: currentTags })
        .eq("id", session.user.id);

      if (error) throw error;

      toast({
        title: "Tags salvas!",
        description: "Suas tags foram atualizadas com sucesso.",
      });
    } catch (error) {
      console.error("Error saving tags:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar suas tags.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </AppLayout>
    );
  }

  if (!isCreator) {
    return null;
  }

  return (
    <AppLayout>
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Gerenciar Tags do Canal
            </CardTitle>
            <CardDescription>
              Adicione até 5 tags para descrever seu conteúdo. Tags ajudam espectadores a encontrar seu canal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Current Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Suas Tags ({currentTags.length}/5)</label>
              <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-lg border border-border bg-muted/50">
                {currentTags.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma tag adicionada</p>
                ) : (
                  currentTags.map(tag => (
                    <Badge 
                      key={tag} 
                      variant="default" 
                      className="text-sm py-1 px-3 gap-1 animate-scale-in"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:bg-background/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {/* Add Custom Tag */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Adicionar Tag Personalizada</label>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Digite uma tag..."
                  maxLength={20}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(newTag);
                    }
                  }}
                />
                <Button 
                  type="button" 
                  onClick={() => addTag(newTag)}
                  disabled={!newTag.trim() || currentTags.length >= 5}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Suggested Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags Sugeridas</label>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_TAGS.filter(t => !currentTags.includes(t)).map(tag => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => addTag(tag)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <Button 
              onClick={saveTags} 
              disabled={saving}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Tags
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
};

export default CreatorTags;
