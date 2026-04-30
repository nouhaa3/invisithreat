import logo from '../assets/logo_invisithreat.png'

/**
 * AuthLayout - WOW split layout with animated orange orbs + glassmorphism
 */
export default function AuthLayout({ children, imageContent }) {
  return (
    <div className="app-shell min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Full-page ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full animate-float-slow"
          style={{ background: 'radial-gradient(circle, rgba(255,107,43,0.15) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full animate-float-med animation-delay-2000"
          style={{ background: 'radial-gradient(circle, rgba(232,77,14,0.12) 0%, transparent 70%)' }} />
      </div>

      {/* Main card */}
      <div className="w-full max-w-6xl rounded-[32px] overflow-hidden flex shadow-elevated min-h-[720px] relative z-10"
        style={{
          background: 'rgba(10,10,10,0.96)',
          border: '1px solid rgba(255,107,43,0.22)',
          boxShadow: '0 0 120px rgba(255,107,43,0.12), 0 50px 110px rgba(0,0,0,0.7)',
        }}
      >
        {/* Left - Animated brand panel */}
        <div className="hidden md:flex md:w-[45%] relative overflow-hidden">
          {/* Base gradient */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(160deg, #190a04 0%, #0c0c0c 45%, #120702 100%)' }} />

          {/* Animated orbs */}
          <div className="absolute top-[-60px] left-[-60px] w-72 h-72 rounded-full animate-float-slow"
            style={{ background: 'radial-gradient(circle, rgba(255,107,43,0.55) 0%, rgba(232,77,14,0.2) 40%, transparent 70%)', filter: 'blur(20px)' }} />
          <div className="absolute bottom-[-40px] right-[-40px] w-56 h-56 rounded-full animate-float-med animation-delay-2000"
            style={{ background: 'radial-gradient(circle, rgba(255,120,60,0.4) 0%, rgba(255,80,0,0.2) 40%, transparent 70%)', filter: 'blur(18px)' }} />
          <div className="absolute top-[40%] left-[30%] w-40 h-40 rounded-full animate-pulse-glow animation-delay-1000"
            style={{ background: 'radial-gradient(circle, rgba(255,140,80,0.3) 0%, transparent 70%)', filter: 'blur(10px)' }} />
          <div className="absolute top-[20%] right-[10%] w-24 h-24 rounded-full animate-float-fast animation-delay-3000"
            style={{ background: 'radial-gradient(circle, rgba(255,60,0,0.4) 0%, transparent 70%)', filter: 'blur(8px)' }} />

          {/* Grid overlay subtle */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />

          {/* Logo */}
          <div className="absolute top-7 left-7 z-10">
            <img src={logo} alt="InvisiThreat" className="h-[50px] w-auto object-contain" />
          </div>

          {/* Logo center watermark */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <img src={logo} alt="" className="w-48 h-auto object-contain opacity-20" />
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
