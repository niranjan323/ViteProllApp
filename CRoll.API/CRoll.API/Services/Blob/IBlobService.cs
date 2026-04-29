using Azure.Storage.Blobs.Models;

namespace CRoll.API.Services.Blob
{
    public interface IBlobService
    {
        Task<IEnumerable<string>> ListBlobsAsync(string prefix);
        Task<string> GetTextAsync(string blobName);
        Task<Stream> GetStreamAsync(string blobName);
        Task<bool> ExistsAsync(string blobName);
        Task<BlobProperties?> GetPropertiesAsync(string blobName);
        Task UploadAsync(string blobName, Stream content, string contentType = "application/octet-stream");
        Task DeleteAsync(string blobName);
    }
}
