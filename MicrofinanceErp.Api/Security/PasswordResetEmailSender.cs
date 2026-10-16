using System.Net;
using System.Net.Mail;
using System.Text;

namespace MicrofinanceErp.Api.Security;

public interface IPasswordResetEmailSender
{
    Task SendAsync(string email, string fullName, string resetUrl, CancellationToken cancellationToken);
}

public sealed class EmailDeliveryException : Exception
{
    public EmailDeliveryException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}

public sealed class SmtpPasswordResetEmailSender : IPasswordResetEmailSender
{
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;

    public SmtpPasswordResetEmailSender(IConfiguration configuration, IWebHostEnvironment environment)
    {
        _configuration = configuration;
        _environment = environment;
    }

    public async Task SendAsync(string email, string fullName, string resetUrl, CancellationToken cancellationToken)
    {
        var host = _configuration["Smtp:Host"];
        var fromAddress = _configuration["Smtp:FromAddress"];
        if (string.IsNullOrWhiteSpace(host)
            || !int.TryParse(_configuration["Smtp:Port"], out var port)
            || port is < 1 or > 65535
            || !MailAddress.TryCreate(fromAddress, out _))
        {
            throw new EmailDeliveryException("Password reset email delivery is not configured.");
        }

        var username = _configuration["Smtp:Username"];
        var password = _configuration["Smtp:Password"];
        if (string.IsNullOrWhiteSpace(username) != string.IsNullOrWhiteSpace(password))
        {
            throw new EmailDeliveryException("SMTP username and password must be configured together.");
        }

        using var message = new MailMessage
        {
            From = new MailAddress(fromAddress!, _configuration["Smtp:FromName"] ?? "Microfinance ERP"),
            Subject = "Reset your Microfinance ERP password",
            Body = BuildBody(fullName, resetUrl),
            IsBodyHtml = false
        };
        message.To.Add(new MailAddress(email));

        var enableSsl = _configuration.GetValue("Smtp:EnableSsl", true);
        if (!_environment.IsDevelopment() && !enableSsl)
        {
            throw new EmailDeliveryException("SMTP TLS must be enabled outside Development.");
        }

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network
        };
        if (!string.IsNullOrWhiteSpace(username))
        {
            client.Credentials = new NetworkCredential(username, password);
        }

        try
        {
            await client.SendMailAsync(message, cancellationToken);
        }
        catch (SmtpException exception)
        {
            throw new EmailDeliveryException("The password reset email could not be delivered.", exception);
        }
    }

    private static string BuildBody(string fullName, string resetUrl)
    {
        var body = new StringBuilder();
        body.Append("Hello ").Append(fullName).AppendLine(",");
        body.AppendLine();
        body.AppendLine("A password reset was requested for your Microfinance ERP account.");
        body.AppendLine("Use the following link within 30 minutes to choose a new password:");
        body.AppendLine();
        body.AppendLine(resetUrl);
        body.AppendLine();
        body.AppendLine("If you did not request this change, you can ignore this message.");
        return body.ToString();
    }
}
