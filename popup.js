
const CONFIG_KEYS = {
  WEBDAV_URL: 'webdav_url',
  USERNAME: 'username',
  PASSWORD: 'password',
  DARK_MODE: 'dark_mode',
  EINK_MODE: 'eink_mode',
  QUICK_SAVE_SILENT: 'quick_save_silent'
};

const QUICK_SAVE_STORAGE_KEY = 'quick_save_bookmark_requested_at';
const QUICK_SAVE_MAX_AGE_MS = 15000;


const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const saveButton = document.getElementById('save-button');
const saveThinkButton = document.getElementById('save-think-button');
const saveOptionsButton = document.getElementById('save-options-button');


const urlInput = document.getElementById('url');
const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const tagsInput = document.getElementById('tags');
const thinkTitleInput = document.getElementById('think-title');
const thinkContentInput = document.getElementById('think-content');
const webdavUrlInput = document.getElementById('webdav-url');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const einkModeToggle = document.getElementById('eink-mode-toggle');
const quickSaveSilentToggle = document.getElementById('quick-save-silent-toggle');


let SQL;
let openDatabase;


async function initSQL() {
  try {
    SQL = await initSqlJs({
      locateFile: file => `lib/${file}`
    });
    openDatabase = async (arrayBuffer) => {
      const db = new SQL.Database(new Uint8Array(arrayBuffer));
      return {
        executeSql: (sql, params = []) => {
          try {
            const stmt = db.prepare(sql);
            stmt.bind(params);
            const result = {
              rows: {
                length: 0,
                item: (index) => null
              },
              insertId: db.getRowsModified ? db.getRowsModified() : undefined
            };
            const rows = [];
            while (stmt.step()) {
              rows.push(stmt.getAsObject());
            }
            result.rows.length = rows.length;
            result.rows.item = (index) => rows[index];
            stmt.free();
            ('SQL Result:', result);
            return result;
          } catch (error) {
            console.error('SQL Error:', error);
            throw error;
          }
        },
        export: () => {
          return db.export();
        }
      };
    };
  } catch (error) {
    console.error('Error initializing SQL.js:', error);
    throw error;
  }
}


async function ensureBookmarksSchema(db) {
  const columnsResult = await db.executeSql('PRAGMA table_info(bookmarks)');
  const existingColumns = new Set();

  for (let i = 0; i < columnsResult.rows.length; i++) {
    const row = columnsResult.rows.item(i);
    if (row && row.name) {
      existingColumns.add(row.name);
    }
  }

  if (!existingColumns.has('created_at')) {
    await db.executeSql('ALTER TABLE bookmarks ADD COLUMN created_at TEXT');
  }

  if (!existingColumns.has('updated_at')) {
    await db.executeSql('ALTER TABLE bookmarks ADD COLUMN updated_at TEXT');
  }
}


function cleanWebDAVUrl(url) {
  
  url = url.replace(/\/+$/, '');
  
  url = url.replace(/([^:]\/)\/+/g, '$1');
  return url;
}


function applyTheme(isDark, isEink) {
  if (isDark) {
    document.body.classList.remove('light-theme');
  } else {
    document.body.classList.add('light-theme');
  }
  if (isEink) {
    document.body.classList.add('eink');
  } else {
    document.body.classList.remove('eink');
  }
}

function switchToTab(tabName) {
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  tabContents.forEach(content => {
    content.classList.toggle('hidden', content.id !== `${tabName}-tab`);
  });
}

async function consumeQuickSaveRequest() {
  const result = await chrome.storage.local.get([QUICK_SAVE_STORAGE_KEY]);
  const requestedAt = result[QUICK_SAVE_STORAGE_KEY];

  if (!requestedAt) {
    return false;
  }

  await chrome.storage.local.remove(QUICK_SAVE_STORAGE_KEY);

  return Date.now() - requestedAt <= QUICK_SAVE_MAX_AGE_MS;
}

