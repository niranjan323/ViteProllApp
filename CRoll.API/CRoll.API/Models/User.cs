namespace CRoll.API.Models
{
    public class User
    {
        public Guid Id { get; set; }
        public string AbsUserId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string? UserEmail { get; set; }
        public DateTime CreatedDate { get; set; }
        public string CreatedBy { get; set; } = "system";
        public DateTime? ModifiedDate { get; set; }
        public string? ModifiedBy { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
