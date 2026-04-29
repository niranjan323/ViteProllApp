using CRoll.API.Services.Blob;
using CRoll.API.Services.Cases;
using CRoll.API.Services.KeyVault;

var builder = WebApplication.CreateBuilder(args);

// ─── AZURE / KEY VAULT ────────────────────────────────────────────────────────
// AzureConnection is null-safe: if KeyVault:Url is empty (local dev),
// Client = null and all services fall back to appsettings.Development.json values.
builder.Services.AddSingleton<AzureConnection>();
builder.Services.AddSingleton<IDbConnectionStringProvider, DbConnectionStringProvider>();

// ─── BLOB STORAGE ─────────────────────────────────────────────────────────────
builder.Services.AddSingleton<IBlobService, BlobService>();

// ─── CASES (SQL SERVER) ───────────────────────────────────────────────────────
builder.Services.AddScoped<ICaseService, CaseService>();

// ─── CONTROLLERS + SWAGGER ───────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "CRoll API", Version = "v1" });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var allowedOrigin = builder.Configuration["CRollReactApp"] ?? "http://localhost:5173";
        policy.WithOrigins(allowedOrigin)
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddLogging();
builder.Services.AddHealthChecks();

var app = builder.Build();

// ─── SWAGGER ──────────────────────────────────────────────────────────────────
if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("EnableSwaggerInProduction"))
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "CRoll API v1"));
}

app.UseHttpsRedirection();
app.UseCors();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
