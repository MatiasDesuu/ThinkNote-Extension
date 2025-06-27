// Background script for ThinkNote Bookmarker extension

// Import SQL.js
importScripts('lib/sql-wasm.js');

// Create context menu when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'saveSelection',
    title: 'Save selection',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'saveSelection') {
    try {
      // Get WebDAV configuration
      const config = await chrome.storage.sync.get([
        'webdav_url',
        'username',
        'password'
      ]);

      if (!config.webdav_url) {
        // Show custom notification to configure WebDAV
        chrome.tabs.sendMessage(tab.id, {
          action: 'showNotification',
          message: 'Please configure WebDAV settings first',
          type: 'error'
        });
        return;
      }

      // Save the think directly
      await saveThinkToDatabase(info.selectionText, config);
      
      // Show success notification
      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message: 'Think saved successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error('Error saving think:', error);
      // Show error notification
      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message: 'Error saving think: ' + error.message,
        type: 'error'
      });
    }
  }
});

// Function to save think to database
async function saveThinkToDatabase(selectedText, config) {
  const webdavUrl = cleanWebDAVUrl(config.webdav_url);
  const dbUrl = `${webdavUrl}/thinknote.db`;

  // Download the current database
  const dbResponse = await fetch(dbUrl, {
    headers: {
      'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`),
      'Origin': chrome.runtime.getURL('')
    }
  });

  if (!dbResponse.ok) {
    throw new Error('Failed to download database');
  }

  const dbBlob = await dbResponse.blob();
  const dbArrayBuffer = await dbBlob.arrayBuffer();

  // Initialize SQL.js
  const SQL = await initSqlJs({
    locateFile: file => `lib/${file}`
  });

  const db = new SQL.Database(new Uint8Array(dbArrayBuffer));

  // Get next think ID
  const nextIdResult = db.exec('SELECT MAX(id) as max_id FROM thinks');
  const maxId = nextIdResult[0]?.values[0]?.[0] || 0;
  const nextId = maxId + 1;

  // Get current timestamp
  const currentTime = Date.now();

  // Generate title from first line of selected text
  const firstLine = selectedText.split('\n')[0].trim();
  const title = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;

  // Insert new think
  db.run(
    'INSERT INTO thinks (id, title, content, created_at, updated_at, deleted_at, is_favorite, tags, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      nextId,
      title || 'Untitled',
      selectedText,
      currentTime,
      currentTime,
      null,
      0,
      'EMPTY',
      0
    ]
  );

  // Update sync_info
  db.run('UPDATE sync_info SET last_modified = ? WHERE id = 1', [currentTime]);

  // Export the updated database
  const updatedDbBlob = db.export();

  // Upload the updated database
  const uploadResponse = await fetch(dbUrl, {
    method: 'PUT',
    headers: {
      'Authorization': 'Basic ' + btoa(`${config.username}:${config.password}`),
      'Content-Type': 'application/x-sqlite3',
      'Origin': chrome.runtime.getURL('')
    },
    body: updatedDbBlob
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload updated database');
  }

  console.log('Think saved successfully');
}

// Helper function to clean WebDAV URL
function cleanWebDAVUrl(url) {
  url = url.replace(/\/+$/, '');
  url = url.replace(/([^:]\/)\/+/g, '$1');
  return url;
} 