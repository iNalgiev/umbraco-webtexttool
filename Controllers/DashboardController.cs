using System;
using System.Web.Http;
using Umbraco.Web.Mvc;
using Umbraco.Web.WebApi;
using Webtexttool.Services;

namespace Webtexttool.Controllers
{
    [PluginController("Webtexttool")]
    public class DashboardController : UmbracoAuthorizedApiController
    {
//        private readonly DashboardService _wttDashboardService = new DashboardService(); //TODO use Singleton or DI instead? See: https://our.umbraco.com/documentation/Reference/using-ioc

        public Records.Webtexttool GetWttData()
        {
            return DashboardService.Current.GetWttData();
        }

        [HttpPost]
        public object Save(Records.Webtexttool wtt)
        {
            try
            {
                DashboardService.Current.Save(wtt);

                return (object)wtt;
            }
            catch (Exception ex)
            {
                return (object) ex;
            }
        }
    }
}