const AffiliateInviteEmail = () => (
  <EmailLayout
    title="Convite para afiliação"
    subtitle="Ganhe comissões indicando novos criadores."
    body={[
      "Você foi convidado para se tornar um afiliado.",
      "Compartilhe seu link e receba comissões por cada novo cadastro aprovado.",
    ]}
    ctaText="Ativar afiliação"
    footer="Se não solicitou este convite, ignore o email."
  />
);

const EmailLayout = ({
  title,
  subtitle,
  body,
  ctaText,
  footer,
}: {
  title: string;
  subtitle: string;
  body: string[];
  ctaText?: string;
  footer?: string;
}) => (
  <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-6 text-gray-900 shadow-sm">
    <header className="mb-4">
      <p className="text-sm font-medium text-indigo-600">Creator Stream Talk</p>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sm text-gray-600">{subtitle}</p>
    </header>

    <main className="space-y-3 text-sm leading-relaxed">
      {body.map((line, idx) => (
        <p key={idx}>{line}</p>
      ))}
      {ctaText && (
        <div className="mt-4">
          <span className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-white">{ctaText}</span>
        </div>
      )}
    </main>

    {footer && <footer className="mt-6 text-xs text-gray-500">{footer}</footer>}
  </div>
);

export default AffiliateInviteEmail;
