using Azure.Identity;
using Azure.Security.KeyVault.Secrets;

namespace CRoll.API.Services.KeyVault
{
    /// <summary>
    /// Wraps the Azure Key Vault SecretClient.
    /// If KeyVault:Url is empty (local dev), Client will be null
    /// and all consumers fall back to appsettings values.
    /// </summary>
    public class AzureConnection
    {
        public SecretClient? Client { get; }

        public AzureConnection(IConfiguration configuration)
        {
            var keyVaultUrl = configuration["KeyVault:Url"];

            if (string.IsNullOrWhiteSpace(keyVaultUrl))
            {
                // Local dev — no Key Vault configured, consumers use appsettings fallback
                Client = null;
                return;
            }

            Client = new SecretClient(new Uri(keyVaultUrl), new DefaultAzureCredential());
        }
    }
}
