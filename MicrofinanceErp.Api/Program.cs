using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Api.Security;
using MicrofinanceErp.Domain.Entities;
using MicrofinanceErp.Domain.Security;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "MicrofinanceErp.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "MicrofinanceErp.Client";
var jwtSigningKey = builder.Configuration["Jwt:SigningKey"];
if (string.IsNullOrWhiteSpace(jwtSigningKey) || Encoding.UTF8.GetByteCount(jwtSigningKey) < 32)
{
    throw new InvalidOperationException("Configure Jwt:SigningKey with a secret of at least 32 bytes.");
}

var connectionString = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("Configure ConnectionStrings:Default using a secret store or environment variable.");
}

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
if (allowedOrigins.Length == 0 && builder.Environment.IsDevelopment())
{
    allowedOrigins = ["http://localhost:5173"];
}
else if (allowedOrigins.Length == 0)
{
    throw new InvalidOperationException("Configure Cors:AllowedOrigins with the production client origins.");
}
else if (allowedOrigins.Any(origin =>
             !Uri.TryCreate(origin, UriKind.Absolute, out var parsedOrigin)
             || parsedOrigin.Scheme != Uri.UriSchemeHttps))
{
    throw new InvalidOperationException("Production Cors:AllowedOrigins entries must be absolute HTTPS origins.");
}

var loginPermitLimit = builder.Configuration.GetValue("Security:LoginRateLimit:PermitLimit", 10);
var loginWindowSeconds = builder.Configuration.GetValue("Security:LoginRateLimit:WindowSeconds", 60);
var lockoutAttempts = builder.Configuration.GetValue("Security:LockoutAttempts", 5);
var lockoutMinutes = builder.Configuration.GetValue("Security:LockoutMinutes", 15);
if (loginPermitLimit <= 0 || loginWindowSeconds <= 0 || lockoutAttempts <= 0 || lockoutMinutes <= 0)
{
    throw new InvalidOperationException("Security login rate-limit and lockout values must be greater than zero.");
}

builder.Services.AddControllers();
builder.Services.AddHealthChecks();
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(entry => entry.Value?.Errors.Count > 0)
            .ToDictionary(
                entry => entry.Key,
                entry => entry.Value!.Errors.Select(error => error.ErrorMessage).ToArray());

        var envelope = new ApiEnvelope<object>(
            false,
            "Request validation failed.",
            null,
            errors,
            context.HttpContext.TraceIdentifier);

        return new BadRequestObjectResult(envelope);
    };
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<MicrofinanceErpDbContext>(options =>
    options.UseNpgsql(connectionString));
