const { app, BrowserWindow } = require('electron');
const path = require('node:path');
app.whenReady().then(() => {
  const window = new BrowserWindow({ width: 1440, height: 1000, minWidth: 900, minHeight: 680, backgroundColor: '#101513', autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false } });
  window.loadFile(path.join(__dirname, '../dist/index.html'));
});
app.on('window-all-closed', () => app.quit());
