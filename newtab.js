let isDragging = false;
let isResizing = false;
let currentWidget = null;
let offsetX, offsetY;

// Load saved widgets when the page loads
function loadWidgets() {
  chrome.storage.local.get(["widgets"], (result) => {
    const widgets = result.widgets || [];
    const newTabWidgets = widgets.filter((widget) => widget.host === "newtab");
    newTabWidgets.forEach((widget) => createWidget(widget));
  });
}

// Create a new widget
function createWidget(widget) {
  const container = document.createElement("div");
  container.className = "link-widget";
  
  // Get the MainForLinkPage container bounds
  const mainContainer = document.querySelector('.MainForLinkPage');
  const containerRect = mainContainer.getBoundingClientRect();
  
  // Constrain initial position to container bounds
  const widgetWidth = 200; // Approximate widget width
  const widgetHeight = 120; // Approximate widget height
  const constrainedX = Math.max(containerRect.left, Math.min(widget.x, containerRect.right - widgetWidth));
  const constrainedY = Math.max(containerRect.top, Math.min(widget.y, containerRect.bottom - widgetHeight));
  
  container.style.left = `${constrainedX}px`;
  container.style.top = `${constrainedY}px`;
  container.dataset.id = widget.id;
  
  // Load saved size if available
  if (widget.width && widget.height) {
    container.style.width = `${widget.width}px`;
    container.style.height = `${widget.height}px`;
  }
  
  // Update the stored position if it was constrained
  if (constrainedX !== widget.x || constrainedY !== widget.y) {
    updateWidgetPosition(widget.id, constrainedX, constrainedY);
  }

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

  // Create action buttons container
  const actionButtons = document.createElement("div");
  actionButtons.className = "link-widget-actions";
  
  // Create edit button
  const editBtn = document.createElement("span");
  editBtn.className = "link-widget-edit";
  editBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  `;
  editBtn.onclick = (e) => {
    e.stopPropagation();
    editWidget(widget.id, widget.title, widget.url);
  };
  
  // Create close button
  const closeBtn = document.createElement("span");
  closeBtn.className = "link-widget-close";
  closeBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 6L6 18"></path>
      <path d="M6 6l12 12"></path>
    </svg>
  `;
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    removeWidget(widget.id, container);
  };
  
  actionButtons.appendChild(editBtn);
  actionButtons.appendChild(closeBtn);

  // Create resize handle
  const resizeHandle = document.createElement("div");
  resizeHandle.className = "link-widget-resize";
  resizeHandle.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 3H3v18h18V3z"></path>
      <path d="M21 3l-9 9"></path>
      <path d="M9 3l9 9"></path>
    </svg>
  `;

  container.appendChild(favicon);
  container.appendChild(link);
  container.appendChild(actionButtons);
  container.appendChild(resizeHandle);
  document.getElementById("widget-container").appendChild(container);

  // Make widget draggable
  container.addEventListener("mousedown", (e) => {
    if (e.target === closeBtn || e.target === editBtn || e.target.closest('.link-widget-actions') || e.target.closest('.link-widget-resize')) return;
    isDragging = true;
    currentWidget = container;
    offsetX = e.clientX - parseInt(container.style.left);
    offsetY = e.clientY - parseInt(container.style.top);
  });

  // Handle resize
  let startX, startY, startWidth, startHeight;
  
  resizeHandle.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = parseInt(container.style.width) || 200;
    startHeight = parseInt(container.style.height) || 120;
    
    document.addEventListener("mousemove", handleResize);
    document.addEventListener("mouseup", stopResize);
  });

  function handleResize(e) {
    if (!isResizing) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newWidth = startWidth + deltaX;
    let newHeight = startHeight + deltaY;
    
    // Set minimum and maximum sizes
    newWidth = Math.max(150, Math.min(newWidth, 400));
    newHeight = Math.max(80, Math.min(newHeight, 300));
    
    container.style.width = `${newWidth}px`;
    container.style.height = `${newHeight}px`;
  }

  function stopResize() {
    isResizing = false;
    document.removeEventListener("mousemove", handleResize);
    document.removeEventListener("mouseup", stopResize);
    
    // Save the new size to storage
    const widgetId = container.dataset.id;
    if (widgetId) {
      const newWidth = parseInt(container.style.width);
      const newHeight = parseInt(container.style.height);
      updateWidgetSize(widgetId, newWidth, newHeight);
      
      // Show feedback that size was saved
      showCopyFeedback(`Widget resized to ${newWidth}x${newHeight}px`);
    }
  }

  document.addEventListener("mousemove", (e) => {
    if (isDragging && currentWidget && !isResizing) {
      // Get the MainForLinkPage container bounds
      const mainContainer = document.querySelector('.MainForLinkPage');
      const containerRect = mainContainer.getBoundingClientRect();
      
      // Calculate widget dimensions
      const widgetRect = currentWidget.getBoundingClientRect();
      const widgetWidth = widgetRect.width;
      const widgetHeight = widgetRect.height;
      
      // Calculate new position with boundary constraints
      let newX = e.clientX - offsetX;
      let newY = e.clientY - offsetY;
      
      // Constrain to MainForLinkPage container bounds
      newX = Math.max(containerRect.left, Math.min(newX, containerRect.right - widgetWidth));
      newY = Math.max(containerRect.top, Math.min(newY, containerRect.bottom - widgetHeight));
      
      currentWidget.style.left = `${newX}px`;
      currentWidget.style.top = `${newY}px`;
      updateWidgetPosition(
        currentWidget.dataset.id,
        newX,
        newY
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

function editWidget(id, currentTitle, currentUrl) {
  const newTitle = prompt("Edit link title:", currentTitle);
  if (newTitle === null) return; // User cancelled
  
  const newUrl = prompt("Edit link URL:", currentUrl);
  if (newUrl === null) return; // User cancelled
  
  if (newTitle.trim() && newUrl.trim()) {
    chrome.storage.local.get(["widgets"], (result) => {
      const widgets = result.widgets || [];
      const updatedWidgets = widgets.map((widget) => {
        if (widget.id === id) {
          return {
            ...widget,
            title: newTitle.trim(),
            url: newUrl.trim(),
            favicon: `https://www.google.com/s2/favicons?domain=${newUrl.trim()}`
          };
        }
        return widget;
      });
      chrome.storage.local.set({ widgets: updatedWidgets });
      
      // Update the widget display
      const container = document.querySelector(`[data-id="${id}"]`);
      if (container) {
        const link = container.querySelector('.link-widget-link');
        const favicon = container.querySelector('.link-widget-favicon');
        
        if (link) {
          link.textContent = newTitle.trim();
          link.href = newUrl.trim();
        }
        
        if (favicon) {
          // Update favicon with new URL
          favicon.src = `https://www.google.com/s2/favicons?domain=${newUrl.trim()}`;
          favicon.onerror = () => {
            favicon.src = "https://www.google.com/s2/favicons?domain=example.com";
          };
        }
      }
      
      showCopyFeedback('Link updated successfully!');
    });
  }
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

function updateWidgetSize(id, width, height) {
  chrome.storage.local.get(["widgets"], (result) => {
    const widgets = result.widgets || [];
    const widget = widgets.find((w) => w.id === id);
    if (widget) {
      widget.width = width;
      widget.height = height;
      chrome.storage.local.set({ widgets }, () => {
        console.log(`Widget ${id} size saved: ${width}x${height}px`);
      });
    }
  });
}

// Show/hide modal
const modal = document.getElementById("add-widget-modal");
const addWidgetBtn = document.getElementById("add-widget-btn");
const cancelBtn = document.getElementById("cancel-btn");
const addWidgetForm = document.getElementById("add-widget-form");

addWidgetBtn.addEventListener("click", () => {
  modal.style.display = "flex";
  document.getElementById("widget-title").focus();
});

cancelBtn.addEventListener("click", () => {
  modal.style.display = "none";
  addWidgetForm.reset();
});

// Close modal when clicking outside
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
    addWidgetForm.reset();
  }
});

