using System.Globalization;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;

internal static class StaticSiteExporter
{
    public static bool TryExport(string[] args)
    {
        if (!args.Contains("--export-static", StringComparer.OrdinalIgnoreCase))
        {
            return false;
        }

        var outputArgument = GetArgumentValue(args, "--output") ?? "docs";
        var projectRoot = FindProjectRoot();
        var outputRoot = Path.IsPathRooted(outputArgument)
            ? outputArgument
            : Path.GetFullPath(Path.Combine(projectRoot, outputArgument));

        Export(projectRoot, outputRoot);
        Console.WriteLine($"Static site generated at: {outputRoot}");

        return true;
    }

    private static void Export(string projectRoot, string outputRoot)
    {
        var webRoot = Path.Combine(projectRoot, "wwwroot");
        if (!Directory.Exists(webRoot))
        {
            throw new DirectoryNotFoundException($"Could not find wwwroot folder at '{webRoot}'.");
        }

        if (Directory.Exists(outputRoot))
        {
            Directory.Delete(outputRoot, recursive: true);
        }

        Directory.CreateDirectory(outputRoot);
        CopyDirectory(webRoot, outputRoot);

        var cards = GetCardEntries(webRoot);
        File.WriteAllText(Path.Combine(outputRoot, "index.html"), BuildIndexHtml(cards));
        File.WriteAllText(Path.Combine(outputRoot, "privacy.html"), BuildPrivacyHtml());
        File.WriteAllText(Path.Combine(outputRoot, ".nojekyll"), string.Empty);
    }

