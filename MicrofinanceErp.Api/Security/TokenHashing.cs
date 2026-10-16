using System.Security.Cryptography;
using System.Text;

namespace MicrofinanceErp.Api.Security;

public static class TokenHashing
{
    public static string CreateToken()
        => Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

    public static string Hash(string token)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
