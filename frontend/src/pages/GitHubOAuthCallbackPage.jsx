import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const ACCENT = '#ff8c5a'

export default function GitHubOAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (code && state && window.opener) {
      window.opener.postMessage(
        { type: 'GITHUB_OAUTH_CODE', code, state },
        window.location.origin
      )
    }
  }, [code, state])

  const handleCopyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)'}}>
      <div className="w-full max-w-md rounded-2xl p-8 border" style={{background: '#111111', border: '1px solid rgba(255,140,90,0.2)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)'}}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold" style={{background: 'rgba(255,140,90,0.15)', color: ACCENT}}>?</div>
          <h1 className="text-2xl font-bold text-white mb-2">{error ? 'Authorization Failed' : 'OAuth Successful!'}</h1>
          <p className="text-white/60 text-sm">{error ? 'GitHub authorization was denied' : 'GitHub has authorized InvisiThreat'}</p>
        </div>

        {error && <div className="p-4 rounded-lg mb-6 text-sm border" style={{background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5'}}>
          <p className="font-semibold mb-1">{error}</p>
          {errorDescription && <p className="text-xs opacity-80">{errorDescription}</p>}
        </div>}

        {!error && code && <>
          <div className="p-4 rounded-lg mb-6 text-sm border" style={{background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)'}}>
            <p className="text-green-300 text-xs uppercase tracking-wide font-semibold mb-2">Authorization Code</p>
            <div className="p-3 rounded font-mono text-xs break-all cursor-pointer hover:opacity-80 transition-opacity" style={{background: 'rgba(0,0,0,0.3)', color: ACCENT, border: '1px solid rgba(255,140,90,0.2)'}} onClick={handleCopyCode} title="Click to copy">{code}</div>
            <p className="text-white/40 text-xs mt-2">{copied ? '? Copied to clipboard' : 'Click to copy code'}</p>
          </div>
          <div className="p-4 rounded-lg mb-6" style={{background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)'}}>
            <p className="text-blue-300 text-sm">?? Paste this code in InvisiThreat or close this window.</p>
          </div>
        </>}

        <button onClick={() => window.close()} className="w-full py-3 rounded-lg font-semibold text-white transition-all" style={{background: 'linear-gradient(to right, #FF6B2B, #ff8c5a)', boxShadow: '0 10px 30px -12px rgba(255,140,90,0.5)'}}>{error ? 'Close' : 'Close Window'}</button>
        <p className="text-center text-white/30 text-xs mt-6">InvisiThreat v0.1.0</p>
      </div>
    </div>
  )
}