// Handle form submission
addWidgetForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("widget-title").value;
  const url = document.getElementById("widget-url").value;
  if (title && url) {
    const widget = {
      id: Date.now().toString(),
      host: "newtab",
      title: title,
      url: url,
      x: 100,
      y: 100,
      favicon: `https://www.google.com/s2/favicons?domain=${url}`,
    };
    chrome.storage.local.get(["widgets"], (result) => {
      const widgets = result.widgets || [];
      widgets.push(widget);
      chrome.storage.local.set({ widgets }, () => {
        createWidget(widget);
        modal.style.display = "none";
        addWidgetForm.reset();
      });
    });
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "addWidget" && request.host === "newtab") {
    const widget = {
      id: Date.now().toString(),
      host: "newtab",
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

// Password Management Functions
function loadPasswords() {
  chrome.storage.local.get(["passwords"], (result) => {
    const passwords = result.passwords || [];
    displayPasswords(passwords);
  });
}

function savePassword(passwordData) {
  chrome.storage.local.get(["passwords"], (result) => {
    const passwords = result.passwords || [];
    const newPassword = {
      id: Date.now().toString(),
      platform: passwordData.platform,
      username: passwordData.username,
      password: passwordData.password,
      notes: passwordData.notes || "",
      createdAt: new Date().toISOString(),
      strength: calculatePasswordStrength(passwordData.password)
    };
    passwords.push(newPassword);
    chrome.storage.local.set({ passwords }, () => {
      loadPasswords();
    });
  });
}

function deletePassword(id) {
  chrome.storage.local.get(["passwords"], (result) => {
    const passwords = result.passwords || [];
    const filteredPasswords = passwords.filter(p => p.id !== id);
    chrome.storage.local.set({ passwords: filteredPasswords }, () => {
      loadPasswords();
    });
  });
}

function editPassword(id) {
  chrome.storage.local.get(["passwords"], (result) => {
    const passwords = result.passwords || [];
    const password = passwords.find(p => p.id === id);
    if (password) {
      // Fill the edit form with current password data
      document.getElementById('edit-password-platform').value = password.platform;
      document.getElementById('edit-password-username').value = password.username;
      document.getElementById('edit-password-password').value = password.password;
      document.getElementById('edit-password-notes').value = password.notes || '';
      
      // Store the password ID for updating
      document.getElementById('edit-password-form').dataset.passwordId = id;
      
      // Show the edit modal
      document.getElementById('edit-password-modal').style.display = 'flex';
      document.getElementById('edit-password-platform').focus();
    }
  });
}

function updatePassword(passwordData) {
  chrome.storage.local.get(["passwords"], (result) => {
    const passwords = result.passwords || [];
    const passwordIndex = passwords.findIndex(p => p.id === passwordData.id);
    if (passwordIndex !== -1) {
      passwords[passwordIndex] = {
        ...passwords[passwordIndex],
        platform: passwordData.platform,
        username: passwordData.username,
        password: passwordData.password,
        notes: passwordData.notes || "",
        strength: calculatePasswordStrength(passwordData.password),
        updatedAt: new Date().toISOString()
      };
      chrome.storage.local.set({ passwords }, () => {
        loadPasswords();
        showCopyFeedback('Password updated successfully!');
      });
    }
  });
}

function calculatePasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}

function displayPasswords(passwords) {
  const container = document.getElementById('passwords-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (passwords.length === 0) {
    container.innerHTML = '<p style="text-align: center; font-family: Caveat, cursive; font-size: 20px; color: #666;">No passwords saved yet. Add your first password!</p>';
    return;
  }
  
  // Group passwords by platform
  const groupedPasswords = passwords.reduce((groups, password) => {
    const platform = password.platform;
    if (!groups[platform]) {
      groups[platform] = [];
    }
    groups[platform].push(password);
    return groups;
  }, {});
  
  Object.keys(groupedPasswords).forEach(platform => {
    const platformGroup = document.createElement('div');
    platformGroup.className = 'platform-group';
    
    const platformHeader = document.createElement('h3');
    platformHeader.textContent = platform;
    platformHeader.style.cssText = 'font-family: Caveat, cursive; font-size: 22px; color: #4a148c; margin: 20px 0 10px 0; border-bottom: 2px solid #7b1fa2; padding-bottom: 5px;';
    
    platformGroup.appendChild(platformHeader);
    
    groupedPasswords[platform].forEach(password => {
      const passwordItem = createPasswordItem(password);
      platformGroup.appendChild(passwordItem);
    });
    
    container.appendChild(platformGroup);
  });
}

function createPasswordItem(password) {
  const item = document.createElement('div');
  item.className = 'password-item';
  item.dataset.id = password.id;
  
  const platform = document.createElement('div');
  platform.className = 'password-platform';
  platform.innerHTML = `
    🔐 ${password.platform}
    <span class="password-strength strength-${password.strength}">${password.strength.toUpperCase()}</span>
  `;
  
  const username = document.createElement('div');
  username.className = 'password-username';
  username.textContent = `👤 ${password.username}`;
  
  const actions = document.createElement('div');
  actions.className = 'password-actions';
  
  // Create copy username button
  const copyUsernameBtn = document.createElement('button');
  copyUsernameBtn.className = 'copy-username-btn';
  copyUsernameBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    Copy Username
  `;
  copyUsernameBtn.addEventListener('click', () => {
    copyToClipboard(password.username, 'Username');
  });
  
  // Create copy password button
  const copyPasswordBtn = document.createElement('button');
  copyPasswordBtn.className = 'copy-password-btn';
  copyPasswordBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
    Copy Password
  `;
  copyPasswordBtn.addEventListener('click', () => {
    copyToClipboard(password.password, 'Password');
  });
  
  // Create edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'edit-password-btn';
  editBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
    Edit
  `;
  editBtn.addEventListener('click', () => {
    editPassword(password.id);
  });
  
  // Create delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-password-btn';
  deleteBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"></path>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
    </svg>
    Delete
  `;
  deleteBtn.addEventListener('click', () => {
    deletePassword(password.id);
  });
  
  actions.appendChild(copyUsernameBtn);
  actions.appendChild(copyPasswordBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  
  item.appendChild(platform);
  item.appendChild(username);
  item.appendChild(actions);
  
  if (password.notes) {
    const notes = document.createElement('div');
    notes.className = 'password-notes';
    notes.textContent = `📝 ${password.notes}`;
    item.appendChild(notes);
  }
  
  return item;
}

function copyToClipboard(text, type) {
  console.log('Attempting to copy:', type, text);
  
  // Try modern clipboard API first
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Successfully copied using modern API');
      showCopyFeedback(`${type} copied to clipboard!`);
    }).catch(err => {
      console.error('Failed to copy with modern API: ', err);
      // Fallback to older method
      fallbackCopyTextToClipboard(text, type);
    });
  } else {
    console.log('Using fallback copy method');
    // Fallback for older browsers or non-secure contexts
    fallbackCopyTextToClipboard(text, type);
  }
}

function fallbackCopyTextToClipboard(text, type) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  
  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showCopyFeedback(`${type} copied to clipboard!`);
    } else {
      showCopyFeedback('Failed to copy to clipboard');
    }
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
    showCopyFeedback('Failed to copy to clipboard');
  }
  
  document.body.removeChild(textArea);
}

function showCopyFeedback(message) {
  const feedback = document.createElement('div');
  feedback.className = 'copy-feedback';
  feedback.textContent = message;
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    feedback.remove();
  }, 2000);
}

// Password Modal Event Listeners
const addPasswordBtn = document.getElementById('add-password-btn');
const viewPasswordsBtn = document.getElementById('view-passwords-btn');
const addPasswordModal = document.getElementById('add-password-modal');
const viewPasswordsModal = document.getElementById('view-passwords-modal');
const editPasswordModal = document.getElementById('edit-password-modal');
const addPasswordForm = document.getElementById('add-password-form');
const editPasswordForm = document.getElementById('edit-password-form');
const cancelPasswordBtn = document.getElementById('cancel-password-btn');
const cancelEditPasswordBtn = document.getElementById('cancel-edit-password-btn');
const closePasswordsBtn = document.getElementById('close-passwords-btn');
const toggleVisibilityBtn = document.getElementById('toggle-password-visibility');
const toggleEditVisibilityBtn = document.getElementById('toggle-edit-password-visibility');