async function handleQuickSaveRequest() {
  const hasQuickSaveRequest = await consumeQuickSaveRequest();

  if (!hasQuickSaveRequest) {
    return;
  }

  switchToTab('save');
  await saveBookmark();
}


async function validateBookmarkData() {
  const title = titleInput.value.trim();
  const url = urlInput.value.trim();
  const description = descriptionInput.value.trim();
  const tags = tagsInput.value.trim();

  ('Validating bookmark data:', {
    title,
    url,
    description,
    tags
  });

  if (!title || title.length === 0) {
    await showInfoDialog('Missing title', 'Title is required and cannot be empty');
    return false;
  }

  if (!url || url.length === 0) {
    await showInfoDialog('Missing URL', 'URL is required and cannot be empty');
    return false;
  }

  return true;
}


tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.dataset.tab;
    switchToTab(tabName);
  });
});


document.addEventListener('DOMContentLoaded', async () => {
  try {
    
    await initSQL();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    ('Current tab:', tab);
    urlInput.value = tab.url;
    titleInput.value = tab.title;
    
    
    const config = await chrome.storage.sync.get([
      CONFIG_KEYS.WEBDAV_URL,
      CONFIG_KEYS.USERNAME,
      CONFIG_KEYS.PASSWORD,
      CONFIG_KEYS.DARK_MODE,
      CONFIG_KEYS.EINK_MODE,
      CONFIG_KEYS.QUICK_SAVE_SILENT
    ]);
    
    webdavUrlInput.value = config[CONFIG_KEYS.WEBDAV_URL] || '';
    usernameInput.value = config[CONFIG_KEYS.USERNAME] || '';
    passwordInput.value = config[CONFIG_KEYS.PASSWORD] || '';
    darkModeToggle.checked = config[CONFIG_KEYS.DARK_MODE] !== false; 
    einkModeToggle.checked = config[CONFIG_KEYS.EINK_MODE] === true; 
    quickSaveSilentToggle.checked = config[CONFIG_KEYS.QUICK_SAVE_SILENT] === true; 
    
    
    darkModeToggle.parentElement.classList.toggle('checked', darkModeToggle.checked);
    einkModeToggle.parentElement.classList.toggle('checked', einkModeToggle.checked);
    quickSaveSilentToggle.parentElement.classList.toggle('checked', quickSaveSilentToggle.checked);
    
    
    applyTheme(darkModeToggle.checked, einkModeToggle.checked);

    await handleQuickSaveRequest();
  } catch (error) {
    console.error('Error in DOMContentLoaded:', error);
    alert('Error initializing extension: ' + error.message);
  }
});


async function getNextBookmarkId(db) {
  const result = await db.executeSql('SELECT MAX(id) as max_id FROM bookmarks');
  const maxId = result.rows.item(0).max_id;
  return maxId ? maxId + 1 : 1;
}


async function getOrCreateTagIds(db, tags) {
  const tagIds = [];
  for (const tag of tags) {
    
    const result = await db.executeSql('SELECT id FROM bookmarks_tags WHERE tag = ?', [tag]);
    let tagId;
    
    if (result.rows.length === 0) {
      
      await db.executeSql('INSERT INTO bookmarks_tags (tag) VALUES (?)', [tag]);
      
      const newTagResult = await db.executeSql('SELECT id FROM bookmarks_tags WHERE tag = ?', [tag]);
      tagId = newTagResult.rows.item(0).id;
      (`Created new tag '${tag}' with ID: ${tagId}`);
    } else {
      tagId = result.rows.item(0).id;
      (`Found existing tag '${tag}' with ID: ${tagId}`);
    }
    tagIds.push(tagId);
  }
  ('Final tag IDs:', tagIds);
  return tagIds;
}


async function getAutomaticTags(db, url) {
  
  const patternsResult = await db.executeSql('SELECT url_pattern, tag FROM bookmarks_tag_url_patterns');
  const automaticTags = [];
  
  
  for (let i = 0; i < patternsResult.rows.length; i++) {
    const pattern = patternsResult.rows.item(i);
    if (url.includes(pattern.url_pattern)) {
      automaticTags.push(pattern.tag);
      (`URL matches pattern '${pattern.url_pattern}', adding tag '${pattern.tag}'`);
    }
  }
  
  ('Automatic tags found:', automaticTags);
  return automaticTags;
}


