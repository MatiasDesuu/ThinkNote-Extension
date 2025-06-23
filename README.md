# ThinkNote Bookmarker Chrome Extension

A simple Chrome extension to save bookmarks to a WebDAV SQLite database.

## Features

- Save bookmarks with title, URL, description, and tags
- Automatic tag assignment based on URL patterns
- WebDAV server configuration
- Simple and intuitive interface

## Installation

1. Clone this repository or download the ZIP file
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## Configuration

1. Click on the extension icon in Chrome
2. Go to the "Options" tab
3. Enter your WebDAV server URL, username, and password
4. Click "Save Options"

## Usage

1. Navigate to any webpage you want to bookmark
2. Click on the extension icon
3. The URL and title will be automatically filled
4. Add a description and tags (comma-separated)
5. Click "Save Bookmark"

## Database Structure

The extension uses a SQLite database with the following tables:

### bookmarks
- id (INTEGER PRIMARY KEY)
- title (TEXT)
- url (TEXT)
- description (TEXT)
- timestamp (TEXT)
- tag_ids (TEXT)

### bookmarks_tag_url_patterns
- id (INTEGER PRIMARY KEY)
- url_pattern (TEXT)
- tag (TEXT)

### bookmarks_tags
- id (INTEGER PRIMARY KEY)
- tag (TEXT)

### sync_info
- id (INTEGER PRIMARY KEY)
- last_modified (TEXT)

## Development

The extension is built using vanilla JavaScript and HTML/CSS. No build process is required.

### Project Structure

```
thinknote_extension/
├── manifest.json
├── popup.html
├── popup.js
├── styles.css
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## License

MIT License 