namespace MicrofinanceErp.Api.Models;

public sealed record ApiEnvelope<T>(
    bool Success,
    string Message,
    T? Data,
    object? Errors = null,
    string? TraceId = null);
