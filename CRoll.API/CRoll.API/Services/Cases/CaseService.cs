using CRoll.API.Models;
using CRoll.API.Services.KeyVault;
using Microsoft.Data.SqlClient;

namespace CRoll.API.Services.Cases
{
    /// <summary>
    /// Inline SQL queries via Microsoft.Data.SqlClient — no EF Core.
    /// Mirrors the SQLite operations in electron/main.ts.
    /// </summary>
    public class CaseService : ICaseService
    {
        private readonly string _connectionString;

        public CaseService(IDbConnectionStringProvider connectionStringProvider)
        {
            _connectionString = connectionStringProvider.CRollDb;
        }

        public async Task<IEnumerable<Case>> GetAllAsync(string osUsername)
        {
            const string sql = @"
                SELECT Id, CreatedAt, OsUsername, MachineName, Color,
                       DraftAft, DraftFore, Gm, Heading, Speed, MaxRoll,
                       Hs, Tz, WaveDirection, DataFilePath,
                       FittedDraft, FittedGm, FittedHs, FittedTz,
                       ChartMode, ChartOrientation, ChartImage, Synced,
                       ProjectId, UpdatedAt
                FROM Cases
                WHERE OsUsername = @OsUsername
                ORDER BY CreatedAt ASC";

            var cases = new List<Case>();
            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();
            await using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@OsUsername", osUsername);
            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                cases.Add(MapRow(reader));
            return cases;
        }

        public async Task<Case?> GetByIdAsync(string id)
        {
            const string sql = @"
                SELECT Id, CreatedAt, OsUsername, MachineName, Color,
                       DraftAft, DraftFore, Gm, Heading, Speed, MaxRoll,
                       Hs, Tz, WaveDirection, DataFilePath,
                       FittedDraft, FittedGm, FittedHs, FittedTz,
                       ChartMode, ChartOrientation, ChartImage, Synced,
                       ProjectId, UpdatedAt
                FROM Cases WHERE Id = @Id";

            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();
            await using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@Id", id);
            await using var reader = await cmd.ExecuteReaderAsync();
            return await reader.ReadAsync() ? MapRow(reader) : null;
        }

