import crypto from 'crypto';

const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

type VerifySignatureArgs = {
  rawBody?: Buffer | string;
  signatureHeader?: string;
  secret: string;
};

export type MercadoPagoSignatureResult = {
  isValid: boolean;
  expectedHmac?: string;
  receivedHmac?: string;
  timestamp?: string;
  timestampMs?: number;
  reason?: string;
};

const toBodyString = (rawBody?: Buffer | string) => {
  if (typeof rawBody === 'string') return rawBody;
  if (rawBody instanceof Buffer) return rawBody.toString('utf8');
  return '';
};

const parseSignatureHeader = (signatureHeader?: string) => {
  if (!signatureHeader) return null;
  const segments = signatureHeader.split(',');
  const map = segments.reduce<Record<string, string>>((acc, segment) => {
    const [key, value] = segment.split('=');
    if (key && value) {
      acc[key.trim()] = value.trim();
    }
    return acc;
  }, {});

  if (!map.ts || !map.v1) {
    return null;
  }

  const timestampMs = Number(map.ts);
  if (!Number.isFinite(timestampMs)) {
    return null;
  }

  const resolvedTimestampMs = map.ts.length > 10 ? timestampMs : timestampMs * 1000;

  return { timestampRaw: map.ts, timestampMs: resolvedTimestampMs, signature: map.v1 };
};

const isTimestampFresh = (timestampMs: number) => {
  const delta = Math.abs(Date.now() - timestampMs);
  return delta <= MAX_WEBHOOK_AGE_MS;
};

export const verifyMercadoPagoSignature = ({
  rawBody,
  signatureHeader,
  secret,
}: VerifySignatureArgs): MercadoPagoSignatureResult => {
  if (!rawBody) {
    return { isValid: false, reason: 'missing_raw_body' };
  }

  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    return { isValid: false, reason: 'invalid_signature_header' };
  }

  if (!isTimestampFresh(parsed.timestampMs)) {
    return {
      isValid: false,
      reason: 'stale_timestamp',
      timestamp: parsed.timestampRaw,
      timestampMs: parsed.timestampMs,
    };
  }

  const bodyString = toBodyString(rawBody);
  const message = `${parsed.timestampRaw}.${bodyString}`;
  const expected = crypto.createHmac('sha256', secret).update(message).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const providedBuffer = Buffer.from(parsed.signature, 'utf8');

  if (expectedBuffer.length !== providedBuffer.length) {
    return {
      isValid: false,
      reason: 'length_mismatch',
      expectedHmac: expected,
      receivedHmac: parsed.signature,
      timestamp: parsed.timestampRaw,
      timestampMs: parsed.timestampMs,
    };
  }

  const signatureMatches = crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  return {
    isValid: signatureMatches,
    expectedHmac: expected,
    receivedHmac: parsed.signature,
    timestamp: parsed.timestampRaw,
    timestampMs: parsed.timestampMs,
    reason: signatureMatches ? undefined : 'hmac_mismatch',
  };
};
