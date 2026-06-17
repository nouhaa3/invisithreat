/**
 * useExportReport
 *
 * Reusable hook for exporting dashboard data as PDF (jsPDF + autoTable)
 * or Excel (.xlsx via SheetJS).
 *
 * Usage:
 *   const { exportPDF, exportExcel, exporting } = useExportReport()
 *
 *   exportPDF({
 *     title:    'Security Report',
 *     user,
 *     sections: [
 *       { heading: 'Summary', rows: [['label', 'value'], ...] },
 *       { heading: 'Projects', columns: ['Name','Risk','Critical',...], rows: [[...], ...] },
 *     ],
 *   })
 */
import { useCallback, useState } from 'react'

// ── helpers ───────────────────────────────────────────────────────────────────

function nowLabel() {
  return new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fileStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

async function buildPDF({ title, user, sections, subtitle }) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PAGE_W = 210
  const MARGIN  = 16
  const CONTENT_W = PAGE_W - MARGIN * 2

  // ── Brand colours ──
  const ORANGE  = [255, 107, 43]
  const DARK    = [10, 10, 10]
  const MID     = [40, 40, 40]
  const LIGHT   = [200, 200, 200]
  const WHITE   = [255, 255, 255]
  const PALE    = [240, 240, 240]

  // ── Cover header band ──
  doc.setFillColor(...DARK)
  doc.rect(0, 0, PAGE_W, 50, 'F')

  // orange accent line
  doc.setFillColor(...ORANGE)
  doc.rect(0, 46, PAGE_W, 4, 'F')

  // Logo text (no image dependency)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...ORANGE)
  doc.text('InvisiThreat', MARGIN, 20)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...LIGHT)
  doc.text('DevSecOps Intelligence Platform', MARGIN, 27)

  // Report title (right-aligned)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text(title, PAGE_W - MARGIN, 18, { align: 'right' })

  // Meta row
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...LIGHT)
  const meta = [
    user ? `User: ${user.nom} (${user.email})` : null,
    user?.role_name ? `Role: ${user.role_name}` : null,
    `Generated: ${nowLabel()}`,
  ].filter(Boolean).join('   •   ')
  doc.text(meta, MARGIN, 38)

  if (subtitle) {
    doc.setFontSize(9)
    doc.setTextColor(180, 180, 180)
    doc.text(subtitle, MARGIN, 44)
  }

  let y = 58

  // ── Sections ──
  for (const section of sections) {
    // Section heading
    if (section.heading) {
      // Check if we need a new page
      if (y > 265) { doc.addPage(); y = 16 }

      doc.setFillColor(...MID)
      doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1.5, 1.5, 'F')
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...ORANGE)
      doc.text(section.heading.toUpperCase(), MARGIN + 4, y + 5.5)
      y += 12
    }

    // Key-value pairs (2-column layout)
    if (section.pairs) {
      const pairs = section.pairs
      const colW = CONTENT_W / 2 - 2
      for (let i = 0; i < pairs.length; i += 2) {
        if (y > 268) { doc.addPage(); y = 16 }
        const left  = pairs[i]
        const right = pairs[i + 1]
        ;[[left, MARGIN], [right, MARGIN + colW + 4]].forEach(([pair, x]) => {
          if (!pair) return
          doc.setFillColor(24, 24, 24)
          doc.roundedRect(x, y, colW, 14, 1, 1, 'F')
          doc.setFontSize(7.5)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(...LIGHT)
          doc.text(String(pair[0]), x + 3, y + 5)
          doc.setFontSize(11)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(...WHITE)
          doc.text(String(pair[1] ?? '—'), x + 3, y + 11.5)
        })
        y += 18
      }
      y += 2
    }

    // Plain text paragraph
    if (section.text) {
      if (y > 270) { doc.addPage(); y = 16 }
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(170, 170, 170)
      const lines = doc.splitTextToSize(section.text, CONTENT_W)
      doc.text(lines, MARGIN, y)
      y += lines.length * 4.5 + 4
    }

    // Table
    if (section.columns && section.rows) {
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [section.columns],
        body: section.rows,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
          textColor: PALE,
          fillColor: [16, 16, 16],
          lineColor: [40, 40, 40],
          lineWidth: 0.2,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: MID,
          textColor: ORANGE,
          fontStyle: 'bold',
          fontSize: 8,
        },
        alternateRowStyles: {
          fillColor: [20, 20, 20],
        },
        columnStyles: section.columnStyles || {},
      })
      y = doc.lastAutoTable.finalY + 8
    }

    if (section.spacer) y += section.spacer
  }

  // ── Footer on every page ──
  const pageCount = doc.internal.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFillColor(...DARK)
    doc.rect(0, 285, PAGE_W, 12, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...LIGHT)
    doc.text('InvisiThreat — Confidential', MARGIN, 291)
    doc.text(`Page ${p} / ${pageCount}`, PAGE_W - MARGIN, 291, { align: 'right' })
    doc.text(nowLabel(), PAGE_W / 2, 291, { align: 'center' })
  }

  return doc
}