    private static string BuildIndexHtml(List<(string Url, string Label, string Key)> cards)
    {
        var allCardsHtml = new StringBuilder();
        foreach (var card in cards)
        {
            var safeLabel = WebUtility.HtmlEncode(card.Label);
            var dataName = WebUtility.HtmlEncode(card.Label.ToLowerInvariant());
            var safeKey = WebUtility.HtmlEncode(card.Key);
            allCardsHtml.AppendLine($"            <div class=\"card-grid-item\" data-card-name=\"{dataName}\" data-card-key=\"{safeKey}\">");
            allCardsHtml.AppendLine("                <div class=\"card h-100 border-0\" style=\"background-color: #111821;\">");
            allCardsHtml.AppendLine("                    <div class=\"card-image-wrap\">");
            allCardsHtml.AppendLine($"                        <img class=\"card-art\" src=\"{card.Url}\" alt=\"Card image\" />");
            allCardsHtml.AppendLine("                    </div>");
            allCardsHtml.AppendLine("                    <div class=\"card-body text-center\" style=\"background-color: rgba(255,255,255,0.06);\">");
            allCardsHtml.AppendLine("                        <small class=\"text-truncate d-block text-light fw-semibold\" style=\"max-width: 100%;\">");
            allCardsHtml.AppendLine($"                            {safeLabel}");
            allCardsHtml.AppendLine("                        </small>");
            allCardsHtml.AppendLine("                    </div>");
            allCardsHtml.AppendLine("                    <div class=\"card-actions\">");
            allCardsHtml.AppendLine("                        <button type=\"button\" class=\"action-btn btn-compare\" data-action=\"add-compare\">Add to Comparison</button>");
            allCardsHtml.AppendLine("                        <button type=\"button\" class=\"action-btn btn-deck\" data-action=\"add-deck\">Add to Deck</button>");
            allCardsHtml.AppendLine("                    </div>");
            allCardsHtml.AppendLine("                </div>");
            allCardsHtml.AppendLine("            </div>");
        }

        var cardsByKey = cards.ToDictionary(card => card.Key, StringComparer.OrdinalIgnoreCase);
        var ironcladStartingDeckKeys = new[]
        {
            "StS2_Ironclad-Strike",
            "StS2_Ironclad-Strike",
            "StS2_Ironclad-Strike",
            "StS2_Ironclad-Strike",
            "StS2_Ironclad-Defend",
            "StS2_Ironclad-Defend",
            "StS2_Ironclad-Defend",
            "StS2_Ironclad-Defend",
            "StS2_Ironclad-Bash",
        };

        var currentDeckHtml = new StringBuilder();
        for (var i = 0; i < ironcladStartingDeckKeys.Length; i++)
        {
            var deckKey = ironcladStartingDeckKeys[i];
            if (!cardsByKey.TryGetValue(deckKey, out var deckCard))
            {
                continue;
            }

            var safeDeckLabel = WebUtility.HtmlEncode(deckCard.Label);
            var deckDataName = WebUtility.HtmlEncode(deckCard.Label.ToLowerInvariant());
            var safeDeckKey = WebUtility.HtmlEncode(deckCard.Key);
            currentDeckHtml.AppendLine($"            <div class=\"card-grid-item\" data-card-name=\"{deckDataName}\" data-card-key=\"{safeDeckKey}\" data-deck-slot=\"{i + 1}\">");
            currentDeckHtml.AppendLine("                <div class=\"card h-100 border-0\" style=\"background-color: #111821;\">");
            currentDeckHtml.AppendLine("                    <div class=\"card-image-wrap\">");
            currentDeckHtml.AppendLine($"                        <img class=\"card-art\" src=\"{deckCard.Url}\" alt=\"Card image\" />");
            currentDeckHtml.AppendLine("                    </div>");
            currentDeckHtml.AppendLine("                    <div class=\"card-body text-center\" style=\"background-color: rgba(255,255,255,0.06);\">");
            currentDeckHtml.AppendLine("                        <small class=\"text-truncate d-block text-light fw-semibold\" style=\"max-width: 100%;\">");
            currentDeckHtml.AppendLine($"                            {safeDeckLabel}");
            currentDeckHtml.AppendLine("                        </small>");
            currentDeckHtml.AppendLine("                    </div>");
            currentDeckHtml.AppendLine("                </div>");
            currentDeckHtml.AppendLine("            </div>");
        }

        var noCardsHtml = "        <div class=\"alert alert-warning\">No card images found in images/cards.</div>";
        var cardsSection = cards.Count == 0
            ? noCardsHtml
            : $"""
        <div class="card-columns">
            <section class="cards-section">
                <div class="search-box mb-4">
                    <div class="d-flex align-items-center gap-2 mb-3">
                        <span style="color:#a1b1d7;font-weight:600; font-size: 1.1rem;">Ironclad</span>
                        <span class="stats">Total cards: <strong>{cards.Count}</strong></span>
                    </div>
                    <label for="cardSearchInput">Search Card Name</label>
                    <input id="cardSearchInput" type="search" class="form-control" placeholder="Type to filter cards..." aria-label="Search cards" autofocus />
                    <div style="margin-top: 0.5rem;">
                        <span id="upgradeHint" class="stats" style="display: block;">Press Q to view upgraded cards</span>
                    </div>
                    <div class="strength-context-row">
                        <label for="strengthContextSelect">Strength Context</label>
                        <select id="strengthContextSelect" class="form-select form-select-sm" aria-label="Card strength context">
                            <option value="short">Short Fight</option>
                            <option value="elite">Elite</option>
                            <option value="boss">Boss</option>
                        </select>
                    </div>
                </div>
                <h2>All Cards</h2>
                <div id="allCardsPanel" class="cards-panel-body">
                    <div id="allCardsGrid" class="card-grid">
{allCardsHtml}                </div>
                </div>
            </section>
            <section class="cards-section right-panels">
                <div class="panel-split">
                    <div class="panel-block">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
                            <h2 style="margin: 0; flex: 1;">Card Comparison <span id="comparisonCountLabel" class="stats-inline">0 cards</span></h2>
                            <button id="clearComparisonBtn" type="button" class="action-btn btn-compare" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; white-space: nowrap;">Clear</button>
                        </div>
                        <div id="comparisonPanel" class="cards-panel-body">
                            <div id="comparisonGrid" class="card-grid"></div>
                            <div id="comparisonEmpty" class="panel-empty">No cards in comparison yet.</div>
                        </div>
                    </div>
                    <div class="panel-block">
                        <h2>Current Deck <span id="deckCountLabel" class="stats-inline">{ironcladStartingDeckKeys.Length} cards</span></h2>
                        <div id="deckPanel" class="cards-panel-body">
                            <div id="currentDeckGrid" class="card-grid">
{currentDeckHtml}                </div>
                        </div>
                        <div id="deckHealthPanel" class="deck-health-panel">
                            <h3>Deck Health <span id="deckHealthOverall" class="stats-inline">0</span></h3>
                            <div class="deck-health-metric">
                                <div class="deck-health-head"><span>Frontload</span><span id="metricFrontloadValue">0</span></div>
                                <div class="deck-health-bar"><div id="metricFrontloadBar" class="deck-health-fill"></div></div>
                            </div>
                            <div class="deck-health-metric">
                                <div class="deck-health-head"><span>Block</span><span id="metricBlockValue">0</span></div>
                                <div class="deck-health-bar"><div id="metricBlockBar" class="deck-health-fill"></div></div>
                            </div>
                            <div class="deck-health-metric">
                                <div class="deck-health-head"><span>Scaling</span><span id="metricScalingValue">0</span></div>
                                <div class="deck-health-bar"><div id="metricScalingBar" class="deck-health-fill"></div></div>
                            </div>
                            <div class="deck-health-metric">
                                <div class="deck-health-head"><span>Consistency</span><span id="metricConsistencyValue">0</span></div>
                                <div class="deck-health-bar"><div id="metricConsistencyBar" class="deck-health-fill"></div></div>
                            </div>
                            <div class="deck-health-metric">
                                <div class="deck-health-head"><span>Utility</span><span id="metricUtilityValue">0</span></div>
                                <div class="deck-health-bar"><div id="metricUtilityBar" class="deck-health-fill"></div></div>
                            </div>
                            <div class="deck-health-notes">
                                <div>
                                    <h4>Weaknesses</h4>
                                    <ul id="deckHealthWeaknesses">
                                        <li>Add cards to evaluate deck health.</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4>Next Picks</h4>
                                    <ul id="deckHealthNextPicks">
                                        <li>Suggestions will appear here.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
""";

        return $$"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ironclad - spire-awakened</title>
    <link rel="stylesheet" href="lib/bootstrap/dist/css/bootstrap.min.css" />
    <link rel="stylesheet" href="css/site.css" />
</head>
<body class="bg-dark text-light">
    <div class="container-fluid cards-page-shell">
{{cardsSection}}
    </div>

    <div id="cardOverlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); z-index:9999; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; transition:opacity 0.5s ease; pointer-events:none;">
        <div id="overlayCard" class="overlay-card">
            <div class="overlay-image-wrap">
                <img id="overlayImg" style="max-width:90vw; max-height:50vh; object-fit:contain; border-radius:0.8rem; background:#222b3a;" />
            </div>
            <div class="overlay-meta">
                <h2 id="overlayTitle" class="text-light fw-semibold"></h2>
                <p id="overlayDescription"></p>
                <div class="overlay-actions">
                    <button id="overlayAddCompare" type="button" class="action-btn btn-compare">Add to Comparison</button>
                    <button id="overlayAddDeck" type="button" class="action-btn btn-deck">Add to Deck</button>
                </div>
            </div>
        </div>
    </div>

    <script src="lib/jquery/dist/jquery.min.js"></script>
    <script src="lib/bootstrap/dist/js/bootstrap.bundle.min.js"></script>
    <script src="js/site.js"></script>
</body>
</html>
""";
    }

    private static string BuildPrivacyHtml()
    {
        return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Privacy Policy - spire-awakened</title>
    <link rel="stylesheet" href="lib/bootstrap/dist/css/bootstrap.min.css" />
    <link rel="stylesheet" href="css/site.css" />
</head>
<body class="bg-dark text-light">
    <main class="container py-4">
        <h1>Privacy Policy</h1>
        <p>Use this page to detail your site's privacy policy.</p>
        <p><a href="index.html">Back to cards</a></p>
    </main>
</body>
</html>
""";
    }

