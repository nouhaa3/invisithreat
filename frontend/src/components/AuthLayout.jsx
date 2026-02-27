/**
 * AuthLayout - splits the screen: left image panel + right form panel
 * Matches the design: dark card with rounded corners, gradient image on left
 */
export default function AuthLayout({ children, imageContent }) {
  return (
    <div className="min-h-screen bg-[#2a2a2a] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-brand-dark rounded-3xl overflow-hidden flex shadow-2xl min-h-[600px]">

        {/* Left - Image / Brand panel */}
        <div className="hidden md:flex md:w-1/2 relative overflow-hidden">
          {/* Gradient background matching the design */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900" />
          <div className="absolute inset-0 opacity-60"
            style={{
              background: 'radial-gradient(ellipse at 30% 50%, rgba(120,40,200,0.6) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.4) 0%, transparent 50%)',
            }}
          />
          {/* Logo top-left */}
          <div className="absolute top-6 left-6 z-10">
            <div className="w-9 h-9 bg-brand-yellow rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-base">IT</span>
            </div>
          </div>
          {/* Bottom text */}
          <div className="absolute bottom-10 left-8 right-8 z-10">
            {imageContent}
          </div>
        </div>

        {/* Right - Form panel */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-8 md:p-12">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>

      </div>
    </div>
  )
}
