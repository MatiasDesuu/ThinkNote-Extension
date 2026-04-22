

if (!window.__thinknoteContentScriptInitialized) {
  window.__thinknoteContentScriptInitialized = true;

  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showNotification') {
      
      showCustomNotification(request.message, request.type);
      sendResponse({ success: true });
    } else if (request.action === 'getSelection') {
      sendResponse({ selection: window.getSelection().toString() });
    }
  });


function showCustomNotification(message, type = 'success') {
  const palette = {
    success: {
      border: '#a9b665',
      icon: '#a9b665',
      bg: '#242320'
    },
    error: {
      border: '#ea6962',
      icon: '#ea6962',
      bg: '#242320'
    },
    info: {
      border: '#e08060',
      icon: '#e08060',
      bg: '#242320'
    }
  };

  const theme = palette[type] || palette.info;

  
  const notification = document.createElement('div');
  notification.className = `thinknote-notification ${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 14px;
    right: 14px;
    background-color: ${theme.bg};
    color: #ece8df;
    padding: 10px 12px;
    border-radius: 0;
    border: 1px solid #585550;
    font-family: 'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    z-index: 10000;
    max-width: 320px;
    border-left: 3px solid ${theme.border};
    transform: translateX(100%);
    opacity: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  
  const icon = document.createElement('div');
  icon.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  `;

  if (type === 'success') {
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="${theme.icon}" stroke-width="2.4">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    `;
  } else if (type === 'error') {
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="${theme.icon}" stroke-width="2.4">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    `;
  } else {
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="${theme.icon}" stroke-width="2.4">
        <circle cx="12" cy="12" r="9"/>
        <path d="M12 8v5"/>
        <circle cx="12" cy="16.5" r="1" fill="${theme.icon}" stroke="none"/>
      </svg>
    `;
  }

  
  const messageText = document.createElement('span');
  messageText.textContent = message;
  messageText.style.cssText = `
    flex: 1;
    line-height: 1.35;
  `;

  
  notification.appendChild(icon);
  notification.appendChild(messageText);

  
  document.body.appendChild(notification);

  
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
    notification.style.opacity = '1';
  }, 10);

  notification.addEventListener('mouseenter', () => {
    notification.style.backgroundColor = '#2d2b27';
  });

  notification.addEventListener('mouseleave', () => {
    notification.style.backgroundColor = theme.bg;
  });

  
  const autoRemove = setTimeout(() => {
    removeNotification(notification);
  }, 1600);

  
  const removeNotification = (element) => {
    element.style.transform = 'translateX(100%)';
    element.style.opacity = '0';
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }, 200);
  };

  notification.addEventListener('click', () => {
    clearTimeout(autoRemove);
    removeNotification(notification);
  });
} 

}