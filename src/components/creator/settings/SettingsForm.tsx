import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type Profile = {
  displayName: string;
  bio: string;
  tags: string[];
  language: string;
  notifications: boolean;
};

type Props = {
  profile: Profile | null;
  isSaving?: boolean;
  onChange: <K extends keyof Profile>(key: K, value: Profile[K]) => void;
  onSave: () => void;
};

const SettingsForm = ({ profile, isSaving, onChange, onSave }: Props) => {
  if (!profile) {
    return <Badge variant="outline">Carregando mock...</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">Nome de exibição</Label>
        <Input
          id="displayName"
          value={profile.displayName}
          onChange={(e) => onChange("displayName", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          rows={3}
          value={profile.bio}
          onChange={(e) => onChange("bio", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
        <Input
          id="tags"
          value={profile.tags.join(", ")}
          onChange={(e) => onChange("tags", e.target.value.split(",").map((t) => t.trim()))}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label>Notificações</Label>
          <p className="text-xs text-muted-foreground">Receber alertas sobre pagamentos e lives</p>
        </div>
        <Switch checked={profile.notifications} onCheckedChange={(v) => onChange("notifications", v)} />
      </div>

      <Button onClick={onSave} disabled={isSaving} className="w-full md:w-auto">
        {isSaving ? "Salvando..." : "Salvar (mock)"}
      </Button>
    </div>
  );
};

export default SettingsForm;
