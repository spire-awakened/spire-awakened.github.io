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
        var cardHtml = new StringBuilder();
        foreach (var card in cards)
        {
            var safeLabel = WebUtility.HtmlEncode(card.Label);
            var dataName = WebUtility.HtmlEncode(card.Label.ToLowerInvariant());
            var safeKey = WebUtility.HtmlEncode(card.Key);
            cardHtml.AppendLine($"            <div class=\"card-grid-item\" data-card-name=\"{dataName}\" data-card-key=\"{safeKey}\">");
            cardHtml.AppendLine("                <div class=\"card h-100 border-0\" style=\"background-color: #111821;\">");
            cardHtml.AppendLine($"                    <img src=\"{card.Url}\" alt=\"Card image\" />");
            cardHtml.AppendLine("                    <div class=\"card-body text-center\" style=\"background-color: rgba(255,255,255,0.06);\">");
            cardHtml.AppendLine("                        <small class=\"text-truncate d-block text-light fw-semibold\" style=\"max-width: 100%;\">");
            cardHtml.AppendLine($"                            {safeLabel}");
            cardHtml.AppendLine("                        </small>");
            cardHtml.AppendLine("                    </div>");
            cardHtml.AppendLine("                </div>");
            cardHtml.AppendLine("            </div>");
        }

        var noCardsHtml = "        <div class=\"alert alert-warning\">No card images found in images/cards.</div>";
        var cardsSection = cards.Count == 0
            ? noCardsHtml
            : $"        <div class=\"card-grid\">{Environment.NewLine}{cardHtml}        </div>";

        return $$"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ironclad - spire-awakened</title>
    <link rel="stylesheet" href="lib/bootstrap/dist/css/bootstrap.min.css" />
    <link rel="stylesheet" href="css/site.css" />
    <style>
        body {
            background: linear-gradient(180deg, #0b0f1a 0%, #121724 100%);
            color: #e7ebf2;
            font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .page-header {
            border-radius: 0.75rem;
            padding: 1rem 1rem 0.6rem;
            background-color: rgba(17, 24, 41, 0.84);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(6px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
            margin-bottom: 1rem;
        }

        .page-header .stats {
            font-size: 0.98rem;
            color: #bbc4d8;
        }

        .search-box {
            border-radius: 0.75rem;
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 0.8rem;
            background-color: rgba(13, 19, 33, 0.8);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        }

        .search-box label {
            color: #cdd3e0;
            font-weight: 600;
            margin-bottom: 0.3rem;
            display: block;
        }

        .search-box input {
            border-radius: 0.6rem;
            border: 1px solid rgba(255, 255, 255, 0.25);
            background-color: rgba(14, 20, 35, 0.94);
            color: #f8fbff;
            caret-color: #ffffff;
            font-weight: 600;
        }

        .card-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 10px;
            width: 100%;
        }

        .card-grid-item .card {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.24);
            border-radius: 1rem;
            border: 1px solid rgba(136, 151, 181, 0.2);
            overflow: hidden;
            min-height: 280px;
        }

        .card-grid-item:hover .card {
            transform: translateY(-6px) scale(1.035);
            box-shadow: 0 18px 38px rgba(66, 135, 245, 0.42), 0 0 24px rgba(140, 36, 176, 0.72);
        }

        .card-grid img {
            width: 100%;
            height: 240px;
            object-fit: contain;
            background-color: rgba(255,255,255,0.06);
        }

        .card-body {
            padding: 0.15rem 0.5rem 0.25rem;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .card-body small {
            font-size: 1.06rem;
            color: #f4f8ff;
            margin: 0;
            line-height: 1.2;
            font-weight: 700;
        }

        .plus-mode {
            color: #00C853 !important;
        }

        .overlay-card {
            background: #181e2a;
            border: 4px solid #42a5f5;
            border-radius: 1.2rem;
            box-shadow: 0 0 50px rgba(66, 135, 245, 0.8), 0 0 100px rgba(140, 36, 176, 1);
            padding: 1.5rem;
            display: flex;
            gap: 1.25rem;
            align-items: flex-start;
            max-width: 95vw;
        }

        .overlay-meta {
            max-width: 360px;
            min-width: 240px;
        }

        .overlay-meta h2 {
            font-size: 1.5rem;
            line-height: 1.2;
            margin-bottom: 0.75rem;
        }

        .overlay-meta p {
            margin: 0;
            color: #d7deef;
            font-size: 1.04rem;
            line-height: 1.35;
            white-space: pre-line;
        }
    </style>
</head>
<body class="bg-dark text-light">
    <div class="container-fluid py-4 min-vh-100">
        <div class="page-header">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div class="d-flex align-items-center gap-2">
                    <span style="color:#a1b1d7;font-weight:600;">Ironclad</span>
                    <span class="stats">Total cards: <strong>{{cards.Count}}</strong></span>
                </div>
                <div>
                    <span id="upgradeHint" class="stats">Press Q to view upgraded cards</span>
                </div>
            </div>
        </div>

        <div class="search-box mb-4">
            <label for="cardSearchInput">Search Card Name</label>
            <input id="cardSearchInput" type="search" class="form-control" placeholder="Type to filter cards..." aria-label="Search cards" autofocus />
        </div>

{{cardsSection}}
    </div>

    <div id="cardOverlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.7); z-index:9999; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; transition:opacity 0.5s ease; pointer-events:none;">
        <div id="overlayCard" class="overlay-card">
            <img id="overlayImg" style="max-width:90vw; max-height:50vh; object-fit:contain; border-radius:0.8rem; background:#222b3a;" />
            <div class="overlay-meta">
                <h2 id="overlayTitle" class="text-light fw-semibold"></h2>
                <p id="overlayDescription"></p>
            </div>
        </div>
    </div>

    <script>
        (function () {
            const input = document.getElementById('cardSearchInput');
            const items = document.querySelectorAll('.card-grid-item');
            const overlay = document.getElementById('cardOverlay');
            const overlayCard = document.getElementById('overlayCard');
            const overlayImg = document.getElementById('overlayImg');
            const overlayTitle = document.getElementById('overlayTitle');
            const overlayDescription = document.getElementById('overlayDescription');
            let cardDescriptions = {};

            const plusAvailabilityCache = new Map();

            function getPlusSrc(baseSrc) {
                return baseSrc.replace(/\.png(?=($|\?))/i, 'Plus.png');
            }

            function canLoadImage(url) {
                if (plusAvailabilityCache.has(url)) {
                    return Promise.resolve(plusAvailabilityCache.get(url));
                }

                return new Promise(resolve => {
                    const probe = new Image();
                    probe.onload = () => {
                        plusAvailabilityCache.set(url, true);
                        resolve(true);
                    };
                    probe.onerror = () => {
                        plusAvailabilityCache.set(url, false);
                        resolve(false);
                    };
                    probe.src = url;
                });
            }

            async function applyCardMode(item, enablePlus) {
                const img = item.querySelector('img');
                const small = item.querySelector('small');
                const baseSrc = img.dataset.baseSrc;

                if (!enablePlus) {
                    img.src = baseSrc;
                    small.classList.remove('plus-mode');
                    small.textContent = small.dataset.originalText;
                    return;
                }

                const plusSrc = getPlusSrc(baseSrc);
                const plusExists = await canLoadImage(plusSrc);

                if (plusExists) {
                    img.src = plusSrc;
                    small.classList.add('plus-mode');
                    small.textContent = small.dataset.originalText + '+';
                } else {
                    img.src = baseSrc;
                    small.classList.remove('plus-mode');
                    small.textContent = small.dataset.originalText;
                }
            }

            async function loadDescriptions() {
                try {
                    const response = await fetch('images/cards/ironclad_card_descriptions.json', { cache: 'no-store' });
                    if (!response.ok) {
                        return;
                    }
                    cardDescriptions = await response.json();
                } catch {
                    cardDescriptions = {};
                }
            }

            function getCardDescription(item, fallbackTitle, useUpgraded) {
                const cardKey = item.getAttribute('data-card-key') || '';
                const entry = cardDescriptions[cardKey];
                if (entry) {
                    if (useUpgraded && typeof entry.upgraded_description === 'string' && entry.upgraded_description.trim()) {
                        return entry.upgraded_description;
                    }
                    if (typeof entry.description === 'string' && entry.description.trim()) {
                        return entry.description;
                    }
                }
                return `No description found for ${fallbackTitle}.`;
            }

            function syncOverlayFromItem(item) {
                const img = item.querySelector('img');
                const small = item.querySelector('small');
                overlayImg.src = img.src;
                overlayImg.dataset.baseSrc = img.dataset.baseSrc;
                overlayTitle.textContent = small.textContent;
                overlayTitle.classList.toggle('plus-mode', small.classList.contains('plus-mode'));
                overlayTitle.dataset.originalText = small.dataset.originalText;
                overlayDescription.textContent = getCardDescription(item, small.dataset.originalText, small.classList.contains('plus-mode'));
            }

            items.forEach(item => {
                const img = item.querySelector('img');
                img.dataset.baseSrc = img.src;
                const small = item.querySelector('small');
                small.dataset.originalText = small.textContent.trim();
            });

            input.addEventListener('input', function () {
                const term = this.value.trim().toLowerCase();

                items.forEach(item => {
                    const name = item.getAttribute('data-card-name') || '';
                    const match = name.includes(term);
                    item.style.display = match ? 'block' : 'none';
                });
            });

            overlayCard.addEventListener('click', function (event) {
                event.stopPropagation();
            });

            let showPlus = false;
            let activeOverlayItem = null;
            let toggleInProgress = false;

            items.forEach(item => {
                item.addEventListener('click', function () {
                    activeOverlayItem = this;
                    syncOverlayFromItem(this);
                    overlay.style.opacity = '1';
                    overlay.style.pointerEvents = 'auto';
                });
            });

            overlay.addEventListener('click', function () {
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
                activeOverlayItem = null;
            });

            const upgradeHint = document.getElementById('upgradeHint');
            const toggleKey = 'q';
            if (upgradeHint) {
                upgradeHint.textContent = `Press ${toggleKey.toUpperCase()} to view upgraded cards`;
            }

            loadDescriptions();

            document.addEventListener('keydown', async function (event) {
                if ((event.key || '').toLowerCase() === toggleKey) {
                    event.preventDefault();
                    if (toggleInProgress) {
                        return;
                    }

                    toggleInProgress = true;
                    showPlus = !showPlus;

                    const updates = Array.from(items).map(item => applyCardMode(item, showPlus));
                    await Promise.all(updates);

                    if (overlay.style.opacity === '1' && activeOverlayItem) {
                        syncOverlayFromItem(activeOverlayItem);
                    }

                    toggleInProgress = false;
                }
            });
        })();
    </script>
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