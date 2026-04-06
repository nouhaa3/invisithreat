// ─── Image Cropper Component ──────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'

const ORANGE = '#FF6B2B'

export default function ImageCropper({ imageData, onConfirm, onCancel }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const containerRef = useRef(null)
  
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [containerSize, setContainerSize] = useState({ width: 400, height: 400 })

  // Load image and update container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setContainerSize({
          width: Math.min(400, rect.width - 32),
          height: 400
        })
      }
    }

    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      updateSize()
      // Center the image initially
      const scale = Math.min(
        containerSize.width / img.width,
        containerSize.height / img.height
      )
      setZoom(scale * 1.2)
      setPosition({
        x: (containerSize.width - img.width * scale * 1.2) / 2,
        y: (containerSize.height - img.height * scale * 1.2) / 2
      })
    }
    img.src = imageData

    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const handleMouseDown = (e) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.max(0.5, Math.min(5, prev * delta)))
  }

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragStart])

  const handleCrop = () => {
    const canvas = canvasRef.current
    if (!canvas || !imgRef.current) return

    const size = containerSize.width  // 400
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    // Save canvas state
    ctx.save()

    // Create clipping region (square boundary)
    ctx.beginPath()
    ctx.rect(0, 0, size, size)
    ctx.clip()

    // Draw image with the same transformation as the preview
    // This ensures what you see is what you crop
    const imgWidth = imgRef.current.width * zoom
    const imgHeight = imgRef.current.height * zoom
    ctx.drawImage(
      imgRef.current,
      position.x,
      position.y,
      imgWidth,
      imgHeight
    )

    // Restore canvas state
    ctx.restore()

    // Get cropped image as base64
    const croppedImageData = canvas.toDataURL('image/jpeg', 0.92)
    onConfirm(croppedImageData)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-3xl p-8 max-w-md w-full" style={{ background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 className="text-xl font-bold text-white mb-4">Crop Your Profile Picture</h3>
        
        {/* Crop Preview */}
        <div
          ref={containerRef}
          className="relative mb-6 rounded-2xl overflow-hidden bg-black/40 cursor-grab active:cursor-grabbing"
          style={{
            width: containerSize.width,
            height: containerSize.height,
            border: `2px dashed ${ORANGE}`,
            userSelect: 'none'
          }}
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
        >
          {imgRef.current && (
            <img
              src={imageData}
              alt="Preview"
              style={{
                position: 'absolute',
                width: imgRef.current.width * zoom,
                height: imgRef.current.height * zoom,
                left: position.x,
                top: position.y,
                pointerEvents: 'none',
                userSelect: 'none'
              }}
              draggable={false}
            />
          )}
          {/* Crop frame overlay */}
          <div className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: `0 0 0 400px rgba(0,0,0,0.4)`,
              borderRadius: '50%'
            }}
          />
        </div>

        {/* Controls */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-white/40 uppercase">Zoom</label>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1"
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '0.5rem'
              }}
            />
            <span className="text-xs text-white/40">{(zoom * 100).toFixed(0)}%</span>
          </div>
          <p className="text-xs text-white/30">Drag to move • Scroll to zoom</p>
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
            onClick={handleCrop}
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
