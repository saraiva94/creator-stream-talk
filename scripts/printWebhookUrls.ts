import {
  ensureRequiredEnvs,
  getPublicBaseUrlMetadata,
  getMercadoPagoWebhookExpectation,
} from '../backend/src/lib/env';

const main = () => {
  ensureRequiredEnvs();
  const metadata = getPublicBaseUrlMetadata();
  const mercadopago = getMercadoPagoWebhookExpectation();

  console.log('Canonical Base URL:');
  console.log(metadata.url ?? 'unresolved');
  console.log('');
  console.log('Mercado Pago Webhook:');
  console.log(mercadopago.canonicalUrl ?? 'unresolved');
  console.log('');
  console.log('Source of Base URL:');
  console.log(metadata.source);
};

try {
  main();
} catch (error) {
  console.error('Failed to print webhook URLs:', (error as Error).message);
  process.exitCode = 1;
}
