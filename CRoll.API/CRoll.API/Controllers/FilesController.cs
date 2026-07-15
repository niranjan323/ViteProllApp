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
        /// Projects with no owner marker are visible to everyone (default/admin projects).
        /// Projects with an owner marker (_owner_{userId}) are only visible to that user.
        /// </summary>
        [HttpGet("projects")]
        public async Task<IActionResult> GetProjects([FromQuery] string? userId = null)
        {
            try
            {
                var allBlobs = await _blobService.ListBlobsAsync(string.Empty);

                // Build owner map (projectName → ownerId) and the set of projects the
                // requesting user has hidden (soft-deleted) from marker blobs.
                var ownerMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var hiddenForUser = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var blob in allBlobs)
                {
                    var parts = blob.Split('/');
                    if (parts.Length < 2) continue;
                    if (parts[1].StartsWith("_owner_"))
                        ownerMap[parts[0]] = parts[1]["_owner_".Length..];
                    else if (parts[1].StartsWith("_hidden_")
                             && !string.IsNullOrEmpty(userId)
                             && parts[1]["_hidden_".Length..] == userId)
                        hiddenForUser.Add(parts[0]);
                }

                var result = allBlobs
                    .Where(b => !b.Contains("/_owner_") && !b.Contains("/_hidden_"))
                    .Select(b => b.Split('/')[0])
                    .Distinct()
                    .Where(p => string.IsNullOrEmpty(userId)
                                || !ownerMap.ContainsKey(p)
                                || ownerMap[p] == userId)
                    .Where(p => !hiddenForUser.Contains(p))
                    .OrderBy(p => p)
                    .Select(p => new
                    {
                        name = p,
                        isOwned = !string.IsNullOrEmpty(userId)
                                  && ownerMap.ContainsKey(p)
                                  && ownerMap[p] == userId,
                    })
                    .ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to list projects for user {UserId}", userId);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>
        /// Soft-delete a project for the requesting user only. Writes a
        /// {projectName}/_hidden_{userId} marker so the project is filtered out of that
        /// user's list via GetProjects. The underlying blobs remain intact for other users.
        /// </summary>
        [HttpDelete("projects/{projectName}")]
        public async Task<IActionResult> DeleteProject(string projectName, [FromQuery] string userId)
        {
            if (string.IsNullOrWhiteSpace(userId))
                return BadRequest("userId is required.");

            try
            {
                var hiddenMarker = $"{projectName}/_hidden_{userId}";
                using var content = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(userId));
                await _blobService.UploadAsync(hiddenMarker, content, "text/plain");

                _logger.LogInformation("Project {Project} hidden for user {UserId}", projectName, userId);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete project {Project}", projectName);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>List all blob paths inside a project (for folder tree view).</summary>
        [HttpGet("projects/{projectName}/tree")]
        public async Task<IActionResult> GetProjectTree(string projectName)
        {
            try
            {
                var blobs = await _blobService.ListBlobsAsync($"{projectName}/");
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
        public async Task<IActionResult> GetFile(string projectName, [FromQuery] string path)
        {
            if (string.IsNullOrWhiteSpace(path))
                return BadRequest("Query param 'path' is required.");

            try
            {
                var blobName = $"{projectName}/{path}";
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
        /// Accepts multipart/form-data. Each file's blob path = {projectName}/{file.FileName}.
        /// Optional ownerId: writes a {projectName}/_owner_{ownerId} marker blob so the project
        /// is only visible to that user via GetProjects.
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
                var uploaded = new List<string>();

                // Write ownership marker so this project is only visible to ownerId
                if (!string.IsNullOrEmpty(ownerId))
                {
                    var markerBlob = $"{projectName}/_owner_{ownerId}";
                    using var empty = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(ownerId));
                    await _blobService.UploadAsync(markerBlob, empty, "text/plain");

                    // Un-hide the project for this user if they had previously soft-deleted it
                    var hiddenMarker = $"{projectName}/_hidden_{ownerId}";
                    if (await _blobService.ExistsAsync(hiddenMarker))
                        await _blobService.DeleteAsync(hiddenMarker);
                }

                foreach (var file in files)
                {
                    var relativePath = file.FileName.Replace("\\", "/");
                    var blobName = $"{projectName}/{relativePath}";
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
