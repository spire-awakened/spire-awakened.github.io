using System.Diagnostics;
using System.IO;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using SpireAwakened.Models;

namespace SpireAwakened.Controllers;

public class HomeController : Controller
{
    private readonly IWebHostEnvironment _env;

    public HomeController(IWebHostEnvironment env)
    {
        _env = env;
    }

    public IActionResult Index()
    {
        var cardsFolder = Path.Combine(_env.WebRootPath, "images", "cards");
        var cardUrls = new List<string>();

        if (Directory.Exists(cardsFolder))
        {
            cardUrls = Directory.EnumerateFiles(cardsFolder, "*.png")
                .Where(f => !Path.GetFileName(f).Contains("Plus", StringComparison.OrdinalIgnoreCase))
                .OrderBy(f => Path.GetFileName(f))
                .Select(f => $"/images/cards/{Path.GetFileName(f)}")
                .ToList();
        }

        return View(cardUrls);
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}
