import { useState } from "react"
import { useNavigate } from "react-router-dom"
import AppLayout from "../components/AppLayout"
import SupportedLanguages from "../components/SupportedLanguages"

export default function FeaturesPage() {
  const navigate = useNavigate()

  return (
    <AppLayout>
      <main className="flex-1 overflow-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* Header */}
          <div className="mb-8 animate-slide-up">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white/70 mb-4 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-white mb-2">Security Scanner Features</h1>
            <p className="text-white/50 max-w-2xl">
              InvisiThreat automatically detects vulnerabilities across 14 programming languages using OWASP Top 10 security rules. Our comprehensive rule set covers 157 individual security patterns.
            </p>
          </div>

          {/* Key Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-slide-up" style={{ animationDelay: "0.04s" }}>
            {[
              { label: "14 Languages", value: "Complete coverage", icon: "🌍" },
              { label: "157 Security Rules", value: "14 rules/language avg", icon: "[*]" },
              { label: "OWASP Mapped", value: "A01-A08 covered", icon: "🛡️" },
              { label: "Real-time Scanning", value: "GitHub webhook", icon: "⚡" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl p-4 text-center"
                style={{
                  background: "linear-gradient(170deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="text-2xl mb-2">{stat.icon}</p>
                <p className="font-bold text-white text-sm">{stat.label}</p>
                <p className="text-[11px] text-white/40 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Main Content */}
          <div className="animate-slide-up" style={{ animationDelay: "0.08s" }}>
            <SupportedLanguages />
          </div>
        </div>
      </main>
    </AppLayout>
  )
}