    private static List<(string Url, string Label, string Key)> GetCardEntries(string webRoot)
    {
        var cardsFolder = Path.Combine(webRoot, "images", "cards");
        if (!Directory.Exists(cardsFolder))
        {
            return [];
        }

        return Directory.EnumerateFiles(cardsFolder, "*.png")
            .Where(f => !Path.GetFileName(f).Contains("Plus", StringComparison.OrdinalIgnoreCase))
            .OrderBy(Path.GetFileName)
            .Select(path =>
            {
                var fileName = Path.GetFileName(path);
                var rawName = Path.GetFileNameWithoutExtension(path);
                return (Url: $"images/cards/{fileName}", Label: FormatCardLabel(rawName), Key: rawName);
            })
            .ToList();
    }

    private static string FormatCardLabel(string raw)
    {
        var withoutPrefix = raw.Replace("StS2_Ironclad-", string.Empty, StringComparison.Ordinal);
        var withSpaces = Regex.Replace(withoutPrefix, "([a-z])([A-Z])", "$1 $2");
        withSpaces = Regex.Replace(withSpaces, "([A-Z]+)([A-Z][a-z])", "$1 $2");
        withSpaces = withSpaces.Replace('-', ' ').Replace('_', ' ').Trim();
        if (string.IsNullOrWhiteSpace(withSpaces))
        {
            return string.Empty;
        }

        var parts = withSpaces.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var first = CultureInfo.CurrentCulture.TextInfo.ToTitleCase(parts[0].ToLowerInvariant());
        if (parts.Length == 1)
        {
            return first;
        }

        return first + " " + string.Join(" ", parts.Skip(1).Select(x => x.ToLowerInvariant()));
    }

    private static void CopyDirectory(string sourceDir, string destinationDir)
    {
        Directory.CreateDirectory(destinationDir);

        foreach (var file in Directory.GetFiles(sourceDir))
        {
            var destinationPath = Path.Combine(destinationDir, Path.GetFileName(file));
            File.Copy(file, destinationPath, overwrite: true);
        }

        foreach (var directory in Directory.GetDirectories(sourceDir))
        {
            var destinationPath = Path.Combine(destinationDir, Path.GetFileName(directory));
            CopyDirectory(directory, destinationPath);
        }
    }

    private static string? GetArgumentValue(string[] args, string key)
    {
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (string.Equals(args[i], key, StringComparison.OrdinalIgnoreCase))
            {
                return args[i + 1];
            }
        }

        return null;
    }

    private static string FindProjectRoot()
    {
        var current = new DirectoryInfo(Directory.GetCurrentDirectory());
        while (current is not null)
        {
            if (current.GetFiles("*.csproj").Length > 0)
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        throw new InvalidOperationException("Could not locate project root containing a .csproj file.");
    }
}
