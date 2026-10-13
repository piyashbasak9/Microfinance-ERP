using MicrofinanceErp.Api.Models;
using MicrofinanceErp.Domain.Entities;
using MicrofinanceErp.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "MicrofinanceErp.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "MicrofinanceErp.Client";
var jwtSigningKey = builder.Configuration["Jwt:SigningKey"];
if (string.IsNullOrWhiteSpace(jwtSigningKey) || Encoding.UTF8.GetByteCount(jwtSigningKey) < 32)
{
    throw new InvalidOperationException("Configure Jwt:SigningKey with a secret of at least 32 bytes.");
}

builder.Services.AddControllers();
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
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddScoped<IPasswordHasher<StaffUser>, PasswordHasher<StaffUser>>();
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
    });
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("MfiCors", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<MicrofinanceErpDbContext>();
    dbContext.Database.Migrate();

    var bootstrapEmail = builder.Configuration["BootstrapAdmin:Email"];
    var bootstrapPassword = builder.Configuration["BootstrapAdmin:Password"];
    var bootstrapName = builder.Configuration["BootstrapAdmin:FullName"];
    var hasBootstrapEmail = !string.IsNullOrWhiteSpace(bootstrapEmail);
    var hasBootstrapPassword = !string.IsNullOrWhiteSpace(bootstrapPassword);
    if (hasBootstrapEmail != hasBootstrapPassword)
    {
        throw new InvalidOperationException("Set both BootstrapAdmin:Email and BootstrapAdmin:Password to provision the initial administrator.");
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
                Role = "Super Admin"
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

app.UseCors("MfiCors");
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
