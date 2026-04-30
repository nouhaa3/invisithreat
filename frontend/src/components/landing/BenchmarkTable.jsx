/**
 * Benchmark Comparison Table - DevSecOps Landing Page
 * Compare InvisiThreat with other platforms
 */

import { ZapIcon, ShieldIcon, TerminalIcon } from '../icons/LandingIcons';

export default function BenchmarkTable() {
  const comparison = [
    {
      category: 'Privacy & Data',
      features: [
        { name: 'Local-only mode', invisithreat: true, others: false },
        { name: 'No code retention', invisithreat: true, others: false },
        { name: 'Data deletion after scan', invisithreat: true, others: false },
        { name: 'End-to-end encryption', invisithreat: true, others: true },
      ],
    },
    {
      category: 'Scanning Capabilities',
      features: [
        { name: 'SAST (Static Analysis)', invisithreat: true, others: true },
        { name: 'Dependency scanning', invisithreat: true, others: true },
        { name: 'Container scanning', invisithreat: false, others: true },
        { name: 'IaC scanning', invisithreat: true, others: true },
      ],
    },
    {
      category: 'Performance & Isolation',
      features: [
        { name: 'Sub-second scans', invisithreat: true, others: false },
        { name: 'Docker isolation', invisithreat: true, others: false },
        { name: 'Local CLI tool', invisithreat: true, others: true },
        { name: 'CI/CD integration', invisithreat: true, others: true },
      ],
    },
    {
      category: 'Developer Experience',
      features: [
        { name: 'Web dashboard', invisithreat: true, others: true },
        { name: 'Detailed recommendations', invisithreat: true, others: true },
        { name: 'API access', invisithreat: true, others: true },
        { name: 'Open source focus', invisithreat: true, others: false },
      ],
    },
  ];

  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8">
      {/* Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute bottom-1/3 left-1/3 w-96 h-96 rounded-full bg-pink-500/5 blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 uppercase tracking-[0.2em]">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
            Comparison
          </div>
          <h2 className="mt-4 text-3xl md:text-4xl font-heading">
            How InvisiThreat Stacks Up
          </h2>
          <p className="mt-4 text-sm md:text-base text-white/55 max-w-xl">
            See why security-conscious teams choose InvisiThreat for privacy-first vulnerability scanning
          </p>
        </div>

        {/* Comparison Sections */}
        <div className="space-y-8">
          {comparison.map((section, sectionIdx) => (
            <div key={sectionIdx} className="animate-slide-up" style={{ animationDelay: `${sectionIdx * 0.1}s` }}>
              {/* Section Header */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-gradient-to-r from-orange-400 to-orange-600" />
                  {section.category}
                </h3>
              </div>

              {/* Table */}
              <div className="rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl" style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)',
              }}>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5">
                      <th className="text-left py-4 px-4 sm:px-6 font-semibold text-white text-sm sm:text-base">Feature</th>
                      <th className="text-center py-4 px-3 sm:px-6 font-semibold">
                        <div className="flex flex-col items-center">
                          <span className="text-orange-400 text-sm sm:text-base">InvisiThreat</span>
                          <span className="text-xs text-orange-400/60 font-normal mt-1 hidden sm:block">Our Platform</span>
                        </div>
                      </th>
                      <th className="text-center py-4 px-3 sm:px-6 font-semibold">
                        <div className="flex flex-col items-center">
                          <span className="text-white/60 text-sm sm:text-base">Others</span>
                          <span className="text-xs text-white/40 font-normal mt-1 hidden sm:block">Typical</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.features.map((feature, featureIdx) => (
                      <tr
                        key={featureIdx}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                      >
                        {/* Feature Name */}
                        <td className="py-3 sm:py-4 px-4 sm:px-6 text-white/80 text-sm sm:text-base">{feature.name}</td>

                        {/* InvisiThreat */}
                        <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">
                          {feature.invisithreat ? (
                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-500/20 border border-green-500/50">
                              <span className="text-green-400 font-bold text-sm">✓</span>
                            </div>
                          ) : (
                            <span className="text-white/20 font-bold">—</span>
                          )}
                        </td>

                        {/* Others */}
                        <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">
                          {feature.others ? (
                            <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/10">
                              <span className="text-white/40 font-bold text-sm">✓</span>
                            </div>
                          ) : (
                            <span className="text-white/20 font-bold">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Key Differentiators */}
        <div className="mt-20 pt-20 border-t border-white/10 grid md:grid-cols-3 gap-8">
          {[
            {
              icon: ShieldIcon,
              title: 'Privacy First',
              description: 'Your code never leaves your machine unless you explicitly choose to share scan results',
              color: 'from-blue-500/20 to-blue-500/5',
              borderColor: 'border-blue-500/30',
            },
            {
              icon: ZapIcon,
              title: 'Lightning Fast',
              description: 'Sub-second scans using optimized algorithms and Docker isolation for instant feedback',
              color: 'from-yellow-500/20 to-yellow-500/5',
              borderColor: 'border-yellow-500/30',
            },
            {
              icon: TerminalIcon,
              title: 'Developer Friendly',
              description: 'Simple CLI, detailed recommendations, and seamless CI/CD integration for modern workflows',
              color: 'from-purple-500/20 to-purple-500/5',
              borderColor: 'border-purple-500/30',
            },
          ].map((differentiator, i) => {
            const IconComponent = differentiator.icon;
            return (
              <div
                key={i}
                className={`p-6 rounded-2xl border ${differentiator.borderColor} backdrop-blur-xl bg-gradient-to-br ${differentiator.color} hover:border-white/20 transition-all`}
              >
                <div className="mb-4 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/10">
                  <IconComponent size={20} className="text-white" />
                </div>
                <h4 className="font-bold text-white text-lg mb-2">{differentiator.title}</h4>
                <p className="text-white/60 text-sm">{differentiator.description}</p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="text-white/60 mb-6">Ready to experience privacy-first security scanning?</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-3 rounded-lg font-semibold text-white transition-all hover:shadow-lg hover:shadow-orange-500/20"
              style={{
                background: 'linear-gradient(135deg, #FF6B2B 0%, #E84D0E 100%)',
              }}>
              Get Started Free
            </button>
            <button className="px-8 py-3 rounded-lg font-semibold text-white border border-white/20 hover:border-white/40 transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
              }}>
              View Documentation
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
