


importScripts('lib/sql-wasm.js');

const QUICK_SAVE_STORAGE_KEY = 'quick_save_bookmark_requested_at';
const QUICK_SAVE_SILENT_KEY = 'quick_save_silent';


chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'saveSelection',
    title: 'Save selection',
    contexts: ['selection']
  });
});


chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick-save-bookmark') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!activeTab?.id || !activeTab?.url || !/^https?:\/\//i.test(activeTab.url)) {
      return;
    }

    try {
      const settings = await chrome.storage.sync.get([
        'webdav_url',
        'username',
        'password',
        QUICK_SAVE_SILENT_KEY
      ]);

      if (settings[QUICK_SAVE_SILENT_KEY] === true) {
        const silentResult = await saveBookmarkToDatabase(activeTab, settings, { skipIfExists: true });

        if (silentResult === 'saved') {
          await safeNotify(activeTab.id, 'Bookmark saved', 'success');
          return;
        }

        await chrome.storage.local.set({
          [QUICK_SAVE_STORAGE_KEY]: Date.now()
        });

        await chrome.action.openPopup();
        return;
      }

      await chrome.storage.local.set({
        [QUICK_SAVE_STORAGE_KEY]: Date.now()
      });

      await chrome.action.openPopup();
    } catch (error) {
      console.error('Error triggering quick save shortcut:', error);
      await safeNotify(activeTab.id, 'Quick save failed: ' + error.message, 'error');
    }
  } else if (command === 'quick-save-think') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!activeTab?.id || !activeTab?.url || !/^https?:\/\//i.test(activeTab.url)) {
      return;
    }

    try {
      const config = await chrome.storage.sync.get([
        'webdav_url',
        'username',
        'password'
      ]);

      if (!config.webdav_url) {
        await safeNotify(activeTab.id, 'Please configure WebDAV settings first', 'error');
        return;
      }

      // Send message to content script to get selected text
      let selectedText = '';
      try {
        const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'getSelection' });
        selectedText = response?.selection || '';
      } catch (msgError) {
        if (msgError.message.includes('Could not establish connection')) {
          await safeNotify(activeTab.id, 'Unable to access page content. Please refresh the page and try again.', 'error');
          return;
        }
        throw msgError; // Re-throw other errors
      }

      if (!selectedText.trim()) {
        await safeNotify(activeTab.id, 'No text selected', 'error');
        return;
      }

      await saveThinkToDatabase(selectedText, config, activeTab.url);

      await safeNotify(activeTab.id, 'Think saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving think via shortcut:', error);
      await safeNotify(activeTab.id, 'Error saving think: ' + error.message, 'error');
    }
  }
});


chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'saveSelection') {
    try {

      const config = await chrome.storage.sync.get([
        'webdav_url',
        'username',
        'password'
      ]);

      if (!config.webdav_url) {

        chrome.tabs.sendMessage(tab.id, {
          action: 'showNotification',
          message: 'Please configure WebDAV settings first',
          type: 'error'
        });
        return;
      }


      await saveThinkToDatabase(info.selectionText, config, tab.url);


      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message: 'Think saved successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error('Error saving think:', error);

      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message: 'Error saving think: ' + error.message,
        type: 'error'
      });
    }
  }
});


function addTextHighlightToUrl(url, text) {
  if (!url || !text) return url;

  const cleanText = text.trim()
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ');

  if (!cleanText || cleanText.length < 2) return url;

  let truncatedText = cleanText;
  if (truncatedText.length > 500) {
    truncatedText = truncatedText.substring(0, 500);
  }

  const encodedText = encodeURIComponent(truncatedText);

  const fragment = `:~:text=${encodedText}`;

  if (url.includes(':~:text=')) {
    return url;
  }

  if (url.includes('#')) {
    return `${url}${fragment}`;
  } else {
    return `${url}#${fragment}`;
  }
}


async function saveThinkToDatabase(selectedText, config, url = null) {
  const webdavUrl = cleanWebDAVUrl(config.webdav_url);
  const dbUrl = `${webdavUrl}/thinknote.db`;

  // Append URL if provided
  if (url) {
    const urlWithHighlight = addTextHighlightToUrl(url, selectedText);
    selectedText = `${selectedText}\n\nSource: ${urlWithHighlight}`;
  }


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


  const SQL = await initSqlJs({
    locateFile: file => `lib/${file}`
  });

  const db = new SQL.Database(new Uint8Array(dbArrayBuffer));


  const nextIdResult = db.exec('SELECT MAX(id) as max_id FROM thinks');
  const maxId = nextIdResult[0]?.values[0]?.[0] || 0;
  const nextId = maxId + 1;


  const currentTime = Date.now();


  const firstLine = selectedText.split('\n')[0].trim();
  const title = firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;


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


  db.run('UPDATE sync_info SET last_modified = ? WHERE id = 1', [currentTime]);


  const updatedDbBlob = db.export();


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
}

