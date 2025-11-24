const StreamErrorEmail = () => (
  <EmailLayout
    title="Erro na transmissão"
    subtitle="Estamos trabalhando para resolver."
    body={[
      "Ocorreu um problema durante a transmissão.",
      "Nossa equipe já foi notificada e está corrigindo o incidente.",
    ]}
    ctaText="Receber atualizações"
    footer="Pedimos desculpas pelo transtorno."
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

export default StreamErrorEmail;
