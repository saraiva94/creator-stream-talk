import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Video, ExternalLink, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";

interface PromotionalVideo {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  redirect_url: string | null;
  position: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

const PromotionalVideosPanel = () => {
  const { t } = useLanguage();
  const [videos, setVideos] = useState<PromotionalVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<PromotionalVideo | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    thumbnail_url: "",
    video_url: "",
    redirect_url: "",
    position: 0,
    is_active: true,
    starts_at: "",
    ends_at: "",
  });

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from("promotional_videos")
        .select("*")
        .order("position", { ascending: true });

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error("Error fetching promotional videos:", error);
      toast.error("Erro ao carregar vídeos promocionais");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        thumbnail_url: formData.thumbnail_url || null,
        video_url: formData.video_url || null,
        redirect_url: formData.redirect_url || null,
        position: formData.position,
        is_active: formData.is_active,
        starts_at: formData.starts_at || null,
        ends_at: formData.ends_at || null,
      };

      if (editingVideo) {
        const { error } = await supabase
          .from("promotional_videos")
          .update(payload)
          .eq("id", editingVideo.id);

        if (error) throw error;
        toast.success("Vídeo atualizado com sucesso");
      } else {
        const { error } = await supabase
          .from("promotional_videos")
          .insert(payload);

        if (error) throw error;
        toast.success("Vídeo adicionado com sucesso");
      }

      setDialogOpen(false);
      resetForm();
      fetchVideos();
    } catch (error) {
      console.error("Error saving promotional video:", error);
      toast.error("Erro ao salvar vídeo");
    }
  };

  const handleEdit = (video: PromotionalVideo) => {
    setEditingVideo(video);
    setFormData({
      title: video.title,
      description: video.description || "",
      thumbnail_url: video.thumbnail_url || "",
      video_url: video.video_url || "",
      redirect_url: video.redirect_url || "",
      position: video.position,
      is_active: video.is_active,
      starts_at: video.starts_at ? video.starts_at.slice(0, 16) : "",
      ends_at: video.ends_at ? video.ends_at.slice(0, 16) : "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este vídeo?")) return;

    try {
      const { error } = await supabase
        .from("promotional_videos")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Vídeo excluído com sucesso");
      fetchVideos();
    } catch (error) {
      console.error("Error deleting promotional video:", error);
      toast.error("Erro ao excluir vídeo");
    }
  };

  const toggleActive = async (video: PromotionalVideo) => {
    try {
      const { error } = await supabase
        .from("promotional_videos")
        .update({ is_active: !video.is_active })
        .eq("id", video.id);

      if (error) throw error;
      fetchVideos();
    } catch (error) {
      console.error("Error toggling video status:", error);
      toast.error("Erro ao alterar status");
    }
  };

  const resetForm = () => {
    setEditingVideo(null);
    setFormData({
      title: "",
      description: "",
      thumbnail_url: "",
      video_url: "",
      redirect_url: "",
      position: videos.length,
      is_active: true,
      starts_at: "",
      ends_at: "",
    });
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <Card className="border-border mb-6 sm:mb-8">
      <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="w-5 h-5 text-primary" />
          Adicionar Vídeos Promocionais
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog} className="gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Vídeo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingVideo ? "Editar Vídeo" : "Novo Vídeo Promocional"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="Título do vídeo promocional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnail_url">URL da Thumbnail</Label>
                <Input
                  id="thumbnail_url"
                  value={formData.thumbnail_url}
                  onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                  placeholder="https://exemplo.com/imagem.jpg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="video_url">URL do Vídeo</Label>
                <Input
                  id="video_url"
                  value={formData.video_url}
                  onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                  placeholder="https://exemplo.com/video.mp4"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="redirect_url">URL de Redirecionamento (ao clicar)</Label>
                <Input
                  id="redirect_url"
                  value={formData.redirect_url}
                  onChange={(e) => setFormData({ ...formData, redirect_url: e.target.value })}
                  placeholder="https://exemplo.com/landing-page"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Posição na Grade</Label>
                <Input
                  id="position"
                  type="number"
                  min="0"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">Menor número = maior prioridade</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="starts_at">Início (opcional)</Label>
                  <Input
                    id="starts_at"
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ends_at">Fim (opcional)</Label>
                  <Input
                    id="ends_at"
                    type="datetime-local"
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Ativo</Label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" className="flex-1">
                  {editingVideo ? "Salvar Alterações" : "Adicionar Vídeo"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : videos.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Video className="w-12 h-12 text-muted-foreground/50 mx-auto" />
            <p className="text-muted-foreground">Nenhum vídeo promocional cadastrado</p>
            <p className="text-sm text-muted-foreground">
              Adicione vídeos para exibir no carrossel da página inicial (1 a cada 3 vídeos)
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {videos.map((video) => (
                <TableRow key={video.id}>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <GripVertical className="w-4 h-4" />
                      {video.position}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-16 h-10 object-cover rounded border border-border"
                        />
                      ) : (
                        <div className="w-16 h-10 bg-muted rounded border border-border flex items-center justify-center">
                          <Video className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{video.title}</p>
                        {video.redirect_url && (
                          <a
                            href={video.redirect_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Link
                          </a>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={video.is_active ? "default" : "secondary"}
                      className="cursor-pointer"
                      onClick={() => toggleActive(video)}
                    >
                      {video.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {video.starts_at || video.ends_at ? (
                      <div className="text-xs text-muted-foreground">
                        {video.starts_at && (
                          <p>De: {new Date(video.starts_at).toLocaleDateString("pt-BR")}</p>
                        )}
                        {video.ends_at && (
                          <p>Até: {new Date(video.ends_at).toLocaleDateString("pt-BR")}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sempre</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(video)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(video.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default PromotionalVideosPanel;
