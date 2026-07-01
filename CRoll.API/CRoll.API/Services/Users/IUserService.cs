namespace CRoll.API.Services.Users
{
    public interface IUserService
    {
        Task EnsureUserAsync(string absUserId, string userName, string? userEmail);
    }
}