function decodeHtmlEntities(text) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}


async function checkUrlExists(db, url) {
  const result = await db.executeSql('SELECT id, title FROM bookmarks WHERE url = ?', [url]);
  return result.rows.length > 0 ? result.rows.item(0) : null;
}


async function updateExistingBookmark(db, bookmarkId, bookmarkData) {
  
  const current = await db.executeSql('SELECT timestamp, created_at FROM bookmarks WHERE id = ?', [bookmarkId]);
  if (current.rows.length > 0 && !current.rows.item(0).created_at) {
    await db.executeSql('UPDATE bookmarks SET created_at = ? WHERE id = ?', [current.rows.item(0).timestamp, bookmarkId]);
  }
  
  
  await db.executeSql(
    'UPDATE bookmarks SET title = ?, description = ?, timestamp = ?, tag_ids = ?, updated_at = ? WHERE id = ?',
    [
      bookmarkData.title,
      bookmarkData.description,
      bookmarkData.timestamp,
      bookmarkData.tag_ids,
      new Date().toISOString(),
      bookmarkId
    ]
  );
}


function showSuccessAnimation() {
  const animation = document.createElement('div');
  animation.className = 'success-animation';
  animation.innerHTML = `<div class="success-icon"></div>`;
  document.body.appendChild(animation);

  
  animation.addEventListener('animationend', () => {
    animation.remove();
    window.close();
  });
}


function showDialog(title, content) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    
    dialog.innerHTML = `
      <div class="dialog-title">${title}</div>
      <div class="dialog-content">${content}</div>
      <div class="dialog-buttons">
        <button class="dialog-button secondary">Cancel</button>
        <button class="dialog-button primary">Overwrite</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    const cancelButton = dialog.querySelector('.dialog-button.secondary');
    const confirmButton = dialog.querySelector('.dialog-button.primary');
    
    const closeDialog = (result) => {
      overlay.style.animation = 'fadeIn 0.2s ease-out reverse';
      dialog.style.animation = 'scaleIn 0.2s ease-out reverse';
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 200);
    };
    
    cancelButton.addEventListener('click', () => closeDialog(false));
    confirmButton.addEventListener('click', () => closeDialog(true));
    
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog(false);
      }
    });
  });
}


function showInfoDialog(title, content) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';

    dialog.innerHTML = `
      <div class="dialog-title">${title}</div>
      <div class="dialog-content">${content}</div>
      <div class="dialog-buttons">
        <button class="dialog-button primary">OK</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const okButton = dialog.querySelector('.dialog-button.primary');

    const closeDialog = () => {
      overlay.style.animation = 'fadeIn 0.2s ease-out reverse';
      dialog.style.animation = 'scaleIn 0.2s ease-out reverse';
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 200);
    };

    okButton.addEventListener('click', closeDialog);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog();
      }
    });
  });
}


