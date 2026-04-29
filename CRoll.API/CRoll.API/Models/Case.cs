namespace CRoll.API.Models
{
    /// <summary>
    /// Mirrors the SQLite 'cases' table used by the Electron app,
    /// plus ProjectId and UpdatedAt for the web layer.
    /// </summary>
    public class Case
    {
        public string Id { get; set; } = string.Empty;
        public long CreatedAt { get; set; }
        public string OsUsername { get; set; } = string.Empty;
        public string MachineName { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;

        public double? DraftAft { get; set; }
        public double? DraftFore { get; set; }
        public double? Gm { get; set; }
        public double? Heading { get; set; }
        public double? Speed { get; set; }
        public double? MaxRoll { get; set; }

        public double? Hs { get; set; }
        public double? Tz { get; set; }
        public double? WaveDirection { get; set; }

        public string? DataFilePath { get; set; }
        public double? FittedDraft { get; set; }
        public double? FittedGm { get; set; }
        public double? FittedHs { get; set; }
        public double? FittedTz { get; set; }

        public string? ChartMode { get; set; }
        public string? ChartOrientation { get; set; }
        public string? ChartImage { get; set; }

        public int Synced { get; set; } = 0;

        // Web-only
        public string? ProjectId { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}
