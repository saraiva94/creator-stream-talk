import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Globe, Camera } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import UserCreditsWalletPanel from "@/components/user/wallet/UserCreditsWalletPanel";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import CreatorActivationCard from "@/components/creator/CreatorActivationCard";
import { logger } from "@/lib/logger";
import AvatarCropDialog from "@/components/AvatarCropDialog";
import { InstructionsDialog } from "@/components/InstructionsDialog";

type ProfileFormState = {
  username: string;
  website: string;
  bio: string;
  gender: string;
  avatar_url: string;
};

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileFormState>({
    username: "",
    website: "",
    bio: "",
    gender: "",
    avatar_url: "",
  });
  const [uploading, setUploading] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    logger.profile.info('Página de perfil carregada');
    
    const checkAuth = async () => {
      logger.auth.debug('Verificando autenticação');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        logger.auth.warn('Sem sessão, redirecionando para /auth');
        navigate("/auth");
        return;
      }
      
      logger.auth.info('Sessão válida', { userId: session.user.id, email: session.user.email });
      setUser(session.user);

      logger.profile.debug('Carregando dados do perfil', { userId: session.user.id });
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) {
        logger.profile.error('Erro ao carregar perfil', { userId: session.user.id }, error);
      }

      if (profileData) {
        logger.profile.info('Perfil carregado', { 
          userId: session.user.id,
          username: profileData.username,
          hasAvatar: !!profileData.avatar_url,
          referralCode: profileData.referral_code,
        });
        
        setProfile({
          username: profileData.username || "",
          website: profileData.website || "",
          bio: profileData.bio || "",
          gender: profileData.gender || "",
          avatar_url: profileData.avatar_url || "",
        });
      }

      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    logger.profile.info('Arquivo selecionado para avatar', { 
      fileName: file.name,
      fileSize: file.size,
    });

    // Create a preview URL and open crop dialog
    const reader = new FileReader();
    reader.onload = () => {
      setTempImageSrc(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
    
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const handleCroppedImage = async (croppedBlob: Blob) => {
    if (!user) return;

    logger.profile.info('Iniciando upload de avatar recortado', { 
      blobSize: croppedBlob.size,
      userId: user.id,
    });

    const fileName = `${user.id}/${Date.now()}.jpg`;

    setUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedBlob, { upsert: true, contentType: 'image/jpeg' });

      if (uploadError) {
        logger.profile.error('Erro no upload do avatar', { fileName }, uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      logger.profile.info('Avatar enviado com sucesso', { publicUrl });
      setProfile({ ...profile, avatar_url: publicUrl });

      toast({
        title: t.profile.photoUpdated,
        description: t.profile.rememberToSave,
      });
    } catch (error: unknown) {
      logger.profile.error('Erro fatal no upload', {}, error as Error);
      const message = error instanceof Error ? error.message : t.common.error;
      toast({
        title: t.common.error,
        description: message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setTempImageSrc(null);
    }
  };

  const handleUpdateProfile = async () => {
    if (!profile.username.trim()) {
      logger.profile.warn('Validação falhou: username vazio');
      toast({
        title: t.common.error,
        description: t.profile.usernameRequired,
        variant: "destructive",
      });
      return;
    }

    logger.profile.info('Atualizando perfil', { 
      userId: user?.id,
      username: profile.username,
    });

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: profile.username.trim(),
          website: profile.website.trim() || null,
          bio: profile.bio.trim() || null,
          gender: profile.gender || null,
          avatar_url: profile.avatar_url.trim() || null,
        })
        .eq("id", user!.id);

      if (error) {
        logger.profile.error('Erro ao atualizar perfil', { userId: user?.id }, error);
        throw error;
      }

      logger.profile.info('Perfil atualizado com sucesso', { userId: user?.id });
      toast({
        title: t.profile.profileUpdated,
        description: t.profile.infoSaved,
      });
    } catch (error: unknown) {
      logger.profile.error('Erro fatal na atualização', {}, error as Error);
      const message = error instanceof Error ? error.message : t.common.error;
      toast({
        title: t.common.error,
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          {t.common.loading}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="container mx-auto px-4 py-6 sm:py-8 max-w-2xl space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <User className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              {t.profile.title}
            </h1>
          </div>
          <InstructionsDialog />
        </div>

        <Card className="border-border shadow-card">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">{t.profile.personalInfo}</CardTitle>
            <CardDescription>
              {t.profile.personalInfoDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
            {/* Avatar Circular Clicável */}
            <div className="flex flex-col items-center gap-3">
              <Label className="self-start">{t.profile.profilePhoto}</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="relative group"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-primary bg-muted flex items-center justify-center transition-all hover:border-primary/70 hover:opacity-90">
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                {uploading && (
                  <div className="absolute inset-0 rounded-full bg-black/70 flex items-center justify-center">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">
                {t.profile.clickToChange}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">{t.profile.username} *</Label>
              <Input
                id="username"
                value={profile.username}
                onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                placeholder="seu_usuario"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">
                <Globe className="inline h-4 w-4 mr-1" />
                {t.profile.personalSite}
              </Label>
              <Input
                id="website"
                type="url"
                value={profile.website}
                onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                placeholder="https://seusite.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">{t.profile.bio}</Label>
              <Textarea
                id="bio"
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                placeholder={t.profile.bioPlaceholder}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">{t.profile.gender}</Label>
              <Select
                value={profile.gender}
                onValueChange={(value) => setProfile({ ...profile, gender: value })}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder={t.profile.selectGender} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t.profile.genderMale}</SelectItem>
                  <SelectItem value="female">{t.profile.genderFemale}</SelectItem>
                  <SelectItem value="other">{t.profile.genderOther}</SelectItem>
                  <SelectItem value="prefer_not_to_say">{t.profile.genderPreferNot}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleUpdateProfile}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              disabled={loading}
            >
              {loading ? t.profile.saving : t.profile.saveChanges}
            </Button>
          </CardContent>
        </Card>

        <UserCreditsWalletPanel />

        <CreatorActivationCard />
      </main>

      {/* Crop Dialog */}
      {tempImageSrc && (
        <AvatarCropDialog
          open={cropDialogOpen}
          onOpenChange={setCropDialogOpen}
          imageSrc={tempImageSrc}
          onCropComplete={handleCroppedImage}
        />
      )}
    </div>
  );
};

export default Profile;
