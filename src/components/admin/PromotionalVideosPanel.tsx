import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Pencil, Trash2, Video, ExternalLink, GripVertical, Upload, Youtube, AlertCircle, Eye, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/hooks/useLanguage";
import VideoCarousel from "@/components/VideoCarousel";

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

type VideoSourceType = 'youtube' | 'upload';

const PromotionalVideosPanel = () => {
  const { t } = useLanguage();
  const [videos, setVideos] = useState<PromotionalVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState<PromotionalVideo | null>(null);
  const [videoSourceType, setVideoSourceType] = useState<VideoSourceType>('youtube');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [carouselCardCount, setCarouselCardCount] = useState<number>(7);
  const [formData, setFormData] = useState({
    title: "",
    video_url: "",
    redirect_url: "",
    position: 0,
    is_active: true,
  });

  // Extract YouTube video ID from URL
  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Generate YouTube embed URL for autoplay
  const getYouTubeEmbedUrl = (url: string): string | null => {
    const videoId = extractYouTubeId(url);
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}`;
  };

  // Handle video file selection and validate duration
  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      toast.error('Selecione um arquivo de vídeo válido');
      return;
    }

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('O arquivo é muito grande. Máximo: 50MB');
      return;
    }

    // Check video duration
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      const duration = Math.round(video.duration);
      
      if (duration > 20) {
        toast.error(`Vídeo muito longo (${duration}s). Máximo permitido: 20 segundos`);
        setVideoFile(null);
        setVideoDuration(null);
        if (videoInputRef.current) videoInputRef.current.value = '';
        return;
      }
      
      setVideoFile(file);
      setVideoDuration(duration);
    };
  };

  // Upload video to Supabase storage
  const uploadVideoFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `promotional/${fileName}`;

    const { error } = await supabase.storage
      .from('chat-media')
      .upload(filePath, file);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  // Upload thumbnail to Supabase storage
  const uploadThumbnailFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `thumbnail_${crypto.randomUUID()}.${fileExt}`;
    const filePath = `promotional/${fileName}`;

    const { error } = await supabase.storage
      .from('chat-media')
      .upload(filePath, file);

    if (error) {
      console.error('Thumbnail upload error:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  // Handle thumbnail file selection
  const handleThumbnailFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem é muito grande. Máximo: 5MB');
      return;
    }

    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  useEffect(() => {
    fetchVideos();
    fetchCarouselSettings();
  }, []);

  const fetchCarouselSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("homepage_settings")
        .select("carousel_card_count")
        .eq("id", "default")
        .single();

      if (error) throw error;
      if (data) setCarouselCardCount(data.carousel_card_count);
    } catch (error) {
      console.error("Error fetching carousel settings:", error);
    }
  };

  const updateCarouselCardCount = async (count: number) => {
    try {
      const { error } = await supabase
        .from("homepage_settings")
        .update({ carousel_card_count: count, updated_at: new Date().toISOString() })
        .eq("id", "default");

      if (error) throw error;
      setCarouselCardCount(count);
      toast.success(`Carrossel atualizado para ${count} card${count > 1 ? 's' : ''}`);
    } catch (error) {
      console.error("Error updating carousel settings:", error);
      toast.error("Erro ao atualizar configuração do carrossel");
    }
  };

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
      let videoUrl = formData.video_url;
      let thumbnailUrl: string | null = null;

      // Handle YouTube URL
      if (videoSourceType === 'youtube') {
        const embedUrl = getYouTubeEmbedUrl(formData.video_url);
        if (!embedUrl) {
          toast.error('URL do YouTube inválida');
          return;
        }
        videoUrl = embedUrl;
        // Generate YouTube thumbnail
        const videoId = extractYouTubeId(formData.video_url);
        if (videoId) {
          thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
      } else if (videoSourceType === 'upload' && videoFile) {
        // Upload video file
        setUploadingVideo(true);
        const uploadedUrl = await uploadVideoFile(videoFile);
        if (!uploadedUrl) {
          toast.error('Erro ao fazer upload do vídeo');
          setUploadingVideo(false);
          return;
        }
        videoUrl = uploadedUrl;
        setUploadingVideo(false);
      }

      // Upload custom thumbnail if provided
      if (thumbnailFile) {
        const uploadedThumbUrl = await uploadThumbnailFile(thumbnailFile);
        if (uploadedThumbUrl) {
          thumbnailUrl = uploadedThumbUrl;
        }
      }

      const payload = {
        title: formData.title,
        description: null,
        thumbnail_url: thumbnailUrl,
        video_url: videoUrl || null,
        redirect_url: formData.redirect_url || null,
        position: formData.position,
        is_active: formData.is_active,
        starts_at: null,
        ends_at: null,
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
    // Detect if it's a YouTube URL
    const isYouTube = video.video_url?.includes('youtube.com') || video.video_url?.includes('youtu.be');
    setVideoSourceType(isYouTube ? 'youtube' : 'upload');
    setFormData({
      title: video.title,
      video_url: video.video_url || "",
      redirect_url: video.redirect_url || "",
      position: video.position,
      is_active: video.is_active,
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
    setVideoSourceType('youtube');
    setVideoFile(null);
    setVideoDuration(null);
    setThumbnailFile(null);
    setThumbnailPreview(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
    setFormData({
      title: "",
      video_url: "",
      redirect_url: "",
      position: videos.length,
      is_active: true,
    });
  };

  const refreshPreview = () => {
    setPreviewKey(prev => prev + 1);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <Card className="border-border mb-6 sm:mb-8">
      <CardHeader className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="w-5 h-5 text-primary" />
            Vídeos Promocionais
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => { setShowPreview(!showPreview); if (!showPreview) refreshPreview(); }}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? "Ocultar Preview" : "Ver Preview"}
            </Button>
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

                {/* Video Source Type Selection */}
                <div className="space-y-3">
                  <Label>Origem do Vídeo *</Label>
                  <RadioGroup 
                    value={videoSourceType} 
                    onValueChange={(value) => setVideoSourceType(value as VideoSourceType)}
                    className="grid grid-cols-2 gap-3"
                  >
                    <div className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${videoSourceType === 'youtube' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                      <RadioGroupItem value="youtube" id="youtube" />
                      <Label htmlFor="youtube" className="flex items-center gap-2 cursor-pointer">
                        <Youtube className="w-5 h-5 text-red-500" />
                        YouTube
                      </Label>
                    </div>
                    <div className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${videoSourceType === 'upload' ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}>
                      <RadioGroupItem value="upload" id="upload" />
                      <Label htmlFor="upload" className="flex items-center gap-2 cursor-pointer">
                        <Upload className="w-5 h-5 text-primary" />
                        Upload (máx 20s)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* YouTube URL Input */}
                {videoSourceType === 'youtube' && (
                  <div className="space-y-2">
                    <Label htmlFor="video_url">URL do YouTube *</Label>
                    <Input
                      id="video_url"
                      value={formData.video_url}
                      onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                      placeholder="https://youtube.com/watch?v=... ou https://youtu.be/..."
                      required={videoSourceType === 'youtube'}
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Youtube className="w-3 h-3" />
                      O vídeo será reproduzido automaticamente no carrossel
                    </p>
                  </div>
                )}

                {/* Video Upload Input */}
                {videoSourceType === 'upload' && (
                  <div className="space-y-2">
                    <Label>Upload de Vídeo (máx 20 segundos) *</Label>
                    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/*"
                        onChange={handleVideoFileChange}
                        className="hidden"
                        id="video-upload"
                      />
                      <label htmlFor="video-upload" className="cursor-pointer block">
                        {videoFile ? (
                          <div className="space-y-2">
                            <Video className="w-10 h-10 mx-auto text-primary" />
                            <p className="text-sm font-medium">{videoFile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Duração: {videoDuration}s • {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Clique para selecionar um vídeo
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Máximo: 20 segundos, 50MB
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                    {videoDuration && videoDuration <= 20 && (
                      <p className="text-xs text-green-500 flex items-center gap-1">
                        ✓ Duração válida: {videoDuration} segundos
                      </p>
                    )}
                  </div>
                )}

                {/* Alert about 20s limit */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-500">
                    <strong>Lógica do Carrossel:</strong> Usuários podem assistir até 20 segundos de cada vídeo promocional. Após isso, o carrossel avança automaticamente.
                  </p>
                </div>

                {/* Custom Thumbnail Upload */}
                <div className="space-y-2">
                  <Label>Thumbnail Personalizada (opcional)</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-3">
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailFileChange}
                      className="hidden"
                      id="thumbnail-upload"
                    />
                    <label htmlFor="thumbnail-upload" className="cursor-pointer block">
                      {thumbnailPreview ? (
                        <div className="space-y-2">
                          <img 
                            src={thumbnailPreview} 
                            alt="Thumbnail preview" 
                            className="w-full h-24 object-cover rounded"
                          />
                          <p className="text-xs text-muted-foreground text-center">
                            Clique para trocar
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <ImagePlus className="w-5 h-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            Adicionar thumbnail
                          </span>
                        </div>
                      )}
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se não enviada, será usada a thumbnail do YouTube (se aplicável)
                  </p>
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

                <div className="flex items-center gap-3">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Ativo</Label>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="submit" className="flex-1" disabled={uploadingVideo}>
                    {uploadingVideo ? "Enviando..." : editingVideo ? "Salvar Alterações" : "Adicionar Vídeo"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Preview Section */}
        {showPreview && (
          <div className="border border-border rounded-lg p-4 bg-background/50">
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-medium">Preview do Carrossel na Homepage</Label>
              <Button variant="ghost" size="sm" onClick={refreshPreview} className="gap-1">
                <Eye className="w-3 h-3" />
                Atualizar
              </Button>
            </div>
            <div className="bg-background rounded-lg overflow-hidden border border-border/50">
              <VideoCarousel key={previewKey} />
            </div>
          </div>
        )}

        {/* Carousel Card Count Selector */}
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
          <Label className="text-sm font-medium whitespace-nowrap">Cards no Carrossel:</Label>
          <div className="flex gap-2">
            {[1, 3, 5, 7].map((count) => (
              <Button
                key={count}
                variant={carouselCardCount === count ? "default" : "outline"}
                size="sm"
                onClick={() => updateCarouselCardCount(count)}
                className="w-10"
              >
                {count}
              </Button>
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-2">
            {carouselCardCount === 1 && "(setas ficam ocultas)"}
          </span>
        </div>
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
