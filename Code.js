    /**
     * Entry point for Google Apps Script Web App
     */
    function doGet(e) {
      // Returns the Index.html as an HtmlOutput object
      return HtmlService.createTemplateFromFile('Index')
        .evaluate()
        .setTitle('BVC Event Attendance Admin')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
    }

    /**
     * Helper function to include external HTML files within the template
     * @param {string} filename 
     */
    function include(filename) {
      return HtmlService.createHtmlOutputFromFile(filename).getContent();
    }
