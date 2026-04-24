

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
    top: 20px;
    right: 20px;
    background-color: #242320;
    color: #ece8df;
    padding: 8px 16px;
    border-radius: 4px;
    border: 1px solid #585550;
    font-family: 'Source Code Pro', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    z-index: 2147483647;
    max-width: 320px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transform: scale(0.9);
    opacity: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 10px;
    transition: all 0.2s cubic-bezier(0.1, 0.9, 0.2, 1);
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
      <svg viewBox="0 0 640 640" width="16" height="16" fill="${theme.icon}">
        <path d="M530.8 134.1C545.1 144.5 548.3 164.5 537.9 178.8L281.9 530.8C276.4 538.4 267.9 543.1 258.5 543.9C249.1 544.7 240 541.2 233.4 534.6L105.4 406.6C92.9 394.1 92.9 373.8 105.4 361.3C117.9 348.8 138.2 348.8 150.7 361.3L252.2 462.8L486.2 141.1C496.6 126.8 516.6 123.6 530.9 134z"/>
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
      notification.style.transform = 'scale(1)';
      notification.style.opacity = '1';
    }, 10);

    notification.addEventListener('mouseenter', () => {
      notification.style.backgroundColor = '#2e2d2a';
      notification.style.borderColor = theme.border;
      notification.style.color = theme.icon;
    });

    notification.addEventListener('mouseleave', () => {
      notification.style.backgroundColor = '#242320';
      notification.style.borderColor = '#585550';
      notification.style.color = '#ece8df';
    });


    const autoRemove = setTimeout(() => {
      removeNotification(notification);
    }, 1600);


    const removeNotification = (element) => {
      element.style.transform = 'scale(0.9)';
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



  let floatingButton = null;

  document.addEventListener('mouseup', async (e) => {

    setTimeout(async () => {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();


      if (floatingButton && !floatingButton.contains(e.target)) {
        removeFloatingButton();
      }

      if (!selectedText) return;


      const config = await chrome.storage.sync.get(['selection_popup']);
      if (config.selection_popup !== true) return;


      if (selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      const rects = range.getClientRects();
      if (rects.length === 0) return;


      const lastRect = rects[rects.length - 1];

      showFloatingButton(
        lastRect.right + window.scrollX,
        lastRect.top + window.scrollY,
        selectedText
      );
    }, 10);
  });

  function showFloatingButton(x, y, text) {
    if (floatingButton) removeFloatingButton();

    floatingButton = document.createElement('div');
    floatingButton.className = 'thinknote-floating-button';
    floatingButton.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 640 640" fill="currentColor">
      <path d="M192 576L512 576C529.7 576 544 561.7 544 544C544 526.3 529.7 512 512 512L512 445.3C530.6 438.7 544 420.9 544 400L544 112C544 85.5 522.5 64 496 64L448 64L448 233.4C448 245.9 437.9 256 425.4 256C419.4 256 413.6 253.6 409.4 249.4L368 208L326.6 249.4C322.4 253.6 316.6 256 310.6 256C298.1 256 288 245.9 288 233.4L288 64L192 64C139 64 96 107 96 160L96 480C96 533 139 576 192 576zM160 480C160 462.3 174.3 448 192 448L448 448L448 512L192 512C174.3 512 160 497.7 160 480z"/>
    </svg>
    <span style="margin-left: 8px; font-weight: 700; font-size: 10px; letter-spacing: 0.05em; white-space: nowrap; font-family: 'Source Code Pro', monospace;">SAVE HIGHLIGHT</span>
  `;

    floatingButton.style.cssText = `
    position: absolute;
    top: ${y - 42}px;
    left: ${x - 60}px;
    height: 34px;
    padding: 0 12px;
    background-color: #242320;
    color: #ece8df;
    border: 1px solid #585550;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 2147483647;
    transition: all 0.2s cubic-bezier(0.1, 0.9, 0.2, 1);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border-radius: 4px;
    user-select: none;
    opacity: 0;
    transform: scale(0.9);
    pointer-events: auto;
    font-family: 'Source Code Pro', monospace;
  `;


    requestAnimationFrame(() => {
      floatingButton.style.opacity = '1';
      floatingButton.style.transform = 'scale(1)';
    });

    floatingButton.addEventListener('mouseenter', (e) => {
      e.currentTarget.style.backgroundColor = '#2e2d2a';
      e.currentTarget.style.borderColor = '#e08060';
      e.currentTarget.style.color = '#e08060';
    });

    floatingButton.addEventListener('mouseleave', (e) => {
      e.currentTarget.style.backgroundColor = '#242320';
      e.currentTarget.style.borderColor = '#585550';
      e.currentTarget.style.color = '#ece8df';
    });

    floatingButton.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.style.transform = 'scale(0.92)';
    });

    floatingButton.addEventListener('mouseup', (e) => {
      e.stopPropagation();
    });

    floatingButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const originalText = text;



      const btn = floatingButton;
      floatingButton = null;

      btn.style.transform = 'scale(0.85)';
      btn.style.opacity = '0';
      btn.style.pointerEvents = 'none';

      setTimeout(() => {
        btn.remove();
      }, 200);

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'saveThink',
          text: originalText
        });

        if (response && response.success) {
          showCustomNotification('Think saved!', 'success');
        } else {
          showCustomNotification('Error: ' + (response?.error || 'Unknown error'), 'error');
        }
      } catch (err) {
        console.error('Save Think error:', err);
        showCustomNotification('Error communicating with extension', 'error');
      }
    });

    document.body.appendChild(floatingButton);
  }

  function removeFloatingButton() {
    if (floatingButton) {
      const btn = floatingButton;
      floatingButton = null;

      btn.style.opacity = '0';
      btn.style.transform = 'scale(0.9)';
      btn.style.pointerEvents = 'none';

      setTimeout(() => {
        btn.remove();
      }, 200);
    }
  }

  document.addEventListener('mousedown', (e) => {
    if (floatingButton && !floatingButton.contains(e.target)) {
      removeFloatingButton();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      removeFloatingButton();
    }
  });

}