builder.Services.AddScoped<AccountingPostingService>();
builder.Services.AddScoped<IPasswordHasher<StaffUser>, PasswordHasher<StaffUser>>();
builder.Services.AddScoped<IPasswordResetEmailSender, SmtpPasswordResetEmailSender>();
builder.Services.AddScoped<IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        var retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry)
            ? retry.TotalSeconds
            : loginWindowSeconds;
        context.HttpContext.Response.Headers.RetryAfter = Math.Ceiling(retryAfter).ToString();
        await context.HttpContext.Response.WriteAsJsonAsync(
            new ApiEnvelope<object>(
                false,
                "Too many authentication requests. Please wait before trying again.",
                null,
                null,
                context.HttpContext.TraceIdentifier),
            cancellationToken);
    };
    options.AddPolicy("auth-sensitive", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = loginPermitLimit,
                Window = TimeSpan.FromSeconds(loginWindowSeconds),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var userIdValue = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdValue, out var userId))
                {
                    context.Fail("The access token does not identify a valid account.");
                    return;
                }

                var dbContext = context.HttpContext.RequestServices.GetRequiredService<MicrofinanceErpDbContext>();
                var account = await dbContext.StaffUsers
                    .AsNoTracking()
                    .Where(account => account.Id == userId
                        && account.IsActive
                        && dbContext.AccessRoles.Any(role => role.Name == account.Role && role.IsActive))
                    .Select(account => new { account.SecurityStamp })
                    .SingleOrDefaultAsync(context.HttpContext.RequestAborted);
                var tokenSecurityStamp = context.Principal?.FindFirstValue("security_stamp");
                if (account is null || string.IsNullOrEmpty(tokenSecurityStamp)
                    || !string.Equals(account.SecurityStamp, tokenSecurityStamp, StringComparison.Ordinal))
                {
                    context.Fail("The account is inactive or the access token has been revoked.");
                }
            }
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
    foreach (var permission in AccessControlCatalog.Permissions)
    {
        options.AddPolicy(
            PermissionPolicies.For(permission.Code),
            policy => policy.RequireAuthenticatedUser()
                .AddRequirements(new PermissionRequirement(permission.Code)));
    }
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("MfiCors", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowCredentials()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<MicrofinanceErpDbContext>();
    if (app.Environment.IsDevelopment())
    {
        dbContext.Database.Migrate();
    }

    var bootstrapEmail = builder.Configuration["BootstrapAdmin:Email"];
    var bootstrapPassword = builder.Configuration["BootstrapAdmin:Password"];
    var bootstrapName = builder.Configuration["BootstrapAdmin:FullName"];
    var hasBootstrapEmail = !string.IsNullOrWhiteSpace(bootstrapEmail);
    var hasBootstrapPassword = !string.IsNullOrWhiteSpace(bootstrapPassword);
    if (hasBootstrapEmail != hasBootstrapPassword)
    {
        throw new InvalidOperationException("Set both BootstrapAdmin:Email and BootstrapAdmin:Password to provision the initial administrator.");
    }
    if (hasBootstrapEmail && string.IsNullOrWhiteSpace(bootstrapName))
    {
        throw new InvalidOperationException("Set BootstrapAdmin:FullName when provisioning the initial administrator.");
    }

    if (!dbContext.Branches.Any())
    {
        dbContext.Branches.AddRange(
            new Branch { Name = "Head Office", Code = "HO", Address = "Dhaka", IsActive = true },
            new Branch { Name = "Dhanmondi Branch", Code = "DHA", Address = "Dhanmondi, Dhaka", IsActive = true },
            new Branch { Name = "Chattogram Branch", Code = "CTG", Address = "Chattogram", IsActive = true });
        dbContext.SaveChanges();
    }

    if (hasBootstrapEmail && hasBootstrapPassword)
    {
        if (string.IsNullOrWhiteSpace(bootstrapName) || bootstrapPassword!.Length < 12)
        {
            throw new InvalidOperationException("BootstrapAdmin:FullName is required and BootstrapAdmin:Password must contain at least 12 characters.");
        }

        var normalizedEmail = bootstrapEmail!.Trim().ToUpperInvariant();
        if (!dbContext.StaffUsers.Any(user => user.NormalizedEmail == normalizedEmail))
        {
            var admin = new StaffUser
            {
                Email = bootstrapEmail.Trim(),
                NormalizedEmail = normalizedEmail,
                FullName = bootstrapName.Trim(),
                Role = "Super Admin",
                BranchId = dbContext.Branches.OrderBy(b => b.Id).Select(b => (int?)b.Id).FirstOrDefault()
            };
            var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<StaffUser>>();
            admin.PasswordHash = passwordHasher.HashPassword(admin, bootstrapPassword!);
            dbContext.StaffUsers.Add(admin);
            dbContext.SaveChanges();
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHsts();
}

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        app.Logger.LogError(exception, "Unhandled exception for request {TraceId}.", context.TraceIdentifier);
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers["X-Frame-Options"] = "DENY";
        context.Response.Headers["Referrer-Policy"] = "no-referrer";

        var envelope = new ApiEnvelope<object>(
            false,
            "An unexpected server error occurred.",
            null,
            null,
            context.TraceIdentifier);

        await context.Response.WriteAsJsonAsync(envelope);
    });
});
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers["X-Frame-Options"] = "DENY";
        context.Response.Headers["Referrer-Policy"] = "no-referrer";
        context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        return Task.CompletedTask;
    });

    await next();
});
app.UseHttpsRedirection();
app.UseRouting();
app.UseCors("MfiCors");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapHealthChecks("/healthz");
app.MapHealthChecks("/readyz");
app.MapControllers();

app.Run();
