import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const EXTENSION_ASYNC_CHANNEL_CLOSED =
  'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received'

if (!window.__ivtExtensionRejectionFilterInstalled) {
  window.__ivtExtensionRejectionFilterInstalled = true
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = typeof reason === 'string' ? reason : reason?.message

    // Ignore a known Chrome extension message-channel rejection that is external to the app.
    if (typeof message === 'string' && message.includes(EXTENSION_ASYNC_CHANNEL_CLOSED)) {
      event.preventDefault()
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
