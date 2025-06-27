// Content script for ThinkNote Bookmarker extension

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showNotification') {
    // Show custom notification
    showCustomNotification(request.message, request.type);
    sendResponse({ success: true });
  }
});

// Function to show custom notification
function showCustomNotification(message, type = 'success') {
  // Create notification container
  const notification = document.createElement('div');
  notification.className = `thinknote-notification ${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #2d2d3a;
    color: #e8eaed;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    max-width: 300px;
    border-left: 4px solid ${type === 'success' ? '#b388ff' : '#f44336'};
    transform: translateX(100%);
    opacity: 0;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 12px;
  `;

  // Create icon
  const icon = document.createElement('div');
  icon.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  `;

  if (type === 'success') {
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="#b388ff" stroke-width="2">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    `;
  } else {
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="#f44336" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    `;
  }

  // Create message text
  const messageText = document.createElement('span');
  messageText.textContent = message;
  messageText.style.cssText = `
    flex: 1;
    line-height: 1.4;
  `;

  // Create close button
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '×';
  closeButton.style.cssText = `
    background: none;
    border: none;
    color: #9aa0a6;
    font-size: 18px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s ease;
    flex-shrink: 0;
    margin-left: 8px;
  `;

  closeButton.addEventListener('mouseenter', () => {
    closeButton.style.backgroundColor = 'rgba(179, 136, 255, 0.1)';
    closeButton.style.color = '#b388ff';
  });

  closeButton.addEventListener('mouseleave', () => {
    closeButton.style.backgroundColor = 'transparent';
    closeButton.style.color = '#9aa0a6';
  });

  // Add elements to notification
  notification.appendChild(icon);
  notification.appendChild(messageText);
  notification.appendChild(closeButton);

  // Add to page
  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
    notification.style.opacity = '1';
  }, 10);

  // Auto-remove after 1 second
  const autoRemove = setTimeout(() => {
    removeNotification(notification);
  }, 1000);

  // Manual close
  const removeNotification = (element) => {
    element.style.transform = 'translateX(100%)';
    element.style.opacity = '0';
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }, 200);
  };

  closeButton.addEventListener('click', () => {
    clearTimeout(autoRemove);
    removeNotification(notification);
  });
} 