// Show add password modal
addPasswordBtn.addEventListener('click', () => {
  addPasswordModal.style.display = 'flex';
  document.getElementById('password-platform').focus();
});

// Show view passwords modal
viewPasswordsBtn.addEventListener('click', () => {
  viewPasswordsModal.style.display = 'flex';
  loadPasswords();
});

// Close modals
cancelPasswordBtn.addEventListener('click', () => {
  addPasswordModal.style.display = 'none';
  addPasswordForm.reset();
});

closePasswordsBtn.addEventListener('click', () => {
  viewPasswordsModal.style.display = 'none';
});

// Close edit modal
cancelEditPasswordBtn.addEventListener('click', () => {
  editPasswordModal.style.display = 'none';
  editPasswordForm.reset();
});

// Close modal when clicking outside
addPasswordModal.addEventListener('click', (e) => {
  if (e.target === addPasswordModal) {
    addPasswordModal.style.display = 'none';
    addPasswordForm.reset();
  }
});

viewPasswordsModal.addEventListener('click', (e) => {
  if (e.target === viewPasswordsModal) {
    viewPasswordsModal.style.display = 'none';
  }
});

editPasswordModal.addEventListener('click', (e) => {
  if (e.target === editPasswordModal) {
    editPasswordModal.style.display = 'none';
    editPasswordForm.reset();
  }
});

// Password visibility toggle
toggleVisibilityBtn.addEventListener('click', () => {
  const passwordInput = document.getElementById('password-password');
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleVisibilityBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    `;
  } else {
    passwordInput.type = 'password';
    toggleVisibilityBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
  }
});

// Edit password visibility toggle
toggleEditVisibilityBtn.addEventListener('click', () => {
  const passwordInput = document.getElementById('edit-password-password');
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleEditVisibilityBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    `;
  } else {
    passwordInput.type = 'password';
    toggleEditVisibilityBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
  }
});

// Handle password form submission
addPasswordForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const platform = document.getElementById('password-platform').value;
  const username = document.getElementById('password-username').value;
  const password = document.getElementById('password-password').value;
  const notes = document.getElementById('password-notes').value;
  
  if (platform && username && password) {
    savePassword({ platform, username, password, notes });
    addPasswordModal.style.display = 'none';
    addPasswordForm.reset();
    showCopyFeedback('Password saved successfully!');
  }
});

// Handle edit password form submission
editPasswordForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const platform = document.getElementById('edit-password-platform').value;
  const username = document.getElementById('edit-password-username').value;
  const password = document.getElementById('edit-password-password').value;
  const notes = document.getElementById('edit-password-notes').value;
  const passwordId = editPasswordForm.dataset.passwordId;
  
  if (platform && username && password && passwordId) {
    updatePassword({ 
      id: passwordId, 
      platform, 
      username, 
      password, 
      notes 
    });
    editPasswordModal.style.display = 'none';
    editPasswordForm.reset();
    // Close the view passwords modal to refresh the list
    viewPasswordsModal.style.display = 'none';
  }
});

// Make functions globally available
window.copyToClipboard = copyToClipboard;
window.deletePassword = deletePassword;
window.editPassword = editPassword;

// Todo List Functions
function loadTodos() {
  chrome.storage.local.get(["todos"], (result) => {
    const todos = result.todos || [];
    displayTodos(todos);
  });
}

function saveTodo(todoData) {
  chrome.storage.local.get(["todos"], (result) => {
    const todos = result.todos || [];
    const newTodo = {
      id: Date.now().toString(),
      text: todoData.text,
      priority: todoData.priority || 'medium',
      date: todoData.date || getCurrentDateString(),
      originalDate: todoData.date || getCurrentDateString(),
      completed: false,
      createdAt: new Date().toISOString()
    };
    todos.push(newTodo);
    chrome.storage.local.set({ todos }, () => {
      loadTodos();
    });
  });
}

function updateTodo(id, updates) {
  chrome.storage.local.get(["todos"], (result) => {
    const todos = result.todos || [];
    const todoIndex = todos.findIndex(t => t.id === id);
    if (todoIndex !== -1) {
      todos[todoIndex] = { ...todos[todoIndex], ...updates };
      chrome.storage.local.set({ todos }, () => {
        loadTodos();
      });
    }
  });
}

function saveTodoOrder() {
  const todoItems = document.querySelectorAll('.todo-item');
  const newOrder = Array.from(todoItems).map(item => item.dataset.id);
  
  chrome.storage.local.get(["todos"], (result) => {
    const todos = result.todos || [];
    const reorderedTodos = newOrder.map(id => todos.find(todo => todo.id === id)).filter(Boolean);
    
    chrome.storage.local.set({ todos: reorderedTodos }, () => {
      showCopyFeedback('Todo order updated');
    });
  });
}

function moveTodoUp(todoElement) {
  const previousSibling = todoElement.previousElementSibling;
  if (previousSibling && previousSibling.classList.contains('todo-item')) {
    todoElement.parentNode.insertBefore(todoElement, previousSibling);
    saveTodoOrder();
  }
}

function moveTodoDown(todoElement) {
  const nextSibling = todoElement.nextElementSibling;
  if (nextSibling && nextSibling.classList.contains('todo-item')) {
    todoElement.parentNode.insertBefore(nextSibling, todoElement);
    saveTodoOrder();
  }
}

function deleteTodo(id) {
  // Add visual feedback for deletion
  const todoItem = document.querySelector(`[data-id="${id}"]`);
  if (todoItem) {
    todoItem.style.transition = 'all 0.3s ease-out';
    todoItem.style.transform = 'translateX(-100%)';
    todoItem.style.opacity = '0';
  }
  
  chrome.storage.local.get(["todos"], (result) => {
    const todos = result.todos || [];
    const filteredTodos = todos.filter(t => t.id !== id);
    chrome.storage.local.set({ todos: filteredTodos }, () => {
      setTimeout(() => {
        loadTodos();
        showCopyFeedback('Todo deleted successfully');
      }, 300);
    });
  });
}

