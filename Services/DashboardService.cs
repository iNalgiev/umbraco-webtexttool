using System;
using System.Linq;
using Umbraco.Core;
using Umbraco.Core.Persistence;

namespace Webtexttool.Services
{
    public class DashboardService
    {
        public static readonly DashboardService Current = new DashboardService();

        private readonly DatabaseContext _databaseContext = ApplicationContext.Current.DatabaseContext;

        public Records.Webtexttool GetWttData()
        {
            try
            {
                return _databaseContext.Database.Fetch<Records.Webtexttool>(new Sql().Select("*").From("Webtexttool")).FirstOrDefault();
            }
            catch (Exception ex)
            {
                return new Records.Webtexttool();
            }
        }

        public object Save(Records.Webtexttool wtt)
        {
            var sql = new Sql().Select(new object[1] { (object)"*" }).From(new object[1] { (object)"Webtexttool" });

            Records.Webtexttool wttObject = _databaseContext.Database.Fetch<Records.Webtexttool>(sql).FirstOrDefault();

            if (wtt != null)
            {
                if (wttObject != null)
                {
                    wtt.Id = wttObject.Id;
                    _databaseContext.Database.Update(wtt);
                }
                else
                {
                    _databaseContext.Database.Save(wtt);
                }
            }
            return wtt;            
        }
    }
}