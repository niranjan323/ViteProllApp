using CRoll.API.Services.Blob;
using Microsoft.AspNetCore.Mvc;

namespace CRoll.API.Controllers
{
    [ApiController]
    [Route("api/files")]
    public class FilesController : ControllerBase
    {
        private readonly IBlobService _blobService;
        private readonly ILogger<FilesController> _logger;

        public FilesController(IBlobService blobService, ILogger<FilesController> logger)
        {
            _blobService = blobService;
            _logger = logger;
        }

        /// <summary>
        /// List vessel project folder names visible to the requesting user.
        /// User-uploaded projects are stored under "users/{userId}/{projectName}/" and
        /// are private to that user. Admin/shared projects live at the root "{projectName}/"
        /// and are visible to everyone.
        /// </summary>
        [HttpGet("projects")]
        public async Task<IActionResult> GetProjects([FromQuery] string? userId = null)
        {
            try
            {
                var allBlobs = await _blobService.ListBlobsAsync(string.Empty);
                var resultList = new List<(string name, bool isOwned)>();

                // User's private projects: blobs stored under "users/{userId}/{projectName}/"
                if (!string.IsNullOrEmpty(userId))
                {
                    var userPrefix = $"users/{userId}/";

                    // Soft-deleted projects (_hidden_) and in-flight deletes (_pending_delete)
                    // should stay hidden from the user's project list.
                    var hiddenProjects = allBlobs
                        .Where(b => b.StartsWith(userPrefix) && b.EndsWith("/_hidden_"))
                        .Select(b => b[userPrefix.Length..].Split('/')[0])
                        .ToHashSet(StringComparer.OrdinalIgnoreCase);

                    var pendingDelete = allBlobs
                        .Where(b => b.StartsWith(userPrefix) && b.EndsWith("/_pending_delete"))
                        .Select(b => b[userPrefix.Length..].Split('/')[0])
                        .ToHashSet(StringComparer.OrdinalIgnoreCase);

                    var userNames = allBlobs
                        .Where(b => b.StartsWith(userPrefix))
                        .Select(b => b[userPrefix.Length..].Split('/')[0])
                        .Where(p => !string.IsNullOrEmpty(p) && !hiddenProjects.Contains(p) && !pendingDelete.Contains(p))
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .OrderBy(p => p);
                    resultList.AddRange(userNames.Select(n => (n, true)));
                }

                var ownedNames = new HashSet<string>(resultList.Select(r => r.name), StringComparer.OrdinalIgnoreCase);

                // Shared-project hides are per-user via markers at:
                // "users/{userId}/{projectName}/_hidden_".
                var userHiddenSharedProjects = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                if (!string.IsNullOrEmpty(userId))
                {
                    var userPrefix = $"users/{userId}/";
                    userHiddenSharedProjects = allBlobs
                        .Where(b => b.StartsWith(userPrefix) && b.EndsWith("/_hidden_"))
                        .Select(b => b[userPrefix.Length..].Split('/')[0])
                        .ToHashSet(StringComparer.OrdinalIgnoreCase);
                }

                var sharedNames = allBlobs
                    .Where(b => !b.StartsWith("users/") && !b.Contains("/_owner_") && !b.Contains("/_hidden_"))
                    .Select(b => b.Split('/')[0])
                    .Where(p => !string.IsNullOrEmpty(p) && !ownedNames.Contains(p) && !userHiddenSharedProjects.Contains(p))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(p => p);
                resultList.AddRange(sharedNames.Select(n => (n, false)));

                return Ok(resultList.Select(r => new { name = r.name, isOwned = r.isOwned }));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to list projects for user {UserId}", userId);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>
        /// Delete behavior:
        /// - User-owned project "users/{userId}/{projectName}/": hard-delete all blobs.
        /// - Shared/root project "{projectName}/": soft-delete only for this user
        ///   via marker "users/{userId}/{projectName}/_hidden_".
        /// Shared-project soft-delete hides the dataset only in this user's listings.
        /// </summary>
        [HttpDelete("projects/{projectName}")]
        public async Task<IActionResult> DeleteProject(string projectName, [FromQuery] string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
                return BadRequest("userId is required.");

            try
            {
                var blobPrefix = $"users/{userId}/{projectName}/";
                var blobs = (await _blobService.ListBlobsAsync(blobPrefix)).ToList();

                // 1) User-owned project exists: preserve existing hard-delete behavior.
                if (blobs.Any())
                {
                    // Write marker immediately (single fast blob write) so listing hides it right away.
                    var markerPath = $"{blobPrefix}_pending_delete";
                    using var empty = new MemoryStream();
                    await _blobService.UploadAsync(markerPath, empty, "text/plain");

                    // Fire-and-forget: delete all blobs in background, then remove marker.
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            foreach (var blob in blobs)
                                await _blobService.DeleteAsync(blob);
                            await _blobService.DeleteAsync(markerPath);
                            _logger.LogInformation("Background delete complete: {Project} for user {UserId}", projectName, userId);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Background delete failed for {Project} — marker remains, project stays hidden", projectName);
                        }
                    });

                    return Accepted();
                }

                // 2) No user-owned project: if shared/root exists, soft-delete only for this user.
                var sharedPrefix = $"{projectName}/";
                var sharedBlobs = (await _blobService.ListBlobsAsync(sharedPrefix)).ToList();
                if (sharedBlobs.Any())
                {
                    var sharedMarkerPath = $"users/{userId}/{projectName}/_hidden_";
                    using var empty = new MemoryStream();
                    await _blobService.UploadAsync(sharedMarkerPath, empty, "text/plain");
                    _logger.LogInformation("Soft-deleted shared project {Project} for user {UserId}", projectName, userId);
                    return NoContent();
                }

                return NotFound($"Project '{projectName}' not found.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to initiate delete for project {Project}", projectName);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>List all blob paths inside a project (for folder tree view).</summary>
        [HttpGet("projects/{projectName}/tree")]
        public async Task<IActionResult> GetProjectTree(string projectName, [FromQuery] string? userId = null)
        {
            try
            {
                var blobPrefix = !string.IsNullOrEmpty(userId)
                    ? $"users/{userId}/{projectName}/"
                    : $"{projectName}/";
                var blobs = await _blobService.ListBlobsAsync(blobPrefix);
                return Ok(blobs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to list tree for {Project}", projectName);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>
        /// Download the control file (.ctl) for a project as plain text.
        /// The frontend parses this to discover available Draft/GM combinations.
        /// </summary>
        [HttpGet("projects/{projectName}/control")]
        public async Task<IActionResult> GetControlFile(string projectName)
        {
            try
            {
                var blobName = $"{projectName}/control.ctl";
                if (!await _blobService.ExistsAsync(blobName))
                    return NotFound($"Control file not found for project '{projectName}'.");

                var text = await _blobService.GetTextAsync(blobName);
                return Content(text, "text/plain");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get control file for {Project}", projectName);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>
        /// Download any file (binary .bpolar or text) from the project.
        /// The frontend receives raw bytes and runs the existing TypeScript parser on it.
        /// Query param 'path' = relative path within the project folder.
        /// Example: GET /api/files/projects/VesselAlpha/file?path=polars/Draft=15.0/GM=1.5/v.bpolar
        /// </summary>
        [HttpGet("projects/{projectName}/file")]
        public async Task<IActionResult> GetFile(string projectName, [FromQuery] string path, [FromQuery] string? userId = null)
        {
            if (string.IsNullOrWhiteSpace(path))
                return BadRequest("Query param 'path' is required.");

            try
            {
                var blobPrefix = !string.IsNullOrEmpty(userId)
                    ? $"users/{userId}/{projectName}"
                    : projectName;
                var blobName = $"{blobPrefix}/{path}";
                if (!await _blobService.ExistsAsync(blobName))
                    return NotFound($"File not found: {blobName}");

                var stream = await _blobService.GetStreamAsync(blobName);
                return File(stream, "application/octet-stream");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to download {Path} from {Project}", path, projectName);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>
        /// Upload one or more files into a project folder.
        /// If ownerId is provided, files are stored under "users/{ownerId}/{projectName}/" —
        /// private to that user and isolated from other users' same-named projects.
        /// Without ownerId, files go to the shared root "{projectName}/".
        /// </summary>
        [HttpPost("projects/{projectName}/upload")]
        [RequestSizeLimit(1024 * 1024 * 1024)]
        [RequestFormLimits(ValueCountLimit = 50000, MultipartBodyLengthLimit = 1024 * 1024 * 1024)]
        public async Task<IActionResult> UploadFiles(string projectName, IList<IFormFile> files, [FromQuery] string? ownerId = null)
        {
            if (files == null || files.Count == 0)
                return BadRequest("No files provided.");

            try
            {
                var blobPrefix = !string.IsNullOrEmpty(ownerId)
                    ? $"users/{ownerId}/{projectName}"
                    : projectName;

                var uploaded = new List<string>();
                foreach (var file in files)
                {
                    var relativePath = file.FileName.Replace("\\", "/");
                    var blobName = $"{blobPrefix}/{relativePath}";
                    await using var stream = file.OpenReadStream();
                    await _blobService.UploadAsync(blobName, stream, file.ContentType ?? "application/octet-stream");
                    uploaded.Add(blobName);
                }
                return Ok(new { uploaded });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upload files to {Project}", projectName);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }
    }
}
