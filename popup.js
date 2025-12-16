// Configuration storage keys
const CONFIG_KEYS = {
  WEBDAV_URL: 'webdav_url',
  USERNAME: 'username',
  PASSWORD: 'password',
  DARK_MODE: 'dark_mode',
  EINK_MODE: 'eink_mode'
};

// DOM Elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
const saveButton = document.getElementById('save-button');
const saveThinkButton = document.getElementById('save-think-button');
const saveOptionsButton = document.getElementById('save-options-button');

// Form elements
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

// SQL.js initialization
let SQL;
let openDatabase;

// Initialize SQL.js
async function initSQL() {
  try {
    SQL = await initSqlJs({
      locateFile: file => `lib/${file}`
    });
    openDatabase = async (arrayBuffer) => {
      const db = new SQL.Database(new Uint8Array(arrayBuffer));
      return {
        executeSql: (sql, params = []) => {
          console.log('Executing SQL:', sql);
          console.log('With params:', params);
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
            console.log('SQL Result:', result);
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
    console.log('SQL.js initialized successfully');
  } catch (error) {
    console.error('Error initializing SQL.js:', error);
    throw error;
  }
}

// Helper function to clean WebDAV URL
function cleanWebDAVUrl(url) {
  // Remove trailing slashes
  url = url.replace(/\/+$/, '');
  // Remove double slashes except for http:// or https://
  url = url.replace(/([^:]\/)\/+/g, '$1');
  return url;
}

// Function to apply theme
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

// Helper function to validate bookmark data
async function validateBookmarkData() {
  const title = titleInput.value.trim();
  const url = urlInput.value.trim();
  const description = descriptionInput.value.trim();
  const tags = tagsInput.value.trim();

  console.log('Validating bookmark data:', {
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

// Tab switching
tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabName = button.dataset.tab;
    
    // Update active tab button
    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Show selected tab content
    tabContents.forEach(content => {
      content.classList.toggle('hidden', content.id !== `${tabName}-tab`);
    });
  });
});

// Load current tab info when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize SQL.js first
    await initSQL();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('Current tab:', tab);
    urlInput.value = tab.url;
    titleInput.value = tab.title;
    
    // Load saved configuration
    const config = await chrome.storage.sync.get([
      CONFIG_KEYS.WEBDAV_URL,
      CONFIG_KEYS.USERNAME,
      CONFIG_KEYS.PASSWORD,
      CONFIG_KEYS.DARK_MODE,
      CONFIG_KEYS.EINK_MODE
    ]);
    
    webdavUrlInput.value = config[CONFIG_KEYS.WEBDAV_URL] || '';
    usernameInput.value = config[CONFIG_KEYS.USERNAME] || '';
    passwordInput.value = config[CONFIG_KEYS.PASSWORD] || '';
    darkModeToggle.checked = config[CONFIG_KEYS.DARK_MODE] !== false; // default true
    einkModeToggle.checked = config[CONFIG_KEYS.EINK_MODE] === true; // default false
    
    // Set initial checked class on labels
    darkModeToggle.parentElement.classList.toggle('checked', darkModeToggle.checked);
    einkModeToggle.parentElement.classList.toggle('checked', einkModeToggle.checked);
    
    // Apply theme
    applyTheme(darkModeToggle.checked, einkModeToggle.checked);
  } catch (error) {
    console.error('Error in DOMContentLoaded:', error);
    alert('Error initializing extension: ' + error.message);
  }
});

// Function to get the next available ID from the bookmarks table
async function getNextBookmarkId(db) {
  const result = await db.executeSql('SELECT MAX(id) as max_id FROM bookmarks');
  const maxId = result.rows.item(0).max_id;
  return maxId ? maxId + 1 : 1;
}

