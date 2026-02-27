/**
 * AuthLayout - WOW split layout with animated orange orbs + glassmorphism
 */
export default function AuthLayout({ children, imageContent }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#080808' }}
    >
      {/* Full-page ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full animate-float-slow"
          style={{ background: 'radial-gradient(circle, rgba(255,107,43,0.15) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full animate-float-med animation-delay-2000"
          style={{ background: 'radial-gradient(circle, rgba(232,77,14,0.12) 0%, transparent 70%)' }} />
      </div>

      {/* Main card */}
      <div className="w-full max-w-6xl rounded-3xl overflow-hidden flex shadow-2xl min-h-[720px] relative z-10"
        style={{
          background: 'rgba(14,14,14,0.95)',
          border: '1px solid rgba(255,107,43,0.12)',
          boxShadow: '0 0 80px rgba(255,107,43,0.08), 0 40px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Left - Animated brand panel */}
        <div className="hidden md:flex md:w-[45%] relative overflow-hidden">
          {/* Base gradient */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(160deg, #1a0800 0%, #0d0d0d 40%, #120600 100%)' }} />

          {/* Animated orbs */}
          <div className="absolute top-[-60px] left-[-60px] w-72 h-72 rounded-full animate-float-slow"
            style={{ background: 'radial-gradient(circle, rgba(255,107,43,0.55) 0%, rgba(232,77,14,0.2) 40%, transparent 70%)', filter: 'blur(20px)' }} />
          <div className="absolute bottom-[-40px] right-[-40px] w-56 h-56 rounded-full animate-float-med animation-delay-2000"
            style={{ background: 'radial-gradient(circle, rgba(200,60,0,0.5) 0%, rgba(255,80,0,0.2) 40%, transparent 70%)', filter: 'blur(15px)' }} />
          <div className="absolute top-[40%] left-[30%] w-40 h-40 rounded-full animate-pulse-glow animation-delay-1000"
            style={{ background: 'radial-gradient(circle, rgba(255,140,80,0.3) 0%, transparent 70%)', filter: 'blur(10px)' }} />
          <div className="absolute top-[20%] right-[10%] w-24 h-24 rounded-full animate-float-fast animation-delay-3000"
            style={{ background: 'radial-gradient(circle, rgba(255,60,0,0.4) 0%, transparent 70%)', filter: 'blur(8px)' }} />

          {/* Grid overlay subtle */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          {/* Logo */}
          <div className="absolute top-7 left-7 z-10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #FF6B2B, #C13A00)', boxShadow: '0 0 20px rgba(255,107,43,0.5)' }}>
                IT
              </div>
              <span className="text-white/70 font-medium text-sm tracking-wide">InvisiThreat</span>
            </div>
          </div>

          {/* Shield icon center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 opacity-10">
            <svg width="180" height="180" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>

          {/* Bottom text */}
          <div className="absolute bottom-14 left-10 right-10 z-10">
            {imageContent}
          </div>
        </div>

        {/* Right - Form panel */}
        <div className="w-full md:w-[55%] flex items-center justify-center p-10 md:px-16 md:py-14 relative">
          {/* Subtle top-right glow */}
          <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
            style={{ background: 'radial-gradient(circle at top right, rgba(255,107,43,0.07) 0%, transparent 70%)' }} />
          <div className="w-full max-w-lg animate-slide-up">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
