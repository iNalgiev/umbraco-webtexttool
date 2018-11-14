using System.Web;

namespace Webtexttool.Helpers
{
    public class Helper
    {
        public static string GetBaseUrl()
        {
            HttpRequest request = HttpContext.Current.Request;
            string str = HttpRuntime.AppDomainAppVirtualPath;
            if (str != "/")
                str = "/" + str;
            return string.Format("{0}://{1}{2}", (object)request.Url.Scheme, (object)request.Url.Authority, (object)str);
        }

        public static string GetPageUrl(string name)
        {
            return GetBaseUrl() + (!name.Contains(" ") ? name.ToLower() : name.ToLower().Replace(" ", "-"));
        }
    }
}