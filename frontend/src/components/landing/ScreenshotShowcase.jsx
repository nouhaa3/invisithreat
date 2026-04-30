/**
 * Screenshot Showcase - DevSecOps Landing Page
 * Gallery of platform screenshots with descriptions
 */

import { useState } from 'react';
import { BarChart3, Search, ZapIcon, TerminalIcon } from '../icons/LandingIcons';

export default function ScreenshotShowcase() {
  const [activeScreenshot, setActiveScreenshot] = useState(0);

  const screenshots = [
    {
      title: 'Dashboard',
      description: 'Real-time security metrics and project overview at a glance',
      icon: BarChart3,
      features: ['Risk scoring', 'Vulnerability trends', 'Recent activity'],
      color: 'from-blue-500/20 to-blue-500/5',
      borderColor: 'border-blue-500/30',
    },
    {
      title: 'Vulnerabilities List',
      description: 'Comprehensive view of all detected security issues with severity levels',
      icon: Search,
      features: ['SAST findings', 'Dependency vulnerabilities', 'Severity filtering'],
      color: 'from-orange-500/20 to-orange-500/5',
      borderColor: 'border-orange-500/30',
    },
    {
      title: 'Vulnerability Details',
      description: 'Deep dive into each vulnerability with recommendations and fix guidance',
      icon: ZapIcon,
      features: ['Code snippet', 'Remediation steps', 'CWE references'],
      color: 'from-red-500/20 to-red-500/5',
      borderColor: 'border-red-500/30',
    },
    {
      title: 'CLI Output',
      description: 'Real-time scanning progress and results in your terminal',
      icon: TerminalIcon,
      features: ['Live progress', 'File analysis', 'Result summary'],
      color: 'from-green-500/20 to-green-500/5',
      borderColor: 'border-green-500/30',
    },
  ];

  const current = screenshots[activeScreenshot];

  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8">
      {/* Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/3 w-96 h-96 rounded-full bg-purple-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 uppercase tracking-[0.2em]">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
            Platform Tour
          </div>
          <h2 className="mt-4 text-3xl md:text-4xl font-heading">
            See InvisiThreat in Action
          </h2>
          <p className="mt-4 text-sm md:text-base text-white/55 max-w-2xl">
            Explore every corner of our platform and discover powerful security insights
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {/* Main Screenshot Display */}
          <div className="lg:col-span-2 animate-scale-in">
            <div className={`rounded-2xl border ${current.borderColor} backdrop-blur-xl overflow-hidden bg-gradient-to-br ${current.color}`}>
              {/* Mock Screenshot */}
              <div className="aspect-video bg-gradient-to-br from-white/5 to-white/0 flex items-center justify-center relative overflow-hidden">
                {/* Decorative grid */}
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                    backgroundSize: '2rem 2rem',
                  }}
                />

                {/* Content */}
                <div className="relative text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
                    <current.icon size={32} className="text-white" />
                  </div>
                  <p className="text-white/60 text-sm">{current.title}</p>
                </div>

                {/* Accent elements */}
                <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/5 blur-2xl -z-10" />
                <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-white/5 blur-2xl -z-10" />
              </div>

              {/* Info Bar */}
              <div className="px-6 py-4 border-t border-white/10 bg-white/5">
                <h3 className="text-xl font-bold text-white mb-2">{current.title}</h3>
                <p className="text-white/60 text-sm mb-4">{current.description}</p>

                <div className="flex flex-wrap gap-2">
                  {current.features.map((feature, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-white/10 text-white/70 border border-white/10"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Thumbnail Navigation */}
          <div className="flex lg:flex-col gap-4 animate-slide-up">
            {screenshots.map((screenshot, i) => {
              const ScreenIcon = screenshot.icon;
              return (
                <button
                  key={i}
                  onClick={() => setActiveScreenshot(i)}
                  className={`p-4 rounded-xl text-left transition-all group ${
                    i === activeScreenshot
                      ? 'ring-2 ring-offset-2 ring-orange-500 ring-offset-black'
                      : 'hover:bg-white/5'
                  }`}
                  style={{
                    background: i === activeScreenshot ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${i === activeScreenshot ? 'rgba(255,107,43,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <ScreenIcon size={20} className="text-white group-hover:scale-110 transition-transform" />
                  </div>
                  <p className="font-semibold text-white text-sm">{screenshot.title}</p>
                  <p className="text-white/40 text-xs mt-1">{screenshot.description.substring(0, 40)}...</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="mt-20 pt-20 border-t border-white/10">
          <div className="text-center mb-12">
            <h3 className="text-2xl font-bold text-white mb-2">One-Step Workflow</h3>
            <p className="text-white/60">From upload to insights in minutes</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Upload', desc: 'Push code to scan' },
              { step: '2', title: 'Scan', desc: 'Automated analysis' },
              { step: '3', title: 'Review', desc: 'View all findings' },
              { step: '4', title: 'Fix', desc: 'Apply recommendations' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                {/* Step number */}
                <div className="mb-4 flex justify-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-500/5 border border-orange-500/30 flex items-center justify-center">
                    <span className="text-lg font-bold text-orange-400">{item.step}</span>
                  </div>
                </div>

                {/* Content */}
                <h4 className="font-bold text-white mb-2">{item.title}</h4>
                <p className="text-white/60 text-sm">{item.desc}</p>

                {/* Arrow (except last) */}
                {i < 3 && (
                  <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-6">
                    <svg className="w-4 h-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
