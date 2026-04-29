-- Run once on Azure SQL Server (rg-ngea-cr-core) using SSMS or Azure Data Studio.

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'CRollDB')
    CREATE DATABASE CRollDB;
GO

USE CRollDB;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Cases')
BEGIN
    CREATE TABLE Cases (
        Id               NVARCHAR(50)   NOT NULL PRIMARY KEY,
        CreatedAt        BIGINT         NOT NULL,
        OsUsername       NVARCHAR(256)  NOT NULL,
        MachineName      NVARCHAR(256)  NOT NULL,
        Color            NVARCHAR(50)   NOT NULL,

        DraftAft         FLOAT          NULL,
        DraftFore        FLOAT          NULL,
        Gm               FLOAT          NULL,
        Heading          FLOAT          NULL,
        Speed            FLOAT          NULL,
        MaxRoll          FLOAT          NULL,

        Hs               FLOAT          NULL,
        Tz               FLOAT          NULL,
        WaveDirection    FLOAT          NULL,

        DataFilePath     NVARCHAR(1000) NULL,
        FittedDraft      FLOAT          NULL,
        FittedGm         FLOAT          NULL,
        FittedHs         FLOAT          NULL,
        FittedTz         FLOAT          NULL,

        ChartMode        NVARCHAR(50)   NULL,
        ChartOrientation NVARCHAR(50)   NULL,
        ChartImage       NVARCHAR(MAX)  NULL,

        Synced           INT            NOT NULL DEFAULT 0,

        -- Web-only
        ProjectId        NVARCHAR(256)  NULL,
        UpdatedAt        DATETIME2      NULL
    );
    PRINT 'Cases table created.';
END
ELSE
    PRINT 'Cases table already exists.';
GO
