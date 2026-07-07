const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');
const logger = require('./logger');

let secretCache = {};

async function loadSecrets() {
  const vaultUri = process.env.KEY_VAULT_URI;
  if (!vaultUri) {
    logger.info('KEY_VAULT_URI not set — skipping Key Vault secret load (local dev mode)');
    return;
  }

  logger.info('Loading secrets from Azure Key Vault via Managed Identity...');
  const credential = new DefaultAzureCredential();
  const client = new SecretClient(vaultUri, credential);

  const secretNames = ['mongodb-uri', 'jwt-secret', 'appinsights-connection-string'];

  await Promise.all(
    secretNames.map(async (name) => {
      try {
        const secret = await client.getSecret(name);
        secretCache[name] = secret.value;
      } catch (err) {
        logger.warn({ err }, `Could not load secret: ${name}`);
      }
    }),
  );

  // Override process.env with Key Vault values so the rest of the app
  // doesn't need to know where secrets came from
  if (secretCache['mongodb-uri'])                  process.env.MONGODB_URI = secretCache['mongodb-uri'];
  if (secretCache['jwt-secret'])                   process.env.JWT_SECRET  = secretCache['jwt-secret'];
  if (secretCache['appinsights-connection-string']) process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = secretCache['appinsights-connection-string'];

  logger.info('Secrets loaded from Key Vault');
}

module.exports = { loadSecrets };
