/**
 * CLI Section - DevSecOps Landing Page
 * Shows command example, output, and privacy assurance
 */

import { ZapIcon, ShieldIcon, LockIcon } from '../icons/LandingIcons';

export default function CLISection() {
  const commandExample = `curl "${window.location.origin}/api/scanner/download" -o scan.py
python scan.py . --token=YOUR_TOKEN --api-url ${window.location.origin}`;

  const outputExample = `[INFO] InvisiThreat Scanner v1.0.0
[INFO] Scanning directory: /app
[INFO] Found 124 files to analyze
[DEBUG] SAST patterns: 45 loaded
[DEBUG] Dependency check: enabled
[INFO] Scan started at 2026-04-30 14:32:15
[✓] JavaScript files: 28 vulnerabilities
[✓] Python files: 12 vulnerabilities  
[✓] Dependencies: 3 outdated packages
[INFO] Scan completed in 2.34s
[INFO] Results uploaded successfully
🎯 Dashboard: ${window.location.origin}/projects/1/scans/123`;

  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/4 w-96 h-96 rounded-full bg-orange-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 uppercase tracking-[0.2em]">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
            Quick Start
          </div>
          <h2 className="mt-4 text-3xl md:text-4xl font-heading">
            Scan in Seconds
          </h2>
          <p className="mt-4 text-sm md:text-base text-white/55 max-w-xl">
            Three simple commands to detect vulnerabilities in your codebase
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-stretch">
          {/* Command Section */}
          <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl h-full min-h-[420px] flex flex-col"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
              }}>
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <span className="text-xs font-mono text-white/40">terminal</span>
              </div>

              {/* Content */}
              <div className="p-6 flex-1 flex flex-col">
                <div className="mb-4">
                  <p className="text-xs text-white/40 font-mono mb-2">$ run this command</p>
                  <pre className="text-sm font-mono text-white/90 whitespace-pre-wrap break-words">
                    {commandExample}
                  </pre>
                </div>

                {/* Privacy Note */}
                <div className="mt-auto p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <p className="text-xs text-blue-400/80 font-medium flex items-center gap-2">
                    <LockIcon size={14} className="text-blue-400 flex-shrink-0" />
                    <span><span className="text-blue-400">Privacy First:</span> Your code stays local by default. Only scan results are uploaded.</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Output Section */}
          <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl h-full min-h-[420px] flex flex-col"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
              }}>
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <span className="text-xs font-mono text-white/40">scan output</span>
              </div>

              {/* Content */}
              <div className="p-6 flex-1 overflow-y-auto">
                <pre className="text-xs font-mono text-green-400/90 whitespace-pre-wrap break-words">
                  {outputExample}
                </pre>
              </div>

              {/* Footer Stats */}
              <div className="px-6 py-4 border-t border-white/10 bg-white/5 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-400">43</p>
                  <p className="text-xs text-white/40 mt-1">Vulnerabilities</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">3</p>
                  <p className="text-xs text-white/40 mt-1">Critical</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400">2.34s</p>
                  <p className="text-xs text-white/40 mt-1">Total time</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="mt-16 grid sm:grid-cols-3 gap-4">
          {[
            { icon: ZapIcon, label: 'Sub-second scans', desc: 'Fast results on demand' },
            { icon: ShieldIcon, label: 'No code retention', desc: 'Local-first by design' },
            { icon: LockIcon, label: 'Secure isolation', desc: 'Docker containerized' },
          ].map((badge, i) => {
            const IconComponent = badge.icon;
            return (
              <div
                key={i}
                className="p-4 rounded-xl border border-white/10 backdrop-blur-xl text-center hover:border-orange-500/30 transition-all"
                style={{ background: 'rgba(255, 255, 255, 0.03)' }}
              >
                <div className="flex justify-center mb-2">
                  <IconComponent size={24} className="text-orange-400" />
                </div>
                <p className="text-sm font-semibold text-white">{badge.label}</p>
                <p className="text-xs text-white/50 mt-1">{badge.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
