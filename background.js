chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    const isNewTab = activeTab.url === "chrome://newtab/";
    const host = isNewTab ? "newtab" : new URL(activeTab.url).hostname;
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      function: promptForNewWidget,
      args: [host],
    });
  });
});

function promptForNewWidget(host) {
  const title = prompt("Enter the title for the new link widget:");
  const url = prompt(
    "Enter the URL for the new link widget (include http:// or https://):"
  );
  if (title && url) {
    chrome.runtime.sendMessage({
      action: "addWidget",
      host: host,
      title: title,
      url: url,
      x: 100,
      y: 100,
    });
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkNewTab") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ isNewTab: tabs[0].url === "chrome://newtab/" });
    });
    return true; // Keep the message channel open for async response
  }
});
