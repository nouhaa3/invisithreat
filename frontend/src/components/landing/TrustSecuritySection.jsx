/**
 * Trust & Security Section - DevSecOps Landing Page
 * Privacy-first architecture explanation (similar to Snyk)
 */

import { SecurityLockIcon, HomeIcon, CloudIcon, DockerIcon, EyeIcon, CheckIcon, ShieldIcon, LockIcon } from '../icons/LandingIcons';

export default function TrustSecuritySection() {
  const trustPoints = [
    {
      icon: SecurityLockIcon,
      title: 'Code Handling',
      description: 'Source code is never stored permanently on our servers',
      details: [
        'Scans execute in isolated environments',
        'Temporary data deleted after completion',
        'No backup retention',
      ],
    },
    {
      icon: HomeIcon,
      title: 'Local-only Mode',
      description: 'Keep your code on your machine completely',
      details: [
        'Code never leaves your system',
        'Zero data transmission to external servers',
        'Results stored locally in JSON format',
      ],
    },
    {
      icon: CloudIcon,
      title: 'Platform Scans',
      description: 'Only minimal metadata is ever transmitted',
      details: [
        'Only scan results (not code) uploaded',
        'Zero code retention policy',
        'Access limited to authorized users',
      ],
    },
    {
      icon: DockerIcon,
      title: 'Isolation & Execution',
      description: 'Enterprise-grade security through containerization',
      details: [
        'Scans run in isolated Docker containers',
        'Each scan is completely isolated from others',
        'No shared execution environment',
      ],
    },
  ];

  const privacyBadges = [
    { label: 'No Code Retention', icon: CheckIcon, color: 'green' },
    { label: 'Local-First Architecture', icon: HomeIcon, color: 'blue' },
    { label: 'Secure Scan Isolation', icon: ShieldIcon, color: 'purple' },
    { label: 'Privacy by Default', icon: LockIcon, color: 'orange' },
  ];

  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8">
      {/* Background elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/3 right-1/3 w-96 h-96 rounded-full bg-green-500/5 blur-3xl" />
        <div className="absolute bottom-1/3 left-1/4 w-96 h-96 rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-20 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 uppercase tracking-[0.2em]">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
            Enterprise Security
          </div>
          <h2 className="mt-4 text-3xl md:text-4xl font-heading">
            Privacy-First Architecture
          </h2>
          <p className="mt-4 text-sm md:text-base text-white/55 max-w-xl">
            Your code is your business. InvisiThreat is built with privacy and security at its core,
            giving you full control over your sensitive data.
          </p>
        </div>

        {/* Trust Points Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {trustPoints.map((point, i) => {
            const IconComponent = point.icon;
            return (
              <div
                key={i}
                className="p-6 rounded-2xl border border-white/10 backdrop-blur-xl hover:border-white/20 transition-all group"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                }}
              >
                {/* Icon */}
                <div className="flex justify-start mb-4 group-hover:scale-110 transition-transform origin-left">
                  <IconComponent size={28} className="text-orange-400" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-white mb-2">{point.title}</h3>
                <p className="text-white/60 text-sm mb-4">{point.description}</p>

                {/* Details */}
                <div className="space-y-2">
                  {point.details.map((detail, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <CheckIcon size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                      <span className="text-white/50 text-sm">{detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Transparency Statement */}
        <div className="rounded-2xl border border-white/10 p-8 mb-16 backdrop-blur-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          }}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 p-3 rounded-xl bg-white/5 border border-white/10">
              <EyeIcon size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Full Transparency</h3>
              <div className="space-y-3 text-white/70 text-sm">
                <p>
                  <span className="text-white font-semibold">Users choose their scan mode.</span> Local-only for
                  maximum privacy, or cloud for team collaboration.
                </p>
                <p>
                  <span className="text-white font-semibold">No hidden data processing.</span> Every piece of data
                  movement is logged and available in your dashboard.
                </p>
                <p>
                  <span className="text-white font-semibold">Full visibility.</span> You have complete visibility
                  into what data is collected, how it's used, and how long it's retained.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Badges */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {privacyBadges.map((badge, i) => {
            const BadgeIcon = badge.icon;
            const colorMap = {
              green: 'from-green-500/20 to-green-500/5 border-green-500/30 text-green-400',
              blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400',
              purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400',
              orange: 'from-orange-500/20 to-orange-500/5 border-orange-500/30 text-orange-400',
            };

            return (
              <div
                key={i}
                className={`p-4 rounded-xl border backdrop-blur-xl text-center bg-gradient-to-br ${colorMap[badge.color]}`}
              >
                <div className="flex justify-center mb-2">
                  <BadgeIcon size={20} className={colorMap[badge.color].split(' ').pop()} />
                </div>
                <p className="font-semibold text-sm">{badge.label}</p>
              </div>
            );
          })}
        </div>

        {/* Comparison with Industry */}
        <div className="mt-20 pt-20 border-t border-white/10">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-white mb-2">Industry-Leading Privacy</h3>
            <p className="text-white/60">Compared to other DevSecOps platforms</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 backdrop-blur-xl">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left py-4 px-4 sm:px-6 font-semibold text-white text-sm sm:text-base">Feature</th>
                  <th className="text-center py-4 px-3 sm:px-6 font-semibold text-orange-400 text-sm sm:text-base">InvisiThreat</th>
                  <th className="text-center py-4 px-3 sm:px-6 font-semibold text-white/40 text-sm sm:text-base">Other Platforms</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Local-only scanning', invisithreat: true, other: false },
                  { feature: 'No code retention', invisithreat: true, other: false },
                  { feature: 'End-to-end encrypted', invisithreat: true, other: true },
                  { feature: 'Docker isolation', invisithreat: true, other: false },
                  { feature: 'Privacy-first design', invisithreat: true, other: false },
                  { feature: 'Data deletion after scan', invisithreat: true, other: false },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 sm:px-6 text-white/80 text-sm sm:text-base">{row.feature}</td>
                    <td className="py-3 px-3 sm:px-6 text-center">
                      {row.invisithreat ? (
                        <span className="text-green-400 font-bold">✓</span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 sm:px-6 text-center">
                      {row.other ? (
                        <span className="text-green-400/50">✓</span>
                      ) : (
                        <span className="text-white/20">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
