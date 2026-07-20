import { useState, useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import './App.css'
import vendorData from '../vendor.json'

const vendorOptions = vendorData?.vendors || []

function App() {
  const quotationRef = useRef()
  const [quotationNumber, setQuotationNumber] = useState('QUO1')
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0])
  const [quotationTo, setQuotationTo] = useState(vendorOptions[0]?.quotationTo || '')
  const [shippingAddress, setShippingAddress] = useState(vendorOptions[0]?.shippingAddress || '')
  const [selectedQuotationVendorId, setSelectedQuotationVendorId] = useState(vendorOptions[0]?.id || '')
  const [selectedShippingVendorId, setSelectedShippingVendorId] = useState(vendorOptions[0]?.id || '')
  const [accordionOpen, setAccordionOpen] = useState(false)
  const [panelDescription, setPanelDescription] = useState('')
  const [panelStatus, setPanelStatus] = useState('')
  const [saveLocationHandle, setSaveLocationHandle] = useState(null)
  const [saveLocationLabel, setSaveLocationLabel] = useState('C:/Users/Welcome/Documents/Quotations')
  const [quotationHistory, setQuotationHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedHistoryQuote, setSelectedHistoryQuote] = useState(null)
  const [lineItems, setLineItems] = useState([
    { id: 1, qty: '', item: 'manufacture', description: '', unitPrice: '' }
  ])

  // Initialize quotation number from localStorage
  useEffect(() => {
    const savedQuoNumber = localStorage.getItem('quoCounter')
    const counter = savedQuoNumber ? parseInt(savedQuoNumber) + 1 : 1
    localStorage.setItem('quoCounter', counter)
    setQuotationNumber(`QUO${counter}`)
  }, [])

  useEffect(() => {
    const savedPanel = localStorage.getItem('quotation-panel-data')
    if (!savedPanel) return

    try {
      const parsed = JSON.parse(savedPanel)
      setPanelDescription(parsed.description || '')
    } catch (error) {
      console.error('Failed to load saved panel data', error)
    }
  }, [])

  useEffect(() => {
    const savedHistory = localStorage.getItem('quotation-history')
    if (!savedHistory) return

    try {
      setQuotationHistory(JSON.parse(savedHistory))
    } catch (error) {
      console.error('Failed to load quotation history', error)
    }
  }, [])

  const itemOptions = [
    { value: 'manufacture', label: 'Manufacture' },
    { value: 'fabricate', label: 'Fabricate' },
    { value: 'supply', label: 'Supply' }
  ]

  const handleVendorSelection = (value, target) => {
    const selectedVendor = vendorOptions.find((vendor) => vendor.id === value)
    if (!selectedVendor) return

    if (target === 'quotation') {
      setSelectedQuotationVendorId(value)
      setQuotationTo(selectedVendor.quotationTo)
    } else {
      setSelectedShippingVendorId(value)
      setShippingAddress(selectedVendor.shippingAddress)
    }
  }

  const calculateLineTotal = (qty, unitPrice) => {
    const q = parseFloat(qty) || 0
    const p = parseFloat(unitPrice) || 0
    return (q * p).toFixed(2)
  }

  const calculateTotalPrice = () => {
    return lineItems
      .reduce((sum, item) => {
        return sum + parseFloat(calculateLineTotal(item.qty, item.unitPrice) || 0)
      }, 0)
      .toFixed(2)
  }

  const handleLineItemChange = (id, field, value) => {
    setLineItems(lineItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ))
  }

  const resizeTextarea = (textarea) => {
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  const addLineItem = () => {
    const newId = Math.max(...lineItems.map(item => item.id), 0) + 1
    setLineItems([
      ...lineItems,
      { id: newId, qty: '', item: 'manufacture', description: '', unitPrice: '' }
    ])
  }

  const removeLineItem = (id) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id))
    }
  }

  const savePanelToJson = async () => {
    const payload = {
      description: panelDescription,
      updatedAt: new Date().toISOString()
    }
    const json = JSON.stringify(payload, null, 2)

    localStorage.setItem('quotation-panel-data', json)

    try {
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'quotation-panel.json',
          types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] }
          }]
        })
        const writable = await handle.createWritable()
        await writable.write(json)
        await writable.close()
        setPanelStatus('Saved to JSON file.')
      } else {
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'quotation-panel.json'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        setPanelStatus('Downloaded JSON file.')
      }
    } catch (error) {
      console.error('Unable to save JSON file', error)
      setPanelStatus('Saved locally. File picker was cancelled.')
    }
  }

  const pickSaveLocation = async () => {
    const fixedPath = 'C:/Users/Welcome/Documents/Quotations'
    setSaveLocationHandle(null)
    setSaveLocationLabel(fixedPath)
  }

  const saveQuotationHistory = (quoteData) => {
    const nextHistory = [quoteData, ...quotationHistory].slice(0, 20)
    setQuotationHistory(nextHistory)
    localStorage.setItem('quotation-history', JSON.stringify(nextHistory))
    return quoteData
  }

  const openHistoryModal = (quote) => {
    setSelectedHistoryQuote(quote)
  }

  const closeHistoryModal = () => {
    setSelectedHistoryQuote(null)
  }

  const generatePDF = async () => {
    try {
      const element = quotationRef.current
      const invoiceContainer = element?.querySelector('.invoice-container')
      
      const originalDisplay = element.style.display
      const originalWidth = element.style.width
      const originalHeight = element.style.height
      const originalPadding = element.style.padding
      const originalBackground = element.style.backgroundColor
      const originalInvoicePadding = invoiceContainer?.style.padding || ''
      const originalInvoiceMargin = invoiceContainer?.style.margin || ''
      const originalInvoiceWidth = invoiceContainer?.style.width || ''
      const originalInvoiceHeight = invoiceContainer?.style.height || ''

      element.style.display = 'block'
      element.style.width = '210mm'
      element.style.height = '297mm'
      element.style.padding = '0'
      element.style.backgroundColor = 'white'
      element.style.boxSizing = 'border-box'

      if (invoiceContainer) {
        invoiceContainer.style.padding = '10px'
        invoiceContainer.style.margin = '0'
        invoiceContainer.style.width = '100%'
        invoiceContainer.style.height = '100%'
      }

      await new Promise(resolve => setTimeout(resolve, 200))

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: element.offsetWidth,
        height: element.offsetHeight,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight
      })

      element.style.display = originalDisplay
      element.style.width = originalWidth
      element.style.height = originalHeight
      element.style.padding = originalPadding
      element.style.backgroundColor = originalBackground

      if (invoiceContainer) {
        invoiceContainer.style.padding = originalInvoicePadding
        invoiceContainer.style.margin = originalInvoiceMargin
        invoiceContainer.style.width = originalInvoiceWidth
        invoiceContainer.style.height = originalInvoiceHeight
      }

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const imgProps = pdf.getImageProperties(imgData)
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight)

      const quoteHistoryItem = {
        id: `${quotationNumber}-${Date.now()}`,
        quotationNumber,
        dateCreated: new Date().toLocaleDateString(),
        timeCreated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quotationTo,
        shippingAddress,
        totalPrice: parseFloat(calculateTotalPrice()).toFixed(2),
        savedAt: new Date().toISOString()
      }

      const fileName = `${quotationNumber}.pdf`
      const targetPath = `${saveLocationLabel || 'C:/Users/Welcome/Documents/Quotations'}/${fileName}`
      const pdfBlob = pdf.output('blob')
      const pdfPreviewUrl = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = pdfPreviewUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      const savedQuote = saveQuotationHistory({
        ...quoteHistoryItem,
        fileName: targetPath,
        pdfPreviewUrl
      })
      setSelectedHistoryQuote(savedQuote)
      setHistoryOpen(true)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please check the console for details.')
    }
  }

  return (
    <div className="app-container">
      <div className="form-section">
        <h1>Quotation Generator</h1>
        
        <div className="form-group">
          <label>Quotation To (Customer Name/Company)</label>
          <select
            value={selectedQuotationVendorId}
            onChange={(e) => handleVendorSelection(e.target.value, 'quotation')}
          >
            {vendorOptions.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.company}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Shipping Address</label>
          <select
            value={selectedShippingVendorId}
            onChange={(e) => handleVendorSelection(e.target.value, 'shipping')}
          >
            {vendorOptions.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.company}
              </option>
            ))}
          </select>
        </div>

        <div className="accordion-card">
          <button type="button" className="accordion-toggle" onClick={() => setAccordionOpen(!accordionOpen)}>
            <span>Additional Panel</span>
            <span className="accordion-icon">{accordionOpen ? '−' : '+'}</span>
          </button>

          {accordionOpen && (
            <div className="accordion-content">
              <label htmlFor="panel-description">Description</label>
              <textarea
                id="panel-description"
                value={panelDescription}
                onChange={(e) => setPanelDescription(e.target.value)}
                rows="6"
                placeholder="Enter description for the JSON panel"
              />

              <div className="accordion-actions">
                <button type="button" className="btn-save-json" onClick={savePanelToJson}>
                  Save to JSON
                </button>
                {panelStatus ? <span className="save-status">{panelStatus}</span> : null}
              </div>
            </div>
          )}
        </div>

        <div className="line-items-section">
          <h2>Line Items</h2>
          <div className="line-items-table">
            <div className="table-header">
              <div className="col-qty">QTY</div>
              <div className="col-item">ITEM</div>
              <div className="col-description">DESCRIPTION</div>
              <div className="col-price">UNIT PRICE</div>
              <div className="col-total">LINE TOTAL</div>
              <div className="col-action">ACTION</div>
            </div>

            {lineItems.map((item) => (
              <div key={item.id} className="table-row">
                <div className="col-qty">
                  <input
                    type="number"
                    min="0"
                    value={item.qty}
                    onChange={(e) => handleLineItemChange(item.id, 'qty', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="col-item">
                  <select
                    value={item.item}
                    onChange={(e) => handleLineItemChange(item.id, 'item', e.target.value)}
                  >
                    {itemOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-description">
                  <textarea
                    value={item.description}
                    onChange={(e) => {
                      handleLineItemChange(item.id, 'description', e.target.value)
                      resizeTextarea(e.target)
                    }}
                    onInput={(e) => resizeTextarea(e.target)}
                    placeholder="Description"
                    rows="2"
                  />
                </div>
                <div className="col-price">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => handleLineItemChange(item.id, 'unitPrice', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="col-total">
                  {calculateLineTotal(item.qty, item.unitPrice)}
                </div>
                <div className="col-action">
                  <button
                    className="btn-delete"
                    onClick={() => removeLineItem(item.id)}
                    disabled={lineItems.length === 1}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button className="btn-add" onClick={addLineItem}>
            + Add Line Item
          </button>
        </div>

        <div className="totals-section">
          <div className="total-price">
            <span>TOTAL PRICE:</span>
            <strong>R{parseFloat(calculateTotalPrice()).toFixed(2)}</strong>
          </div>
        </div>

        <div className="form-group">
          <label>PDF save location</label>
          <div className="save-location-row">
            <span className="save-location-label">{saveLocationLabel}</span>
          </div>
        </div>

        <div className="button-group">
          <button className="btn-generate" onClick={generatePDF}>
            Download PDF
          </button>
        </div>

        <div className="history-card">
          <button type="button" className="accordion-toggle" onClick={() => setHistoryOpen(!historyOpen)}>
            <span>Quotation History</span>
            <span className="accordion-icon">{historyOpen ? '−' : '+'}</span>
          </button>
          {historyOpen && (
            <div className="history-content">
              {quotationHistory.length === 0 ? (
                <p className="empty-history">No quotations created yet.</p>
              ) : (
                <div className="history-list">
                  {quotationHistory.map((quote) => (
                    <button
                      key={quote.id}
                      type="button"
                      className="history-item"
                      onClick={() => openHistoryModal(quote)}
                    >
                      <div className="history-item-left">
                        <strong>{quote.quotationNumber}</strong>
                        <span>{quote.dateCreated} {quote.timeCreated}</span>
                      </div>
                      <div className="history-item-right">R{quote.totalPrice}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PDF Template */}
      {selectedHistoryQuote && (
        <div className="modal-overlay" onClick={closeHistoryModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close modal-close-top" type="button" onClick={closeHistoryModal}>&times;</button>
            {selectedHistoryQuote.pdfPreviewUrl ? (
              <div className="pdf-preview-frame only-preview">
                <iframe
                  src={selectedHistoryQuote.pdfPreviewUrl}
                  title="Quotation PDF Preview"
                  className="pdf-preview-iframe"
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
      <div ref={quotationRef} className="pdf-template">
        <div className="invoice-container">
          
          <header className="header">
            <div className="company-logo-area">
              <img src="/src/GalaLogo.PNG" alt="Gala Mining & Engineering logo" className="company-logo" />
            </div>
            
            <div className="company-details">
              <h1>GALA MINING & ENGINEERING (PTY) LTD</h1>
              <p>17 Theuns Mulder Street<br/>Industrial Sites<br/>Brits, 0250<br/>North West</p>
              <p className="reg-info">VAT Reg. No: 4880192374<br/>Company Reg. No: 2000/024885/07</p>
            </div>
            
            <div className="quote-title-area">
              <h2 className="document-title">QUOTATION</h2>
              <p className="contact-info">
                P O Box 3557, Brits, 0250<br/>
                Tel: (012) 250 0111/3510<br/>
                Fax: (012) 250 3074<br/>
                E-mail: info@galamining.co.za<br/>
                Website: www.galamining.co.za<br/>
                Account Enquiries: accounts@galamining.co.za
              </p>
            </div>
          </header>

          <div className="meta-section">
            <div className="meta-box">
              <h3>QUOTATION TO</h3>
              <div className="box-content">{quotationTo}</div>
            </div>
            <div className="quote-details-plain">
              <div className="quote-details-inner">
                <div className="details-table">
                  <div className="row"><span className="label font-bold">Quotation Date:</span> <span className="val">{quotationDate}</span></div>
                  <div className="row"><span className="label font-bold">Quotation Number:</span> <span className="val font-bold">{quotationNumber}</span></div>
                  <div className="row"><span className="label">Purchase Order No:</span> <span className="val"></span></div>
                  <div className="row"><span className="label">Reference Number:</span> <span className="val"></span></div>
                  <div className="row"><span className="label">Terms:</span> <span className="val">Net 30</span></div>
                  <div className="row"><span className="label">Customer VAT Reg. No:</span> <span className="val"></span></div>
                </div>
              </div>
            </div>
            <div className="meta-box">
              <h3>SHIPPING ADDRESS</h3>
              <div className="box-content">{shippingAddress}</div>
            </div>
            <div className="meta-box">
              <h3>DELIVERY INFORMATION</h3>
              <div className="box-content"></div>
            </div>
          </div>

          <table className="items-table">
            <thead>
              <tr>
                <th style={{width: '8%'}}>QTY</th>
                <th style={{width: '12%'}}>ITEM</th>
                <th style={{width: '50%', textAlign: 'left'}}>DESCRIPTION</th>
                <th style={{width: '15%', textAlign: 'right'}}>UNIT PRICE</th>
                <th style={{width: '15%', textAlign: 'right'}}>LINE TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="text-center">{item.qty || ''}</td>
                  <td>{item.item}</td>
                  <td>
                    <strong>{item.description}</strong>
                  </td>
                  <td className="text-right">R{parseFloat(item.unitPrice || 0).toFixed(2)}</td>
                  <td className="text-right">R{calculateLineTotal(item.qty, item.unitPrice)}</td>
                </tr>
              ))}
              <tr className="spacer-row"><td colSpan="5"></td></tr>
            </tbody>
          </table>

          <footer className="footer-section">
            <div className="notes-box">
              <h4>Notes:</h4>
              <ul>
                <li>All Prices EXCLUDE 15% VAT</li>
                <li>Prices are subject to market and rand currency fluctuations</li>
                <li>All Goods supplied remain the property of Gala Mining & Engineering (Pty) Ltd until paid in full</li>
              </ul>
            </div>
            
            <div className="total-box-container">
              <div className="total-box">
                <span className="total-label">TOTAL PRICE:</span>
                <span className="total-amount">R{parseFloat(calculateTotalPrice()).toFixed(2)}</span>
              </div>
            </div>
          </footer>

        </div>
      </div>
    </div>
  )
}

export default App
