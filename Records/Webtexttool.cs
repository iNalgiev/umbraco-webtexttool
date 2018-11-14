using Umbraco.Core.Persistence;
using Umbraco.Core.Persistence.DatabaseAnnotations;

namespace Webtexttool.Records
{
    [TableName("Webtexttool")]
    [PrimaryKey("Id", autoIncrement = true)]
    [ExplicitColumns]
    public class Webtexttool
    {
        [Column("Id")]
        [PrimaryKeyColumn(AutoIncrement = true)]
        public int Id { get; set; }

        [Column("ApiKey")]
        [Length(500)]
        [NullSetting(NullSetting = NullSettings.Null)]
        public string ApiKey { get; set; }

        [Column("AccessToken")]
        [Length(500)]
        [NullSetting(NullSetting = NullSettings.Null)]
        public string AccessToken { get; set; }
    }
}