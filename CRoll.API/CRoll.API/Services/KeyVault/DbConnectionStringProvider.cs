namespace CRoll.API.Services.KeyVault
{
    public interface IDbConnectionStringProvider
    {
        string CRollDb { get; }
    }

    /// <summary>
    /// Resolves the SQL connection string.
    /// Priority: Key Vault secret → appsettings fallback (ConnectionStrings:DefaultConnection).
    /// On local dev Key Vault is skipped; real value comes from appsettings.Development.json.
    /// </summary>
    public class DbConnectionStringProvider : IDbConnectionStringProvider
    {
        public string CRollDb { get; }

        public DbConnectionStringProvider(AzureConnection azureConnection, IConfiguration configuration)
        {
            CRollDb = Resolve(
                azureConnection,
                configuration,
                secretConfigKey: "SQL:Cases:SecretName",
                fallbackConfigKey: "ConnectionStrings:DefaultConnection");
        }

        private static string Resolve(
            AzureConnection azureConnection,
            IConfiguration configuration,
            string secretConfigKey,
            string fallbackConfigKey)
        {
            if (azureConnection.Client != null)
            {
                try
                {
                    var secretName = configuration[secretConfigKey];
                    if (!string.IsNullOrWhiteSpace(secretName))
                    {
                        var secret = azureConnection.Client.GetSecret(secretName);
                        if (!string.IsNullOrWhiteSpace(secret?.Value?.Value))
                            return secret.Value.Value;
                    }
                }
                catch
                {
                    // Fall through to appsettings fallback
                }
            }

            return configuration[fallbackConfigKey]
                ?? throw new InvalidOperationException(
                    $"SQL connection string not found. Checked Key Vault key '{secretConfigKey}' " +
                    $"and config fallback '{fallbackConfigKey}'.");
        }
    }
}
