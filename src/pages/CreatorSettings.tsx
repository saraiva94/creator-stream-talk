import SettingsForm from "@/components/creator/settings/SettingsForm";
import SettingsSummary from "@/components/creator/settings/SettingsSummary";
import { useCreatorSettings } from "@/hooks/useCreatorSettings";

const CreatorSettings = () => {
  const { profile, isLoading, isSaving, updateField, save } = useCreatorSettings();

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Configurações</h1>
            <p className="text-muted-foreground text-sm">Apenas mock, sem salvar real.</p>
          </div>
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
