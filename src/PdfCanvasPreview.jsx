import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

const PdfCanvasPreview = ({ fileUrl }) => {
  const containerRef = useRef(null)
  const canvasRefs = useRef([])
  const pdfDocRef = useRef(null)
  const [pageCount, setPageCount] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!fileUrl) return

    let cancelled = false
    let loadingTask = null
    setError(null)
    setPageCount(0)

    const load = async () => {
      try {
        const response = await fetch(fileUrl)
        if (!response.ok) {
          throw new Error(`Fetch failed with status ${response.status}`)
        }
        const arrayBuffer = await response.arrayBuffer()
        if (cancelled) return

        loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
        const pdf = await loadingTask.promise
        if (cancelled) return

        pdfDocRef.current = pdf
        canvasRefs.current = []
        setPageCount(pdf.numPages)
      } catch (loadError) {
        if (cancelled) return
        console.error('Failed to load PDF for preview', loadError)
        setError(
          loadError?.message
            ? `Unable to display this PDF (${loadError.message}).`
            : 'Unable to display this PDF.'
        )
      }
    }

    load()

    return () => {
      cancelled = true
      loadingTask?.destroy?.()
    }
  }, [fileUrl])

  useEffect(() => {
    const element = containerRef.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width
      if (width) setContainerWidth(width)
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const pdf = pdfDocRef.current
    if (!pdf || !pageCount || !containerWidth) return

    let cancelled = false
    const renderTasks = []

    const renderPages = async () => {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (cancelled) return

        const canvas = canvasRefs.current[pageNumber - 1]
        if (!canvas) continue

        const page = await pdf.getPage(pageNumber)
        if (cancelled) return

        const unscaledViewport = page.getViewport({ scale: 1 })
        const pixelRatio = window.devicePixelRatio || 1
        const scale = (containerWidth / unscaledViewport.width) * pixelRatio
        const viewport = page.getViewport({ scale })

        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = '100%'
        canvas.style.height = 'auto'

        const context = canvas.getContext('2d')
        const renderTask = page.render({ canvasContext: context, viewport })
        renderTasks.push(renderTask)
        await renderTask.promise.catch(() => {})
      }
    }

    renderPages()

    return () => {
      cancelled = true
      renderTasks.forEach((task) => task.cancel?.())
    }
  }, [pageCount, containerWidth])

  return (
    <div ref={containerRef} className="pdf-canvas-preview">
      {error ? (
        <p className="pdf-canvas-preview-error">{error}</p>
      ) : (
        Array.from({ length: pageCount }, (_, index) => (
          <canvas
            key={index}
            ref={(node) => {
              canvasRefs.current[index] = node
            }}
            className="pdf-canvas-preview-page"
          />
        ))
      )}
    </div>
  )
}

export default PdfCanvasPreview