// ─── Excel ────────────────────────────────────────────────────────────────────

async function buildExcel({ title, user, sheets }) {
  const XLSX = await import('xlsx')

  const wb = XLSX.utils.book_new()
  wb.Props = {
    Title: title,
    Author: user?.nom || 'InvisiThreat',
    CreatedDate: new Date(),
  }

  for (const sheet of sheets) {
    const wsData = []

    // Title rows
    wsData.push([title])
    wsData.push([`Generated by: ${user?.nom || '—'} (${user?.email || '—'})`])
    wsData.push([`Role: ${user?.role_name || '—'}  •  Date: ${nowLabel()}`])
    wsData.push([]) // blank spacer

    if (sheet.heading) {
      wsData.push([sheet.heading])
      wsData.push([])
    }

    // Key-value summary block
    if (sheet.pairs) {
      for (const [k, v] of sheet.pairs) {
        wsData.push([k, v ?? '—'])
      }
      wsData.push([])
    }

    // Column headers + data rows
    if (sheet.columns) {
      wsData.push(sheet.columns)
    }
    if (sheet.rows) {
      for (const row of sheet.rows) {
        wsData.push(row)
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Column widths
    if (sheet.colWidths) {
      ws['!cols'] = sheet.colWidths.map(w => ({ wch: w }))
    } else if (sheet.columns) {
      ws['!cols'] = sheet.columns.map(h => ({ wch: Math.max(String(h).length + 4, 14) }))
    }

    // Freeze first header row (row 5 = index 4, which is where column headers land)
    ws['!freeze'] = { xSplit: 0, ySplit: 5 }

    const safeName = (sheet.name || 'Data').replace(/[:\\/?\[\]*]/g, '').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, safeName)
  }

  return wb
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export default function useExportReport() {
  const [exporting, setExporting] = useState(false)

  /**
   * exportPDF({ title, user, subtitle, sections, filename })
   *
   * sections: Array<{
   *   heading?: string
   *   pairs?:   [label, value][]   — displayed as KPI cards
   *   text?:    string             — plain paragraph
   *   columns?: string[]           — table header row
   *   rows?:    (string|number)[][] — table data rows
   *   columnStyles?: object        — jsPDF autoTable column styles
   *   spacer?:  number             — extra vertical space (mm)
   * }>
   */
  const exportPDF = useCallback(async ({ title, user, subtitle, sections, filename }) => {
    setExporting(true)
    try {
      const doc = await buildPDF({ title, user, subtitle, sections })
      const stamp = fileStamp()
      doc.save(filename || `${title.toLowerCase().replace(/\s+/g, '-')}-${stamp}.pdf`)
    } finally {
      setExporting(false)
    }
  }, [])

  /**
   * exportExcel({ title, user, sheets, filename })
   *
   * sheets: Array<{
   *   name?:      string
   *   heading?:   string
   *   pairs?:     [label, value][]
   *   columns?:   string[]
   *   rows?:      (string|number)[][]
   *   colWidths?: number[]
   * }>
   */
  const exportExcel = useCallback(async ({ title, user, sheets, filename }) => {
    setExporting(true)
    try {
      const XLSX = await import('xlsx')
      const wb = await buildExcel({ title, user, sheets })
      const stamp = fileStamp()
      XLSX.writeFile(wb, filename || `${title.toLowerCase().replace(/\s+/g, '-')}-${stamp}.xlsx`)
    } finally {
      setExporting(false)
    }
  }, [])

  return { exportPDF, exportExcel, exporting }
}
