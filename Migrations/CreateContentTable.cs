using Umbraco.Core;
using Umbraco.Core.Logging;
using Umbraco.Core.Persistence;
using Umbraco.Core.Persistence.Migrations;
using Umbraco.Core.Persistence.SqlSyntax;
using Webtexttool.Records;

namespace Webtexttool.Migrations
{
    [Migration("1.0.0", 2, "Webtexttool")]
    public class CreateContentTable : MigrationBase
    {
        private readonly UmbracoDatabase _database = ApplicationContext.Current.DatabaseContext.Database;
        private readonly DatabaseSchemaHelper _schemaHelper;

        public CreateContentTable(ISqlSyntaxProvider sqlSyntax, ILogger logger) : base(sqlSyntax, logger)
        {
            _schemaHelper = new DatabaseSchemaHelper(_database, logger, sqlSyntax);
        }

        public override void Up()
        {
            //Pass the class to the schema and do not over write anything that exists
            _schemaHelper.CreateTable<WebtexttoolContent>(false);
        }

        public override void Down()
        {
//            _schemaHelper.DropTable<UserRecord>();
        }

    }
}