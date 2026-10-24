import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { logger } from './logging/logger'
import { configureCSP } from './security/csp'
import { registerIpcHandlers } from './ipc/handlers'
import { registerMediaProtocol, registerMediaScheme } from './protocols/media-protocol'

registerMediaScheme()

const WINDOWS_APP_USER_MODEL_ID = 'com.scpt.app'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: 'SCPT — Studio de Création Pédagogique et Technique',
    icon: app.isPackaged
      ? join(process.resourcesPath, 'branding', 'scpt-icon.png')
      : join(__dirname, '../../build/icon.png'),
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    logger.info('Main window shown')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    logger.warn({ url: details.url }, 'Blocked external window.open')
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  logger.info({ isDev: !app.isPackaged }, 'Window created')
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId(WINDOWS_APP_USER_MODEL_ID)
  logger.info('Electron app ready')
  configureCSP(!app.isPackaged)
  registerMediaProtocol()
  registerIpcHandlers()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  logger.info('All windows closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  logger.info('App before-quit')
})

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception')
  app.quit()
})

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled rejection')
})
