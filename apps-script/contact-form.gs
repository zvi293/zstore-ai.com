// Google Apps Script behind the contact form (script.google.com, project "פרויקט ללא שם").
// This file mirrors the deployed code; edit there and here together.
function doPost(e) {
  try {
    // ===== CONFIG =====
    var REDIRECT_URL = "https://zstore-ai.com/thank-you.html";
    var NOTIFY_EMAIL = "zstore.ai295@gmail.com";
    var SPREADSHEET_ID = "1O_WmtSgJLdLSC8Sih1ZaUH0rxCztZtYAEmQhtwz6Lbk";
    var SHEET_NAME = "Leads";
    var MAX_PER_HOUR = 15; // global cap so a flood can never drain the daily MailApp quota

    // ===== VALIDATION =====
    if (!e || !e.parameter) throw new Error("Missing form payload");

    var name = (e.parameter.name || "").trim();
    var email = (e.parameter.email || "").trim();
    var message = (e.parameter.message || "").trim();

    if (!name || !email || !message) {
      throw new Error("Missing required fields");
    }

    // ===== SPAM CHECKS (server-side mirror of the site's client-side gates) =====
    // Honeypot: the site's JS never sends "company"; scraped/native bot submits do, filled.
    // Answer with the normal success page so the bot learns nothing.
    if ((e.parameter.company || "").trim()) {
      return redirectPage_(REDIRECT_URL);
    }

    // Timing: the site always sends ts (page-load epoch ms) and dt (whole seconds until
    // submit, 3 or more). Direct posts without them are not from the site's form.
    var ts = Number(e.parameter.ts || 0);
    var dt = Number(e.parameter.dt);
    if (!(ts > 0) || !(dt >= 3)) {
      throw new Error("This request did not come from the site's contact form. If you are a real person, please email " + NOTIFY_EMAIL + " directly.");
    }

    // Field limits, mirroring the form's own maxlength/minlength attributes.
    if (name.length > 80 || email.length > 160 || message.length < 10 || message.length > 3000) {
      throw new Error("Field length out of range");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new Error("Invalid email address");
    }

    // Rate cap, counted only for submissions that passed every check above.
    if (overRateLimit_(MAX_PER_HOUR)) {
      return redirectPage_(REDIRECT_URL);
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
    return redirectPage_(REDIRECT_URL);
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

function redirectPage_(url) {
  return HtmlService.createHtmlOutput(
    "<!doctype html><html><head>" +
    '<meta charset="utf-8">' +
    '<meta http-equiv="refresh" content="0;url=' + url + '">' +
    "<title>Redirecting...</title>" +
    "</head><body>" +
    'Redirecting... <a href="' + url + '">Click here</a>' +
    "</body></html>"
  );
}

// Approximate rolling-hour counter; if the cache is ever unavailable,
// prefer delivering mail over blocking it.
function overRateLimit_(maxPerHour) {
  try {
    var cache = CacheService.getScriptCache();
    var n = Number(cache.get("submitCount") || 0) + 1;
    cache.put("submitCount", String(n), 3600);
    return n > maxPerHour;
  } catch (err) {
    return false;
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