function displayTodos(todos) {
  const container = document.getElementById('todos-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Apply date filter first - include todos without date field (legacy todos)
  let dateFilteredTodos = todos.filter(todo => 
    todo.date === currentViewDate || 
    (!todo.date && currentViewDate === getCurrentDateString())
  );
  
  // Apply priority filter
  let filteredTodos = dateFilteredTodos;
  if (currentPriorityFilter && currentPriorityFilter !== 'all') {
    filteredTodos = dateFilteredTodos.filter(todo => todo.priority === currentPriorityFilter);
  }
  
  // Update stats with filtered todos
  updateTodoStats(filteredTodos);
  
  if (filteredTodos.length === 0) {
    const message = currentPriorityFilter === 'all' 
      ? `No todos for ${formatDateString(currentViewDate)}` 
      : `No ${currentPriorityFilter} priority todos for ${formatDateString(currentViewDate)}`;
    const subMessage = currentPriorityFilter === 'all'
      ? 'Add a task for this date or navigate to another day'
      : 'Try a different priority filter or add new todos';
    
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
        <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
        <div style="font-family: var(--font-primary); font-size: 18px; font-weight: 600; margin-bottom: 8px;">${message}</div>
        <div style="font-family: var(--font-primary); font-size: 14px; opacity: 0.8;">${subMessage}</div>
      </div>
    `;
    return;
  }
  
  // Sort todos: by priority first, then by completion status
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortedTodos = [...filteredTodos].sort((a, b) => {
    // First sort by completion status (incomplete first)
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    
    // Then sort by priority (urgent first)
    const aPriority = priorityOrder[a.priority] ?? priorityOrder.medium;
    const bPriority = priorityOrder[b.priority] ?? priorityOrder.medium;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // Finally sort by creation date (newest first)
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  
  sortedTodos.forEach(todo => {
    const todoItem = createTodoItem(todo);
    container.appendChild(todoItem);
  });
}

function updateTodoStats(todos) {
  const totalTodos = todos.length;
  const completedTodos = todos.filter(todo => todo.completed).length;
  const pendingTodos = totalTodos - completedTodos;
  
  const totalElement = document.getElementById('total-todos');
  const completedElement = document.getElementById('completed-todos');
  const pendingElement = document.getElementById('pending-todos');
  
  if (totalElement) totalElement.textContent = totalTodos;
  if (completedElement) completedElement.textContent = completedTodos;
  if (pendingElement) pendingElement.textContent = pendingTodos;
}

function createTodoItem(todo) {
  const item = document.createElement('div');
  item.className = `todo-item ${todo.completed ? 'completed' : ''}`;
  item.dataset.id = todo.id;
  
  
  // Add drag handle
  const dragHandle = document.createElement('div');
  dragHandle.className = 'todo-drag-handle';
  dragHandle.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  `;
  dragHandle.title = 'Drag to reorder';
  dragHandle.draggable = true;
  
  // Add drag and drop event listeners
  dragHandle.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', todo.id);
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  
  dragHandle.addEventListener('dragend', (e) => {
    item.classList.remove('dragging');
    // Remove all drop indicators
    document.querySelectorAll('.todo-item').forEach(el => {
      el.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    });
  });
  
  item.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const rect = item.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    
    // Remove previous indicators
    document.querySelectorAll('.todo-item').forEach(el => {
      el.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    
    if (e.clientY < midpoint) {
      item.classList.add('drag-over-top');
    } else {
      item.classList.add('drag-over-bottom');
    }
  });
  
  item.addEventListener('dragleave', (e) => {
    if (!item.contains(e.relatedTarget)) {
      item.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
    }
  });
  
  item.addEventListener('drop', (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    
    if (draggedId === todo.id) return; // Can't drop on itself
    
    const draggedItem = document.querySelector(`[data-id="${draggedId}"]`);
    if (!draggedItem) return;
    
    const isDropAbove = item.classList.contains('drag-over-top');
    const container = item.parentNode;
    
    if (isDropAbove) {
      container.insertBefore(draggedItem, item);
    } else {
      container.insertBefore(draggedItem, item.nextSibling);
    }
    
    // Save new order
    saveTodoOrder();
    
    // Clean up
    item.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
  });
  
  const text = document.createElement('div');
  text.className = 'todo-text';
  text.textContent = todo.text;
  text.addEventListener('click', () => {
    editTodo(todo.id, todo.text);
  });
  
  // Add priority class to the todo item itself
  item.classList.add(`priority-${todo.priority || 'medium'}`);
  
  // Add date display if not today
  if (todo.date && todo.date !== getCurrentDateString()) {
    const dateDisplay = document.createElement('div');
    dateDisplay.className = 'todo-date-display';
    dateDisplay.textContent = formatDateString(todo.date);
    dateDisplay.title = `Scheduled for ${todo.date}`;
    item.appendChild(dateDisplay);
  }
  
  // Add rollover indicators
  if (todo.isRolledOver) {
    const rolloverBadge = document.createElement('div');
    rolloverBadge.className = 'todo-rollover-badge';
    rolloverBadge.innerHTML = '→ Rolled Over';
    rolloverBadge.title = 'This task was moved to a later date';
    item.appendChild(rolloverBadge);
    item.classList.add('rolled-over-task');
  }

  if (todo.rolledOverFrom) {
    const fromBadge = document.createElement('div');
    fromBadge.className = 'todo-from-badge';
    fromBadge.innerHTML = `📅 From ${formatDateString(todo.rolledOverFrom)}`;
    fromBadge.title = `Originally scheduled for ${todo.rolledOverFrom}`;
    item.appendChild(fromBadge);
    item.classList.add('rolled-over-from-task');
  }
  
  const actions = document.createElement('div');
  actions.className = 'todo-actions';
  
  const editBtn = document.createElement('button');
  editBtn.className = 'edit-todo-btn';
  
  // Update title and styling based on task type
  if (todo.isRolledOver) {
    editBtn.title = 'Edit this rolled-over task (only affects this day)';
    editBtn.style.opacity = '0.7';
  } else if (todo.rolledOverFrom) {
    editBtn.title = 'Edit this task (only affects this day)';
  } else {
    editBtn.title = 'Edit todo (Click to edit)';
  }
  
  editBtn.setAttribute('aria-label', 'Edit todo');
  editBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  `;
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    editBtn.classList.add('loading');
    setTimeout(() => {
      editBtn.classList.remove('loading');
      editTodo(todo.id, todo.text);
    }, 150);
  });
  
  // Add keyboard support for edit button
  editBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      editTodo(todo.id, todo.text);
    }
  });
  
  const doneBtn = document.createElement('button');
  doneBtn.className = `done-todo-btn ${todo.completed ? 'undone' : ''}`;
  
  // Update title based on task type
  if (todo.isRolledOver) {
    doneBtn.title = todo.completed ? 'Mark as pending (only affects this day)' : 'Mark as done (only affects this day)';
  } else if (todo.rolledOverFrom) {
    doneBtn.title = todo.completed ? 'Mark as pending (only affects this day)' : 'Mark as done (only affects this day)';
  } else {
    doneBtn.title = todo.completed ? 'Mark as pending' : 'Mark as done';
  }
  
  doneBtn.setAttribute('aria-label', todo.completed ? 'Mark as pending' : 'Mark as done');
  doneBtn.innerHTML = todo.completed ? `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 6L6 18"></path>
      <path d="M6 6l12 12"></path>
    </svg>
  ` : `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6L9 17l-5-5"></path>
    </svg>
  `;
  doneBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    doneBtn.classList.add('loading');
    setTimeout(() => {
      doneBtn.classList.remove('loading');
      updateTodo(todo.id, { completed: !todo.completed });
    }, 150);
  });
  
  // Add keyboard support for done button
  doneBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      updateTodo(todo.id, { completed: !todo.completed });
    }
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-todo-btn';
  
  // Update title and styling based on task type
  if (todo.isRolledOver) {
    deleteBtn.title = 'Delete this rolled-over task (only affects this day)';
    deleteBtn.style.opacity = '0.7';
  } else if (todo.rolledOverFrom) {
    deleteBtn.title = 'Delete this task (only affects this day)';
  } else {
    deleteBtn.title = 'Delete todo (Permanent)';
  }
  
  deleteBtn.setAttribute('aria-label', 'Delete todo');
  deleteBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"></path>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
  `;
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteBtn.classList.add('loading');
    setTimeout(() => {
      deleteBtn.classList.remove('loading');
      if (confirm('Are you sure you want to delete this todo? This action cannot be undone.')) {
        deleteTodo(todo.id);
      }
    }, 150);
  });
  
  // Add keyboard support for delete button
  deleteBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this todo? This action cannot be undone.')) {
        deleteTodo(todo.id);
      }
    }
  });
  
  actions.appendChild(doneBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  
  item.appendChild(dragHandle);
  item.appendChild(text);
  item.appendChild(actions);
  
  return item;
}

