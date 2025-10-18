/**
 * Text Synchronization Engine for Collaborative Textarea
 * Handles operational transformation, cursor tracking, and conflict resolution
 */

class CollaborativeSyncEngine {
  constructor() {
    this.textarea = null;
    this.currentText = '';
    this.operations = [];
    this.remoteCursors = new Map();
    this.isApplyingRemoteChange = false;
    this.lastCursorPosition = 0;
    this.cursorUpdateTimeout = null;
    
    // Debounce settings
    this.TEXT_CHANGE_DEBOUNCE = 100; // ms
    this.CURSOR_UPDATE_DEBOUNCE = 50; // ms
    
    this.init();
  }
  
  init() {
    this.setupPeerManager();
    this.loadFromStorage();
  }
  
  setupPeerManager() {
    if (window.collaborativePeerManager) {
      // Listen for incoming messages
      window.collaborativePeerManager.onMessage((message) => {
        this.handleIncomingMessage(message);
      });
      
      // Listen for connection changes
      window.collaborativePeerManager.onConnectionChange((isConnected) => {
        this.handleConnectionChange(isConnected);
      });
    }
  }
  
  setTextarea(textarea) {
    this.textarea = textarea;
    this.setupTextareaEvents();
    this.updateTextareaContent();
  }
  
  setupTextareaEvents() {
    if (!this.textarea) return;
    
    // Text change events
    this.textarea.addEventListener('input', (event) => {
      this.handleTextChange(event);
    });
    
    // Cursor position events
    this.textarea.addEventListener('selectionchange', () => {
      this.handleCursorChange();
    });
    
    this.textarea.addEventListener('click', () => {
      this.handleCursorChange();
    });
    
    this.textarea.addEventListener('keyup', () => {
      this.handleCursorChange();
    });
    
    // Paste event
    this.textarea.addEventListener('paste', (event) => {
      setTimeout(() => {
        this.handleTextChange(event);
      }, 10);
    });
  }
  
  handleTextChange(event) {
    if (this.isApplyingRemoteChange) return;
    
    const newText = this.textarea.value;
    const operation = this.calculateOperation(this.currentText, newText);
    
    if (operation) {
      this.currentText = newText;
      this.operations.push({
        ...operation,
        timestamp: Date.now(),
        userId: window.collaborativePeerManager.getUserId()
      });
      
      // Debounce sending the operation
      this.debounce(() => {
        this.sendOperation(operation);
      }, this.TEXT_CHANGE_DEBOUNCE)();
      
      // Save to local storage
      this.saveToStorage();
    }
  }
  
  handleCursorChange() {
    if (!this.textarea || this.isApplyingRemoteChange) return;
    
    const cursorPosition = this.textarea.selectionStart;
    
    if (cursorPosition !== this.lastCursorPosition) {
      this.lastCursorPosition = cursorPosition;
      
      // Debounce cursor updates
      this.debounce(() => {
        this.sendCursorPosition(cursorPosition);
      }, this.CURSOR_UPDATE_DEBOUNCE)();
    }
  }
  
  calculateOperation(oldText, newText) {
    const oldLength = oldText.length;
    const newLength = newText.length;
    
    if (newLength > oldLength) {
      // Insert operation
      const diff = newLength - oldLength;
      let insertPosition = -1;
      
      // Find the position where text was inserted
      for (let i = 0; i <= oldLength; i++) {
        if (oldText.substring(0, i) + newText.substring(i + diff) === oldText) {
          insertPosition = i;
          break;
        }
      }
      
      if (insertPosition !== -1) {
        const insertedText = newText.substring(insertPosition, insertPosition + diff);
        return {
          type: 'insert',
          position: insertPosition,
          content: insertedText
        };
      }
    } else if (newLength < oldLength) {
      // Delete operation
      const diff = oldLength - newLength;
      let deletePosition = -1;
      
      // Find the position where text was deleted
      for (let i = 0; i <= newLength; i++) {
        if (newText.substring(0, i) + oldText.substring(i + diff) === oldText) {
          deletePosition = i;
          break;
        }
      }
      
      if (deletePosition !== -1) {
        return {
          type: 'delete',
          position: deletePosition,
          length: diff
        };
      }
    }
    
    return null;
  }
  
  applyOperation(operation) {
    if (!this.textarea) return;
    
    this.isApplyingRemoteChange = true;
    
    try {
      const currentText = this.textarea.value;
      let newText = currentText;
      
      if (operation.type === 'insert') {
        newText = currentText.substring(0, operation.position) + 
                  operation.content + 
                  currentText.substring(operation.position);
      } else if (operation.type === 'delete') {
        newText = currentText.substring(0, operation.position) + 
                  currentText.substring(operation.position + operation.length);
      }
      
      // Update textarea content
      const cursorPosition = this.textarea.selectionStart;
      this.textarea.value = newText;
      this.currentText = newText;
      
      // Restore cursor position if it was affected
      if (operation.type === 'insert' && operation.position <= cursorPosition) {
        this.textarea.setSelectionRange(
          cursorPosition + operation.content.length,
          cursorPosition + operation.content.length
        );
      } else if (operation.type === 'delete' && operation.position < cursorPosition) {
        const newPosition = Math.max(operation.position, cursorPosition - operation.length);
        this.textarea.setSelectionRange(newPosition, newPosition);
      }
      
      // Save to storage
      this.saveToStorage();
      
    } finally {
      this.isApplyingRemoteChange = false;
    }
  }
  
