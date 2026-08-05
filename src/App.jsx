import { Fragment, useState, useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import './App.css'
import vendorData from '../vendor.json'
import timeManagementData from './time-management-data.json'
import employeeData from './employee.json'
import labourPricesData from '../labour-prices.json'
import materialPricesData from '../material-prices.json'

const vendorOptions = vendorData?.vendors || []
const validPages = ['builder', 'history', 'preview', 'time-management', 'employee-management', 'price-calculator']
const initialLabourTitleOptions = (labourPricesData?.labourPrices || [])
  .map((entry) => entry.title)
  .filter(Boolean)
const coyNumberPattern = /^\d{8}$/

const sanitizeEmployeeRoster = (employees, validTitles) => {
  const allowedTitles = new Set(validTitles)

  return (Array.isArray(employees) ? employees : []).map((employee) => {
    const rawRole = (employee?.role || employee?.title || '').trim()
    const role = allowedTitles.has(rawRole) ? rawRole : ''
    const rawCoyNumber = String(employee?.coyNumber || '').replace(/\D/g, '')
    const coyNumber = coyNumberPattern.test(rawCoyNumber) ? rawCoyNumber : ''
    return {
      ...employee,
      role,
      title: role,
      coyNumber
    }
  })
}

const normalizePageKey = (page) => {
  if (page === 'time') {
    return 'time-management'
  }

  return validPages.includes(page) ? page : 'builder'
}

const getInitialActivePage = () => {
  if (typeof window === 'undefined') {
    return 'builder'
  }

  try {
    const savedPage = localStorage.getItem('active-page')
    return normalizePageKey(savedPage)
  } catch (error) {
    console.error('Failed to load saved page state', error)
    return 'builder'
  }
}

const initialTimeManagementData = timeManagementData || {}
const initialTimeManagementState = {
  employeeHours: initialTimeManagementData.employeeHours || [],
  currentProjectHours: initialTimeManagementData.currentProjectHours || [],
  plannedProjectHours: initialTimeManagementData.plannedProjectHours || [],
  activityLog: initialTimeManagementData.activityLog || []
}

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
  const [activePage, setActivePage] = useState(getInitialActivePage)
  const [pdfTemplateMode, setPdfTemplateMode] = useState('quote')
  const [timeEntries, setTimeEntries] = useState([
    { id: 1, title: 'Review client quote', date: '2026-07-29', hours: '2.5', status: 'Planned' },
    { id: 2, title: 'Site coordination call', date: '2026-07-30', hours: '1.0', status: 'In progress' }
  ])
  const [employeeHours, setEmployeeHours] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedData = localStorage.getItem('time-management-data')
        if (savedData) {
          const parsed = JSON.parse(savedData)
          if (Array.isArray(parsed.employeeHours)) {
            return parsed.employeeHours
          }
        }
      } catch (error) {
        console.error('Failed to load saved time management data', error)
      }
    }

    return initialTimeManagementState.employeeHours
  })
  const [currentProjectHours, setCurrentProjectHours] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedData = localStorage.getItem('time-management-data')
        if (savedData) {
          const parsed = JSON.parse(savedData)
          if (Array.isArray(parsed.currentProjectHours)) {
            return parsed.currentProjectHours
          }
        }
      } catch (error) {
        console.error('Failed to load saved time management data', error)
      }
    }

    return initialTimeManagementState.currentProjectHours
  })
  const [plannedProjectHours, setPlannedProjectHours] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedData = localStorage.getItem('time-management-data')
        if (savedData) {
          const parsed = JSON.parse(savedData)
          if (Array.isArray(parsed.plannedProjectHours)) {
            return parsed.plannedProjectHours
          }
        }
      } catch (error) {
        console.error('Failed to load saved time management data', error)
      }
    }

    return initialTimeManagementState.plannedProjectHours
  })
  const [timeLogEntries, setTimeLogEntries] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedData = localStorage.getItem('time-management-data')
        if (savedData) {
          const parsed = JSON.parse(savedData)
          if (Array.isArray(parsed.activityLog)) {
            return parsed.activityLog
          }
        }
      } catch (error) {
        console.error('Failed to load saved time management activity log', error)
      }
    }

    return initialTimeManagementState.activityLog
  })
  const [timeLogStatus, setTimeLogStatus] = useState('Auto-saving changes locally.')
  const [employeeOptions, setEmployeeOptions] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedEmployees = localStorage.getItem('employee-management-data')
        if (savedEmployees) {
          return sanitizeEmployeeRoster(JSON.parse(savedEmployees), initialLabourTitleOptions)
        }
      } catch (error) {
        console.error('Failed to load saved employees', error)
      }
    }

    return sanitizeEmployeeRoster(employeeData?.employees || [], initialLabourTitleOptions)
  })
  const [employeeForm, setEmployeeForm] = useState({ name: '', date: '', timeIn: '', timeOut: '' })
  const [currentProjectForm, setCurrentProjectForm] = useState({ name: '', hours: '', project: '' })
  const [plannedProjectForm, setPlannedProjectForm] = useState({ name: '', hours: '', project: '' })
  const [employeeManagementForm, setEmployeeManagementForm] = useState({ name: '', role: '', coyNumber: '', department: '', email: '', phone: '' })
  const [employeeFileHandle, setEmployeeFileHandle] = useState(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState(null)
  const [editingEmployeeManagementId, setEditingEmployeeManagementId] = useState(null)
  const [employeeFormOpen, setEmployeeFormOpen] = useState(false)
  const [employeeManagementStatus, setEmployeeManagementStatus] = useState('Manage employees and keep the roster current.')
  const [editingCurrentProjectId, setEditingCurrentProjectId] = useState(null)
  const [editingPlannedProjectId, setEditingPlannedProjectId] = useState(null)
  const [labourPrices, setLabourPrices] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedData = localStorage.getItem('labour-prices-data')
        if (savedData) {
          const parsed = JSON.parse(savedData).labourPrices || []
          if (parsed.length > 0 && parsed[0].normalHourlyRate) {
            return parsed
          }
        }
      } catch (error) {
        console.error('Failed to load saved labour prices', error)
      }
    }
    return labourPricesData?.labourPrices || []
  })
  const [editingLabourId, setEditingLabourId] = useState(null)
  const [labourFormData, setLabourFormData] = useState({ title: '', normalHourlyRate: '', onsiteHourlyRate: '', breakdownHourlyRate: '' })
  const labourTitleOptions = labourPrices
    .map((labour) => labour.title)
    .filter(Boolean)
  const [priceCalculatorStatus, setPriceCalculatorStatus] = useState('Manage labour pricing rates.')
  const [priceCalculatorOpen, setPriceCalculatorOpen] = useState(false)
  const [materialManagementStatus, setMaterialManagementStatus] = useState('Manage material pricing.')
  const [materialManagementOpen, setMaterialManagementOpen] = useState(false)
  const [plates, setPlates] = useState(materialPricesData?.materials?.plates || [])
  const [selectedPlate, setSelectedPlate] = useState(plates[0]?.id || null)
  const [angleIron, setAngleIron] = useState(materialPricesData?.materials?.angleIron || [])
  const [selectedAngleIron, setSelectedAngleIron] = useState(angleIron[0]?.id || null)
  const [linerPlates, setLinerPlates] = useState(materialPricesData?.materials?.linerPlates || [])
  const [selectedLinerPlate, setSelectedLinerPlate] = useState(linerPlates[0]?.id || null)
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

  useEffect(() => {
    const jsonLabourPrices = labourPricesData?.labourPrices || []
    const jsonLabourTitles = jsonLabourPrices.map((entry) => entry.title).filter(Boolean)
    const jsonEmployees = sanitizeEmployeeRoster(employeeData?.employees || [], jsonLabourTitles)
    const jsonTimeData = {
      employeeHours: initialTimeManagementState.employeeHours,
      currentProjectHours: initialTimeManagementState.currentProjectHours,
      plannedProjectHours: initialTimeManagementState.plannedProjectHours,
      activityLog: initialTimeManagementState.activityLog,
      updatedAt: new Date().toISOString()
    }

    setLabourPrices(jsonLabourPrices)
    setEmployeeOptions(jsonEmployees)
    setEmployeeHours(jsonTimeData.employeeHours)
    setCurrentProjectHours(jsonTimeData.currentProjectHours)
    setPlannedProjectHours(jsonTimeData.plannedProjectHours)
    setTimeLogEntries(jsonTimeData.activityLog)

    const jsonPlates = materialPricesData?.materials?.plates || []
    const jsonAngleIron = materialPricesData?.materials?.angleIron || []
    const jsonLinerPlates = materialPricesData?.materials?.linerPlates || []
    setPlates(jsonPlates)
    setSelectedPlate(jsonPlates[0]?.id || null)
    setAngleIron(jsonAngleIron)
    setSelectedAngleIron(jsonAngleIron[0]?.id || null)
    setLinerPlates(jsonLinerPlates)
    setSelectedLinerPlate(jsonLinerPlates[0]?.id || null)

    if (typeof window !== 'undefined') {
      localStorage.setItem('employee-management-data', JSON.stringify(jsonEmployees))
      localStorage.setItem('labour-prices-data', JSON.stringify({
        generatedAt: new Date().toISOString(),
        labourPrices: jsonLabourPrices
      }))
      localStorage.setItem('time-management-data', JSON.stringify(jsonTimeData))
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('active-page', normalizePageKey(activePage))
    }
  }, [activePage])

  const hasHydratedTimeManagementRef = useRef(false)

  const persistTimeManagementData = (payload) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('time-management-data', JSON.stringify(payload))
        setTimeLogStatus('Auto-saved time-management changes locally.')
      }
    } catch (error) {
      console.error('Unable to save time management data', error)
      setTimeLogStatus('Auto-save failed.')
    }
  }

  useEffect(() => {
    if (!hasHydratedTimeManagementRef.current) {
      hasHydratedTimeManagementRef.current = true
      return
    }

    const payload = {
      employeeHours,
      currentProjectHours,
      plannedProjectHours,
      activityLog: timeLogEntries,
      updatedAt: new Date().toISOString()
    }

    persistTimeManagementData(payload)
  }, [employeeHours, currentProjectHours, plannedProjectHours, timeLogEntries])

  useEffect(() => {
    setEmployeeOptions((prev) => {
      const sanitized = sanitizeEmployeeRoster(prev, labourTitleOptions)
      if (JSON.stringify(prev) === JSON.stringify(sanitized)) {
        return prev
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('employee-management-data', JSON.stringify(sanitized))
      }

      return sanitized
    })
  }, [labourTitleOptions])

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

  const appendTimeLogEntry = async (action, section, details) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      action,
      group: action,
      section,
      timestamp: new Date().toISOString(),
      ...details
    }

    setTimeLogEntries((prev) => [entry, ...prev].slice(0, 200))
  }

  const addEmployeeHour = () => {
    if (!employeeForm.name || !employeeForm.date || !employeeForm.timeIn || !employeeForm.timeOut) return
    const newEntry = {
      id: Date.now(),
      name: employeeForm.name,
      date: employeeForm.date,
      timeIn: employeeForm.timeIn,
      timeOut: employeeForm.timeOut
    }
    setEmployeeHours([newEntry, ...employeeHours])
    setEmployeeForm({ name: '', date: '', timeIn: '', timeOut: '' })
    void appendTimeLogEntry('add', 'employee-hours', { entry: newEntry })
  }

  const updateEmployeeHour = (id, field, value) => {
    setEmployeeHours((prev) => {
      const currentEntry = prev.find((item) => item.id === id)
      const nextEntries = prev.map((item) => item.id === id ? { ...item, [field]: value } : item)
      if (currentEntry && currentEntry[field] !== value) {
        void appendTimeLogEntry('edit', 'employee-hours', {
          itemId: id,
          field,
          previousValue: currentEntry[field],
          newValue: value
        })
      }
      return nextEntries
    })
  }

  const removeEmployeeHour = (id) => {
    const entryToRemove = employeeHours.find((item) => item.id === id)
    setEmployeeHours(employeeHours.filter((item) => item.id !== id))
    if (entryToRemove) {
      void appendTimeLogEntry('remove', 'employee-hours', { itemId: id, entry: entryToRemove })
    }
  }

  const addCurrentProjectHour = () => {
    if (!currentProjectForm.name || !currentProjectForm.hours || !currentProjectForm.project) return
    const newEntry = {
      id: Date.now(),
      name: currentProjectForm.name,
      hours: currentProjectForm.hours,
      project: currentProjectForm.project
    }
    setCurrentProjectHours([newEntry, ...currentProjectHours])
    setCurrentProjectForm({ name: '', hours: '', project: '' })
    void appendTimeLogEntry('add', 'current-project-hours', { entry: newEntry })
  }

  const updateCurrentProjectHour = (id, field, value) => {
    setCurrentProjectHours((prev) => {
      const currentEntry = prev.find((item) => item.id === id)
      const nextEntries = prev.map((item) => item.id === id ? { ...item, [field]: value } : item)
      if (currentEntry && currentEntry[field] !== value) {
        void appendTimeLogEntry('edit', 'current-project-hours', {
          itemId: id,
          field,
          previousValue: currentEntry[field],
          newValue: value
        })
      }
      return nextEntries
    })
  }

  const removeCurrentProjectHour = (id) => {
    const entryToRemove = currentProjectHours.find((item) => item.id === id)
    setCurrentProjectHours(currentProjectHours.filter((item) => item.id !== id))
    if (entryToRemove) {
      void appendTimeLogEntry('remove', 'current-project-hours', { itemId: id, entry: entryToRemove })
    }
  }

  const addPlannedProjectHour = () => {
    if (!plannedProjectForm.name || !plannedProjectForm.hours || !plannedProjectForm.project) return
    const newEntry = {
      id: Date.now(),
      name: plannedProjectForm.name,
      hours: plannedProjectForm.hours,
      project: plannedProjectForm.project
    }
    setPlannedProjectHours([newEntry, ...plannedProjectHours])
    setPlannedProjectForm({ name: '', hours: '', project: '' })
    void appendTimeLogEntry('add', 'planned-project-hours', { entry: newEntry })
  }

  const updatePlannedProjectHour = (id, field, value) => {
    setPlannedProjectHours((prev) => {
      const currentEntry = prev.find((item) => item.id === id)
      const nextEntries = prev.map((item) => item.id === id ? { ...item, [field]: value } : item)
      if (currentEntry && currentEntry[field] !== value) {
        void appendTimeLogEntry('edit', 'planned-project-hours', {
          itemId: id,
          field,
          previousValue: currentEntry[field],
          newValue: value
        })
      }
      return nextEntries
    })
  }

  const removePlannedProjectHour = (id) => {
    const entryToRemove = plannedProjectHours.find((item) => item.id === id)
    setPlannedProjectHours(plannedProjectHours.filter((item) => item.id !== id))
    if (entryToRemove) {
      void appendTimeLogEntry('remove', 'planned-project-hours', { itemId: id, entry: entryToRemove })
    }
  }

  const persistEmployeesToFile = async (employeesToSave) => {
    const payload = JSON.stringify({ generatedAt: new Date().toISOString(), employees: employeesToSave }, null, 2)

    try {
      if (typeof window !== 'undefined' && ('showOpenFilePicker' in window || 'showSaveFilePicker' in window)) {
        let handle = employeeFileHandle

        if (!handle) {
          if ('showOpenFilePicker' in window) {
            const [pickedHandle] = await window.showOpenFilePicker({
              multiple: false,
              excludeAcceptAllOption: true,
              types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
            })
            handle = pickedHandle
          } else {
            handle = await window.showSaveFilePicker({
              suggestedName: 'employee.json',
              types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
            })
          }

          if (handle?.requestPermission) {
            const permission = await handle.requestPermission({ mode: 'readwrite' })
            if (permission !== 'granted') {
              throw new Error('Read/write permission denied for selected file.')
            }
          }

          setEmployeeFileHandle(handle)
        }

        const writable = await handle.createWritable()
        await writable.write(payload)
        await writable.close()
        setEmployeeManagementStatus('Employee file overwritten successfully.')
        return true
      } else {
        const blob = new Blob([payload], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'employee.json'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        setEmployeeManagementStatus('Downloaded employee.json (browser fallback).')
        return false
      }
    } catch (error) {
      console.error('Unable to save employee JSON file', error)
      setEmployeeManagementStatus('File save cancelled or blocked.')
      return false
    }
  }

  const saveEmployeesToJson = async () => {
    const sanitized = sanitizeEmployeeRoster(employeeOptions, labourTitleOptions)
    setEmployeeOptions(sanitized)
    const savedToFile = await persistEmployeesToFile(sanitized)

    if (savedToFile) {
      localStorage.setItem('employee-management-data', JSON.stringify(sanitized))
      return
    }

    localStorage.setItem('employee-management-data', JSON.stringify(sanitized))
    setEmployeeManagementStatus('Saved locally only. Link employee.json and press Save JSON again.')
  }

  const resetEmployeeManagementForm = () => {
    setEmployeeManagementForm({ name: '', role: '', coyNumber: '', department: '', email: '', phone: '' })
    setEditingEmployeeManagementId(null)
    setEmployeeFormOpen(false)
  }

  const handleEmployeeManagementSubmit = (event) => {
    event.preventDefault()

    if (!labourTitleOptions.includes(employeeManagementForm.role)) {
      setEmployeeManagementStatus('Please select a valid role from labour titles.')
      return
    }

    if (!coyNumberPattern.test(employeeManagementForm.coyNumber)) {
      setEmployeeManagementStatus('Coy number must be exactly 8 digits.')
      return
    }

    if (!employeeManagementForm.name || !employeeManagementForm.role || !employeeManagementForm.department || !employeeManagementForm.coyNumber) {
      setEmployeeManagementStatus('Name, role, coy number, and department are required.')
      return
    }

    if (editingEmployeeManagementId) {
      const nextEmployees = sanitizeEmployeeRoster(employeeOptions.map((employee) => (
        employee.id === editingEmployeeManagementId
          ? { ...employee, ...employeeManagementForm }
          : employee
      )), labourTitleOptions)

      setEmployeeOptions(nextEmployees)
      localStorage.setItem('employee-management-data', JSON.stringify(nextEmployees))
      setEmployeeManagementStatus('Employee updated. Click Save JSON to write file.')
    } else {
      const newEmployee = {
        id: Date.now(),
        ...employeeManagementForm
      }
      const nextEmployees = sanitizeEmployeeRoster([newEmployee, ...employeeOptions], labourTitleOptions)
      setEmployeeOptions(nextEmployees)
      localStorage.setItem('employee-management-data', JSON.stringify(nextEmployees))
      setEmployeeManagementStatus('Employee added. Click Save JSON to write file.')
    }

    resetEmployeeManagementForm()
  }

  const startEditingEmployee = (employee) => {
    setEditingEmployeeManagementId(employee.id)
    setEmployeeFormOpen(true)
    setEmployeeManagementForm({
      name: employee.name || '',
      role: employee.role || employee.title || '',
      coyNumber: employee.coyNumber || '',
      department: employee.department || '',
      email: employee.email || '',
      phone: employee.phone || ''
    })
  }

  const deleteEmployee = (id) => {
    const nextEmployees = employeeOptions.filter((employee) => employee.id !== id)
    setEmployeeOptions(nextEmployees)
    localStorage.setItem('employee-management-data', JSON.stringify(nextEmployees))
    setEmployeeManagementStatus('Employee removed. Click Save JSON to write file.')

    if (editingEmployeeManagementId === id) {
      resetEmployeeManagementForm()
    }
  }

  const calculateDailyTotal = (hourlyRate, hours) => {
    return parseFloat((hourlyRate * hours).toFixed(0))
  }

  const updateLabourPrice = (id, field, value) => {
    const updatedPrices = labourPrices.map((price) => {
      if (price.id === id) {
        return { ...price, [field]: field === 'title' ? value : parseFloat(value) || 0 }
      }
      return price
    })
    setLabourPrices(updatedPrices)
  }

  const startEditingLabour = (labour) => {
    setEditingLabourId(labour.id)
    setLabourFormData({
      title: labour.title,
      normalHourlyRate: labour.normalHourlyRate,
      onsiteHourlyRate: labour.onsiteHourlyRate,
      breakdownHourlyRate: labour.breakdownHourlyRate
    })
  }

  const resetLabourForm = () => {
    setLabourFormData({ title: '', normalHourlyRate: '', onsiteHourlyRate: '', breakdownHourlyRate: '' })
    setEditingLabourId(null)
  }

  const saveLabourPrices = () => {
    const payload = { generatedAt: new Date().toISOString(), labourPrices }
    localStorage.setItem('labour-prices-data', JSON.stringify(payload))
    setPriceCalculatorStatus('Labour prices saved locally.')
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

  const handleHeaderExport = async () => {
    if (activePage === 'time-management') {
      await generateReportPDF('time-report', 'time-management-report.pdf')
      return
    }

    if (activePage === 'employee-management') {
      await generateReportPDF('employee-report', 'employee-report.pdf')
      return
    }

    if (activePage === 'price-calculator') {
      await generateReportPDF('price-report', 'labour-rates-report.pdf')
      return
    }

    await generatePDF()
  }

  const generatePDF = async () => {
    setPdfTemplateMode('quote')
    await new Promise((resolve) => setTimeout(resolve, 150))
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

  const generateReportPDF = async (mode, fileName) => {
    setPdfTemplateMode(mode)
    await new Promise((resolve) => setTimeout(resolve, 150))

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

      await new Promise((resolve) => setTimeout(resolve, 200))

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

      const pdfBlob = pdf.output('blob')
      const pdfPreviewUrl = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = pdfPreviewUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(pdfPreviewUrl)
    } catch (error) {
      console.error('Error generating report PDF:', error)
      alert('Error generating report PDF. Please check the console for details.')
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <p className="brand-eyebrow">MSP</p>
          <h2>Quotation Hub</h2>
          <p>Create, review, and export quotes from a dedicated workspace.</p>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          <button
            type="button"
            className={`nav-item ${activePage === 'builder' ? 'active' : ''}`}
            onClick={() => setActivePage('builder')}
          >
            <span className="nav-icon">✎</span>
            Create Quote
          </button>
          <button
            type="button"
            className={`nav-item ${activePage === 'history' ? 'active' : ''}`}
            onClick={() => setActivePage('history')}
          >
            <span className="nav-icon">🕘</span>
            History
          </button>
          <button
            type="button"
            className={`nav-item ${activePage === 'preview' ? 'active' : ''}`}
            onClick={() => setActivePage('preview')}
          >
            <span className="nav-icon">🖨️</span>
            Preview
          </button>
          <button
            type="button"
            className={`nav-item ${activePage === 'time-management' ? 'active' : ''}`}
            onClick={() => setActivePage('time-management')}
          >
            <span className="nav-icon">⏱️</span>
            Time Management
          </button>
          <button
            type="button"
            className={`nav-item ${activePage === 'employee-management' ? 'active' : ''}`}
            onClick={() => setActivePage('employee-management')}
          >
            <span className="nav-icon">👥</span>
            Employee Management
          </button>
          <button
            type="button"
            className={`nav-item ${activePage === 'price-calculator' ? 'active' : ''}`}
            onClick={() => setActivePage('price-calculator')}
          >
            <span className="nav-icon">💰</span>
            Price Calculator
          </button>
        </nav>

        <div className="sidebar-card">
          <p className="card-label">Current quote</p>
          <h3>{quotationNumber}</h3>
          <p>{quotationTo || 'Pick a customer'}</p>
          <div className="summary-metric">
            <span>Total</span>
            <strong>R{parseFloat(calculateTotalPrice()).toFixed(2)}</strong>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-header">
          <div>
            <p className="eyebrow">Multi-page workspace</p>
            <h1>{activePage === 'builder' ? 'Quote builder' : activePage === 'history' ? 'Quotation history' : activePage === 'time-management' ? 'Time management' : activePage === 'employee-management' ? 'Employee management' : activePage === 'price-calculator' ? 'Price calculator' : 'PDF preview'}</h1>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-secondary" onClick={() => setActivePage('history')}>
              View history
            </button>
            <button type="button" className="btn-secondary" onClick={() => setActivePage('preview')}>
              Preview output
            </button>
            {(activePage === 'builder' || activePage === 'preview') && (
              <button className="btn-generate" onClick={handleHeaderExport}>
                Download PDF
              </button>
            )}
            {(activePage === 'time-management' || activePage === 'employee-management') && (
              <button className="btn-generate" onClick={handleHeaderExport}>
                Download report
              </button>
            )}
            {activePage === 'price-calculator' && (
              <>
                <button className="btn-generate" onClick={handleHeaderExport}>
                  Download PDF
                </button>
                <button
                  type="button"
                  className="btn-generate"
                  onClick={() => setPriceCalculatorOpen(!priceCalculatorOpen)}
                >
                  {priceCalculatorOpen ? 'Hide' : 'Manage'} rates
                </button>
                {priceCalculatorOpen && <span className="status-badge">{priceCalculatorStatus}</span>}
                <button
                  type="button"
                  className="btn-generate"
                  onClick={() => setMaterialManagementOpen(!materialManagementOpen)}
                >
                  {materialManagementOpen ? 'Hide' : 'Manage'} material
                </button>
                {materialManagementOpen && <span className="status-badge">{materialManagementStatus}</span>}
              </>
            )}
          </div>
        </header>

        {activePage === 'builder' && (
          <section className="page-card">
            <div className="page-header">
              <div>
                <p className="section-kicker">Step 1</p>
                <h2>Build your quotation</h2>
              </div>
              <span className="page-badge">Draft</span>
            </div>

            <div className="builder-grid">
              <div className="main-stack">
                <div className="form-section">
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
                </div>
              </div>

              <div className="side-stack">
                <div className="info-card">
                  <h3>Quote snapshot</h3>
                  <ul>
                    <li><span>Customer</span><strong>{quotationTo || 'Not selected'}</strong></li>
                    <li><span>Delivery</span><strong>{shippingAddress || 'Not selected'}</strong></li>
                    <li><span>Line items</span><strong>{lineItems.length}</strong></li>
                    <li><span>Status</span><strong>Draft</strong></li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        )}

        {activePage === 'history' && (
          <section className="page-card">
            <div className="page-header">
              <div>
                <p className="section-kicker">Step 2</p>
                <h2>Saved quotations</h2>
              </div>
              <span className="page-badge">Recent</span>
            </div>

            <div className="history-card history-card-page">
              {quotationHistory.length === 0 ? (
                <p className="empty-history">No quotations created yet.</p>
              ) : (
                <div className="history-list history-list-page">
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
          </section>
        )}

        {activePage === 'preview' && (
          <section className="page-card preview-page">
            <div className="page-header">
              <div>
                <p className="section-kicker">Step 3</p>
                <h2>Review the final document</h2>
              </div>
              <span className="page-badge">Ready</span>
            </div>
            <p className="page-copy">The output below mirrors the PDF layout so your team can review the document before export.</p>
          </section>
        )}

        {activePage === 'employee-management' && (
          <section className="page-card">
            <div className="page-header">
              <div>
                <p className="section-kicker">Step 4</p>
                <h2>Employee management</h2>
              </div>
              <div className="employee-page-actions">
                <span className="page-badge">Roster</span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (employeeFormOpen || editingEmployeeManagementId) {
                      resetEmployeeManagementForm()
                      return
                    }

                    setEmployeeFormOpen(true)
                  }}
                >
                  {employeeFormOpen || editingEmployeeManagementId ? 'Hide add employee' : 'Add employee'}
                </button>
              </div>
            </div>

            <p className="time-log-status">{employeeManagementStatus}</p>

            <div className="employee-summary-grid">
              <div className="employee-summary-card">
                <span>Total employees</span>
                <strong>{employeeOptions.length}</strong>
              </div>
              <div className="employee-summary-card">
                <span>Departments</span>
                <strong>{new Set(employeeOptions.map((employee) => employee.department).filter(Boolean)).size}</strong>
              </div>
              <div className="employee-summary-card">
                <span>Latest update</span>
                <strong>{employeeOptions[0]?.name || 'No roster yet'}</strong>
              </div>
            </div>

            <div className="employee-roster-shell">
              {(employeeFormOpen || editingEmployeeManagementId) && (
                <section className="employee-form-panel">
                  <div className="employee-card-header">
                    <h3>{editingEmployeeManagementId ? 'Edit employee' : 'Add employee'}</h3>
                    <button type="button" className="btn-secondary" onClick={resetEmployeeManagementForm}>Cancel</button>
                  </div>

                  <form className="employee-form-grid" onSubmit={handleEmployeeManagementSubmit}>
                    <label>
                      <span>Name</span>
                      <input
                        value={employeeManagementForm.name}
                        onChange={(e) => setEmployeeManagementForm({ ...employeeManagementForm, name: e.target.value })}
                        placeholder="Employee name"
                      />
                    </label>
                    <label>
                      <span>Role</span>
                      <select
                        value={employeeManagementForm.role}
                        onChange={(e) => setEmployeeManagementForm({ ...employeeManagementForm, role: e.target.value })}
                      >
                        <option value="">Select labour role</option>
                        {labourTitleOptions.map((title) => (
                          <option key={title} value={title}>
                            {title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Department</span>
                      <input
                        value={employeeManagementForm.department}
                        onChange={(e) => setEmployeeManagementForm({ ...employeeManagementForm, department: e.target.value })}
                        placeholder="Department"
                      />
                    </label>
                    <label>
                      <span>Coy number</span>
                      <input
                        value={employeeManagementForm.coyNumber}
                        onChange={(e) => {
                          const sanitizedCoyNumber = e.target.value.replace(/\D/g, '').slice(0, 8)
                          setEmployeeManagementForm({ ...employeeManagementForm, coyNumber: sanitizedCoyNumber })
                        }}
                        placeholder="8-digit coy number"
                        inputMode="numeric"
                        pattern="[0-9]{8}"
                        maxLength={8}
                      />
                    </label>
                    <label>
                      <span>Email</span>
                      <input
                        type="email"
                        value={employeeManagementForm.email}
                        onChange={(e) => setEmployeeManagementForm({ ...employeeManagementForm, email: e.target.value })}
                        placeholder="email@example.com"
                      />
                    </label>
                    <label>
                      <span>Phone</span>
                      <input
                        value={employeeManagementForm.phone}
                        onChange={(e) => setEmployeeManagementForm({ ...employeeManagementForm, phone: e.target.value })}
                        placeholder="Phone"
                      />
                    </label>
                    <div className="employee-form-actions">
                      <button type="submit" className="btn-add">{editingEmployeeManagementId ? 'Save changes' : 'Add employee'}</button>
                      <button type="button" className="btn-secondary" onClick={saveEmployeesToJson}>Save JSON</button>
                    </div>
                  </form>
                </section>
              )}

              {!(employeeFormOpen || editingEmployeeManagementId) && (
                <section className="employee-roster-panel">
                  <div className="employee-card-header">
                    <h3>Employee roster</h3>
                    <span>{employeeOptions.length} people</span>
                  </div>

                  {employeeOptions.length === 0 ? (
                    <p className="employee-empty-state">No employees added yet.</p>
                  ) : (
                    <div className="employee-roster-table-wrap">
                      <table className="employee-roster-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Department</th>
                            <th>Coy Number</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeeOptions.map((employee) => (
                            <tr key={employee.id}>
                              <td>{employee.name || 'Not set'}</td>
                              <td>{employee.role || 'Role not set'}</td>
                              <td>{employee.department || 'Department pending'}</td>
                              <td>{employee.coyNumber || 'Not set'}</td>
                              <td>{employee.email || 'No email'}</td>
                              <td>{employee.phone || 'No phone'}</td>
                              <td>
                                <div className="employee-list-actions">
                                  <button
                                    type="button"
                                    className="employee-action-btn employee-action-btn-edit"
                                    onClick={() => startEditingEmployee(employee)}
                                    aria-label={`Edit ${employee.name || 'employee'}`}
                                    title="Edit employee"
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                      <path d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l10.06-10.06.92.92L5.92 19.58zM20.71 5.63a1 1 0 0 0 0-1.41L19.78 3.29a1 1 0 0 0-1.41 0l-1.15 1.15 3.75 3.75 1.74-1.56z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    className="employee-action-btn employee-action-btn-delete"
                                    onClick={() => deleteEmployee(employee.id)}
                                    aria-label={`Delete ${employee.name || 'employee'}`}
                                    title="Delete employee"
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                      <path d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </div>
          </section>
        )}

        {activePage === 'price-calculator' && (
          <section className="page-card">
            <div className="page-header">
              <div>
                <p className="section-kicker">Calculator</p>
                <h2>Price calculator</h2>
              </div>
              <span className="page-badge">Tools</span>
            </div>

            {priceCalculatorOpen && (
            <div className="price-calculator-grid">
              <section className="price-editor-card">
                <div className="price-card-header">
                  <h3>{editingLabourId ? 'Edit labour rate' : 'Labour rates'}</h3>
                  {editingLabourId ? (
                    <button type="button" className="btn-secondary" onClick={resetLabourForm}>Cancel</button>
                  ) : null}
                </div>

                <div className="price-table-redesigned">
                  {labourPrices.map((labour) => (
                    <div key={labour.id} className="price-card-row">
                      <div className="price-card-header">
                        <h4>{labour.title}</h4>
                        <button type="button" className="btn-secondary" onClick={() => startEditingLabour(labour)}>Edit</button>
                      </div>
                      <div className="price-card-grid">
                        <div className="price-rate-group">
                          <div className="rate-label">Workshop / Normal</div>
                          <div className="rate-hourly">R{labour.normalHourlyRate || 0}/hr</div>
                          <div className="rate-daily">
                            <span className="daily-item">7.5h: R{labour.normalDaily7 || calculateDailyTotal(labour.normalHourlyRate, 7.5)}</span>
                            <span className="daily-item">11.5h: R{labour.normalDaily11 || calculateDailyTotal(labour.normalHourlyRate, 11.5)}</span>
                          </div>
                        </div>
                        <div className="price-rate-group">
                          <div className="rate-label">Onsite (Mine)</div>
                          <div className="rate-hourly">R{labour.onsiteHourlyRate || 0}/hr</div>
                          <div className="rate-daily">
                            <span className="daily-item">7.5h: R{labour.onsiteDaily7 || calculateDailyTotal(labour.onsiteHourlyRate, 7.5)}</span>
                            <span className="daily-item">11.5h: R{labour.onsiteDaily11 || calculateDailyTotal(labour.onsiteHourlyRate, 11.5)}</span>
                          </div>
                        </div>
                        <div className="price-rate-group">
                          <div className="rate-label">Breakdown (Out of Hours)</div>
                          <div className="rate-hourly breakdown-rate">R{labour.breakdownHourlyRate || 0}/hr</div>
                          <div className="rate-daily">
                            <span className="daily-item">7.5h: R{labour.breakdownDaily7 || calculateDailyTotal(labour.breakdownHourlyRate, 7.5)}</span>
                            <span className="daily-item">11.5h: R{labour.breakdownDaily11 || calculateDailyTotal(labour.breakdownHourlyRate, 11.5)}</span>
                          </div>
                        </div>
                      </div>
                      {editingLabourId === labour.id && (
                        <div className="price-editor-panel">
                          <div className="price-editor-grid">
                            <label>
                              <span>Category</span>
                              <input
                                type="text"
                                value={labourFormData.title}
                                onChange={(e) => setLabourFormData({ ...labourFormData, title: e.target.value })}
                                placeholder="Category"
                              />
                            </label>
                            <label>
                              <span>Normal Hours (R)</span>
                              <input
                                type="number"
                                min="0"
                                step="10"
                                value={labourFormData.normalHourlyRate}
                                onChange={(e) => {
                                  const rate = parseFloat(e.target.value) || 0
                                  setLabourFormData({ ...labourFormData, normalHourlyRate: rate })
                                  updateLabourPrice(labour.id, 'normalHourlyRate', rate)
                                }}
                                placeholder="0"
                              />
                            </label>
                            <label>
                              <span>Onsite Hours (R)</span>
                              <input
                                type="number"
                                min="0"
                                step="10"
                                value={labourFormData.onsiteHourlyRate}
                                onChange={(e) => {
                                  const rate = parseFloat(e.target.value) || 0
                                  setLabourFormData({ ...labourFormData, onsiteHourlyRate: rate })
                                  updateLabourPrice(labour.id, 'onsiteHourlyRate', rate)
                                }}
                                placeholder="0"
                              />
                            </label>
                            <label>
                              <span>Breakdown Hours (R)</span>
                              <input
                                type="number"
                                min="0"
                                step="10"
                                value={labourFormData.breakdownHourlyRate}
                                onChange={(e) => {
                                  const rate = parseFloat(e.target.value) || 0
                                  setLabourFormData({ ...labourFormData, breakdownHourlyRate: rate })
                                  updateLabourPrice(labour.id, 'breakdownHourlyRate', rate)
                                }}
                                placeholder="0"
                              />
                            </label>
                          </div>
                          <div className="price-breakdown">
                            <div className="breakdown-item">
                              <span>Normal Hours (7.5 hrs)</span>
                              <strong>R{calculateDailyTotal(labourFormData.normalHourlyRate, labour.normalHours)}</strong>
                            </div>
                            <div className="breakdown-item">
                              <span>Mine Hours (11.5 hrs)</span>
                              <strong>R{calculateDailyTotal(labourFormData.normalHourlyRate, labour.mineHours)}</strong>
                            </div>
                          </div>
                          <div className="price-editor-actions">
                            <button type="button" className="btn-secondary" onClick={() => {
                              updateLabourPrice(labour.id, 'title', labourFormData.title)
                              resetLabourForm()
                            }}>Done</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="price-form-actions">
                  <button type="button" className="btn-add" onClick={saveLabourPrices}>Save prices</button>
                </div>
              </section>

              <section className="price-summary-card">
                <h3>Rate summary</h3>
                <div className="summary-stats">
                  <div className="summary-stat">
                    <span>Total labour categories</span>
                    <strong>{labourPrices.length}</strong>
                  </div>
                  <div className="summary-stat">
                    <span>Highest normal rate</span>
                    <strong>R{Math.max(...labourPrices.map(l => l.normalHourlyRate))}</strong>
                  </div>
                  <div className="summary-stat">
                    <span>Lowest normal rate</span>
                    <strong>R{Math.min(...labourPrices.map(l => l.normalHourlyRate))}</strong>
                  </div>
                  <div className="summary-stat">
                    <span>Average normal rate</span>
                    <strong>R{Math.round(labourPrices.reduce((sum, l) => sum + l.normalHourlyRate, 0) / labourPrices.length)}</strong>
                  </div>
                </div>
              </section>
            </div>
            )}

            {materialManagementOpen && (
            <div className="material-management-grid">
              <section className="material-card">
                <div className="material-card-header">
                  <h3>Plates</h3>
                </div>
                <div className="material-content">
                  <label className="material-select-label">
                    <span>Select plate:</span>
                    <select value={selectedPlate} onChange={(e) => setSelectedPlate(Number(e.target.value))}>
                      {plates.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </label>
                  {selectedPlate && (
                    <div className="material-price-display">
                      <span className="material-name">{plates.find(p => p.id === selectedPlate)?.name}</span>
                      <span className="material-price">R{plates.find(p => p.id === selectedPlate)?.price}</span>
                    </div>
                  )}
                </div>
              </section>

              <section className="material-card">
                <div className="material-card-header">
                  <h3>Angle Iron / Flat Bar</h3>
                </div>
                <div className="material-content">
                  <label className="material-select-label">
                    <span>Select angle iron:</span>
                    <select value={selectedAngleIron} onChange={(e) => setSelectedAngleIron(Number(e.target.value))}>
                      {angleIron.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </label>
                  {selectedAngleIron && (
                    <div className="material-price-display">
                      <span className="material-name">{angleIron.find(a => a.id === selectedAngleIron)?.name}</span>
                      <span className="material-price">R{angleIron.find(a => a.id === selectedAngleIron)?.price}</span>
                    </div>
                  )}
                </div>
              </section>

              <section className="material-card">
                <div className="material-card-header">
                  <h3>Liner Plates</h3>
                </div>
                <div className="material-content">
                  <label className="material-select-label">
                    <span>Select liner plate:</span>
                    <select value={selectedLinerPlate} onChange={(e) => setSelectedLinerPlate(Number(e.target.value))}>
                      {linerPlates.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </label>
                  {selectedLinerPlate && (
                    <div className="material-price-display">
                      <span className="material-name">{linerPlates.find(l => l.id === selectedLinerPlate)?.name}</span>
                      <span className="material-price">R{linerPlates.find(l => l.id === selectedLinerPlate)?.price}</span>
                    </div>
                  )}
                </div>
              </section>

              <footer className="material-suppliers-footer">
                <h4>Top Suppliers</h4>
                <div className="suppliers-grid">
                  <a href="https://www.metalmotionsa.co.za/" target="_blank" rel="noopener noreferrer" className="supplier-link">
                    <span className="supplier-name">Metal Motion SA</span>
                    <span className="supplier-type">Mild Steel Plates</span>
                  </a>
                  <a href="https://shop.macsteel.co.za/" target="_blank" rel="noopener noreferrer" className="supplier-link">
                    <span className="supplier-name">Macsteel</span>
                    <span className="supplier-type">Angle Iron, VRN Liner Plates</span>
                  </a>
                  <a href="https://leongjin.co.za/" target="_blank" rel="noopener noreferrer" className="supplier-link">
                    <span className="supplier-name">Leong Jin Africa</span>
                    <span className="supplier-type">NM Series Liner Plates</span>
                  </a>
                  <a href="https://asapsteel.shop/" target="_blank" rel="noopener noreferrer" className="supplier-link">
                    <span className="supplier-name">ASAP Steel</span>
                    <span className="supplier-type">Mild Steel & Angle Iron</span>
                  </a>
                  <a href="https://steelonline.co.za/" target="_blank" rel="noopener noreferrer" className="supplier-link">
                    <span className="supplier-name">SteelOnline</span>
                    <span className="supplier-type">Mild Steel Plates</span>
                  </a>
                  <a href="https://www.steelpipesforafrica.co.za/" target="_blank" rel="noopener noreferrer" className="supplier-link">
                    <span className="supplier-name">Steel & Pipes for Africa</span>
                    <span className="supplier-type">Mild Steel & Angle Iron</span>
                  </a>
                  <a href="https://www.bsisteel.co.za/" target="_blank" rel="noopener noreferrer" className="supplier-link">
                    <span className="supplier-name">BSi Steel</span>
                    <span className="supplier-type">Mild Steel Plates</span>
                  </a>
                  <a href="https://www.steeloxsa.co.za/" target="_blank" rel="noopener noreferrer" className="supplier-link">
                    <span className="supplier-name">Steelox SA</span>
                    <span className="supplier-type">Specialized Steel Products</span>
                  </a>
                </div>
              </footer>
            </div>
            )}
          </section>
        )}

        {activePage === 'time-management' && (
          <section className="page-card">
            <div className="page-header">
              <div>
                <p className="section-kicker">Step 4</p>
                <h2>Time management</h2>
              </div>
              <span className="page-badge">Planning</span>
            </div>

            <p className="time-log-status">{timeLogStatus}</p>

            <div className="time-overview-grid">
              <section className="time-overview-block">
                <h3>Weekly effort</h3>
                <div className="time-kpi-grid">
                  <div>
                    <span>Estimated this week</span>
                    <strong>12.5 hrs</strong>
                  </div>
                  <div>
                    <span>Scheduled activities</span>
                    <strong>{timeEntries.length} tasks</strong>
                  </div>
                </div>
              </section>

              <section className="time-overview-block">
                <h3>Upcoming activities</h3>
                <div className="time-table-wrap">
                  <table className="time-grid-table">
                    <thead>
                      <tr>
                        <th>Activity</th>
                        <th>Date</th>
                        <th>Hours</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.title}</td>
                          <td>{entry.date}</td>
                          <td>{entry.hours} hrs</td>
                          <td>{entry.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="time-section-grid">
              <section className="time-table-card">
                <div className="time-table-header">
                  <h3>Employee hours</h3>
                  <span>Attendance</span>
                </div>
                <div className="time-table-wrap">
                  <table className="time-grid-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Date</th>
                        <th>Time in</th>
                        <th>Time out</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeHours.map((entry) => (
                        <Fragment key={entry.id}>
                          <tr>
                            <td>{entry.name}</td>
                            <td>{entry.date}</td>
                            <td>{entry.timeIn}</td>
                            <td>{entry.timeOut}</td>
                            <td>
                              <div className="time-row-actions">
                                <button
                                  type="button"
                                  className="employee-action-btn employee-action-btn-edit"
                                  onClick={() => setEditingEmployeeId(entry.id)}
                                  aria-label={`Edit ${entry.name || 'entry'}`}
                                  title="Edit entry"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l10.06-10.06.92.92L5.92 19.58zM20.71 5.63a1 1 0 0 0 0-1.41L19.78 3.29a1 1 0 0 0-1.41 0l-1.15 1.15 3.75 3.75 1.74-1.56z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="employee-action-btn employee-action-btn-delete"
                                  onClick={() => removeEmployeeHour(entry.id)}
                                  aria-label={`Delete ${entry.name || 'entry'}`}
                                  title="Delete entry"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {editingEmployeeId === entry.id && (
                            <tr className="time-editor-row">
                              <td colSpan={5}>
                                <div className="time-editor-panel">
                                  <div className="time-editor-grid">
                                    <select
                                      value={entry.name}
                                      onChange={(e) => updateEmployeeHour(entry.id, 'name', e.target.value)}
                                    >
                                      {employeeOptions.map((employee) => (
                                        <option key={employee.id} value={employee.name}>
                                          {employee.name}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      type="date"
                                      value={entry.date}
                                      onChange={(e) => updateEmployeeHour(entry.id, 'date', e.target.value)}
                                    />
                                    <input
                                      type="time"
                                      value={entry.timeIn}
                                      onChange={(e) => updateEmployeeHour(entry.id, 'timeIn', e.target.value)}
                                    />
                                    <input
                                      type="time"
                                      value={entry.timeOut}
                                      onChange={(e) => updateEmployeeHour(entry.id, 'timeOut', e.target.value)}
                                    />
                                  </div>
                                  <div className="time-editor-actions">
                                    <button type="button" className="btn-delete" onClick={() => removeEmployeeHour(entry.id)}>Remove</button>
                                    <button type="button" className="btn-secondary" onClick={() => setEditingEmployeeId(null)}>Done</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="time-form">
                  <select
                    value={employeeForm.name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })}
                  >
                    <option value="">Select employee</option>
                    {employeeOptions.map((employee) => (
                      <option key={employee.id} value={employee.name}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={employeeForm.date}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, date: e.target.value })}
                  />
                  <input
                    type="time"
                    value={employeeForm.timeIn}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, timeIn: e.target.value })}
                  />
                  <input
                    type="time"
                    value={employeeForm.timeOut}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, timeOut: e.target.value })}
                  />
                  <button type="button" className="btn-add" onClick={addEmployeeHour}>Add</button>
                </div>
              </section>

              <section className="time-table-card">
                <div className="time-table-header">
                  <h3>Current project hours</h3>
                  <span>Live allocation</span>
                </div>
                <div className="time-table-wrap">
                  <table className="time-grid-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Hours</th>
                        <th>Project</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentProjectHours.map((entry) => (
                        <Fragment key={entry.id}>
                          <tr>
                            <td>{entry.name}</td>
                            <td>{entry.hours}</td>
                            <td>{entry.project}</td>
                            <td>
                              <div className="time-row-actions">
                                <button
                                  type="button"
                                  className="employee-action-btn employee-action-btn-edit"
                                  onClick={() => setEditingCurrentProjectId(entry.id)}
                                  aria-label={`Edit ${entry.name || 'entry'}`}
                                  title="Edit entry"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l10.06-10.06.92.92L5.92 19.58zM20.71 5.63a1 1 0 0 0 0-1.41L19.78 3.29a1 1 0 0 0-1.41 0l-1.15 1.15 3.75 3.75 1.74-1.56z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="employee-action-btn employee-action-btn-delete"
                                  onClick={() => removeCurrentProjectHour(entry.id)}
                                  aria-label={`Delete ${entry.name || 'entry'}`}
                                  title="Delete entry"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {editingCurrentProjectId === entry.id && (
                            <tr className="time-editor-row">
                              <td colSpan={4}>
                                <div className="time-editor-panel">
                                  <div className="time-editor-grid time-editor-grid-three">
                                    <select
                                      value={entry.name}
                                      onChange={(e) => updateCurrentProjectHour(entry.id, 'name', e.target.value)}
                                    >
                                      {employeeOptions.map((employee) => (
                                        <option key={employee.id} value={employee.name}>
                                          {employee.name}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      step="0.5"
                                      value={entry.hours}
                                      onChange={(e) => updateCurrentProjectHour(entry.id, 'hours', e.target.value)}
                                      placeholder="Hours"
                                    />
                                    <input
                                      value={entry.project}
                                      onChange={(e) => updateCurrentProjectHour(entry.id, 'project', e.target.value)}
                                      placeholder="Project"
                                    />
                                  </div>
                                  <div className="time-editor-actions">
                                    <button type="button" className="btn-delete" onClick={() => removeCurrentProjectHour(entry.id)}>Remove</button>
                                    <button type="button" className="btn-secondary" onClick={() => setEditingCurrentProjectId(null)}>Done</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="time-form">
                  <select
                    value={currentProjectForm.name}
                    onChange={(e) => setCurrentProjectForm({ ...currentProjectForm, name: e.target.value })}
                  >
                    <option value="">Select employee</option>
                    {employeeOptions.map((employee) => (
                      <option key={employee.id} value={employee.name}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Hours"
                    value={currentProjectForm.hours}
                    onChange={(e) => setCurrentProjectForm({ ...currentProjectForm, hours: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Project"
                    value={currentProjectForm.project}
                    onChange={(e) => setCurrentProjectForm({ ...currentProjectForm, project: e.target.value })}
                  />
                  <button type="button" className="btn-add" onClick={addCurrentProjectHour}>Add</button>
                </div>
              </section>

              <section className="time-table-card">
                <div className="time-table-header">
                  <h3>Planned project hours</h3>
                  <span>Upcoming</span>
                </div>
                <div className="time-table-wrap">
                  <table className="time-grid-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Hours</th>
                        <th>Project</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plannedProjectHours.map((entry) => (
                        <Fragment key={entry.id}>
                          <tr>
                            <td>{entry.name}</td>
                            <td>{entry.hours}</td>
                            <td>{entry.project}</td>
                            <td>
                              <div className="time-row-actions">
                                <button
                                  type="button"
                                  className="employee-action-btn employee-action-btn-edit"
                                  onClick={() => setEditingPlannedProjectId(entry.id)}
                                  aria-label={`Edit ${entry.name || 'entry'}`}
                                  title="Edit entry"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l10.06-10.06.92.92L5.92 19.58zM20.71 5.63a1 1 0 0 0 0-1.41L19.78 3.29a1 1 0 0 0-1.41 0l-1.15 1.15 3.75 3.75 1.74-1.56z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="employee-action-btn employee-action-btn-delete"
                                  onClick={() => removePlannedProjectHour(entry.id)}
                                  aria-label={`Delete ${entry.name || 'entry'}`}
                                  title="Delete entry"
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                          {editingPlannedProjectId === entry.id && (
                            <tr className="time-editor-row">
                              <td colSpan={4}>
                                <div className="time-editor-panel">
                                  <div className="time-editor-grid time-editor-grid-three">
                                    <select
                                      value={entry.name}
                                      onChange={(e) => updatePlannedProjectHour(entry.id, 'name', e.target.value)}
                                    >
                                      {employeeOptions.map((employee) => (
                                        <option key={employee.id} value={employee.name}>
                                          {employee.name}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      type="number"
                                      step="0.5"
                                      value={entry.hours}
                                      onChange={(e) => updatePlannedProjectHour(entry.id, 'hours', e.target.value)}
                                      placeholder="Hours"
                                    />
                                    <input
                                      value={entry.project}
                                      onChange={(e) => updatePlannedProjectHour(entry.id, 'project', e.target.value)}
                                      placeholder="Project"
                                    />
                                  </div>
                                  <div className="time-editor-actions">
                                    <button type="button" className="btn-delete" onClick={() => removePlannedProjectHour(entry.id)}>Remove</button>
                                    <button type="button" className="btn-secondary" onClick={() => setEditingPlannedProjectId(null)}>Done</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="time-form">
                  <select
                    value={plannedProjectForm.name}
                    onChange={(e) => setPlannedProjectForm({ ...plannedProjectForm, name: e.target.value })}
                  >
                    <option value="">Select employee</option>
                    {employeeOptions.map((employee) => (
                      <option key={employee.id} value={employee.name}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="Hours"
                    value={plannedProjectForm.hours}
                    onChange={(e) => setPlannedProjectForm({ ...plannedProjectForm, hours: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Project"
                    value={plannedProjectForm.project}
                    onChange={(e) => setPlannedProjectForm({ ...plannedProjectForm, project: e.target.value })}
                  />
                  <button type="button" className="btn-add" onClick={addPlannedProjectHour}>Add</button>
                </div>
              </section>
            </div>
          </section>
        )}
      </main>

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
      <div ref={quotationRef} className={`pdf-template ${activePage === 'preview' ? 'preview-visible' : ''}`}>
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
              <h2 className="document-title">
                {pdfTemplateMode === 'time-report' ? 'TIME MANAGEMENT REPORT' : pdfTemplateMode === 'employee-report' ? 'EMPLOYEE REPORT' : pdfTemplateMode === 'price-report' ? 'LABOUR RATES REPORT' : 'QUOTATION'}
              </h2>
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

          {pdfTemplateMode === 'quote' ? (
            <>
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
            </>
          ) : (
            <>
              <div className="meta-section">
                <div className="meta-box">
                  <h3>REPORT SUMMARY</h3>
                  <div className="box-content">
                    {pdfTemplateMode === 'time-report' ? `Generated: ${new Date().toLocaleString()}\nEntries: ${employeeHours.length + currentProjectHours.length + plannedProjectHours.length}` : pdfTemplateMode === 'employee-report' ? `Generated: ${new Date().toLocaleString()}\nEmployees: ${employeeOptions.length}` : `Generated: ${new Date().toLocaleString()}\nLabour Categories: ${labourPrices.length}`}
                  </div>
                </div>
                <div className="meta-box">
                  <h3>DETAILS</h3>
                  <div className="box-content">
                    {pdfTemplateMode === 'time-report' ? `Employee hours: ${employeeHours.length}\nCurrent project hours: ${currentProjectHours.length}\nPlanned project hours: ${plannedProjectHours.length}` : pdfTemplateMode === 'employee-report' ? `Roles: ${employeeOptions.filter((employee) => employee.role).length}` : `Normal Rate Range: R${Math.min(...labourPrices.map(l => l.normalHourlyRate))} - R${Math.max(...labourPrices.map(l => l.normalHourlyRate))}`}
                  </div>
                </div>
              </div>

              <table className="items-table">
                <thead>
                  <tr>
                    {pdfTemplateMode === 'price-report' ? (
                      <>
                        <th style={{width: '20%'}}>CATEGORY</th>
                        <th style={{width: '15%'}}>FEE TYPE</th>
                        <th style={{width: '15%', textAlign: 'right'}}>HOURLY RATE</th>
                        <th style={{width: '15%', textAlign: 'right'}}>DAILY (7.5h)</th>
                        <th style={{width: '20%', textAlign: 'right'}}>DAILY (11.5h)</th>
                      </>
                    ) : (
                      <>
                        <th style={{width: '25%'}}>{pdfTemplateMode === 'time-report' ? 'SECTION' : 'NAME'}</th>
                        <th style={{width: '25%'}}>{pdfTemplateMode === 'time-report' ? 'ITEM' : 'ROLE'}</th>
                        <th style={{width: '30%', textAlign: 'left'}}>{pdfTemplateMode === 'time-report' ? 'DETAILS' : 'DEPARTMENT'}</th>
                        <th style={{width: '20%', textAlign: 'right'}}>{pdfTemplateMode === 'time-report' ? 'VALUE' : 'EMAIL'}</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pdfTemplateMode === 'price-report' ? (
                    labourPrices.map((labour, idx) => [
                      <tr key={`${labour.id}-normal`}>
                        <td>{idx === 0 ? labour.title : idx === labourPrices.indexOf(labour) ? labour.title : ''}</td>
                        <td>Normal</td>
                        <td className="text-right">R{labour.normalHourlyRate}</td>
                        <td className="text-right">R{labour.normalDaily7 || calculateDailyTotal(labour.normalHourlyRate, 7.5)}</td>
                        <td className="text-right">R{labour.normalDaily11 || calculateDailyTotal(labour.normalHourlyRate, 11.5)}</td>
                      </tr>,
                      <tr key={`${labour.id}-onsite`}>
                        <td></td>
                        <td>Onsite (Mine)</td>
                        <td className="text-right">R{labour.onsiteHourlyRate}</td>
                        <td className="text-right">R{labour.onsiteDaily7 || calculateDailyTotal(labour.onsiteHourlyRate, 7.5)}</td>
                        <td className="text-right">R{labour.onsiteDaily11 || calculateDailyTotal(labour.onsiteHourlyRate, 11.5)}</td>
                      </tr>,
                      <tr key={`${labour.id}-breakdown`}>
                        <td></td>
                        <td>Breaktime (Out of Hrs)</td>
                        <td className="text-right">R{labour.breakdownHourlyRate}</td>
                        <td className="text-right">R{labour.breakdownDaily7 || calculateDailyTotal(labour.breakdownHourlyRate, 7.5)}</td>
                        <td className="text-right">R{labour.breakdownDaily11 || calculateDailyTotal(labour.breakdownHourlyRate, 11.5)}</td>
                      </tr>
                    ]).flat()
                  ) : pdfTemplateMode === 'time-report' ? (
                    <>
                      {employeeHours.slice(0, 8).map((entry) => (
                        <tr key={`emp-${entry.id}`}>
                          <td>Employee Hours</td>
                          <td>{entry.name || 'Unknown'}</td>
                          <td>{entry.date || '-'}</td>
                          <td className="text-right">{entry.timeIn || '-'} - {entry.timeOut || '-'}</td>
                        </tr>
                      ))}
                      {currentProjectHours.slice(0, 8).map((entry) => (
                        <tr key={`current-${entry.id}`}>
                          <td>Current Project</td>
                          <td>{entry.name || 'Unknown'}</td>
                          <td>{entry.project || '-'}</td>
                          <td className="text-right">{entry.hours || '-'}</td>
                        </tr>
                      ))}
                      {plannedProjectHours.slice(0, 8).map((entry) => (
                        <tr key={`planned-${entry.id}`}>
                          <td>Planned Project</td>
                          <td>{entry.name || 'Unknown'}</td>
                          <td>{entry.project || '-'}</td>
                          <td className="text-right">{entry.hours || '-'}</td>
                        </tr>
                      ))}
                      {timeLogEntries.slice(0, 8).map((entry) => (
                        <tr key={`log-${entry.id}`}>
                          <td>Activity Log</td>
                          <td>{entry.action || 'Action'}</td>
                          <td>{entry.section || '-'}</td>
                          <td className="text-right">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    employeeOptions.map((employee) => (
                      <tr key={employee.id}>
                        <td>{employee.name || 'Unknown'}</td>
                        <td>{employee.role || '-'}</td>
                        <td>{employee.department || '-'}</td>
                        <td className="text-right">{employee.email || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
