using CRoll.API.Services.Blob;
using CRoll.API.Services.Cases;
using CRoll.API.Services.KeyVault;
using CRoll.API.Services.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Identity.Web;

var builder = WebApplication.CreateBuilder(args);

// ─── REQUEST BODY LIMITS (large multi-file uploads) ───────────────────────────
// Kestrel + IIS in-process host both cap request bodies; raise to 1 GB so large
// upload batches aren't rejected with HTTP 413 before reaching the controller.
const long MaxUploadBytes = 1024L * 1024 * 1024; // 1 GB
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = MaxUploadBytes);
builder.Services.Configure<Microsoft.AspNetCore.Builder.IISServerOptions>(
    options => options.MaxRequestBodySize = MaxUploadBytes);

// ─── AUTHENTICATION (Azure AD + Azure AD B2C JWT Bearer) ─────────────────────
// Both schemes are accepted. The default authorization policy requires the
// request to pass either — matching CRoute's DynamicOidc dual-auth pattern.
var authBuilder = builder.Services.AddAuthentication();
authBuilder.AddMicrosoftIdentityWebApi(builder.Configuration, "AzureAd",  jwtBearerScheme: "AAD");
authBuilder.AddMicrosoftIdentityWebApi(builder.Configuration, "AzureB2C", jwtBearerScheme: "B2C");

builder.Services.AddAuthorization(options =>
{
    options.DefaultPolicy = new AuthorizationPolicyBuilder("AAD", "B2C")
        .RequireAuthenticatedUser()
        .Build();
});

// ─── AZURE / KEY VAULT ────────────────────────────────────────────────────────
// AzureConnection is null-safe: if KeyVault:Url is empty (local dev),
// Client = null and all services fall back to appsettings.Development.json values.
builder.Services.AddSingleton<AzureConnection>();
builder.Services.AddSingleton<IDbConnectionStringProvider, DbConnectionStringProvider>();

// ─── BLOB STORAGE ─────────────────────────────────────────────────────────────
builder.Services.AddSingleton<IBlobService, BlobService>();

// ─── CASES (SQL SERVER) ───────────────────────────────────────────────────────
builder.Services.AddScoped<ICaseService, CaseService>();

// ─── USERS (SQL SERVER) ───────────────────────────────────────────────────────
builder.Services.AddScoped<IUserService, UserService>();

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
        var configured = builder.Configuration["CRollReactApp"] ?? "";
        var origins = new List<string> { "http://localhost:5173", "http://localhost:5174" };
        foreach (var o in configured.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            origins.Add(o);

        policy.WithOrigins([.. origins])
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

if (!app.Environment.IsDevelopment()) app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();