// Function to get or create tag IDs
async function getOrCreateTagIds(db, tags) {
  const tagIds = [];
  for (const tag of tags) {
    // Check if tag exists
    const result = await db.executeSql('SELECT id FROM bookmarks_tags WHERE tag = ?', [tag]);
    let tagId;
    
    if (result.rows.length === 0) {
      // Create new tag
      await db.executeSql('INSERT INTO bookmarks_tags (tag) VALUES (?)', [tag]);
      // Get the ID of the newly created tag
      const newTagResult = await db.executeSql('SELECT id FROM bookmarks_tags WHERE tag = ?', [tag]);
      tagId = newTagResult.rows.item(0).id;
      console.log(`Created new tag '${tag}' with ID: ${tagId}`);
    } else {
      tagId = result.rows.item(0).id;
      console.log(`Found existing tag '${tag}' with ID: ${tagId}`);
    }
    tagIds.push(tagId);
  }
  console.log('Final tag IDs:', tagIds);
  return tagIds;
}

// Function to check URL patterns and add automatic tags
async function getAutomaticTags(db, url) {
  // Primero obtenemos todos los patrones
  const patternsResult = await db.executeSql('SELECT url_pattern, tag FROM bookmarks_tag_url_patterns');
  const automaticTags = [];
  
  // Para cada patrón, verificamos si la URL lo contiene
  for (let i = 0; i < patternsResult.rows.length; i++) {
    const pattern = patternsResult.rows.item(i);
    if (url.includes(pattern.url_pattern)) {
      automaticTags.push(pattern.tag);
      console.log(`URL matches pattern '${pattern.url_pattern}', adding tag '${pattern.tag}'`);
    }
  }
  
  console.log('Automatic tags found:', automaticTags);
  return automaticTags;
}

// Function to decode HTML entities
function decodeHtmlEntities(text) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

// Function to check if URL exists in database
async function checkUrlExists(db, url) {
  const result = await db.executeSql('SELECT id, title FROM bookmarks WHERE url = ?', [url]);
  return result.rows.length > 0 ? result.rows.item(0) : null;
}

// Function to update existing bookmark
async function updateExistingBookmark(db, bookmarkId, bookmarkData) {
  await db.executeSql(
    'UPDATE bookmarks SET title = ?, description = ?, timestamp = ?, tag_ids = ? WHERE id = ?',
    [
      bookmarkData.title,
      bookmarkData.description,
      bookmarkData.timestamp,
      bookmarkData.tag_ids,
      bookmarkId
    ]
  );
}

// Function to show success animation
function showSuccessAnimation() {
  const animation = document.createElement('div');
  animation.className = 'success-animation';
  animation.innerHTML = `<div class="success-icon"></div>`;
  document.body.appendChild(animation);

  // Remove the animation element after it completes
  animation.addEventListener('animationend', () => {
    animation.remove();
    window.close();
  });
}

// Function to show custom dialog
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
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeDialog(false);
      }
    });
  });
}

// Function to show info dialog (one button)
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

