using System;
using System.Threading;
using System.Web.Http;
using umbraco;
using Umbraco.Core.Logging;
using Umbraco.Core.Models;
using Umbraco.Web;
using Umbraco.Web.Mvc;
using Umbraco.Web.WebApi;
using Webtexttool.Helpers;
using Webtexttool.Models;
using Webtexttool.Records;
using Webtexttool.Services;

namespace Webtexttool.Controllers
{
    [PluginController("Webtexttool")]
    public class ContentController : UmbracoAuthorizedApiController
    {
        public WebtexttoolContent GetById(int contentId)
        {
            return ContentService.Current.GetByContentId(contentId);
        }

        [HttpPost]
        public object Save(WebtexttoolContent wtt)
        {
            try
            {
                ContentService.Current.Save(wtt);

                return (object) wtt;
            }
            catch (Exception ex)
            {
                return (object) ex;
            }
        }

        [HttpPost]
        public object SaveSettings(WebtexttoolContent wtt)
        {
            try
            {
                ContentService.Current.SaveContentQualitySettings(wtt);

                return (object)wtt;
            }
            catch (Exception ex)
            {
                return (object)ex;
            }
        }

        [HttpPost]
        public object SaveSuggestions(WebtexttoolContent wtt)
        {
            try
            {
                ContentService.Current.SaveContentQualitySuggestions(wtt);

                return (object)wtt;
            }
            catch (Exception ex)
            {
                return (object)ex;
            }
        }

        public PageModel GetPageDetails(int pageId)
        {
            PageModel pageModel = new PageModel();

            try
            {
                IContent contentById = Services.ContentService.GetById(pageId);

                pageModel.PagePublished = contentById.Status.ToString() == "Published";
                
                if (contentById != null)
                    pageModel.PageType = contentById.ContentType.Name;
                IPublishedContent publishedContent = Umbraco.TypedContent(pageId);
                if (publishedContent != null)
                    pageModel.PageUrl = PublishedContentExtensions.UrlAbsolute(publishedContent);
                if (string.IsNullOrEmpty(pageModel.PageUrl))
                    pageModel.PageUrl = Helper.GetPageUrl(contentById.Name);
                pageModel.Language = Thread.CurrentThread.CurrentCulture.TwoLetterISOLanguageName;
                var currentUmbracoUser = helper.GetCurrentUmbracoUser();
                pageModel.UserEmail = currentUmbracoUser.Email;
                pageModel.UserName = currentUmbracoUser.Name;
                pageModel.PageId = pageId;
                pageModel.DomainUrl = Helper.GetBaseUrl();

                return pageModel;
            }
            catch (Exception ex)
            {
                LogHelper.Error<PageModel>("Something went wrong", ex);
                return pageModel;
            }
        }
    }
}
