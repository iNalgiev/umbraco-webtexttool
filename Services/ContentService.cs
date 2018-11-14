using System.Linq;
using Umbraco.Core;
using Umbraco.Core.Persistence;
using Webtexttool.Records;

namespace Webtexttool.Services
{
    public class ContentService
    {
        public static readonly ContentService Current = new ContentService();

        private readonly DatabaseContext _dc = ApplicationContext.Current.DatabaseContext;      

        public WebtexttoolContent GetByContentId(int contentId)
        {
            var query = new Sql().Select("*").From("WebtexttoolContent").Where<WebtexttoolContent>(x => x.ContentId == contentId, _dc.SqlSyntax);
            return _dc.Database.Fetch<WebtexttoolContent>(query).FirstOrDefault();
        }

        public object Save(WebtexttoolContent wtt)
        {
            WebtexttoolContent wttObject = GetByContentId(wtt.ContentId);

            if (wtt != null)
            {
                if (wttObject != null)
                {
//                    wttObject.Id = wtt.Id;
                    wttObject.ContentId = wtt.ContentId;
                    wttObject.Keywords = wtt.Keywords;
                    wttObject.Description = wtt.Description;
                    wttObject.Language = wtt.Language;
                    wttObject.Synonyms = wtt.Synonyms;

                    _dc.Database.Update(wttObject);
                }
                else
                {
                    _dc.Database.Save(wtt);
                }
            }
            return wtt;

        }

        public object SaveContentQualitySettings(WebtexttoolContent wtt)
        {
            WebtexttoolContent wttObject = GetByContentId(wtt.ContentId);

            if (wtt != null)
            {
                if (wttObject != null)
                {                   
                    wttObject.ContentQualitySettings = wtt.ContentQualitySettings;

                    _dc.Database.Update(wttObject);
                }
            }
            return wtt;
        }

        public object SaveContentQualitySuggestions(WebtexttoolContent wtt)
        {
            WebtexttoolContent wttObject = GetByContentId(wtt.ContentId);

            if (wtt != null)
            {
                if (wttObject != null)
                {
                    wttObject.ContentQualitySuggestions = wtt.ContentQualitySuggestions;

                    _dc.Database.Update(wttObject);
                }
            }
            return wtt;

        }
    }
}