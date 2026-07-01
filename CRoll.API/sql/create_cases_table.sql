-- Run once against sqldb-ngea-proll-001 using SSMS or Azure Data Studio.
-- Connect directly to sqldb-ngea-proll-001 before running.
-- Run in order: Users first, then Cases (FK dependency).

-- ─── 1. Users ────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE [dbo].[Users] (
        [user_id]       UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [abs_user_id]   UNIQUEIDENTIFIER NOT NULL,
        [user_name]     NVARCHAR(50)     NOT NULL,
        [user_email]    NVARCHAR(50)     NULL,
        [created_date]  DATETIME         NOT NULL DEFAULT GETDATE(),
        [created_by]    NVARCHAR(50)     NOT NULL DEFAULT 'system',
        [modified_date] DATETIME         NULL,
        [modified_by]   NVARCHAR(50)     NULL,
        [is_active]     BIT              NOT NULL DEFAULT 1,
        CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([user_id] ASC),
        CONSTRAINT [UQ_Users_AbsUserId] UNIQUE ([abs_user_id])
    );
    PRINT 'Users table created.';
END
ELSE
    PRINT 'Users table already exists.';
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
