using Azure;
using Azure.Storage;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using CRoll.API.Services.KeyVault;

namespace CRoll.API.Services.Blob
{
    /// <summary>
    /// Wraps Azure Blob Storage for vessel data files (.ctl, .bpolar).
    /// Copied and adapted from the Digital Rules reference project (BlobService.cs).
    ///
    /// Auth priority:
    ///   1. Key Vault secret  → production (Azure App Service + Managed Identity)
    ///   2. Storage:AccountKey in appsettings → local dev (appsettings.Development.json)
    /// </summary>
    public class BlobService : IBlobService
    {
        private readonly BlobContainerClient _container;

        public BlobService(IConfiguration configuration, AzureConnection azureConnection)
        {
            var accountName = configuration["StorageAccountName"]
                ?? throw new InvalidOperationException("Missing config: StorageAccountName");

            var containerName = configuration["BlobContainerName"]
                ?? throw new InvalidOperationException("Missing config: BlobContainerName");

            var accountKey = ResolveAccountKey(configuration, azureConnection);

            var blobServiceClient = new BlobServiceClient(
                new Uri($"https://{accountName}.blob.core.windows.net"),
                new StorageSharedKeyCredential(accountName, accountKey));

            _container = blobServiceClient.GetBlobContainerClient(containerName);
        }

        private static string ResolveAccountKey(IConfiguration configuration, AzureConnection azureConnection)
        {
            if (azureConnection.Client != null)
            {
                try
                {
                    var secretName = configuration["StorageAccountSecretName"] ?? "croll-blob-storage";
                    var secret = azureConnection.Client.GetSecret(secretName);
                    if (!string.IsNullOrWhiteSpace(secret?.Value?.Value))
                        return secret.Value.Value;
                }
                catch
                {
                    // Fall through to appsettings
                }
            }

            return configuration["Storage:AccountKey"]
                ?? throw new InvalidOperationException(
                    "Storage account key not found in Key Vault or config 'Storage:AccountKey'.");
        }

        private BlobClient GetClient(string blobName) => _container.GetBlobClient(blobName);

        public async Task<string> GetTextAsync(string blobName)
        {
            var response = await GetClient(blobName).DownloadContentAsync();
            return response.Value.Content.ToString();
        }

        public async Task<Stream> GetStreamAsync(string blobName)
        {
            var response = await GetClient(blobName).DownloadStreamingAsync();
            return response.Value.Content;
        }

        public async Task<bool> ExistsAsync(string blobName)
            => await GetClient(blobName).ExistsAsync();

        public async Task<BlobProperties?> GetPropertiesAsync(string blobName)
        {
            try
            {
                var response = await GetClient(blobName).GetPropertiesAsync();
                return response.Value;
            }
            catch (RequestFailedException ex) when (ex.Status == 404)
            {
                return null;
            }
        }

        public async Task<IEnumerable<string>> ListBlobsAsync(string prefix)
        {
            var results = new List<string>();
            await foreach (var blobItem in _container.GetBlobsAsync(prefix: prefix))
                results.Add(blobItem.Name);
            return results;
        }

        public async Task UploadAsync(string blobName, Stream content, string contentType = "application/octet-stream")
        {
            await GetClient(blobName).UploadAsync(content, new BlobUploadOptions
            {
                HttpHeaders = new BlobHttpHeaders { ContentType = contentType }
            });
        }

        public async Task DeleteAsync(string blobName)
        {
            await GetClient(blobName).DeleteIfExistsAsync();
        }
    }
}
