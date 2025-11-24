import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Profile = {
  displayName: string;
  bio: string;
  tags: string[];
  language: string;
  notifications: boolean;
};

type Props = {
  profile: Profile | null;
};

const SettingsSummary = ({ profile }: Props) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo</CardTitle>
        <CardDescription>Dados fictícios do criador</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">Nome: </span>
          {profile?.displayName ?? "—"}
        </div>
        <div>
          <span className="font-medium text-foreground">Bio: </span>
          {profile?.bio ?? "—"}
        </div>
        <div>
          <span className="font-medium text-foreground">Tags: </span>
          {profile?.tags.join(", ") ?? "—"}
        </div>
        <div>
          <span className="font-medium text-foreground">Idioma: </span>
          {profile?.language ?? "—"}
        </div>
        <div>
          <span className="font-medium text-foreground">Notificações: </span>
          {profile?.notifications ? "Ativadas" : "Desativadas"}
        </div>
      </CardContent>
    </Card>
  );
};

export default SettingsSummary;
