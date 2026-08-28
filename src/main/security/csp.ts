import { session } from 'electron'

export function configureCSP(isDev: boolean): void {
  // Production: strict script-src 'self' (Vite bundles JS as files, no inline scripts).
  // Development: Vite injects the @vitejs/plugin-react refresh preamble as an inline
  // script, which requires 'unsafe-inline' in the script-src directive. This relaxation
  // applies ONLY to dev mode; the packaged app keeps script-src 'self'.
  const scriptSrc = isDev ? "'self' 'unsafe-inline'" : "'self'"

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: scpt-media:; font-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*; worker-src 'self' blob:; media-src 'self' data: blob:;`
        ]
      }
    })
  })
}
