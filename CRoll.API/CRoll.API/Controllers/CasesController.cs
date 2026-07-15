using CRoll.API.Models;
using CRoll.API.Services.Cases;  
using Microsoft.AspNetCore.Mvc;

namespace CRoll.API.Controllers
{
    [ApiController]
    [Route("api/cases")]
    public class CasesController : ControllerBase
    {
        private readonly ICaseService _caseService;
        private readonly ILogger<CasesController> _logger;

        public CasesController(ICaseService caseService, ILogger<CasesController> logger)
        {
            _caseService = caseService;
            _logger = logger;
        }

        /// <summary>Load saved cases for a user, optionally filtered to a specific vessel project.</summary>
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string userId, [FromQuery] string? projectId = null)
        {
            if (string.IsNullOrWhiteSpace(userId))
                return BadRequest("userId query parameter is required.");

            try
            {
                var cases = await _caseService.GetAllAsync(userId, projectId);
                return Ok(cases);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to load cases for user {User}", userId);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>Get a single case by ID.</summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(string id)
        {
            try
            {
                var item = await _caseService.GetByIdAsync(id);
                return item == null ? NotFound($"Case '{id}' not found.") : Ok(item);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get case {Id}", id);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>Save a new analysis case.</summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Case caseItem)
        {
            if (string.IsNullOrWhiteSpace(caseItem.Id))
                return BadRequest("Case Id is required.");

            try
            {
                caseItem.UpdatedAt = DateTime.UtcNow;
                await _caseService.CreateAsync(caseItem);
                return CreatedAtAction(nameof(GetById), new { id = caseItem.Id }, caseItem);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create case {Id}", caseItem.Id);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>Update an existing case (all fields).</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] Case caseItem)
        {
            if (id != caseItem.Id)
                return BadRequest("ID in URL does not match body.");

            try
            {
                if (await _caseService.GetByIdAsync(id) == null)
                    return NotFound($"Case '{id}' not found.");

                caseItem.UpdatedAt = DateTime.UtcNow;
                await _caseService.UpdateAsync(caseItem);
                return Ok(caseItem);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update case {Id}", id);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>
        /// Update only the chart image for a case.
        /// Mirrors the db-update-chart-image IPC call in the Electron app.
        /// </summary>
        [HttpPatch("{id}/chart")]
        public async Task<IActionResult> UpdateChartImage(string id, [FromBody] UpdateChartImageRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.ChartImage))
                return BadRequest("ChartImage is required.");

            try
            {
                if (await _caseService.GetByIdAsync(id) == null)
                    return NotFound($"Case '{id}' not found.");

                await _caseService.UpdateChartImageAsync(id, request.ChartImage);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update chart image for case {Id}", id);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        /// <summary>Delete a case by ID.</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            try
            {
                if (await _caseService.GetByIdAsync(id) == null)
                    return NotFound($"Case '{id}' not found.");

                await _caseService.DeleteAsync(id);
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to delete case {Id}", id);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }
    }

    public record UpdateChartImageRequest(string ChartImage);
}
