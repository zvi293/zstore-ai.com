// Google Apps Script behind the contact form (script.google.com, project "פרויקט ללא שם").
// This file mirrors the deployed code; edit there and here together.
function doPost(e) {
  try {
    // ===== CONFIG =====
    var REDIRECT_URL = "https://zstore-ai.com/thank-you.html";
    var NOTIFY_EMAIL = "zstore.ai295@gmail.com";
    var SPREADSHEET_ID = "1O_WmtSgJLdLSC8Sih1ZaUH0rxCztZtYAEmQhtwz6Lbk";
    var SHEET_NAME = "Leads";

    // ===== VALIDATION =====
    if (!e || !e.parameter) throw new Error("Missing form payload");

    var name = (e.parameter.name || "").trim();
    var email = (e.parameter.email || "").trim();
    var message = (e.parameter.message || "").trim();

    if (!name || !email || !message) {
      throw new Error("Missing required fields");
    }

    // ===== WRITE TO SHEET =====
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Name", "Email", "Message"]);
    }

    sheet.appendRow([new Date(), name, email, message]);

    // ===== SEND EMAIL =====
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: "New Contact Form Message",
      htmlBody:
        "<h2>New Contact Form Message</h2>" +
        "<p><b>Name:</b> " + escapeHtml_(name) + "</p>" +
        "<p><b>Email:</b> " + escapeHtml_(email) + "</p>" +
        "<p><b>Message:</b><br>" +
        escapeHtml_(message).replace(/\n/g, "<br>") +
        "</p>"
    });

    // ===== HTML REDIRECT (IMPORTANT: HtmlService, not ContentService) =====
    return HtmlService.createHtmlOutput(
      "<!doctype html><html><head>" +
      '<meta charset="utf-8">' +
      '<meta http-equiv="refresh" content="0;url=' + REDIRECT_URL + '">' +
      "<title>Redirecting...</title>" +
      "</head><body>" +
      'Redirecting... <a href="' + REDIRECT_URL + '">Click here</a>' +
      "</body></html>"
    );
  } catch (err) {
    var msg = (err && err.message) ? err.message : String(err);
    return HtmlService.createHtmlOutput(
      "<!doctype html><html><head>" +
      '<meta charset="utf-8">' +
      "<title>Submission failed</title>" +
      "</head><body>" +
      "<h2>Submission failed</h2>" +
      "<p>" + escapeHtml_(msg) + "</p>" +
      "</body></html>"
    );
  }
}

function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
