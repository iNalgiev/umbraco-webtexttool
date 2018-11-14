using System;
using System.Linq;
using Semver;
using Umbraco.Core;
using Umbraco.Core.Logging;
using Umbraco.Core.Models;
using Umbraco.Core.Persistence.Migrations;
using Umbraco.Core.Persistence.SqlSyntax;
using Umbraco.Core.Services;
using Webtexttool.Migrations;

namespace Webtexttool.Helpers
{
    public class PublishEventHandler : ApplicationEventHandler
    {
        protected const string WebtexttoolAlias = "webtexttool";

        protected override void ApplicationStarted(UmbracoApplicationBase umbracoApplication, ApplicationContext applicationContext)
        {
            MyClassMigration(applicationContext.DatabaseContext.SqlSyntax, applicationContext.Services.MigrationEntryService, applicationContext.ProfilingLogger.Logger);

            // Gets a reference to the section(if already added)
            Section section = ApplicationContext.Current.Services.SectionService.GetByAlias(WebtexttoolAlias);
            if (section != null) return;

            // Add a new "Webtexttool Dashboard" section
            ApplicationContext.Current.Services.SectionService.MakeNew("Webtexttool Dashboard", WebtexttoolAlias, "webtexttool-icon");            

            // Grant admin users access to the new section (tested in 7.11.1)
            /*var adminGroup = ApplicationContext.Current.Services.UserService.GetUserGroupByAlias("admin");
            if (adminGroup != null)
            {
                if (!adminGroup.AllowedSections.Contains(WebtexttoolAlias))
                {
                    adminGroup.AddAllowedSection(WebtexttoolAlias);
                    try
                    {
                        ApplicationContext.Current.Services.UserService.Save(adminGroup);
                    }
                    catch (System.Web.HttpException e)
                    {

                    }
                    catch (Exception e)
                    {
                        LogHelper.Error<PublishEventHandler>("Error granting admin access to webtexttool section", e);
                    }
                }
            }*/
        }

        private static void MyClassMigration(ISqlSyntaxProvider sqlSyntax, IMigrationEntryService migrationEntryService, ILogger logger)
        {
            var tableName = "Webtexttool";

            SemVersion currentVersion = GetCurrentVersion(tableName);
            SemVersion targetVersion = ParseVersion("1.0.0");

            var scriptsForMigration = new IMigration[] {
                new CreateDataTable (sqlSyntax, logger),
                new CreateContentTable (sqlSyntax, logger)
            };

            RunMigration(sqlSyntax, migrationEntryService, logger,
                scriptsForMigration, currentVersion, targetVersion, tableName);
        }

        private static SemVersion GetCurrentVersion(string tableName)
        {
            var migrations = ApplicationContext.Current.Services.MigrationEntryService.GetAll(tableName);
            var latestMigration = migrations.OrderByDescending(x => x.Version).FirstOrDefault();

            if (latestMigration == null)
                return ParseVersion("0.0.0");

            return ParseVersion(latestMigration.Version.ToString());
        }

        private static SemVersion ParseVersion(string input)
        {
            return SemVersion.Parse(input);
        }

        private static void RunMigration(ISqlSyntaxProvider SqlSyntax, IMigrationEntryService migrationEntryService, ILogger logger, IMigration[] classesForMigration, SemVersion currentVersion, SemVersion targetVersion, string productName)
        {
            MigrationRunner mRunner = new MigrationRunner(migrationEntryService, logger, currentVersion, targetVersion, productName, classesForMigration);

            try
            {
                mRunner.Execute(ApplicationContext.Current.DatabaseContext.Database, true);
            }
            catch (System.Web.HttpException e)
            {
                // because umbraco runs some other migrations after the migration runner 
                // is executed we get httpexception
                // catch this error, but don't do anything
                // fixed in 7.4.2+ see : http://issues.umbraco.org/issue/U4-8077
            }
            catch (Exception e)
            {
                LogHelper.Error<PublishEventHandler>("Error running Webtexttool migration", e);
            }
        }
    }
}