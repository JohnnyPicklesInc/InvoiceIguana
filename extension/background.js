// The extension is a thin shortcut: toolbar click -> open the web app.
// All generating/viewing lives on the site (works on mobile, no permissions).
const SITE = 'https://invoiceiguana.com/';
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: SITE });
});
