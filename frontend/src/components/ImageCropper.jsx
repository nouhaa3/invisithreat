// ─── Image Cropper Component ──────────────────────────────────────────────
import { useState, useRef } from 'react'
import Cropper from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'

const ORANGE = '#FF6B2B'

export default function ImageCropper({ imageData, onConfirm, onCancel }) {
  const canvasRef = useRef(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  const onCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const handleConfirmCrop = async () => {
    if (!croppedAreaPixels) return

    const image = new Image()
    image.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      // Square crop area
      const size = Math.min(croppedAreaPixels.width, croppedAreaPixels.height)
      canvas.width = size
      canvas.height = size

      const ctx = canvas.getContext('2d')
      ctx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        size,
        size,
        0,
        0,
        size,
        size
      )

      const croppedImageData = canvas.toDataURL('image/jpeg', 0.92)
      onConfirm(croppedImageData)
    }
    image.src = imageData
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-3xl p-8 max-w-2xl w-full" style={{ background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 className="text-xl font-bold text-white mb-4">Crop Your Profile Picture</h3>
        <p className="text-sm text-white/60 mb-6">Drag to move • Scroll to zoom • Adjust the frame to crop</p>
        
        {/* Easy Crop Component */}
        <div className="relative mb-6 rounded-2xl overflow-hidden bg-black/40" style={{ height: '480px' }}>
          <Cropper
            image={imageData}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            onMouseDown={() => {}}
            onTouchStart={() => {}}
          />
        </div>

        {/* Zoom Control */}
        <div className="mb-6">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <label className="text-xs font-semibold text-white/40 uppercase min-w-fit">Zoom:</label>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1"
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '0.5rem'
              }}
            />
            <span className="text-xs text-white/40 min-w-fit">{(zoom * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)'
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,0.04)'}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmCrop}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: ORANGE, border: `1px solid ${ORANGE}` }}
            onMouseEnter={e => e.target.style.opacity = '0.9'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          >
            Crop & Apply
          </button>
        </div>

        {/* Hidden canvas for cropping */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  )
}
