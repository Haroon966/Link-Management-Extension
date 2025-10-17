let isDragging = false;
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

  const closeBtn = document.createElement("span");
  closeBtn.className = "link-widget-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => removeWidget(widget.id, container);

  container.appendChild(favicon);
  container.appendChild(link);
  container.appendChild(closeBtn);
  document.getElementById("widget-container").appendChild(container);

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
  copyUsernameBtn.textContent = 'Copy Username';
  copyUsernameBtn.addEventListener('click', () => {
    copyToClipboard(password.username, 'Username');
  });
  
  // Create copy password button
  const copyPasswordBtn = document.createElement('button');
  copyPasswordBtn.className = 'copy-password-btn';
  copyPasswordBtn.textContent = 'Copy Password';
  copyPasswordBtn.addEventListener('click', () => {
    copyToClipboard(password.password, 'Password');
  });
  
  // Create edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'edit-password-btn';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => {
    editPassword(password.id);
  });
  
  // Create delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-password-btn';
  deleteBtn.textContent = 'Delete';
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
    toggleVisibilityBtn.textContent = '🙈';
  } else {
    passwordInput.type = 'password';
    toggleVisibilityBtn.textContent = '👁️';
  }
});

// Edit password visibility toggle
toggleEditVisibilityBtn.addEventListener('click', () => {
  const passwordInput = document.getElementById('edit-password-password');
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleEditVisibilityBtn.textContent = '🙈';
  } else {
    passwordInput.type = 'password';
    toggleEditVisibilityBtn.textContent = '👁️';
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

// Initialize widgets on page load
loadWidgets();
