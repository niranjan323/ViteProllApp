using CRoll.API.Models;

namespace CRoll.API.Services.Cases
{
    public interface ICaseService
    {
        Task<IEnumerable<Case>> GetAllAsync(string userId);
        Task<Case?> GetByIdAsync(string id);
        Task CreateAsync(Case caseItem);
        Task UpdateAsync(Case caseItem);
        Task UpdateChartImageAsync(string id, string chartImage);
        Task DeleteAsync(string id);
    }
}