  sendOperation(operation) {
    if (window.collaborativePeerManager && window.collaborativePeerManager.isPeerConnected()) {
      window.collaborativePeerManager.sendMessage({
        type: 'text_operation',
        operation: operation
      });
    }
  }
  
  sendCursorPosition(position) {
    if (window.collaborativePeerManager && window.collaborativePeerManager.isPeerConnected()) {
      window.collaborativePeerManager.sendMessage({
        type: 'cursor_position',
        position: position
      });
    }
  }
  
  handleIncomingMessage(message) {
    switch (message.type) {
      case 'text_operation':
        this.applyOperation(message.operation);
        break;
        
      case 'cursor_position':
        this.updateRemoteCursor(message.userId, message.position, message.userColor);
        break;
        
      case 'full_text_sync':
        this.handleFullTextSync(message.text);
        break;
        
      case 'room_change':
        // Handle room changes if needed
        break;
        
      case 'heartbeat':
        // Update user activity
        this.updateRemoteCursor(message.userId, null, message.userColor);
        break;
    }
  }
  
  handleFullTextSync(text) {
    if (this.isApplyingRemoteChange) return;
    
    this.isApplyingRemoteChange = true;
    
    try {
      if (this.textarea) {
        const cursorPosition = this.textarea.selectionStart;
        this.textarea.value = text;
        this.currentText = text;
        
        // Restore cursor position
        this.textarea.setSelectionRange(cursorPosition, cursorPosition);
      }
      
      this.saveToStorage();
    } finally {
      this.isApplyingRemoteChange = false;
    }
  }
  
  updateRemoteCursor(userId, position, color) {
    if (userId === window.collaborativePeerManager.getUserId()) return;
    
    this.remoteCursors.set(userId, {
      position: position,
      color: color,
      lastSeen: Date.now()
    });
    
    this.renderRemoteCursors();
  }
  
  renderRemoteCursors() {
    // Remove old cursor indicators
    const existingCursors = document.querySelectorAll('.remote-cursor');
    existingCursors.forEach(cursor => cursor.remove());
    
    if (!this.textarea) return;
    
    // Clean up old cursors (older than 5 seconds)
    const now = Date.now();
    for (const [userId, cursorData] of this.remoteCursors.entries()) {
      if (now - cursorData.lastSeen > 5000) {
        this.remoteCursors.delete(userId);
      }
    }
    
    // Render active cursors
    this.remoteCursors.forEach((cursorData, userId) => {
      if (cursorData.position !== null && cursorData.position >= 0) {
        this.createCursorIndicator(cursorData.position, cursorData.color, userId);
      }
    });
  }
  
  createCursorIndicator(position, color, userId) {
    // Create cursor indicator element
    const cursorIndicator = document.createElement('div');
    cursorIndicator.className = 'remote-cursor';
    cursorIndicator.style.backgroundColor = color;
    cursorIndicator.title = `User ${userId.substr(-4)}`;
    
    // Position the cursor indicator
    this.positionCursorIndicator(cursorIndicator, position);
    
    // Add to textarea container
    const container = this.textarea.parentElement;
    if (container) {
      container.appendChild(cursorIndicator);
    }
  }
  
  positionCursorIndicator(indicator, position) {
    // This is a simplified cursor positioning
    // In a real implementation, you'd need to calculate the exact pixel position
    // based on the text position, font size, line height, etc.
    
    const textBeforePosition = this.textarea.value.substring(0, position);
    const lines = textBeforePosition.split('\n');
    const currentLine = lines.length - 1;
    const currentColumn = lines[lines.length - 1].length;
    
    // Approximate positioning (this would need more sophisticated calculation)
    const lineHeight = 20; // Approximate line height
    const charWidth = 8; // Approximate character width
    
    indicator.style.left = `${currentColumn * charWidth}px`;
    indicator.style.top = `${currentLine * lineHeight}px`;
  }
  
  handleConnectionChange(isConnected) {
    if (isConnected) {
      // Send full text sync when connected
      this.sendFullTextSync();
    } else {
      // Clear remote cursors when disconnected
      this.remoteCursors.clear();
      this.renderRemoteCursors();
    }
  }
  
  sendFullTextSync() {
    if (window.collaborativePeerManager && window.collaborativePeerManager.isPeerConnected()) {
      window.collaborativePeerManager.sendMessage({
        type: 'full_text_sync',
        text: this.currentText
      });
    }
  }
  
  // Storage methods
  saveToStorage() {
    const data = {
      text: this.currentText,
      lastModified: Date.now(),
      userId: window.collaborativePeerManager.getUserId()
    };
    
    chrome.storage.local.set({ collaborativeText: data }, () => {
      console.log('Collaborative text saved to storage');
    });
  }
  
  loadFromStorage() {
    chrome.storage.local.get(['collaborativeText'], (result) => {
      if (result.collaborativeText) {
        this.currentText = result.collaborativeText.text;
        this.updateTextareaContent();
      }
    });
  }
  
  updateTextareaContent() {
    if (this.textarea && this.currentText !== undefined) {
      this.textarea.value = this.currentText;
    }
  }
  
  clearText() {
    if (this.textarea) {
      this.textarea.value = '';
      this.currentText = '';
      this.operations = [];
      this.saveToStorage();
      
      // Send clear operation to peers
      if (window.collaborativePeerManager && window.collaborativePeerManager.isPeerConnected()) {
        window.collaborativePeerManager.sendMessage({
          type: 'full_text_sync',
          text: ''
        });
      }
    }
  }
  
  // Utility methods
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Global instance
window.collaborativeSyncEngine = new CollaborativeSyncEngine();