// Save bookmark
saveButton.addEventListener('click', async () => {
  // Validate data before proceeding
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

    // First, download the current database
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
    
    // Open the database
    const db = await openDatabase(dbArrayBuffer);
    
    // Check if URL already exists
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
    
    // Get manual tags
    const manualTags = tagsInput.value.split(',').map(tag => tag.trim()).filter(tag => tag);
    console.log('Manual tags:', manualTags);
    
    // Get automatic tags from URL patterns
    const automaticTags = await getAutomaticTags(db, urlInput.value);
    console.log('Automatic tags:', automaticTags);
    
    // Combine and deduplicate tags
    const allTags = [...new Set([...manualTags, ...automaticTags])];
    console.log('All tags:', allTags);
    
    // Get or create tag IDs
    const tagIds = await getOrCreateTagIds(db, allTags);
    console.log('Tag IDs to be assigned:', tagIds);
    
    // Prepare bookmark data
    const bookmarkData = {
      title: titleInput.value.trim(),
      url: urlInput.value.trim(),
      description: descriptionInput.value.trim(),
      timestamp: new Date().toISOString(),
      lastModified: Date.now(),
      hidden: 0,
      tag_ids: JSON.stringify(tagIds)
    };

    if (existingBookmark) {
      // Update existing bookmark
      await updateExistingBookmark(db, existingBookmark.id, bookmarkData);
      console.log('Updating existing bookmark with data:', bookmarkData);
    } else {
      // Get next bookmark ID for new bookmark
      const nextId = await getNextBookmarkId(db);
      bookmarkData.id = nextId;
      
      // Insert new bookmark
      await db.executeSql(
        'INSERT INTO bookmarks (id, title, url, description, timestamp, hidden, tag_ids) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          bookmarkData.id,
          bookmarkData.title,
          bookmarkData.url,
          bookmarkData.description,
          bookmarkData.timestamp,
          bookmarkData.hidden,
          bookmarkData.tag_ids
        ]
      );
      console.log('Inserting new bookmark with data:', bookmarkData);
    }
    
    // Update sync_info with milliseconds timestamp
    await db.executeSql(
      'UPDATE sync_info SET last_modified = ? WHERE id = 1',
      [bookmarkData.lastModified]
    );
    
    // Get the updated database as a blob
    const updatedDbBlob = await db.export();
    
    // Upload the updated database
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
});

// Save options
saveOptionsButton.addEventListener('click', async () => {
  const config = {
    [CONFIG_KEYS.WEBDAV_URL]: cleanWebDAVUrl(webdavUrlInput.value),
    [CONFIG_KEYS.USERNAME]: usernameInput.value,
    [CONFIG_KEYS.PASSWORD]: passwordInput.value,
    [CONFIG_KEYS.DARK_MODE]: darkModeToggle.checked,
    [CONFIG_KEYS.EINK_MODE]: einkModeToggle.checked
  };

  await chrome.storage.sync.set(config);
  await showInfoDialog('Options Saved', 'Your options have been saved successfully.');
});

// Apply theme on toggle change
darkModeToggle.addEventListener('change', async () => {
  darkModeToggle.parentElement.classList.toggle('checked', darkModeToggle.checked);
  applyTheme(darkModeToggle.checked, einkModeToggle.checked);
  // Save immediately
  await chrome.storage.sync.set({ [CONFIG_KEYS.DARK_MODE]: darkModeToggle.checked });
});

// Apply theme on eink toggle change
einkModeToggle.addEventListener('change', async () => {
  einkModeToggle.parentElement.classList.toggle('checked', einkModeToggle.checked);
  applyTheme(darkModeToggle.checked, einkModeToggle.checked);
  // Save immediately
  await chrome.storage.sync.set({ [CONFIG_KEYS.EINK_MODE]: einkModeToggle.checked });
});

// Load selected text when think tab is opened
tabButtons.forEach(button => {
  button.addEventListener('click', async () => {
    const tabName = button.dataset.tab;
    
    // Update active tab button
    tabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Show selected tab content
    tabContents.forEach(content => {
      content.classList.toggle('hidden', content.id !== `${tabName}-tab`);
    });
  });
});

// Save think
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

    // Download the current database
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
    
    // Open the database
    const db = await openDatabase(dbArrayBuffer);
    
    // Get next think ID
    const nextIdResult = await db.executeSql('SELECT MAX(id) as max_id FROM thinks');
    const maxId = nextIdResult.rows.item(0).max_id;
    const nextId = maxId ? maxId + 1 : 1;
    
    // Get current timestamp
    const currentTime = Date.now();
    
    // Insert new think
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
    
    // Update sync_info
    await db.executeSql(
      'UPDATE sync_info SET last_modified = ? WHERE id = 1',
      [currentTime]
    );
    
    // Get the updated database as a blob
    const updatedDbBlob = await db.export();
    
    // Upload the updated database
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
      // Clear the form
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