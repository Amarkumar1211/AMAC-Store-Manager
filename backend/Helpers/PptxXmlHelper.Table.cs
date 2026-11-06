using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace StoreManager.Api.Helpers;

public static partial class PptxXmlHelper
{
    public static string ReplaceSlide2Table(string xmlContent, List<(string Name, decimal Price, decimal Qty, decimal Total, string Type)> rowsData, decimal totalValue)
    {
        try {
            var tblMatch = Regex.Match(xmlContent, @"(?s)<a:tbl>.*?</a:tbl>");
            if (!tblMatch.Success) return xmlContent;
            
            string tblXml = tblMatch.Value;
            var trMatches = Regex.Matches(tblXml, @"(?s)<a:tr .*?</a:tr>");
            
            if (trMatches.Count < 3) return xmlContent;
            
            string headerRow = trMatches[0].Value;
            string templateRow = trMatches[1].Value;
            string footerRow = trMatches[trMatches.Count - 1].Value;
            
            // Build new table content
            var newRows = new System.Text.StringBuilder();
            newRows.AppendLine(headerRow);
            
            foreach (var r in rowsData)
            {
                string rXml = templateRow;
                var texts = Regex.Matches(rXml, @"(?s)(<a:t>)(.*?)(</a:t>)");
                if (texts.Count >= 5) {
                    rXml = rXml.Remove(texts[4].Groups[2].Index, texts[4].Groups[2].Length).Insert(texts[4].Groups[2].Index, r.Type);
                    rXml = rXml.Remove(texts[3].Groups[2].Index, texts[3].Groups[2].Length).Insert(texts[3].Groups[2].Index, r.Total.ToString("0.##"));
                    rXml = rXml.Remove(texts[2].Groups[2].Index, texts[2].Groups[2].Length).Insert(texts[2].Groups[2].Index, r.Qty.ToString("0.##"));
                    rXml = rXml.Remove(texts[1].Groups[2].Index, texts[1].Groups[2].Length).Insert(texts[1].Groups[2].Index, r.Price.ToString("0.##"));
                    rXml = rXml.Remove(texts[0].Groups[2].Index, texts[0].Groups[2].Length).Insert(texts[0].Groups[2].Index, System.Security.SecurityElement.Escape(r.Name));
                }
                newRows.AppendLine(rXml);
            }
            
            // Footer row
            var fTexts = Regex.Matches(footerRow, @"(?s)(<a:t>)(.*?)(</a:t>)");
            if (fTexts.Count >= 2) {
                footerRow = footerRow.Remove(fTexts[1].Groups[2].Index, fTexts[1].Groups[2].Length).Insert(fTexts[1].Groups[2].Index, totalValue.ToString("0.##"));
            }
            newRows.AppendLine(footerRow);
            
            // Replace old rows with new rows
            int firstTrIndex = tblXml.IndexOf("<a:tr ");
            int lastTrEnd = tblXml.LastIndexOf("</a:tr>") + 7;
            
            string newTblXml = tblXml.Substring(0, firstTrIndex) + newRows.ToString() + tblXml.Substring(lastTrEnd);
            
            return xmlContent.Replace(tblXml, newTblXml);
        } catch {
            return xmlContent;
        }
    }
}
