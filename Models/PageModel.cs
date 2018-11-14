using Newtonsoft.Json;

namespace Webtexttool.Models
{
    public class PageModel
    {
        [JsonProperty("pageUrl")]
        public string PageUrl { get; set; }

        [JsonProperty("pageId")]
        public int PageId { get; set; }

        [JsonProperty("pageType")]
        public string PageType { get; set; }

        [JsonProperty("pagePublished")]
        public bool PagePublished { get; set; }

        [JsonProperty("language")]
        public string Language { get; set; }

        [JsonProperty("userName")]
        public string UserName { get; set; }

        [JsonProperty("userEmail")]
        public string UserEmail { get; set; }

        [JsonProperty("domainUrl")]
        public string DomainUrl { get; set; }
    }
}