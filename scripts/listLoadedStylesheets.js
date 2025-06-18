/*
 * This script lists the URLs of all stylesheets loaded on the current page.
 * It's a quick way to verify which CSS files are being applied.
 */
(function() {
  console.log("🚀 Checking for loaded stylesheets...");

  const allStylesheets = Array.from(document.styleSheets);
  let report = `STYLESHEET AUDIT - ${new Date().toISOString()}\n`;
  report += `Found ${allStylesheets.length} stylesheet(s) loaded on this page.\n\n`;

  if (allStylesheets.length > 0) {
    allStylesheets.forEach((sheet, index) => {
      report += `--- Stylesheet ${index + 1} ---\n`;
      report += `URL: ${sheet.href || '(Inline Stylesheet)'}\n`;
      try {
        report += `Rule Count: ${sheet.cssRules.length}\n\n`;
      } catch (e) {
        report += `Rule Count: (Could not read cross-origin rules)\n\n`;
      }
    });
  } else {
    report += "No external stylesheets were found.\n";
  }

  // Automatically copy the final report to the clipboard
  copy(report);

  console.log("✅ Stylesheet report finished and copied to clipboard.");
  console.log(report); // Also log it directly for easy viewing
})();