function editTodo(id, currentText) {
  // Create a better inline editing experience
  const todoItem = document.querySelector(`[data-id="${id}"]`);
  if (!todoItem) return;
  
  const textElement = todoItem.querySelector('.todo-text');
  const originalText = textElement.textContent;
  
  // Create input element
  const input = document.createElement('input');
  input.type = 'text';
  input.value = originalText;
  input.className = 'todo-edit-input';
  input.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 2px solid var(--primary-green);
    border-radius: 6px;
    font-family: var(--font-primary);
    font-size: var(--font-size-medium);
    background: white;
    color: var(--text-primary);
    outline: none;
  `;
  
  // Replace text with input
  textElement.style.display = 'none';
  textElement.parentNode.insertBefore(input, textElement);
  input.focus();
  input.select();
  
  const finishEdit = () => {
    const newText = input.value.trim();
    if (newText && newText !== originalText) {
      updateTodo(id, { text: newText });
    }
    textElement.style.display = 'block';
    input.remove();
  };
  
  const cancelEdit = () => {
    textElement.style.display = 'block';
    input.remove();
  };
  
  // Handle events
  input.addEventListener('blur', finishEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });
}

// Todo Sidebar Event Listeners
const todoSidebar = document.getElementById('todo-sidebar');
const addTodoForm = document.getElementById('add-todo-form');

// Todo sidebar is always visible - load todos on page load
loadTodos();

// Date utility functions
function getCurrentDateString() {
  return new Date().toISOString().split('T')[0];
}

function formatDateString(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (dateString === getCurrentDateString()) {
    return 'Today';
  } else if (dateString === yesterday.toISOString().split('T')[0]) {
    return 'Yesterday';
  } else if (dateString === tomorrow.toISOString().split('T')[0]) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }
}

// Current viewing date
let currentViewDate = getCurrentDateString();

// Priority filtering
let currentPriorityFilter = 'all';

// Add event listeners for priority filters
document.addEventListener('DOMContentLoaded', () => {
  const priorityFilters = document.querySelectorAll('.priority-filter');
  priorityFilters.forEach(filter => {
    filter.addEventListener('click', () => {
      // Remove active class from all filters
      priorityFilters.forEach(f => f.classList.remove('active'));
      // Add active class to clicked filter
      filter.classList.add('active');
      
      // Update current filter
      currentPriorityFilter = filter.dataset.priority;
      
      // Reload todos with new filter
      loadTodos();
    });
  });
});

// Handle todo form submission
addTodoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = document.getElementById('todo-text').value;
  const priority = document.getElementById('todo-priority').value;
  const date = document.getElementById('todo-date').value || currentViewDate;
  if (text && text.trim() !== '') {
    saveTodo({ text: text.trim(), priority: priority, date: date });
    addTodoForm.reset();
    document.getElementById('todo-priority').value = 'medium'; // Reset to default
    document.getElementById('todo-date').value = currentViewDate; // Set to current viewing date
    showCopyFeedback('Todo added successfully!');
  }
});

// Settings and Theme Management
function loadSettings() {
  chrome.storage.local.get(['theme', 'editModeEnabled'], (result) => {
    const theme = result.theme || 'default';
    const editModeEnabled = result.editModeEnabled || false;
    
    applyTheme(theme);
    
    // Update theme buttons in dropdown
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.theme === theme) {
        btn.classList.add('active');
      }
    });
    
    // Load edit mode setting
    const editModeToggle = document.getElementById('edit-mode-toggle');
    const editModeToggleBtn = document.getElementById('edit-mode-toggle-btn');
    const editModeLabel = document.querySelector('.edit-mode-label');
    
    if (editModeToggle) {
      editModeToggle.checked = editModeEnabled;
    }
    
    if (editModeToggleBtn && editModeLabel) {
      if (editModeEnabled) {
        document.body.classList.add('edit-mode-enabled');
        editModeToggleBtn.classList.add('edit-mode-active');
        editModeLabel.textContent = 'Edit Mode';
      } else {
        document.body.classList.remove('edit-mode-enabled');
        editModeToggleBtn.classList.remove('edit-mode-active');
        editModeLabel.textContent = 'View Mode';
      }
    }
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  chrome.storage.local.set({ theme });
}

function exportAllData() {
  chrome.storage.local.get(['widgets', 'todos', 'passwords', 'theme', 'editModeEnabled'], (result) => {
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      widgets: result.widgets || [],
      todos: result.todos || [],
      passwords: result.passwords || [],
      theme: result.theme || 'default',
      editModeEnabled: result.editModeEnabled || false
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `link-management-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showCopyFeedback('Data exported successfully!');
  });
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const importData = JSON.parse(e.target.result);
      
      if (!importData.version || !importData.widgets || !importData.todos || !importData.passwords) {
        throw new Error('Invalid backup file format');
      }
      
      // Confirm import
      if (confirm('This will replace all your current data. Are you sure you want to continue?')) {
        const dataToStore = {
          widgets: importData.widgets,
          todos: importData.todos,
          passwords: importData.passwords
        };
        
        // Include theme and edit mode if available
        if (importData.theme) {
          dataToStore.theme = importData.theme;
        }
        if (importData.editModeEnabled !== undefined) {
          dataToStore.editModeEnabled = importData.editModeEnabled;
        }
        
        chrome.storage.local.set(dataToStore, () => {
          // Reload all data
          loadWidgets();
          loadTodos();
          loadPasswords();
          loadSettings();
          showCopyFeedback('Data imported successfully!');
        });
      }
    } catch (error) {
      showCopyFeedback('Error: Invalid backup file');
      console.error('Import error:', error);
    }
  };
  reader.readAsText(file);
}

// Settings Modal Event Listeners
const exportDataBtn = document.getElementById('export-data-btn');
const importDataBtn = document.getElementById('import-data-btn');
const importFileInput = document.getElementById('import-file-input');

// Old settings modal code removed - now using dropdown

// Old modal event listeners removed - now using dropdown

// Theme switching
document.addEventListener('change', (e) => {
  if (e.target.name === 'theme') {
    applyTheme(e.target.value);
  }
});

// Export data
exportDataBtn.addEventListener('click', exportAllData);

// Import data
importDataBtn.addEventListener('click', () => {
  importFileInput.click();
});

importFileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    importData(e.target.files[0]);
  }
});

// Rollover history button
const viewRolloverHistoryBtn = document.getElementById('view-rollover-history');
if (viewRolloverHistoryBtn) {
  viewRolloverHistoryBtn.addEventListener('click', () => {
    showRolloverHistory();
    // Close settings dropdown after opening history
    const settingsDropdown = document.getElementById('settings-dropdown');
    if (settingsDropdown) {
      settingsDropdown.classList.remove('show');
    }
  });
}

// Make functions globally available
window.deleteTodo = deleteTodo;
window.editTodo = editTodo;
window.editWidget = editWidget;

// Initialize widgets on page load
loadWidgets();
loadSettings();

// Initialize collaborative features
initializeCollaborativeFeatures();

// Automatic rollover functionality
function checkAndRolloverIncompleteTasks() {
  chrome.storage.local.get(['todos', 'lastRolloverDate'], (result) => {
    const todos = result.todos || [];
    const lastRolloverDate = result.lastRolloverDate || getCurrentDateString();
    const today = getCurrentDateString();
    
    // Only run rollover once per day
    if (lastRolloverDate !== today) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayString = yesterday.toISOString().split('T')[0];
      
      // Find incomplete tasks from yesterday (including legacy todos without date)
      const incompleteTasks = todos.filter(todo => 
        (todo.date === yesterdayString || (!todo.date && yesterdayString === getCurrentDateString())) && !todo.completed
      );
      
      if (incompleteTasks.length > 0) {
        // Create copies for today and mark originals as rolled over
        const newTodos = [...todos];
        const rolledOverTodos = [];
        
        incompleteTasks.forEach(todo => {
          // Mark original as rolled over
          const originalIndex = newTodos.findIndex(t => t.id === todo.id);
          if (originalIndex !== -1) {
            newTodos[originalIndex] = { 
              ...newTodos[originalIndex], 
              isRolledOver: true 
            };
          }
          
          // Create new copy for today
          const newTodo = {
            ...todo,
            id: Date.now().toString() + Math.random(),
            date: today,
            rolledOverFrom: todo.date,
            isRolledOver: false
          };
          rolledOverTodos.push(newTodo);
        });
        
        chrome.storage.local.set({ 
          todos: [...newTodos, ...rolledOverTodos], 
          lastRolloverDate: today 
        }, () => {
          console.log(`Rolled over ${incompleteTasks.length} incomplete tasks to today`);
          showCopyFeedback(`Rolled over ${incompleteTasks.length} incomplete tasks to today`);
        });
      } else {
        // Just update the rollover date
        chrome.storage.local.set({ lastRolloverDate: today });
      }
    }
  });
}

// Run rollover check on page load
checkAndRolloverIncompleteTasks();

