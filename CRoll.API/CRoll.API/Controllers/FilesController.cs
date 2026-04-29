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

        /// <summary>List all vessel project folder names in blob storage.</summary>
        [HttpGet("projects")]
        public async Task<IActionResult> GetProjects()
        {
            try
            {
                var allBlobs = await _blobService.ListBlobsAsync(string.Empty);
                var projects = allBlobs
                    .Select(b => b.Split('/')[0])
                    .Distinct()
                    .OrderBy(p => p)
                    .ToList();
                return Ok(projects);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to list projects");
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
        /// The FileName should carry the relative sub-path, e.g. "polars/Draft=15.0/GM=1.5/v.bpolar".
        /// </summary>
        [HttpPost("projects/{projectName}/upload")]
        [RequestSizeLimit(500 * 1024 * 1024)]
        public async Task<IActionResult> UploadFiles(string projectName, IList<IFormFile> files)
        {
            if (files == null || files.Count == 0)
                return BadRequest("No files provided.");

            try
            {
                var uploaded = new List<string>();
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
