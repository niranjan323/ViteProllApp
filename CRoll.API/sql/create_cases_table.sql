-- Run once against sqldb-ngea-proll-001 using SSMS or Azure Data Studio.
-- Connect directly to sqldb-ngea-proll-001 before running.
-- Run in order: Users first, then Cases (FK dependency).

-- ─── 1. Users ────────────────────────────────────────────────────────────────
-- Drop and recreate if exists (safe in dev — no FK dependencies yet)
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
    DROP TABLE [dbo].[Users];
GO

CREATE TABLE [dbo].[Users] (
    [Id]           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    [AbsUserId]    NVARCHAR(256)    NOT NULL,
    [UserName]     NVARCHAR(100)    NOT NULL,
    [UserEmail]    NVARCHAR(100)    NULL,
    [CreatedDate]  DATETIME         NOT NULL DEFAULT GETDATE(),
    [CreatedBy]    NVARCHAR(100)    NOT NULL DEFAULT 'system',
    [ModifiedDate] DATETIME         NULL,
    [ModifiedBy]   NVARCHAR(100)    NULL,
    [IsActive]     BIT              NOT NULL DEFAULT 1,
    CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([Id] ASC),
    CONSTRAINT [UQ_Users_AbsUserId] UNIQUE ([AbsUserId])
);
PRINT 'Users table created.';
GO

-- ─── 2. Cases ────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Cases')
BEGIN
    CREATE TABLE [dbo].[Cases] (
        [Id]               NVARCHAR(50)   NOT NULL PRIMARY KEY,
        [CreatedAt]        BIGINT         NOT NULL,
        [UserId]           NVARCHAR(256)  NOT NULL,
        [Color]            NVARCHAR(50)   NOT NULL,

        [DraftAft]         FLOAT          NULL,
        [DraftFore]        FLOAT          NULL,
        [Gm]               FLOAT          NULL,
        [Heading]          FLOAT          NULL,
        [Speed]            FLOAT          NULL,
        [MaxRoll]          FLOAT          NULL,

        [Hs]               FLOAT          NULL,
        [Tz]               FLOAT          NULL,
        [WaveDirection]    FLOAT          NULL,

        [DataFilePath]     NVARCHAR(1000) NULL,
        [FittedDraft]      FLOAT          NULL,
        [FittedGm]         FLOAT          NULL,
        [FittedHs]         FLOAT          NULL,
        [FittedTz]         FLOAT          NULL,

        [ChartMode]        NVARCHAR(50)   NULL,
        [ChartOrientation] NVARCHAR(50)   NULL,
        [ChartImage]       NVARCHAR(MAX)  NULL,

        [Synced]           INT            NOT NULL DEFAULT 0,

        -- Web-only
        [ProjectId]        NVARCHAR(256)  NULL,
        [UpdatedAt]        DATETIME2      NULL
    );
    PRINT 'Cases table created.';
END
ELSE
    PRINT 'Cases table already exists.';
GO