// Migrate legacy todos to have dates
function migrateLegacyTodos() {
  chrome.storage.local.get(['todos', 'todosMigrated'], (result) => {
    const todos = result.todos || [];
    const todosMigrated = result.todosMigrated || false;
    
    if (!todosMigrated && todos.length > 0) {
      // Check if any todos are missing the date field
      const needsMigration = todos.some(todo => !todo.date);
      
      if (needsMigration) {
        const migratedTodos = todos.map(todo => {
          if (!todo.date) {
            return { ...todo, date: getCurrentDateString() };
          }
          return todo;
        });
        
        chrome.storage.local.set({ 
          todos: migratedTodos, 
          todosMigrated: true 
        }, () => {
          console.log('Migrated legacy todos to include dates');
          loadTodos();
        });
      } else {
        chrome.storage.local.set({ todosMigrated: true });
      }
    }
  });
}

// Run migration on page load
migrateLegacyTodos();

// Rollover history functionality
function showRolloverHistory() {
  chrome.storage.local.get(['todos'], (result) => {
    const todos = result.todos || [];
    const rolledOverTasks = todos.filter(todo => todo.isRolledOver || todo.rolledOverFrom);
    
    if (rolledOverTasks.length === 0) {
      showCopyFeedback('No rollover history found');
      return;
    }
    
    // Group by date
    const groupedByDate = {};
    rolledOverTasks.forEach(todo => {
      const date = todo.isRolledOver ? todo.date : todo.rolledOverFrom;
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push(todo);
    });
    
    // Create history modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px; max-height: 80vh;">
        <div class="modal-header">
          <h2>📋 Rollover History</h2>
          <button class="close-modal-btn">&times;</button>
        </div>
        <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
          ${Object.keys(groupedByDate).map(date => `
            <div class="history-date-group">
              <h3>${formatDateString(date)}</h3>
              <div class="history-tasks">
                ${groupedByDate[date].map(todo => `
                  <div class="history-task ${todo.isRolledOver ? 'rolled-over' : 'rolled-from'}">
                    <div class="task-info">
                      <span class="task-text">${todo.text}</span>
                      <span class="task-priority priority-${todo.priority}">${todo.priority}</span>
                    </div>
                    <div class="task-status">
                      ${todo.isRolledOver ? 
                        `<span class="status-badge rolled-over">→ Rolled Over</span>` : 
                        `<span class="status-badge rolled-from">📅 From ${formatDateString(todo.rolledOverFrom)}</span>`
                      }
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal functionality
    const closeBtn = modal.querySelector('.close-modal-btn');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  });
}

// Date Navigation Functionality
function updateDateDisplay() {
  const currentDateText = document.getElementById('current-date-text');
  const datePicker = document.getElementById('date-picker');
  const todoDateInput = document.getElementById('todo-date');
  
  if (currentDateText) {
    currentDateText.textContent = formatDateString(currentViewDate);
  }
  if (datePicker) {
    datePicker.value = currentViewDate;
  }
  if (todoDateInput) {
    todoDateInput.value = currentViewDate;
  }
}

function navigateToDate(dateString) {
  currentViewDate = dateString;
  updateDateDisplay();
  loadTodos();
}

// Date navigation event listeners
document.addEventListener('DOMContentLoaded', () => {
  const prevDateBtn = document.getElementById('prev-date-btn');
  const nextDateBtn = document.getElementById('next-date-btn');
  const datePicker = document.getElementById('date-picker');
  
  if (prevDateBtn) {
    prevDateBtn.addEventListener('click', () => {
      const currentDate = new Date(currentViewDate);
      currentDate.setDate(currentDate.getDate() - 1);
      navigateToDate(currentDate.toISOString().split('T')[0]);
    });
  }
  
  if (nextDateBtn) {
    nextDateBtn.addEventListener('click', () => {
      const currentDate = new Date(currentViewDate);
      currentDate.setDate(currentDate.getDate() + 1);
      navigateToDate(currentDate.toISOString().split('T')[0]);
    });
  }
  
  if (datePicker) {
    datePicker.addEventListener('change', (e) => {
      navigateToDate(e.target.value);
    });
  }
  
  // Rollover buttons
  const rolloverNextBtn = document.getElementById('rollover-next-btn');
  const rolloverPrevBtn = document.getElementById('rollover-prev-btn');
  
  if (rolloverNextBtn) {
    rolloverNextBtn.addEventListener('click', () => {
      const nextDay = new Date(currentViewDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayString = nextDay.toISOString().split('T')[0];
      
      chrome.storage.local.get(['todos'], (result) => {
        const todos = result.todos || [];
        const incompleteTasks = todos.filter(todo => 
          (todo.date === currentViewDate || (!todo.date && currentViewDate === getCurrentDateString())) && !todo.completed
        );
        
        if (incompleteTasks.length > 0) {
          const newTodos = [...todos];
          const rolledOverTodos = [];
          
          incompleteTasks.forEach(todo => {
            // Mark original as rolled over
            const originalIndex = newTodos.findIndex(t => t.id === todo.id);
            if (originalIndex !== -1) {
              newTodos[originalIndex] = { 
                ...newTodos[originalIndex], 
                isRolledOver: true 
              };
            }
            
            // Create new copy for next day
            const newTodo = {
              ...todo,
              id: Date.now().toString() + Math.random(),
              date: nextDayString,
              rolledOverFrom: todo.date,
              isRolledOver: false
            };
            rolledOverTodos.push(newTodo);
          });
          
          chrome.storage.local.set({ todos: [...newTodos, ...rolledOverTodos] }, () => {
            showCopyFeedback(`Moved ${incompleteTasks.length} incomplete tasks to ${formatDateString(nextDayString)}`);
            loadTodos();
          });
        } else {
          showCopyFeedback('No incomplete tasks to move');
        }
      });
    });
  }
  
  if (rolloverPrevBtn) {
    rolloverPrevBtn.addEventListener('click', () => {
      const prevDay = new Date(currentViewDate);
      prevDay.setDate(prevDay.getDate() - 1);
      const prevDayString = prevDay.toISOString().split('T')[0];
      
      chrome.storage.local.get(['todos'], (result) => {
        const todos = result.todos || [];
        const incompleteTasks = todos.filter(todo => 
          (todo.date === currentViewDate || (!todo.date && currentViewDate === getCurrentDateString())) && !todo.completed
        );
        
        if (incompleteTasks.length > 0) {
          const newTodos = [...todos];
          const rolledOverTodos = [];
          
          incompleteTasks.forEach(todo => {
            // Mark original as rolled over
            const originalIndex = newTodos.findIndex(t => t.id === todo.id);
            if (originalIndex !== -1) {
              newTodos[originalIndex] = { 
                ...newTodos[originalIndex], 
                isRolledOver: true 
              };
            }
            
            // Create new copy for previous day
            const newTodo = {
              ...todo,
              id: Date.now().toString() + Math.random(),
              date: prevDayString,
              rolledOverFrom: todo.date,
              isRolledOver: false
            };
            rolledOverTodos.push(newTodo);
          });
          
          chrome.storage.local.set({ todos: [...newTodos, ...rolledOverTodos] }, () => {
            showCopyFeedback(`Moved ${incompleteTasks.length} incomplete tasks to ${formatDateString(prevDayString)}`);
            loadTodos();
          });
        } else {
          showCopyFeedback('No incomplete tasks to move');
        }
      });
    });
  }
  
  
  // Initialize date display
  updateDateDisplay();
});

// Settings Dropdown Functionality
const settingsDropdown = document.getElementById('settings-dropdown');

// Toggle dropdown
const settingsBtn = document.getElementById('settings-btn');
if (settingsBtn && settingsDropdown) {
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsDropdown.classList.toggle('show');
  });
}

// Close dropdown
const closeSettingsBtn = document.getElementById('close-settings-btn');
if (closeSettingsBtn && settingsDropdown) {
  closeSettingsBtn.addEventListener('click', () => {
    settingsDropdown.classList.remove('show');
  });
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (settingsDropdown && !settingsDropdown.contains(e.target) && !settingsBtn.contains(e.target)) {
    settingsDropdown.classList.remove('show');
  }
});

