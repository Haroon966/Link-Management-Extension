/**
 * WebRTC Peer Manager for Collaborative Textarea
 * Handles peer discovery, connection establishment, and data channel management
 */

class CollaborativePeerManager {
  constructor() {
    this.peers = new Map();
    this.dataChannels = new Map();
    this.userId = this.generateUserId();
    this.userColor = this.generateUserColor();
    this.roomId = this.generateRoomId();
    this.isConnected = false;
    this.connectionCallbacks = [];
    this.messageCallbacks = [];
    
    // STUN servers for NAT traversal
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];
    
    this.init();
  }
  
  init() {
    this.startPeerDiscovery();
    this.setupHeartbeat();
  }
  
  generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }
  
  generateUserColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  generateRoomId() {
    // Generate room ID based on network or use default
    return 'default_room';
  }
  
  setRoomId(roomId) {
    this.roomId = roomId || this.generateRoomId();
    this.broadcastRoomChange();
  }
  
  startPeerDiscovery() {
    // In a real implementation, this would use a signaling server
    // For now, we'll simulate peer discovery with a simple approach
    this.simulatePeerDiscovery();
  }
  
  simulatePeerDiscovery() {
    // Simulate finding peers after a delay
    setTimeout(() => {
      this.updateConnectionStatus('discovering', 'Looking for peers...');
    }, 1000);
    
    // Simulate connection after another delay
    setTimeout(() => {
      this.updateConnectionStatus('connected', 'Connected to network');
      this.notifyConnectionCallbacks(true);
    }, 3000);
  }
  
  async createPeerConnection(peerId) {
    const peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers
    });
    
    // Set up data channel
    const dataChannel = peerConnection.createDataChannel('collaboration', {
      ordered: true
    });
    
    this.setupDataChannelEvents(dataChannel, peerId);
    
    // Set up ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendICECandidate(peerId, event.candidate);
      }
    };
    
    // Set up connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${peerId}:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        this.peers.set(peerId, peerConnection);
        this.updateUserCount();
      }
    };
    
    return { peerConnection, dataChannel };
  }
  
  setupDataChannelEvents(dataChannel, peerId) {
    dataChannel.onopen = () => {
      console.log(`Data channel opened with ${peerId}`);
      this.dataChannels.set(peerId, dataChannel);
      this.isConnected = true;
      this.updateConnectionStatus('connected', `Connected to ${this.peers.size} peer(s)`);
    };
    
    dataChannel.onclose = () => {
      console.log(`Data channel closed with ${peerId}`);
      this.dataChannels.delete(peerId);
      this.peers.delete(peerId);
      this.updateUserCount();
      this.updateConnectionStatus('connected', `Connected to ${this.peers.size} peer(s)`);
    };
    
    dataChannel.onerror = (error) => {
      console.error(`Data channel error with ${peerId}:`, error);
    };
    
    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleIncomingMessage(message, peerId);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  }
  
  handleIncomingMessage(message, peerId) {
    // Add peer info to message
    message.peerId = peerId;
    message.receivedAt = Date.now();
    
    // Notify message callbacks
    this.messageCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error in message callback:', error);
      }
    });
  }
  
  sendMessage(message) {
    const messageWithMetadata = {
      ...message,
      userId: this.userId,
      userColor: this.userColor,
      timestamp: Date.now()
    };
    
    const messageStr = JSON.stringify(messageWithMetadata);
    
    // Send to all connected peers
    this.dataChannels.forEach((dataChannel, peerId) => {
      if (dataChannel.readyState === 'open') {
        dataChannel.send(messageStr);
      }
    });
  }
  
  sendICECandidate(peerId, candidate) {
    // In a real implementation, this would send through a signaling server
    console.log(`Sending ICE candidate to ${peerId}:`, candidate);
  }
  
  updateConnectionStatus(status, text) {
    const indicator = document.getElementById('connection-indicator');
    const textElement = document.getElementById('connection-text');
    
    if (indicator) {
      indicator.className = `connection-indicator ${status}`;
    }
    
    if (textElement) {
      textElement.textContent = text;
    }
  }
  
  updateUserCount() {
    const countElement = document.getElementById('users-count');
    const userCount = this.peers.size + 1; // +1 for self
    
    if (countElement) {
      countElement.textContent = `${userCount} user${userCount !== 1 ? 's' : ''} online`;
    }
    
    this.updateUserIndicators();
  }
  
  updateUserIndicators() {
    const indicatorsContainer = document.getElementById('user-indicators');
    if (!indicatorsContainer) return;
    
    indicatorsContainer.innerHTML = '';
    
    // Add self indicator
    const selfIndicator = document.createElement('div');
    selfIndicator.className = 'user-indicator self';
    selfIndicator.style.backgroundColor = this.userColor;
    selfIndicator.title = 'You';
    indicatorsContainer.appendChild(selfIndicator);
    
    // Add peer indicators (simulated for now)
    const peerCount = Math.floor(Math.random() * 3); // Simulate 0-2 peers
    for (let i = 0; i < peerCount; i++) {
      const peerIndicator = document.createElement('div');
      peerIndicator.className = 'user-indicator peer';
      peerIndicator.style.backgroundColor = this.generateUserColor();
      peerIndicator.title = `Peer ${i + 1}`;
      indicatorsContainer.appendChild(peerIndicator);
    }
  }
  
  setupHeartbeat() {
    // Send heartbeat every 30 seconds to maintain connection
    setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({
          type: 'heartbeat',
          userId: this.userId
        });
      }
    }, 30000);
  }
  
  broadcastRoomChange() {
    this.sendMessage({
      type: 'room_change',
      roomId: this.roomId
    });
  }
  
  // Public API methods
  onConnectionChange(callback) {
    this.connectionCallbacks.push(callback);
  }
  
  onMessage(callback) {
    this.messageCallbacks.push(callback);
  }
  
  getUserId() {
    return this.userId;
  }
  
  getUserColor() {
    return this.userColor;
  }
  
  getRoomId() {
    return this.roomId;
  }
  
  isPeerConnected() {
    return this.isConnected;
  }
  
  disconnect() {
    this.dataChannels.forEach(dataChannel => {
      dataChannel.close();
    });
    this.peers.forEach(peerConnection => {
      peerConnection.close();
    });
    this.dataChannels.clear();
    this.peers.clear();
    this.isConnected = false;
    this.updateConnectionStatus('offline', 'Disconnected');
    this.updateUserCount();
  }
}

// Global instance
window.collaborativePeerManager = new CollaborativePeerManager();