        public async Task CreateAsync(Case c)
        {
            const string sql = @"
                INSERT INTO Cases (
                    Id, CreatedAt, OsUsername, MachineName, Color,
                    DraftAft, DraftFore, Gm, Heading, Speed, MaxRoll,
                    Hs, Tz, WaveDirection, DataFilePath,
                    FittedDraft, FittedGm, FittedHs, FittedTz,
                    ChartMode, ChartOrientation, ChartImage, Synced,
                    ProjectId, UpdatedAt
                ) VALUES (
                    @Id, @CreatedAt, @OsUsername, @MachineName, @Color,
                    @DraftAft, @DraftFore, @Gm, @Heading, @Speed, @MaxRoll,
                    @Hs, @Tz, @WaveDirection, @DataFilePath,
                    @FittedDraft, @FittedGm, @FittedHs, @FittedTz,
                    @ChartMode, @ChartOrientation, @ChartImage, @Synced,
                    @ProjectId, @UpdatedAt
                )";

            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();
            await using var cmd = new SqlCommand(sql, conn);
            BindParameters(cmd, c);
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task UpdateAsync(Case c)
        {
            const string sql = @"
                UPDATE Cases SET
                    OsUsername = @OsUsername, MachineName = @MachineName, Color = @Color,
                    DraftAft = @DraftAft, DraftFore = @DraftFore, Gm = @Gm,
                    Heading = @Heading, Speed = @Speed, MaxRoll = @MaxRoll,
                    Hs = @Hs, Tz = @Tz, WaveDirection = @WaveDirection,
                    DataFilePath = @DataFilePath,
                    FittedDraft = @FittedDraft, FittedGm = @FittedGm,
                    FittedHs = @FittedHs, FittedTz = @FittedTz,
                    ChartMode = @ChartMode, ChartOrientation = @ChartOrientation,
                    ChartImage = @ChartImage, Synced = @Synced,
                    ProjectId = @ProjectId, UpdatedAt = @UpdatedAt
                WHERE Id = @Id";

            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();
            await using var cmd = new SqlCommand(sql, conn);
            BindParameters(cmd, c);
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task UpdateChartImageAsync(string id, string chartImage)
        {
            const string sql = "UPDATE Cases SET ChartImage = @ChartImage, UpdatedAt = @UpdatedAt WHERE Id = @Id";

            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();
            await using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@Id", id);
            cmd.Parameters.AddWithValue("@ChartImage", chartImage);
            cmd.Parameters.AddWithValue("@UpdatedAt", DateTime.UtcNow);
            await cmd.ExecuteNonQueryAsync();
        }

        public async Task DeleteAsync(string id)
        {
            const string sql = "DELETE FROM Cases WHERE Id = @Id";

            await using var conn = new SqlConnection(_connectionString);
            await conn.OpenAsync();
            await using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@Id", id);
            await cmd.ExecuteNonQueryAsync();
        }

        // ─── HELPERS ───────────────────────────────────────────────────────────────

        private static void BindParameters(SqlCommand cmd, Case c)
        {
            cmd.Parameters.AddWithValue("@Id", c.Id);
            cmd.Parameters.AddWithValue("@CreatedAt", c.CreatedAt);
            cmd.Parameters.AddWithValue("@OsUsername", c.OsUsername);
            cmd.Parameters.AddWithValue("@MachineName", c.MachineName);
            cmd.Parameters.AddWithValue("@Color", c.Color);
            cmd.Parameters.AddWithValue("@DraftAft", (object?)c.DraftAft ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@DraftFore", (object?)c.DraftFore ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Gm", (object?)c.Gm ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Heading", (object?)c.Heading ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Speed", (object?)c.Speed ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@MaxRoll", (object?)c.MaxRoll ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Hs", (object?)c.Hs ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Tz", (object?)c.Tz ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@WaveDirection", (object?)c.WaveDirection ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@DataFilePath", (object?)c.DataFilePath ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@FittedDraft", (object?)c.FittedDraft ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@FittedGm", (object?)c.FittedGm ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@FittedHs", (object?)c.FittedHs ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@FittedTz", (object?)c.FittedTz ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@ChartMode", (object?)c.ChartMode ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@ChartOrientation", (object?)c.ChartOrientation ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@ChartImage", (object?)c.ChartImage ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@Synced", c.Synced);
            cmd.Parameters.AddWithValue("@ProjectId", (object?)c.ProjectId ?? DBNull.Value);
            cmd.Parameters.AddWithValue("@UpdatedAt", (object?)c.UpdatedAt ?? DBNull.Value);
        }

        private static Case MapRow(SqlDataReader r) => new()
        {
            Id = r.GetString(r.GetOrdinal("Id")),
            CreatedAt = r.GetInt64(r.GetOrdinal("CreatedAt")),
            OsUsername = r.GetString(r.GetOrdinal("OsUsername")),
            MachineName = r.GetString(r.GetOrdinal("MachineName")),
            Color = r.GetString(r.GetOrdinal("Color")),
            DraftAft = Dbl(r, "DraftAft"),
            DraftFore = Dbl(r, "DraftFore"),
            Gm = Dbl(r, "Gm"),
            Heading = Dbl(r, "Heading"),
            Speed = Dbl(r, "Speed"),
            MaxRoll = Dbl(r, "MaxRoll"),
            Hs = Dbl(r, "Hs"),
            Tz = Dbl(r, "Tz"),
            WaveDirection = Dbl(r, "WaveDirection"),
            DataFilePath = Str(r, "DataFilePath"),
            FittedDraft = Dbl(r, "FittedDraft"),
            FittedGm = Dbl(r, "FittedGm"),
            FittedHs = Dbl(r, "FittedHs"),
            FittedTz = Dbl(r, "FittedTz"),
            ChartMode = Str(r, "ChartMode"),
            ChartOrientation = Str(r, "ChartOrientation"),
            ChartImage = Str(r, "ChartImage"),
            Synced = r.GetInt32(r.GetOrdinal("Synced")),
            ProjectId = Str(r, "ProjectId"),
            UpdatedAt = r.IsDBNull(r.GetOrdinal("UpdatedAt")) ? null : r.GetDateTime(r.GetOrdinal("UpdatedAt")),
        };

        private static double? Dbl(SqlDataReader r, string col)
        {
            var i = r.GetOrdinal(col);
            return r.IsDBNull(i) ? null : r.GetDouble(i);
        }

        private static string? Str(SqlDataReader r, string col)
        {
            var i = r.GetOrdinal(col);
            return r.IsDBNull(i) ? null : r.GetString(i);
        }
    }
}
