using System;
using System.Xml;

namespace StoreManager.Api.Helpers;

public static partial class PptxXmlHelper
{
    public static string ReplaceChartValues(string xmlContent, int seriesIndex, params double[] values)
    {
        try {
            XmlDocument xmlDoc = new XmlDocument();
            xmlDoc.LoadXml(xmlContent);
            XmlNamespaceManager nsmgr = new XmlNamespaceManager(xmlDoc.NameTable);
            nsmgr.AddNamespace("c", "http://schemas.openxmlformats.org/drawingml/2006/chart");

            string xpath = $"//c:ser[{seriesIndex + 1}]/c:val/c:numRef/c:numCache/c:pt";
            var pts = xmlDoc.SelectNodes(xpath, nsmgr);
            if (pts != null)
            {
                for (int i = 0; i < Math.Min(pts.Count, values.Length); i++)
                {
                    var vNode = pts[i].SelectSingleNode("c:v", nsmgr);
                    if (vNode != null)
                    {
                        vNode.InnerText = values[i].ToString(System.Globalization.CultureInfo.InvariantCulture);
                    }
                }
            }
            return xmlDoc.OuterXml;
        } catch {
            return xmlContent; // Fallback
        }
    }
    
    public static string ReplaceChartCategories(string xmlContent, int seriesIndex, params string[] categories)
    {
        try {
            XmlDocument xmlDoc = new XmlDocument();
            xmlDoc.LoadXml(xmlContent);
            XmlNamespaceManager nsmgr = new XmlNamespaceManager(xmlDoc.NameTable);
            nsmgr.AddNamespace("c", "http://schemas.openxmlformats.org/drawingml/2006/chart");

            string xpath = $"//c:ser[{seriesIndex + 1}]/c:cat/c:strRef/c:strCache/c:pt";
            var pts = xmlDoc.SelectNodes(xpath, nsmgr);
            if (pts != null)
            {
                for (int i = 0; i < Math.Min(pts.Count, categories.Length); i++)
                {
                    var vNode = pts[i].SelectSingleNode("c:v", nsmgr);
                    if (vNode != null)
                    {
                        vNode.InnerText = categories[i];
                    }
                }
            }
            return xmlDoc.OuterXml;
        } catch {
            return xmlContent;
        }
    }
}
