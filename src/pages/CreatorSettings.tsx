import { Link } from "react-router-dom";
import SettingsForm from "@/components/creator/settings/SettingsForm";
import SettingsSummary from "@/components/creator/settings/SettingsSummary";
import { useCreatorSettings } from "@/hooks/useCreatorSettings";
import { Button } from "@/components/ui/button";
import { Tag } from "lucide-react";

const CreatorSettings = () => {
  const { profile, isLoading, isSaving, updateField, save } = useCreatorSettings();

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Configurações</h1>
            <p className="text-muted-foreground text-sm">Gerencie suas configurações de canal.</p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/creator/tags">
              <Tag className="h-4 w-4" />
              Gerenciar Tags
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SettingsForm profile={profile} isSaving={isSaving} onChange={updateField} onSave={save} />
          </div>
          <SettingsSummary profile={profile} />
        </div>
      </main>
    </div>
  );
};

export default CreatorSettings;
