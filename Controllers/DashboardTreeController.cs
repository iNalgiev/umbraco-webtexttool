using System;
using System.Collections.Generic;
using System.Net.Http.Formatting;
using Umbraco.Core;
using Umbraco.Web.Models.Trees;
using Umbraco.Web.Mvc;
using Umbraco.Web.Trees;

namespace Webtexttool.Controllers
{
    [Tree("webtexttool", "webtexttoolTree", "Textmetrics", iconClosed:"icon-folder", iconOpen:"icon-folder-open")]
    [PluginController("Webtexttool")]
    public class DashboardTreeController : TreeController
    {
        protected override TreeNodeCollection GetTreeNodes(string id, FormDataCollection queryStrings)
        {
            // check if we're rendering the root node's children
            if (id == Constants.System.Root.ToInvariantString())
            {
                // you can get your custom nodes from anywhere, and they can represent anything... 
                Dictionary<int, string> sectionTrees = new Dictionary<int, string>();
                sectionTrees.Add(1, "Dashboard");

                // create our node collection
                var nodes = new TreeNodeCollection();

                // loop through our favourite things and create a tree item for each one
                foreach (var thing in sectionTrees)
                {
                    // add each node to the tree collection using the base CreateTreeNode method
                    // it has several overloads, using here unique Id of tree item, -1 is the Id of the parent node to create, eg the root of this tree is -1 by convention - the querystring collection passed into this route - the name of the tree node -  css class of icon to display for the node - and whether the item has child nodes
                    var node = CreateTreeNode(thing.Key.ToString(), "-1", queryStrings, thing.Value, "icon-presentation", "webtexttool/webtexttoolTree/wtt-admin-display/0");
                    nodes.Add(node);
                }
                return nodes;
            }

            // this tree doesn't support rendering more than 1 level
            throw new NotSupportedException();
        }

        protected override MenuItemCollection GetMenuForNode(string id, FormDataCollection queryStrings)
        {
            return new MenuItemCollection();
        }        
    }
}