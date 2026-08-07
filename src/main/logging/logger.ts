import pino from 'pino'
import { app } from 'electron'
import { join } from 'path'

const isDev = !app.isPackaged

const logDir = join(app.getPath('userData'), 'logs')
const logFile = join(logDir, 'scpt.log')

export const logger = pino({
  name: 'scpt',
  level: isDev ? 'debug' : 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' }
        }
      }
    : {
        transport: {
          targets: [
            {
              target: 'pino/file',
              options: { destination: logFile, mkdir: true },
              level: 'info'
            }
          ]
        }
      })
})

logger.info({ isDev, userData: app.getPath('userData') }, 'Logger initialized')