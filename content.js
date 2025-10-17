let isDragging = false;
let currentWidget = null;
let offsetX, offsetY;

// Load saved widgets when the page loads
function loadWidgets() {
  chrome.storage.local.get(["widgets"], (result) => {
    const widgets = result.widgets || [];
    const currentUrl = window.location.hostname;
    widgets
      .filter((widget) => widget.host === currentUrl)
      .forEach((widget) => createWidget(widget));
  });
}

// Create a new widget
function createWidget(widget) {
  const container = document.createElement("div");
  container.className = "link-widget";
  container.style.left = `${widget.x}px`;
  container.style.top = `${widget.y}px`;
  container.dataset.id = widget.id;

  const favicon = document.createElement("img");
  favicon.className = "link-widget-favicon";
  favicon.src =
    widget.favicon || `https://www.google.com/s2/favicons?domain=${widget.url}`;
  favicon.onerror = () => {
    favicon.src = "https://www.google.com/s2/favicons?domain=example.com";
  };

  const link = document.createElement("a");
  link.href = widget.url;
  link.textContent = widget.title;
  link.className = "link-widget-link";
  link.target = "_blank"; // Open links in new tab

  const closeBtn = document.createElement("span");
  closeBtn.className = "link-widget-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => removeWidget(widget.id, container);

  container.appendChild(favicon);
  container.appendChild(link);
  container.appendChild(closeBtn);
  document.body.appendChild(container);

  // Make widget draggable
  container.addEventListener("mousedown", (e) => {
    if (e.target === closeBtn) return;
    isDragging = true;
    currentWidget = container;
    offsetX = e.clientX - parseInt(container.style.left);
    offsetY = e.clientY - parseInt(container.style.top);
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging && currentWidget) {
      currentWidget.style.left = `${e.clientX - offsetX}px`;
      currentWidget.style.top = `${e.clientY - offsetY}px`;
      updateWidgetPosition(
        currentWidget.dataset.id,
        e.clientX - offsetX,
        e.clientY - offsetY
      );
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    currentWidget = null;
  });
}

// Remove a widget
function removeWidget(id, element) {
  chrome.storage.local.get(["widgets"], (result) => {
    let widgets = result.widgets || [];
    widgets = widgets.filter((widget) => widget.id !== id);
    chrome.storage.local.set({ widgets }, () => {
      element.remove();
    });
  });
}

// Update widget position in storage
function updateWidgetPosition(id, x, y) {
  chrome.storage.local.get(["widgets"], (result) => {
    const widgets = result.widgets || [];
    const widget = widgets.find((w) => w.id === id);
    if (widget) {
      widget.x = x;
      widget.y = y;
      chrome.storage.local.set({ widgets });
    }
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "addWidget" && request.host !== "newtab") {
    const widget = {
      id: Date.now().toString(),
      host: request.host,
      title: request.title,
      url: request.url,
      x: request.x,
      y: request.y,
      favicon: `https://www.google.com/s2/favicons?domain=${request.url}`,
    };
    chrome.storage.local.get(["widgets"], (result) => {
      const widgets = result.widgets || [];
      widgets.push(widget);
      chrome.storage.local.set({ widgets }, () => {
        createWidget(widget);
      });
    });
  }
});

// Initialize widgets on page load
loadWidgets();