async function saveBookmark() {
  
  if (!await validateBookmarkData()) {
    return;
  }

  const config = await chrome.storage.sync.get([
    CONFIG_KEYS.WEBDAV_URL,
    CONFIG_KEYS.USERNAME,
    CONFIG_KEYS.PASSWORD
  ]);

  if (!config[CONFIG_KEYS.WEBDAV_URL]) {
    alert('Please configure WebDAV settings first');
    return;
  }

  try {
    const webdavUrl = cleanWebDAVUrl(config[CONFIG_KEYS.WEBDAV_URL]);
    const dbUrl = `${webdavUrl}/thinknote.db`;

    
    const dbResponse = await fetch(dbUrl, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${config[CONFIG_KEYS.USERNAME]}:${config[CONFIG_KEYS.PASSWORD]}`),
        'Origin': chrome.runtime.getURL('')
      }
    });

    if (!dbResponse.ok) {
      throw new Error('Failed to download database');
    }

    const dbBlob = await dbResponse.blob();
    const dbArrayBuffer = await dbBlob.arrayBuffer();
    
    
    const db = await openDatabase(dbArrayBuffer);
    
    
    await ensureBookmarksSchema(db);
    
    
    const existingBookmark = await checkUrlExists(db, urlInput.value.trim());
    
    if (existingBookmark) {
      const shouldOverwrite = await showDialog(
        'Bookmark Already Exists',
        `A bookmark with this URL already exists:<br><br><strong>${existingBookmark.title}</strong><br><br>Do you want to overwrite it with the new data?`
      );
      if (!shouldOverwrite) {
        return;
      }
    }
    
    
    const manualTags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
    ('Manual tags:', manualTags);
    
    
    const automaticTags = await getAutomaticTags(db, urlInput.value);
    ('Automatic tags:', automaticTags);
    
    
    const allTags = [...new Set([...manualTags, ...automaticTags])];
    ('All tags:', allTags);
    
    
    const tagIds = await getOrCreateTagIds(db, allTags);
    ('Tag IDs to be assigned:', tagIds);
    
    
    const now = new Date().toISOString();
    const bookmarkData = {
      title: titleInput.value.trim(),
      url: urlInput.value.trim(),
      description: descriptionInput.value.trim(),
      timestamp: now,
      lastModified: Date.now(),
      hidden: 0,
      tag_ids: JSON.stringify(tagIds),
      created_at: now,
      updated_at: now
    };

    if (existingBookmark) {
      
      await updateExistingBookmark(db, existingBookmark.id, bookmarkData);
      ('Updating existing bookmark with data:', bookmarkData);
    } else {
      
      const nextId = await getNextBookmarkId(db);
      bookmarkData.id = nextId;
      
      
      await db.executeSql(
        'INSERT INTO bookmarks (id, title, url, description, timestamp, hidden, tag_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          bookmarkData.id,
          bookmarkData.title,
          bookmarkData.url,
          bookmarkData.description,
          bookmarkData.timestamp,
          bookmarkData.hidden,
          bookmarkData.tag_ids,
          bookmarkData.created_at,
          bookmarkData.updated_at
        ]
      );
      ('Inserting new bookmark with data:', bookmarkData);
    }
    
    
    await db.executeSql(
      'UPDATE sync_info SET last_modified = ? WHERE id = 1',
      [bookmarkData.lastModified]
    );
    
    
    const updatedDbBlob = await db.export();
    
    
    const uploadResponse = await fetch(dbUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + btoa(`${config[CONFIG_KEYS.USERNAME]}:${config[CONFIG_KEYS.PASSWORD]}`),
        'Content-Type': 'application/x-sqlite3',
        'Origin': chrome.runtime.getURL('')
      },
      body: updatedDbBlob
    });

    if (uploadResponse.ok) {
      showSuccessAnimation();
    } else {
      throw new Error('Failed to upload updated database');
    }
  } catch (error) {
    console.error('Error saving bookmark:', error);
    alert('Error saving bookmark: ' + error.message);
  }
}

saveButton.addEventListener('click', saveBookmark);

titleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    saveBookmark();
  }
});

tagsInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    saveBookmark();
  }
});


saveOptionsButton.addEventListener('click', async () => {
  const config = {
    [CONFIG_KEYS.WEBDAV_URL]: cleanWebDAVUrl(webdavUrlInput.value),
    [CONFIG_KEYS.USERNAME]: usernameInput.value,
    [CONFIG_KEYS.PASSWORD]: passwordInput.value,
    [CONFIG_KEYS.DARK_MODE]: darkModeToggle.checked,
    [CONFIG_KEYS.EINK_MODE]: einkModeToggle.checked,
    [CONFIG_KEYS.QUICK_SAVE_SILENT]: quickSaveSilentToggle.checked
  };

  await chrome.storage.sync.set(config);
  await showInfoDialog('Options Saved', 'Your options have been saved successfully.');
});


darkModeToggle.addEventListener('change', async () => {
  darkModeToggle.parentElement.classList.toggle('checked', darkModeToggle.checked);
  applyTheme(darkModeToggle.checked, einkModeToggle.checked);
  
  await chrome.storage.sync.set({ [CONFIG_KEYS.DARK_MODE]: darkModeToggle.checked });
});


einkModeToggle.addEventListener('change', async () => {
  einkModeToggle.parentElement.classList.toggle('checked', einkModeToggle.checked);
  applyTheme(darkModeToggle.checked, einkModeToggle.checked);
  
  await chrome.storage.sync.set({ [CONFIG_KEYS.EINK_MODE]: einkModeToggle.checked });
});

quickSaveSilentToggle.addEventListener('change', async () => {
  quickSaveSilentToggle.parentElement.classList.toggle('checked', quickSaveSilentToggle.checked);
  await chrome.storage.sync.set({ [CONFIG_KEYS.QUICK_SAVE_SILENT]: quickSaveSilentToggle.checked });
});


saveThinkButton.addEventListener('click', async () => {
  const title = thinkTitleInput.value.trim();
  const content = thinkContentInput.value.trim();

  if (!content) {
    await showInfoDialog('Missing content', 'Please enter content for your think.');
    return;
  }

  if (!title) {
    await showInfoDialog('Missing title', 'Please enter a title for your think.');
    return;
  }

  try {
    const config = await chrome.storage.sync.get([
      CONFIG_KEYS.WEBDAV_URL,
      CONFIG_KEYS.USERNAME,
      CONFIG_KEYS.PASSWORD
    ]);

    if (!config[CONFIG_KEYS.WEBDAV_URL]) {
      alert('Please configure WebDAV settings first');
      return;
    }

    const webdavUrl = cleanWebDAVUrl(config[CONFIG_KEYS.WEBDAV_URL]);
    const dbUrl = `${webdavUrl}/thinknote.db`;

    
    const dbResponse = await fetch(dbUrl, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${config[CONFIG_KEYS.USERNAME]}:${config[CONFIG_KEYS.PASSWORD]}`),
        'Origin': chrome.runtime.getURL('')
      }
    });

    if (!dbResponse.ok) {
      throw new Error('Failed to download database');
    }

    const dbBlob = await dbResponse.blob();
    const dbArrayBuffer = await dbBlob.arrayBuffer();
    
    
    const db = await openDatabase(dbArrayBuffer);
    
    
    const nextIdResult = await db.executeSql('SELECT MAX(id) as max_id FROM thinks');
    const maxId = nextIdResult.rows.item(0).max_id;
    const nextId = maxId ? maxId + 1 : 1;
    
    
    const currentTime = Date.now();
    
    
    await db.executeSql(
      'INSERT INTO thinks (id, title, content, created_at, updated_at, deleted_at, is_favorite, tags, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        nextId,
        title,
        content,
        currentTime,
        currentTime,
        null,
        0,
        'EMPTY',
        0
      ]
    );
    
    
    await db.executeSql(
      'UPDATE sync_info SET last_modified = ? WHERE id = 1',
      [currentTime]
    );
    
    
    const updatedDbBlob = await db.export();
    
    
    const uploadResponse = await fetch(dbUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + btoa(`${config[CONFIG_KEYS.USERNAME]}:${config[CONFIG_KEYS.PASSWORD]}`),
        'Content-Type': 'application/x-sqlite3',
        'Origin': chrome.runtime.getURL('')
      },
      body: updatedDbBlob
    });

    if (uploadResponse.ok) {
      showSuccessAnimation();
      
      thinkTitleInput.value = '';
      thinkContentInput.value = '';
    } else {
      throw new Error('Failed to upload updated database');
    }
  } catch (error) {
    console.error('Error saving think:', error);
    alert('Error saving think: ' + error.message);
  }
}); 