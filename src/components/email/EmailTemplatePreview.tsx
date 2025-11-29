import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import WelcomeEmail from "./templates/WelcomeEmail";
import PurchaseSuccessEmail from "./templates/PurchaseSuccessEmail";
import LowBalanceEmail from "./templates/LowBalanceEmail";
import LiveEndedEmail from "./templates/LiveEndedEmail";
import StreamErrorEmail from "./templates/StreamErrorEmail";
import AffiliateInviteEmail from "./templates/AffiliateInviteEmail";
import { type EmailTemplateName } from "@/lib/emailTemplatesService";

type Props = {
  template: EmailTemplateName;
};

const EmailTemplatePreview = ({ template }: Props) => {
  const renderTemplate = () => {
    switch (template) {
      case "welcome":
        return <WelcomeEmail />;
      case "purchaseSuccess":
        return <PurchaseSuccessEmail />;
      case "lowBalance":
        return <LowBalanceEmail />;
      case "liveEnded":
        return <LiveEndedEmail />;
      case "streamError":
        return <StreamErrorEmail />;
      case "affiliateInvite":
        return <AffiliateInviteEmail />;
      default:
        return null;
    }
  };

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle>Pré-visualização</CardTitle>
      </CardHeader>
      <CardContent className="bg-muted/30">
        <div className="rounded-lg border border-border/60 bg-white p-4">{renderTemplate()}</div>
      </CardContent>
    </Card>
  );
};

export default EmailTemplatePreview;