async function saveBookmarkToDatabase(tab, config, options = {}) {
  if (!config.webdav_url) {
    throw new Error('Please configure WebDAV settings first');
  }

  const webdavUrl = cleanWebDAVUrl(config.webdav_url);
  const dbUrl = `${webdavUrl}/thinknote.db`;

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

  const SQL = await initSqlJs({
    locateFile: file => `lib/${file}`
  });

  const db = new SQL.Database(new Uint8Array(dbArrayBuffer));

  ensureBookmarksSchema(db);

  const nowIso = new Date().toISOString();
  const nowMs = Date.now();
  const title = (tab.title || '').trim() || 'Untitled';
  const existingBookmark = getBookmarkByUrl(db, tab.url);

  const automaticTags = getAutomaticTags(db, tab.url);
  const tagIds = getOrCreateTagIds(db, automaticTags);
  const tagIdsJson = JSON.stringify(tagIds);

  if (existingBookmark) {
    if (options.skipIfExists) {
      return 'exists';
    }

    const existingTagIds = parseTagIds(existingBookmark.tag_ids);
    const mergedTagIds = Array.from(new Set([...(existingTagIds || []), ...tagIds]));
    db.run(
      'UPDATE bookmarks SET title = ?, timestamp = ?, updated_at = ?, tag_ids = ? WHERE id = ?',
      [title, nowIso, nowIso, JSON.stringify(mergedTagIds), existingBookmark.id]
    );
  } else {
    const nextId = getNextBookmarkId(db);
    db.run(
      'INSERT INTO bookmarks (id, title, url, description, timestamp, hidden, tag_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nextId, title, tab.url, '', nowIso, 0, tagIdsJson, nowIso, nowIso]
    );
  }

  db.run('UPDATE sync_info SET last_modified = ? WHERE id = 1', [nowMs]);

  const updatedDbBlob = db.export();

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

  return 'saved';
}

function ensureBookmarksSchema(db) {
  const columns = new Set();
  const stmt = db.prepare('PRAGMA table_info(bookmarks)');

  while (stmt.step()) {
    const row = stmt.getAsObject();
    if (row?.name) {
      columns.add(row.name);
    }
  }
  stmt.free();

  if (!columns.has('created_at')) {
    db.run('ALTER TABLE bookmarks ADD COLUMN created_at TEXT');
  }

  if (!columns.has('updated_at')) {
    db.run('ALTER TABLE bookmarks ADD COLUMN updated_at TEXT');
  }
}

function getBookmarkByUrl(db, url) {
  const stmt = db.prepare('SELECT id, tag_ids FROM bookmarks WHERE url = ?');
  stmt.bind([url]);

  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }

  stmt.free();
  return row;
}

function parseTagIds(tagIdsJson) {
  try {
    const parsed = JSON.parse(tagIdsJson || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function getAutomaticTags(db, url) {
  const tags = [];
  const stmt = db.prepare('SELECT url_pattern, tag FROM bookmarks_tag_url_patterns');

  while (stmt.step()) {
    const row = stmt.getAsObject();
    if (row?.url_pattern && row?.tag && url.includes(row.url_pattern)) {
      tags.push(row.tag);
    }
  }

  stmt.free();
  return tags;
}

function getOrCreateTagIds(db, tags) {
  const tagIds = [];

  for (const tag of tags) {
    if (!tag || !tag.trim()) {
      continue;
    }

    const selectStmt = db.prepare('SELECT id FROM bookmarks_tags WHERE tag = ?');
    selectStmt.bind([tag]);

    let tagId = null;
    if (selectStmt.step()) {
      tagId = selectStmt.getAsObject().id;
    }
    selectStmt.free();

    if (!tagId) {
      const insertStmt = db.prepare('INSERT INTO bookmarks_tags (tag) VALUES (?)');
      insertStmt.bind([tag]);
      insertStmt.step();
      insertStmt.free();

      const newTagStmt = db.prepare('SELECT id FROM bookmarks_tags WHERE tag = ?');
      newTagStmt.bind([tag]);
      if (newTagStmt.step()) {
        tagId = newTagStmt.getAsObject().id;
      }
      newTagStmt.free();
    }

    if (tagId) {
      tagIds.push(tagId);
    }
  }

  return tagIds;
}

function getNextBookmarkId(db) {
  const stmt = db.prepare('SELECT MAX(id) as max_id FROM bookmarks');
  let maxId = 0;

  if (stmt.step()) {
    const row = stmt.getAsObject();
    maxId = row?.max_id || 0;
  }

  stmt.free();
  return maxId + 1;
}

async function safeNotify(tabId, message, type) {
  if (!tabId) {
    return;
  }

  try {
    await sendNotification(tabId, message, type);
  } catch (error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });

      await sendNotification(tabId, message, type);
    } catch (injectError) {
      console.warn('Unable to show notification:', injectError);
    }
  }
}

function sendNotification(tabId, message, type) {
  return chrome.tabs.sendMessage(tabId, {
    action: 'showNotification',
    message,
    type
  });
}


function cleanWebDAVUrl(url) {
  url = url.replace(/\/+$/, '');
  url = url.replace(/([^:]\/)\/+/g, '$1');
  return url;
} 