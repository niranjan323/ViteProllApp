using CRoll.API.Services.KeyVault;
using Microsoft.Data.SqlClient;

namespace CRoll.API.Services.Users
{
    public class UserService : IUserService
    {
        private readonly string _connectionString;
        private readonly ILogger<UserService> _logger;

        public UserService(IDbConnectionStringProvider connectionStringProvider, ILogger<UserService> logger)
        {
            _connectionString = connectionStringProvider.CRollDb;
            _logger = logger;
        }

        public async Task EnsureUserAsync(string absUserId, string userName, string? userEmail)
        {
            const string sql = @"
                IF NOT EXISTS (SELECT 1 FROM Users WHERE AbsUserId = @AbsUserId)
                    INSERT INTO Users (AbsUserId, UserName, UserEmail)
                    VALUES (@AbsUserId, @UserName, @UserEmail)";

            try
            {
                await using var conn = new SqlConnection(_connectionString);
                await conn.OpenAsync();
                await using var cmd = new SqlCommand(sql, conn);
                cmd.Parameters.AddWithValue("@AbsUserId", absUserId);
                cmd.Parameters.AddWithValue("@UserName", userName);
                cmd.Parameters.AddWithValue("@UserEmail", (object?)userEmail ?? DBNull.Value);
                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to ensure user {AbsUserId}", absUserId);
                throw new InvalidOperationException($"Failed to ensure user: {ex.Message}", ex);
            }
        }
    }
}