// Theme selection
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('theme-btn')) {
    const theme = e.target.dataset.theme;
    
    // Update active button
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // Apply theme
    applyTheme(theme);
    showCopyFeedback(`Theme changed to ${theme}`);
  }
});

// Edit mode toggle in dropdown
const editModeToggleDropdown = document.getElementById('edit-mode-toggle');
if (editModeToggleDropdown) {
  editModeToggleDropdown.addEventListener('change', (e) => {
    const isEnabled = e.target.checked;
    
    if (isEnabled) {
      document.body.classList.add('edit-mode-enabled');
      document.getElementById('edit-mode-toggle-btn').classList.add('edit-mode-active');
      document.querySelector('.edit-mode-label').textContent = 'Edit Mode';
    } else {
      document.body.classList.remove('edit-mode-enabled');
      document.getElementById('edit-mode-toggle-btn').classList.remove('edit-mode-active');
      document.querySelector('.edit-mode-label').textContent = 'View Mode';
    }
    
    chrome.storage.local.set({ editModeEnabled: isEnabled });
    showCopyFeedback(isEnabled ? 'Edit mode enabled' : 'View mode enabled');
  });
}

// Edit Mode Toggle (New prominent button)
const editModeToggleBtn = document.getElementById('edit-mode-toggle-btn');
const editModeLabel = document.querySelector('.edit-mode-label');

if (editModeToggleBtn) {
  editModeToggleBtn.addEventListener('click', () => {
    const isCurrentlyEnabled = document.body.classList.contains('edit-mode-enabled');
    const newState = !isCurrentlyEnabled;
    
    // Toggle edit mode class on body
    if (newState) {
      document.body.classList.add('edit-mode-enabled');
      editModeToggleBtn.classList.add('edit-mode-active');
      editModeLabel.textContent = 'Edit Mode';
    } else {
      document.body.classList.remove('edit-mode-enabled');
      editModeToggleBtn.classList.remove('edit-mode-active');
      editModeLabel.textContent = 'View Mode';
    }
    
    // Save edit mode setting
    chrome.storage.local.set({ editModeEnabled: newState });
    
    // Show feedback
    showCopyFeedback(newState ? 'Edit mode enabled' : 'View mode enabled');
  });
}

// Edit Mode Toggle (Settings checkbox - keep for backward compatibility)
const editModeToggle = document.getElementById('edit-mode-toggle');
if (editModeToggle) {
  editModeToggle.addEventListener('change', (e) => {
    const isEditModeEnabled = e.target.checked;
    
    // Toggle edit mode class on body
    if (isEditModeEnabled) {
      document.body.classList.add('edit-mode-enabled');
      if (editModeToggleBtn) {
        editModeToggleBtn.classList.add('edit-mode-active');
        editModeLabel.textContent = 'Edit Mode';
      }
    } else {
      document.body.classList.remove('edit-mode-enabled');
      if (editModeToggleBtn) {
        editModeToggleBtn.classList.remove('edit-mode-active');
        editModeLabel.textContent = 'View Mode';
      }
    }
    
    // Save edit mode setting
    chrome.storage.local.set({ editModeEnabled: isEditModeEnabled });
  });
}

// Window Resize Handler for Desktop Responsive Design
let resizeTimeout;
function handleWindowResize() {
  // Debounce resize events for better performance
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    // Get all widgets and check if they're still within bounds
    const widgets = document.querySelectorAll('.link-widget');
    const mainContainer = document.querySelector('.MainForLinkPage');
    
    if (mainContainer) {
      const containerRect = mainContainer.getBoundingClientRect();
      
      widgets.forEach(widget => {
        const widgetRect = widget.getBoundingClientRect();
        
        // Check if widget is outside the main container bounds
        if (widgetRect.right > containerRect.right || 
            widgetRect.bottom > containerRect.bottom ||
            widgetRect.left < containerRect.left ||
            widgetRect.top < containerRect.top) {
          
          // Reposition widget to be within bounds
          let newX = parseInt(widget.style.left);
          let newY = parseInt(widget.style.top);
          
          // Constrain to container bounds
          newX = Math.max(containerRect.left, Math.min(newX, containerRect.right - widgetRect.width));
          newY = Math.max(containerRect.top, Math.min(newY, containerRect.bottom - widgetRect.height));
          
          widget.style.left = `${newX}px`;
          widget.style.top = `${newY}px`;
          
          // Update stored position
          const widgetId = widget.dataset.id;
          if (widgetId) {
            updateWidgetPosition(widgetId, newX, newY);
          }
        }
      });
    }
  }, 150); // 150ms debounce
}

// Add resize event listener
window.addEventListener('resize', handleWindowResize);

// Collaborative Features Initialization
function initializeCollaborativeFeatures() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupCollaborativeFeatures);
  } else {
    setupCollaborativeFeatures();
  }
}

function setupCollaborativeFeatures() {
  const collaborativeSidebar = document.getElementById('collaborative-sidebar');
  const toggleCollaborativeBtn = document.getElementById('toggle-collaborative-btn');
  const collaborativeToggleIcon = document.getElementById('collaborative-toggle-icon');
  const collaborativeTextarea = document.getElementById('collaborative-textarea');
  const roomIdInput = document.getElementById('room-id-input');
  const joinRoomBtn = document.getElementById('join-room-btn');
  const clearTextBtn = document.getElementById('clear-text-btn');
  
  if (!collaborativeSidebar || !toggleCollaborativeBtn || !collaborativeToggleIcon || !collaborativeTextarea) {
    console.error('Collaborative elements not found');
    return;
  }
  
  // Initialize sidebar as collapsed by default
  collaborativeSidebar.classList.add('collapsed');
  
  // Function to open sidebar
  const openSidebar = () => {
    collaborativeSidebar.classList.remove('collapsed');
    collaborativeSidebar.classList.add('open');
    collaborativeToggleIcon.classList.add('hidden');
    
    // Initialize sync engine when sidebar is first opened
    if (window.collaborativeSyncEngine) {
      window.collaborativeSyncEngine.setTextarea(collaborativeTextarea);
    }
  };
  
  // Function to close sidebar
  const closeSidebar = () => {
    collaborativeSidebar.classList.add('collapsed');
    collaborativeSidebar.classList.remove('open');
    collaborativeToggleIcon.classList.remove('hidden');
  };
  
  // Toggle icon click - open sidebar
  collaborativeToggleIcon.addEventListener('click', openSidebar);
  
  // Close button click - close sidebar
  toggleCollaborativeBtn.addEventListener('click', closeSidebar);
  
  // Room management
  if (joinRoomBtn && roomIdInput) {
    joinRoomBtn.addEventListener('click', () => {
      const roomId = roomIdInput.value.trim();
      if (window.collaborativePeerManager) {
        window.collaborativePeerManager.setRoomId(roomId);
        showCopyFeedback(`Joined room: ${roomId || 'default'}`);
      }
    });
    
    // Allow Enter key to join room
    roomIdInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        joinRoomBtn.click();
      }
    });
  }
  
  // Clear text functionality
  if (clearTextBtn) {
    clearTextBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all text? This will clear text for all users in the room.')) {
        if (window.collaborativeSyncEngine) {
          window.collaborativeSyncEngine.clearText();
          showCopyFeedback('Text cleared for all users');
        }
      }
    });
  }
  
  // Click outside to close sidebar
  document.addEventListener('click', (e) => {
    if (!collaborativeSidebar.classList.contains('collapsed') && 
        !collaborativeSidebar.contains(e.target) && 
        !collaborativeToggleIcon.contains(e.target)) {
      closeSidebar();
    }
  });
  
  // Keyboard shortcuts for collaborative features
  document.addEventListener('keydown', (e) => {
    // Escape key - close sidebar
    if (e.key === 'Escape' && !collaborativeSidebar.classList.contains('collapsed')) {
      closeSidebar();
      return;
    }
    
    // Ctrl+Shift+C - Toggle collaborative sidebar
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      if (collaborativeSidebar.classList.contains('collapsed')) {
        openSidebar();
      } else {
        closeSidebar();
      }
    }
    
    // Ctrl+Shift+R - Focus room input
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      if (roomIdInput && !collaborativeSidebar.classList.contains('collapsed')) {
        roomIdInput.focus();
      }
    }
  });
  
  console.log('Collaborative features initialized');
}

// Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
  // Prevent shortcuts when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }
  
  // Ctrl+N - Add new widget
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault();
    document.getElementById('add-widget-btn').click();
  }
  
  // Ctrl+P - Add password
  if (e.ctrlKey && e.key === 'p' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('add-password-btn').click();
  }
  
  // Ctrl+Shift+P - View passwords
  if (e.ctrlKey && e.shiftKey && e.key === 'P') {
    e.preventDefault();
    document.getElementById('view-passwords-btn').click();
  }
  
  // Ctrl+, - Open settings
  if (e.ctrlKey && e.key === ',') {
    e.preventDefault();
    document.getElementById('settings-btn').click();
  }
  
  // Ctrl+F - Focus search
  if (e.ctrlKey && e.key === 'f') {
    e.preventDefault();
    document.getElementById('search-input').focus();
  }
  
  // E key - Toggle edit mode
  if (e.key === 'e' || e.key === 'E') {
    e.preventDefault();
    document.getElementById('edit-mode-toggle-btn').click();
  }
  
  // Escape - Close modals
  if (e.key === 'Escape') {
    // Close any open modals
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
      if (modal.style.display === 'block') {
        modal.style.display = 'none';
      }
    });
  }
  
  // Delete key - Delete selected widget (when edit mode is on)
  if (e.key === 'Delete' && document.body.classList.contains('edit-mode-enabled')) {
    // This will be implemented with multi-select functionality
    console.log('Delete key pressed - will implement with multi-select');
  }
  
  // Todo-specific shortcuts
  if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    // Ctrl+T - Focus todo input
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault();
      const todoInput = document.getElementById('todo-text');
      if (todoInput) {
        todoInput.focus();
      }
    }
    
    // Ctrl+Shift+T - Toggle first todo completion
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      const firstTodo = document.querySelector('.todo-item:not(.completed)');
      if (firstTodo) {
        const doneBtn = firstTodo.querySelector('.done-todo-btn');
        if (doneBtn) {
          doneBtn.click();
        }
      }
    }
    
    // D key - Toggle completion of focused todo
    if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      const focusedTodo = document.querySelector('.todo-item:hover');
      if (focusedTodo) {
        const doneBtn = focusedTodo.querySelector('.done-todo-btn');
        if (doneBtn) {
          doneBtn.click();
        }
      }
    }
    
    // Ctrl+Arrow Up - Move todo up
    if (e.ctrlKey && e.key === 'ArrowUp') {
      e.preventDefault();
      const focusedTodo = document.querySelector('.todo-item:hover');
      if (focusedTodo) {
        moveTodoUp(focusedTodo);
      }
    }
    
    // Ctrl+Arrow Down - Move todo down
    if (e.ctrlKey && e.key === 'ArrowDown') {
      e.preventDefault();
      const focusedTodo = document.querySelector('.todo-item:hover');
      if (focusedTodo) {
        moveTodoDown(focusedTodo);
      }
    }
  }
});

// Search Functionality
let searchTimeout;
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const searchResultsInfo = document.getElementById('search-results-info');

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    clearTimeout(searchTimeout);
    
    // Show/hide clear button
    if (query.length > 0) {
      clearSearchBtn.classList.add('visible');
    } else {
      clearSearchBtn.classList.remove('visible');
      searchResultsInfo.textContent = '';
      clearSearch();
      return;
    }
    
    // Debounce search
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  });
}

if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.remove('visible');
    searchResultsInfo.textContent = '';
    clearSearch();
  });
}

function performSearch(query) {
  if (!query) {
    clearSearch();
    return;
  }
  
  const searchTerm = query.toLowerCase().trim();
  const widgets = document.querySelectorAll('.link-widget');
  const todos = document.querySelectorAll('.todo-item');
  let widgetMatches = 0;
  let todoMatches = 0;
  
  // Search widgets
  widgets.forEach(widget => {
    const title = widget.querySelector('.link-widget-link')?.textContent.toLowerCase() || '';
    const url = widget.querySelector('.link-widget-link')?.href?.toLowerCase() || '';
    const matches = title.includes(searchTerm) || url.includes(searchTerm);
    
    if (matches) {
      widgetMatches++;
      widget.style.display = 'block';
      widget.style.visibility = 'visible';
      widget.classList.add('search-highlight');
    } else {
      widget.style.display = 'none';
      widget.style.visibility = 'hidden';
      widget.classList.remove('search-highlight');
    }
  });
  
  // Search todos with better matching
  todos.forEach(todo => {
    const text = todo.querySelector('.todo-text')?.textContent.toLowerCase() || '';
    const matches = text.includes(searchTerm);
    
    if (matches) {
      todoMatches++;
      todo.style.display = 'flex';
      todo.style.visibility = 'visible';
      todo.classList.add('search-highlight');
    } else {
      todo.style.display = 'none';
      todo.style.visibility = 'hidden';
      todo.classList.remove('search-highlight');
    }
  });
  
  // Update results info
  const totalMatches = widgetMatches + todoMatches;
  if (totalMatches > 0) {
    searchResultsInfo.textContent = `Found ${totalMatches} result${totalMatches !== 1 ? 's' : ''} (${widgetMatches} links, ${todoMatches} todos)`;
    searchResultsInfo.classList.add('highlight');
    
    // Remove any existing no-results messages
    const noResultsMessage = document.querySelector('.no-results-message');
    if (noResultsMessage) {
      noResultsMessage.remove();
    }
  } else {
    searchResultsInfo.textContent = 'No results found';
    searchResultsInfo.classList.remove('highlight');
    
    // Show "no results" message in containers
    const todosContainer = document.getElementById('todos-list');
    const mainContainer = document.querySelector('.MainForLinkPage');
    
    if (todosContainer && todosContainer.children.length === 0) {
      todosContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
          <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
          <div style="font-family: var(--font-primary); font-size: 18px; font-weight: 600; margin-bottom: 8px;">No todos found</div>
          <div style="font-family: var(--font-primary); font-size: 14px; opacity: 0.8;">Try a different search term</div>
        </div>
      `;
    }
    
    if (mainContainer && mainContainer.querySelectorAll('.link-widget:not([style*="display: none"])').length === 0) {
      // Add no results message for widgets if needed
      const existingNoResults = mainContainer.querySelector('.no-results-message');
      if (!existingNoResults) {
        const noResultsDiv = document.createElement('div');
        noResultsDiv.className = 'no-results-message';
        noResultsDiv.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
          color: var(--text-secondary);
          font-family: var(--font-primary);
          z-index: 1;
        `;
        noResultsDiv.innerHTML = `
          <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No links found</div>
          <div style="font-size: 14px; opacity: 0.8;">Try a different search term</div>
        `;
        mainContainer.appendChild(noResultsDiv);
      }
    }
  }
}

function clearSearch() {
  // Show all widgets
  const widgets = document.querySelectorAll('.link-widget');
  widgets.forEach(widget => {
    widget.style.display = 'block';
    widget.style.visibility = 'visible';
    widget.classList.remove('search-highlight');
  });
  
  // Show all todos
  const todos = document.querySelectorAll('.todo-item');
  todos.forEach(todo => {
    todo.style.display = 'flex';
    todo.style.visibility = 'visible';
    todo.classList.remove('search-highlight');
  });
  
  // Remove no-results messages
  const noResultsMessage = document.querySelector('.no-results-message');
  if (noResultsMessage) {
    noResultsMessage.remove();
  }
  
  // Restore original todo list if it was replaced
  const todosContainer = document.getElementById('todos-list');
  if (todosContainer && todosContainer.querySelector('.no-results-message')) {
    // Reload todos from storage
    chrome.storage.local.get(['todos'], (result) => {
      displayTodos(result.todos || []);
    });
  }
}
