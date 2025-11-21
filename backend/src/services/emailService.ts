import { Resend } from 'resend';
import logger from '../lib/logger';
import { getEnv } from '../lib/env';

const resend = new Resend(getEnv('RESEND_API_KEY'));

type EmailType = 'payment_receipt' | 'access_granted' | 'live_starting';

type EmailPayload = {
  to: string;
  type: EmailType;
  data?: Record<string, unknown>;
};

type EmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

type EmailLogEntry = {
  id: string;
  to: string;
  type: EmailType;
  status: 'sent' | 'failed';
  timestamp: string;
  error?: string;
};

const emailLog: EmailLogEntry[] = [];

const logEmail = (entry: EmailLogEntry) => {
  emailLog.push(entry);
  if (emailLog.length > 100) {
    emailLog.shift();
  }
};

const DEFAULT_LOCALE = process.env.EMAIL_LOCALE || 'en-US';
const DEFAULT_CURRENCY = process.env.MERCADOPAGO_CURRENCY || 'USD';

const formatCurrency = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return new Intl.NumberFormat(DEFAULT_LOCALE, { style: 'currency', currency: DEFAULT_CURRENCY }).format(0);
  }
  return new Intl.NumberFormat(DEFAULT_LOCALE, { style: 'currency', currency: DEFAULT_CURRENCY }).format(value);
};

const templates: Record<EmailType, (data?: Record<string, unknown>) => EmailTemplate> = {
  payment_receipt: (data = {}) => {
    const amount = formatCurrency(Number(data.amount));
    const liveTitle = (data.liveTitle as string) || 'sua transmissão';
    return {
      subject: `Pagamento confirmado para ${liveTitle}`,
      text: `Recebemos o pagamento de ${amount}. Você já pode acessar ${liveTitle}.`,
      html: `<p>Recebemos o pagamento de <strong>${amount}</strong>.</p><p>Você já pode acessar <strong>${liveTitle}</strong>.</p>`,
    };
  },
  access_granted: (data = {}) => {
    const liveTitle = (data.liveTitle as string) || 'sua transmissão';
    const viewerUrl = (data.viewerUrl as string) || '#';
    return {
      subject: `Acesso liberado para ${liveTitle}`,
      text: `Seu acesso está liberado. Entre em ${viewerUrl} quando o evento começar.`,
      html: `<p>Seu acesso para <strong>${liveTitle}</strong> está liberado.</p><p><a href="${viewerUrl}">Entrar na transmissão</a></p>`,
    };
  },
  live_starting: (data = {}) => {
    const liveTitle = (data.liveTitle as string) || 'sua transmissão';
    const startTime = (data.startTime as string) || 'em instantes';
    return {
      subject: `${liveTitle} está começando`,
      text: `O evento ${liveTitle} começa ${startTime}. Prepare-se para entrar.`,
      html: `<p>O evento <strong>${liveTitle}</strong> começa ${startTime}.</p><p>Prepare-se para entrar!</p>`,
    };
  },
};

export const sendTransactionalEmail = async ({ to, type, data }: EmailPayload) => {
  const templateBuilder = templates[type];

  if (!templateBuilder) {
    throw new Error(`Unsupported email type: ${type}`);
  }

  const template = templateBuilder(data);

  try {
    const { data: response, error } = await resend.emails.send({
      from: 'Creator Stream <no-reply@creatorstream.local>',
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    if (error) {
      throw new Error(error.message);
    }

    const messageId = response?.id || `email-${Date.now()}`;

    logEmail({
      id: messageId,
      to,
      type,
      status: 'sent',
      timestamp: new Date().toISOString(),
    });

    logger.info({ event: 'email.sent', to, type, messageId });

    return {
      id: response?.id,
      status: 'sent',
    };
  } catch (error) {
    logEmail({
      id: `email-${Date.now()}`,
      to,
      type,
      status: 'failed',
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
    });
    logger.error({ event: 'email.failed', to, type, error: (error as Error).message });
    throw error;
  }
};

export const getEmailLog = () => emailLog;
