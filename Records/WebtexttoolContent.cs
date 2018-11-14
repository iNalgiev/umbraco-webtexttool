using Umbraco.Core.Persistence;
using Umbraco.Core.Persistence.DatabaseAnnotations;

namespace Webtexttool.Records
{
    [TableName("WebtexttoolContent")]
    [PrimaryKey("Id", autoIncrement = true)]
    [ExplicitColumns]
    public class WebtexttoolContent
    {
        [Column("Id")]
        [PrimaryKeyColumn(AutoIncrement = true)]
        public int Id { get; set; }

        [Column("ContentId")]
        public int ContentId { get; set; }

        [Column("Keywords")]
        [NullSetting(NullSetting = NullSettings.Null)]
        public string Keywords { get; set; }

        [Column("Description")]
        [Length(500)]
        [NullSetting(NullSetting = NullSettings.Null)]
        public string Description { get; set; }

        [Column("Language")]
        [NullSetting(NullSetting = NullSettings.Null)]
        public string Language { get; set; }

        [Column("Synonyms")]
        [NullSetting(NullSetting = NullSettings.Null)]        
        public string Synonyms { get; set; }

        [Column("ContentQualitySettings")]
        [SpecialDbType(SpecialDbTypes.NTEXT)]
        [NullSetting(NullSetting = NullSettings.Null)]
        public string ContentQualitySettings { get; set; }

        [Column("ContentQualitySuggestions")]
        [SpecialDbType(SpecialDbTypes.NTEXT)]
        [NullSetting(NullSetting = NullSettings.Null)]
        public string ContentQualitySuggestions { get; set; }
    }
}