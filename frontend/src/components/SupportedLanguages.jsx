import { useState } from "react"

export default function SupportedLanguages() {
  const SUPPORTED_LANGUAGES = [
    { 
      name: "Python", 
      extensions: ".py", 
      rules: 12, 
      status: "COMPLETE", 
      color: "#3776ab", 
      icon: "🐍",
      vulnerabilities: ["SQL Injection", "Code Execution", "Path Traversal", "Deserialization", "LDAP Injection"]
    },
    { 
      name: "JavaScript/TypeScript", 
      extensions: ".js, .ts, .jsx, .tsx", 
      rules: 13, 
      status: "COMPLETE", 
      color: "#f7df1e", 
      icon: "⚡",
      vulnerabilities: ["XSS", "CSRF", "Prototype Pollution", "DOM Injection", "Command Injection"]
    },
    { 
      name: "Java", 
      extensions: ".java, .class, .jar", 
      rules: 9, 
      status: "PARTIAL", 
      color: "#007396", 
      icon: "☕",
      vulnerabilities: ["SQL Injection", "XXE Injection", "Deserialization", "Path Traversal", "Hardcoded Secrets"]
    },
    { 
      name: "Go", 
      extensions: ".go", 
      rules: 10, 
      status: "PARTIAL", 
      color: "#00add8", 
      icon: "🐹",
      vulnerabilities: ["SQL Injection", "Path Traversal", "Hardcoded Secrets", "Weak Crypto", "Race Conditions"]
    },
    { 
      name: "Rust", 
      extensions: ".rs", 
      rules: 8, 
      status: "PARTIAL", 
      color: "#ce422b", 
      icon: "🦀",
      vulnerabilities: ["Unsafe Code", "Buffer Overflow", "Use After Free", "Integer Overflow", "Path Traversal"]
    },
    { 
      name: "C#/.NET", 
      extensions: ".cs, .csproj, .sln", 
      rules: 8, 
      status: "PARTIAL", 
      color: "#239120", 
      icon: "#️⃣",
      vulnerabilities: ["SQL Injection", "XXE Injection", "Hardcoded Secrets", "Path Traversal", "Weak Crypto"]
    },
    { 
      name: "C++", 
      extensions: ".cpp, .cc, .cxx, .h, .hpp", 
      rules: 9, 
      status: "PARTIAL", 
      color: "#00599c", 
      icon: "⚙️",
      vulnerabilities: ["Buffer Overflow", "SQL Injection", "Integer Overflow", "Use After Free", "Path Traversal"]
    },
    { 
      name: "PHP", 
      extensions: ".php, .php7, .phtml", 
      rules: 9, 
      status: "PARTIAL", 
      color: "#777bb4", 
      icon: "🐘",
      vulnerabilities: ["SQL Injection", "XSS", "SSRF", "Path Traversal", "Remote Code Execution"]
    },
    { 
      name: "Ruby", 
      extensions: ".rb, .erb", 
      rules: 9, 
      status: "PARTIAL", 
      color: "#cc342d", 
      icon: "💎",
      vulnerabilities: ["SQL Injection", "YAML Deserialization", "Hardcoded Secrets", "Path Traversal", "XSS"]
    },
    { 
      name: "Swift", 
      extensions: ".swift", 
      rules: 9, 
      status: "PARTIAL", 
      color: "#fa7343", 
      icon: "🍎",
      vulnerabilities: ["Hardcoded Secrets", "Insecure Storage", "Weak Crypto", "Path Traversal", "Code Injection"]
    },
    { 
      name: "Kotlin", 
      extensions: ".kt, .kts", 
      rules: 8, 
      status: "PARTIAL", 
      color: "#7f52ff", 
      icon: "🚀",
      vulnerabilities: ["SQL Injection", "Deserialization", "Hardcoded Secrets", "Path Traversal", "XXE Injection"]
    },
    { 
      name: "Shell/Bash", 
      extensions: ".sh, .bash, .zsh", 
      rules: 7, 
      status: "PARTIAL", 
      color: "#4eaa25", 
      icon: "💻",
      vulnerabilities: ["Command Injection", "Path Traversal", "Hardcoded Secrets", "Insecure Pipe", "Code Injection"]
    },
    { 
      name: "Dart", 
      extensions: ".dart", 
      rules: 9, 
      status: "PARTIAL", 
      color: "#0175c2", 
      icon: "🎯",
      vulnerabilities: ["Hardcoded Secrets", "Insecure Storage", "SQL Injection", "Path Traversal", "XSS"]
    },
    { 
      name: "General Rules", 
      extensions: "all files", 
      rules: 14, 
      status: "COMPLETE", 
      color: "#888888", 
      icon: "🔍",
      vulnerabilities: ["Hardcoded API Keys", "Secrets in Comments", "Git Leaks", "SSL Cert Issues", "License Violations"]
    },
  ]

  const [expanded, setExpanded] = useState({})

  const toggleExpanded = (idx) => {
    setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const StatusBadge = ({ status }) => {
    const colors = {
      COMPLETE: { bg: "rgba(34, 197, 94, 0.1)", text: "#22c55e", label: "Production Ready" },
      PARTIAL: { bg: "rgba(234, 179, 8, 0.1)", text: "#eab308", label: "Enhanced Support" },
      MISSING: { bg: "rgba(239, 68, 68, 0.1)", text: "#ef4444", label: "Coming Soon" },
    }
    const color = colors[status]
    if (!color) return null
    return (
      <div 
        className="text-xs font-medium px-2.5 py-1 rounded-full"
        style={{ background: color.bg, color: color.text }}
      >
        {color.label}
      </div>
    )
  }

  const LanguageCard = ({ lang, idx, isExpanded }) => (
    <div
      className="rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:scale-105"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `2px solid ${lang.color}`,
        borderOpacity: "0.2",
      }}
      onClick={() => toggleExpanded(idx)}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-3xl">{lang.icon}</span>
            <h3 className="text-lg font-bold text-white">{lang.name}</h3>
          </div>
          <p className="text-sm text-white/40">{lang.extensions}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{lang.rules}</p>
          <p className="text-xs text-white/40">rules</p>
        </div>
      </div>
      
      <StatusBadge status={lang.status} />

      {isExpanded && lang.vulnerabilities && lang.vulnerabilities.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Detects</p>
          <ul className="space-y-1">
            {lang.vulnerabilities.slice(0, 5).map((vuln, i) => (
              <li key={i} className="text-sm text-white/70 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full" style={{ background: lang.color }} />
                {vuln}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )

  const stats = {
    total: SUPPORTED_LANGUAGES.length,
    complete: SUPPORTED_LANGUAGES.filter(l => l.status === "COMPLETE").length,
    partial: SUPPORTED_LANGUAGES.filter(l => l.status === "PARTIAL").length,
    missing: SUPPORTED_LANGUAGES.filter(l => l.status === "MISSING").length,
    rules: SUPPORTED_LANGUAGES.reduce((sum, l) => sum + l.rules, 0),
  }

  return (
    <div className="mb-8">
      {/* Stats Header */}
      <div className="mb-8 animate-slide-up">
        <h2 className="text-2xl font-bold text-white mb-2">Language Support</h2>
        <p className="text-white/50 mb-4">
          Comprehensive security scanning across {stats.total} programming languages with {stats.rules} individual security rules.
        </p>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg p-3" style={{ background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.2)" }}>
            <p className="text-2xl font-bold" style={{ color: "#22c55e" }}>{stats.complete}</p>
            <p className="text-xs text-white/50">Production Ready</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.2)" }}>
            <p className="text-2xl font-bold" style={{ color: "#eab308" }}>{stats.partial}</p>
            <p className="text-xs text-white/50">Enhanced Support</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
            <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>{stats.missing}</p>
            <p className="text-xs text-white/50">Coming Soon</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "rgba(255, 107, 43, 0.1)", border: "1px solid rgba(255, 107, 43, 0.2)" }}>
            <p className="text-2xl font-bold" style={{ color: "#FF6B2B" }}>{stats.rules}</p>
            <p className="text-xs text-white/50">Total Rules</p>
          </div>
        </div>
      </div>

      {/* Production Ready Section */}
      <div className="mb-8 animate-slide-up" style={{ animationDelay: "0.04s" }}>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span style={{ color: "#22c55e" }}>●</span> Production Ready
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SUPPORTED_LANGUAGES.filter(l => l.status === "COMPLETE").map((lang, idx) => (
            <LanguageCard 
              key={lang.name} 
              lang={lang} 
              idx={`complete-${idx}`}
              isExpanded={expanded[`complete-${idx}`]}
            />
          ))}
        </div>
      </div>

      {/* Enhanced Support Section */}
      <div className="mb-8 animate-slide-up" style={{ animationDelay: "0.08s" }}>
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span style={{ color: "#eab308" }}>●</span> Enhanced Support
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SUPPORTED_LANGUAGES.filter(l => l.status === "PARTIAL").map((lang, idx) => (
            <LanguageCard 
              key={lang.name} 
              lang={lang} 
              idx={`partial-${idx}`}
              isExpanded={expanded[`partial-${idx}`]}
            />
          ))}
        </div>
      </div>

      {/* Coming Soon Section */}
      {SUPPORTED_LANGUAGES.filter(l => l.status === "MISSING").length > 0 && (
        <div className="animate-slide-up" style={{ animationDelay: "0.12s" }}>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span style={{ color: "#ef4444" }}>●</span> Coming Soon
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SUPPORTED_LANGUAGES.filter(l => l.status === "MISSING").map((lang, idx) => (
              <LanguageCard 
                key={lang.name} 
                lang={lang} 
                idx={`missing-${idx}`}
                isExpanded={expanded[`missing-${idx}`]}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
