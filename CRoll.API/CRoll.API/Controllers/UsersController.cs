using CRoll.API.Services.Users;
using Microsoft.AspNetCore.Mvc;

namespace CRoll.API.Controllers
{
    [ApiController]
    [Route("api/users")]
    // [Authorize] — disabled for local testing; re-enable before deploying
    public class UsersController : ControllerBase
    {
        private readonly IUserService _userService;
        private readonly ILogger<UsersController> _logger;

        public UsersController(IUserService userService, ILogger<UsersController> logger)
        {
            _userService = userService;
            _logger = logger;
        }

        /// <summary>
        /// Ensure the Azure AD user exists in the Users table.
        /// Creates a new record on first login; no-ops on subsequent calls.
        /// Called automatically by the frontend after MSAL login.
        /// </summary>
        [HttpPost("ensure")]
        public async Task<IActionResult> Ensure([FromBody] EnsureUserRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.AbsUserId))
                return BadRequest("AbsUserId is required.");

            try
            {
                await _userService.EnsureUserAsync(request.AbsUserId, request.UserName, request.UserEmail);
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to ensure user {AbsUserId}", request.AbsUserId);
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }
    }

    public record EnsureUserRequest(string AbsUserId, string UserName, string? UserEmail);
}
