// The extension is a thin shortcut: toolbar click -> open the web app.
// All generating/viewing lives on the site (works on mobile, no permissions).
// TODO: confirm once the Cloudflare Pages project exists under this name.
const SITE = 'https://invoiceiguana.pages.dev/';
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: SITE });
});
