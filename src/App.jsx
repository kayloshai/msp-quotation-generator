import { Fragment, Suspense, lazy, useState, useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import './App.css'

const PdfCanvasPreview = lazy(() => import('./PdfCanvasPreview'))

const validPages = ['builder', 'history', 'preview', 'time-management', 'employee-management', 'price-calculator', 'list-management']
const coyNumberPattern = /^\d{8}$/
const employeeTrainingOptions = [
  'Basic rigging',
  'Working at heights level 1',
  'Working at heights level 2',
  'Basic fire fighting'
]
const defaultQuoteItems = ['Manufacture', 'Fabricate', 'Supply']
const defaultManagedLists = {
  roles: [],
  trainings: [...employeeTrainingOptions],
  departments: [],
  projects: [],
  quoteItems: [...defaultQuoteItems]
}
const runtimeHost = typeof window === 'undefined' ? 'localhost' : window.location.hostname
const graphqlEndpoint = import.meta.env.VITE_GRAPHQL_URL || `http://${runtimeHost}:4000/`

const graphqlRequest = async (query, variables = {}) => {
  const response = await fetch(graphqlEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  })

  if (!response.ok) {
    throw new Error(`GraphQL request failed with status ${response.status}`)
  }

  const payload = await response.json()
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message || 'GraphQL request failed')
  }

  return payload.data
}

const sanitizeEmployeeRoster = (employees, validTitles) => {
  const allowedTitles = new Set(validTitles)

  return (Array.isArray(employees) ? employees : []).map((employee) => {
    const rawRole = (employee?.role || employee?.title || '').trim()
    const role = rawRole
    const rawCoyNumber = String(employee?.coyNumber || '').replace(/\D/g, '')
    const coyNumber = coyNumberPattern.test(rawCoyNumber) ? rawCoyNumber : ''
    let trainingRecords = []

    if (Array.isArray(employee?.trainingRecords)) {
      trainingRecords = employee.trainingRecords
    } else if (employee?.trainingRecords) {
      try {
        const parsedTrainingRecords = JSON.parse(employee.trainingRecords)
        if (Array.isArray(parsedTrainingRecords)) {
          trainingRecords = parsedTrainingRecords
        }
      } catch (error) {
        trainingRecords = []
      }
    }

    return {
      ...employee,
      role,
      title: allowedTitles.has(rawRole) ? rawRole : rawRole,
      coyNumber,
      inductionExpiryDate: String(employee?.inductionExpiryDate || '').trim(),
      trainingRecords: trainingRecords
        .map((record) => ({
          training: String(record?.training || '').trim(),
          expiryDate: String(record?.expiryDate || '').trim()
        }))
        .filter((record) => record.training)
    }
  })
}

const getEmployeeComplianceRows = (employee) => {
  const trainingRows = Array.isArray(employee?.trainingRecords) ? employee.trainingRecords : []
  const rows = []

  if (String(employee?.inductionExpiryDate || '').trim()) {
    rows.push({
      label: 'Induction expiry date',
      value: employee.inductionExpiryDate
    })
  }

  rows.push(
    ...trainingRows
      .filter((record) => String(record?.training || '').trim())
      .map((record) => ({
        label: record.training,
        value: record.expiryDate || 'DD/MM/YYYY'
      }))
  )

  return rows
}

const normalizeMatchLabel = (value) => {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const findLabourRateByRole = (role, labourRows) => {
  const normalizedRole = normalizeMatchLabel(role)
  if (!normalizedRole) return null

  const rows = Array.isArray(labourRows) ? labourRows : []

  const exactMatch = rows.find((labour) => normalizeMatchLabel(labour?.title) === normalizedRole)
  if (exactMatch) return exactMatch

  return rows.find((labour) => {
    const normalizedTitle = normalizeMatchLabel(labour?.title)
    return normalizedTitle.includes(normalizedRole) || normalizedRole.includes(normalizedTitle)
  }) || null
}

const normalizePageKey = (page) => {
  if (page === 'time') {
    return 'time-management'
  }

  return validPages.includes(page) ? page : 'builder'
}

const getReportPrefix = (mode) => {
  if (mode === 'time-report') return 'time-management-report'
  if (mode === 'employee-report') return 'employee-report'
  if (mode === 'price-report') return 'labour-rates-report'
  return 'report'
}

const formatReportTimestampSegment = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}-${hour}${minute}${second}`
}

const toSlugValue = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const normalizeUniqueList = (values) => {
  return Array.from(
    new Map(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .map((value) => [value.toLowerCase(), value])
    ).values()
  ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }))
}

const normalizeManagedListSettings = (value = {}) => {
  return {
    roles: normalizeUniqueList(value.roles || []),
    trainings: normalizeUniqueList(value.trainings || []),
    departments: normalizeUniqueList(value.departments || []),
    projects: normalizeUniqueList(value.projects || []),
    quoteItems: normalizeUniqueList(value.quoteItems || [])
  }
}

const blobToBase64 = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
}

const base64ToBlobUrl = (base64Data, mimeType = 'application/pdf') => {
  const binary = atob(base64Data)
  const length = binary.length
  const bytes = new Uint8Array(length)

  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  const blob = new Blob([bytes], { type: mimeType })
  return URL.createObjectURL(blob)
}

function App() {
  const quotationRef = useRef()
  const [vendorOptions, setVendorOptions] = useState([])
  const [vendorForm, setVendorForm] = useState({ company: '', vatNumber: '', quotationTo: '', shippingAddress: '' })
  const [editingVendorId, setEditingVendorId] = useState(null)
  const [quotationNumber, setQuotationNumber] = useState('QUO1')
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0])
  const [quotationTo, setQuotationTo] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')
  const [selectedQuotationVendorId, setSelectedQuotationVendorId] = useState('')
  const [selectedShippingVendorId, setSelectedShippingVendorId] = useState('')
  const [accordionOpen, setAccordionOpen] = useState(false)
  const [panelDescription, setPanelDescription] = useState('')
  const [panelStatus, setPanelStatus] = useState('')
  const [saveLocationHandle, setSaveLocationHandle] = useState(null)
  const [saveLocationLabel, setSaveLocationLabel] = useState('C:/Users/Welcome/Documents/Quotations')
  const [quotationHistory, setQuotationHistory] = useState([])
  const [quotations, setQuotations] = useState([])
  const [activeQuotationId, setActiveQuotationId] = useState('')
  const [quoteSaveStatus, setQuoteSaveStatus] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedHistoryQuote, setSelectedHistoryQuote] = useState(null)
  const [activePage, setActivePage] = useState('builder')
  const [pdfTemplateMode, setPdfTemplateMode] = useState('quote')
  const [timeEntries, setTimeEntries] = useState([])
  const [employeeHours, setEmployeeHours] = useState([])
  const [currentProjectHours, setCurrentProjectHours] = useState([])
  const [plannedProjectHours, setPlannedProjectHours] = useState([])
  const [timeLogEntries, setTimeLogEntries] = useState([])
  const [timeLogStatus, setTimeLogStatus] = useState('Loading data from database...')
  const [employeeOptions, setEmployeeOptions] = useState([])
  const [employeeForm, setEmployeeForm] = useState({ name: '', date: '', timeIn: '', timeOut: '' })
  const [employeeHoursFormOpen, setEmployeeHoursFormOpen] = useState(true)
  const [currentProjectForm, setCurrentProjectForm] = useState({ name: '', hours: '', project: '' })
  const [plannedProjectForm, setPlannedProjectForm] = useState({ name: '', hours: '', project: '' })
  const [currentProjectFormOpen, setCurrentProjectFormOpen] = useState(true)
  const [plannedProjectFormOpen, setPlannedProjectFormOpen] = useState(true)
  const [currentProjectEmployeeMode, setCurrentProjectEmployeeMode] = useState('single')
  const [plannedProjectEmployeeMode, setPlannedProjectEmployeeMode] = useState('single')
  const [currentProjectBulkEmployees, setCurrentProjectBulkEmployees] = useState([])
  const [plannedProjectBulkEmployees, setPlannedProjectBulkEmployees] = useState([])
  const [currentProjectBulkOpen, setCurrentProjectBulkOpen] = useState(false)
  const [plannedProjectBulkOpen, setPlannedProjectBulkOpen] = useState(false)
  const [employeeManagementForm, setEmployeeManagementForm] = useState({ name: '', role: '', coyNumber: '', department: '', email: '', phone: '', inductionExpiryDate: '' })
  const [employeeTrainingMode, setEmployeeTrainingMode] = useState('single')
  const [employeeTrainingSingle, setEmployeeTrainingSingle] = useState({ training: '', expiryDate: '' })
  const [employeeTrainingBulk, setEmployeeTrainingBulk] = useState({ trainings: [], expiryDate: '' })
  const [employeeTrainingBulkOpen, setEmployeeTrainingBulkOpen] = useState(false)
  const [employeeTrainingRecords, setEmployeeTrainingRecords] = useState([])
  const [editingEmployeeId, setEditingEmployeeId] = useState(null)
  const [editingEmployeeManagementId, setEditingEmployeeManagementId] = useState(null)
  const [employeeFormOpen, setEmployeeFormOpen] = useState(false)
  const [employeeRosterSort, setEmployeeRosterSort] = useState({ column: 'name', direction: 'asc' })
  const [expandedEmployeeId, setExpandedEmployeeId] = useState(null)
  const [employeeManagementStatus, setEmployeeManagementStatus] = useState('Manage employees and keep the roster current.')
  const [editingCurrentProjectId, setEditingCurrentProjectId] = useState(null)
  const [editingPlannedProjectId, setEditingPlannedProjectId] = useState(null)
  const [labourPrices, setLabourPrices] = useState([])
  const [editingLabourId, setEditingLabourId] = useState(null)
  const [labourFormData, setLabourFormData] = useState({ title: '', normalHourlyRate: '', onsiteHourlyRate: '', breakdownHourlyRate: '' })
  const labourTitleOptions = Array.from(
    new Map(
      labourPrices
        .map((labour) => String(labour.title || '').trim())
        .filter(Boolean)
        .map((title) => [title.toLowerCase(), title])
    ).values()
  )
  const [priceCalculatorStatus, setPriceCalculatorStatus] = useState('Manage labour pricing rates.')
  const [priceCalculatorOpen, setPriceCalculatorOpen] = useState(false)
  const [materialManagementStatus, setMaterialManagementStatus] = useState('Manage material pricing.')
  const [materialManagementOpen, setMaterialManagementOpen] = useState(false)
  const [plates, setPlates] = useState([])
  const [selectedPlate, setSelectedPlate] = useState(plates[0]?.id || null)
  const [angleIron, setAngleIron] = useState([])
  const [selectedAngleIron, setSelectedAngleIron] = useState(angleIron[0]?.id || null)
  const [linerPlates, setLinerPlates] = useState([])
  const [selectedLinerPlate, setSelectedLinerPlate] = useState(linerPlates[0]?.id || null)
  const [isDbHydrated, setIsDbHydrated] = useState(false)
  const [isListManagementHydrated, setIsListManagementHydrated] = useState(false)
  const [reportMetadata, setReportMetadata] = useState({
    reportNumber: 0,
    generatedAtIso: '',
    fileName: ''
  })
  const [managedLists, setManagedLists] = useState(defaultManagedLists)
  const [listDrafts, setListDrafts] = useState({
    roles: '',
    trainings: '',
    departments: '',
    projects: '',
    quoteItems: ''
  })
  const [listManagementStatus, setListManagementStatus] = useState('Manage reusable dropdown lists used across forms.')
  const [lineItems, setLineItems] = useState([
    { id: 1, qty: '', item: toSlugValue(defaultQuoteItems[0]), description: '', unitPrice: '' }
  ])
  const [newLineItem, setNewLineItem] = useState({
    qty: '',
    item: toSlugValue(defaultQuoteItems[0]),
    description: '',
    unitPrice: ''
  })

  const upsertEmployeeTrainingRecords = (records) => {
    setEmployeeTrainingRecords((currentRecords) => {
      const nextRecords = [...currentRecords]

      for (const record of records) {
        const trainingName = String(record?.training || '').trim()
        const expiryDate = String(record?.expiryDate || '').trim()

        if (!trainingName || !expiryDate) {
          continue
        }

        const existingIndex = nextRecords.findIndex((entry) => entry.training === trainingName)
        const nextEntry = { training: trainingName, expiryDate }

        if (existingIndex >= 0) {
          nextRecords[existingIndex] = nextEntry
        } else {
          nextRecords.push(nextEntry)
        }
      }

      return nextRecords
    })
  }

  const addSingleEmployeeTraining = () => {
    if (!employeeTrainingSingle.training || !employeeTrainingSingle.expiryDate) return
    upsertEmployeeTrainingRecords([employeeTrainingSingle])
    setEmployeeTrainingSingle({ training: '', expiryDate: '' })
  }

  const addBulkEmployeeTraining = () => {
    if (!employeeTrainingBulk.trainings.length || !employeeTrainingBulk.expiryDate) return

    upsertEmployeeTrainingRecords(
      employeeTrainingBulk.trainings.map((training) => ({
        training,
        expiryDate: employeeTrainingBulk.expiryDate
      }))
    )

    setEmployeeTrainingBulk({ trainings: [], expiryDate: '' })
    setEmployeeTrainingBulkOpen(false)
  }

  const toggleEmployeeRosterSort = (column) => {
    setEmployeeRosterSort((currentSort) => {
      if (column === 'name') {
        return {
          column: 'name',
          direction: 'asc'
        }
      }

      if (currentSort.column === column) {
        return {
          column,
          direction: currentSort.direction === 'asc' ? 'desc' : 'asc'
        }
      }

      return {
        column,
        direction: 'asc'
      }
    })
  }

  const toggleEmployeeDetails = (employeeId) => {
    setExpandedEmployeeId((currentEmployeeId) => (currentEmployeeId === employeeId ? null : employeeId))
  }

  const sortedEmployeeOptions = [...employeeOptions].sort((left, right) => {
    const column = employeeRosterSort.column
    const direction = employeeRosterSort.direction === 'asc' ? 1 : -1
    const leftValue = String(left?.[column] || '').trim()
    const rightValue = String(right?.[column] || '').trim()

    if (!leftValue && !rightValue) {
      return Number(left?.id || 0) - Number(right?.id || 0)
    }

    if (!leftValue) {
      return 1
    }

    if (!rightValue) {
      return -1
    }

    const comparison = leftValue.localeCompare(rightValue, undefined, {
      sensitivity: 'base',
      numeric: true
    })

    if (comparison !== 0) {
      return comparison * direction
    }

    return Number(left?.id || 0) - Number(right?.id || 0)
  })

  const latestUpdatedEmployee = employeeOptions.reduce((latestEmployee, currentEmployee) => {
    if (!latestEmployee) {
      return currentEmployee
    }

    const latestUpdatedAt = new Date(latestEmployee.updatedAt || 0).getTime()
    const currentUpdatedAt = new Date(currentEmployee.updatedAt || 0).getTime()

    if (currentUpdatedAt > latestUpdatedAt) {
      return currentEmployee
    }

    return latestEmployee
  }, null)

  const upcomingActivities = [
    ...currentProjectHours.map((entry) => ({
      id: `current-${entry.id}`,
      activity: entry.project || 'Current project activity',
      date: entry.date || '-',
      hours: parseFloat(entry.hours) || 0,
      status: 'In progress'
    })),
    ...plannedProjectHours.map((entry) => ({
      id: `planned-${entry.id}`,
      activity: entry.project || 'Planned project activity',
      date: entry.date || '-',
      hours: parseFloat(entry.hours) || 0,
      status: 'Planned'
    }))
  ]

  const estimatedWeeklyHours = upcomingActivities.reduce((sum, entry) => sum + (entry.hours || 0), 0)

  const hydrateFromBootstrap = (bootstrap) => {
    const incomingVendors = bootstrap.vendors || []
    const incomingLabour = bootstrap.labourPrices || []
    const labourTitles = incomingLabour.map((row) => row.title).filter(Boolean)
    const incomingEmployees = sanitizeEmployeeRoster(bootstrap.employees || [], labourTitles)

    setVendorOptions(incomingVendors)
    setLabourPrices(incomingLabour)
    setEmployeeOptions(incomingEmployees)
    setEmployeeHours(bootstrap.employeeHours || [])
    setCurrentProjectHours(bootstrap.currentProjectHours || [])
    setPlannedProjectHours(bootstrap.plannedProjectHours || [])
    setTimeEntries(bootstrap.timeEntries || [])
    setTimeLogEntries(bootstrap.timeLogEntries || [])
    setQuotationHistory(bootstrap.quotationHistory || [])
    setQuotations(bootstrap.quotations || [])
    setPanelDescription(bootstrap.panelDescription || '')
    setManagedLists(
      normalizeManagedListSettings({
        ...defaultManagedLists,
        ...(bootstrap.listManagement || {})
      })
    )
    setIsListManagementHydrated(true)

    const materialItems = bootstrap.materialItems || []
    const nextPlates = materialItems.filter((item) => item.category === 'plates')
    const nextAngleIron = materialItems.filter((item) => item.category === 'angleIron')
    const nextLinerPlates = materialItems.filter((item) => item.category === 'linerPlates')
    setPlates(nextPlates)
    setSelectedPlate(nextPlates[0]?.id || null)
    setAngleIron(nextAngleIron)
    setSelectedAngleIron(nextAngleIron[0]?.id || null)
    setLinerPlates(nextLinerPlates)
    setSelectedLinerPlate(nextLinerPlates[0]?.id || null)

    const initialPage = normalizePageKey(bootstrap.activePage)
    setActivePage(initialPage)

    const firstVendor = incomingVendors[0]
    setSelectedQuotationVendorId(firstVendor?.id || '')
    setSelectedShippingVendorId(firstVendor?.id || '')
    setQuotationTo(firstVendor?.quotationTo || '')
    setShippingAddress(firstVendor?.shippingAddress || '')
  }

  useEffect(() => {
    let isCancelled = false

    const loadFromDatabase = async () => {
      try {
        const legacyInput = typeof window === 'undefined'
          ? {}
          : {
            employeeManagementData: localStorage.getItem('employee-management-data'),
            timeManagementData: localStorage.getItem('time-management-data'),
            labourPricesData: localStorage.getItem('labour-prices-data'),
            quotationHistory: localStorage.getItem('quotation-history'),
            quotationPanelData: localStorage.getItem('quotation-panel-data'),
            activePage: localStorage.getItem('active-page'),
            quoCounter: localStorage.getItem('quoCounter')
          }

        const hasLegacyData = Object.values(legacyInput).some((value) => value)
        const operation = hasLegacyData
          ? `
              mutation MigrateLegacyData($input: LegacyDataInput) {
                migrateLegacyData(input: $input) {
                  activePage
                  quotationCounter
                  panelDescription
                  quotationHistory {
                    id
                    quotationNumber
                    dateCreated
                    timeCreated
                    quotationTo
                    shippingAddress
                    totalPrice
                    savedAt
                    fileName
                    pdfPreviewUrl
                  }
                  quotations {
                    id
                    quotationNumber
                    quotationDate
                    vendorId
                    quotationTo
                    shippingAddress
                    panelDescription
                    lineItems
                    totalPrice
                    status
                    pdfFileName
                    pdfMimeType
                    hasPdf
                    createdAt
                    updatedAt
                  }
                  vendors { id company vatNumber quotationTo shippingAddress }
                  labourPrices {
                    id
                    title
                    normalHourlyRate
                    normalDaily7
                    normalDaily11
                    onsiteHourlyRate
                    onsiteDaily7
                    onsiteDaily11
                    breakdownHourlyRate
                    breakdownDaily7
                    breakdownDaily11
                    normalHours
                    mineHours
                  }
                  materialItems { id category name price note }
                  employees { id name role coyNumber department email phone inductionExpiryDate trainingRecords createdAt updatedAt }
                  employeeHours { id name date timeIn timeOut createdAt updatedAt }
                  currentProjectHours { id name hours project createdAt updatedAt }
                  plannedProjectHours { id name hours project createdAt updatedAt }
                  timeEntries { id title date hours status }
                  timeLogEntries { id action group section timestamp details }
                  listManagement {
                    roles
                    trainings
                    departments
                    projects
                    quoteItems
                  }
                }
              }
            `
          : `
              query Bootstrap {
                bootstrap {
                  activePage
                  quotationCounter
                  panelDescription
                  quotationHistory {
                    id
                    quotationNumber
                    dateCreated
                    timeCreated
                    quotationTo
                    shippingAddress
                    totalPrice
                    savedAt
                    fileName
                    pdfPreviewUrl
                  }
                  quotations {
                    id
                    quotationNumber
                    quotationDate
                    vendorId
                    quotationTo
                    shippingAddress
                    panelDescription
                    lineItems
                    totalPrice
                    status
                    pdfFileName
                    pdfMimeType
                    hasPdf
                    createdAt
                    updatedAt
                  }
                  vendors { id company vatNumber quotationTo shippingAddress }
                  labourPrices {
                    id
                    title
                    normalHourlyRate
                    normalDaily7
                    normalDaily11
                    onsiteHourlyRate
                    onsiteDaily7
                    onsiteDaily11
                    breakdownHourlyRate
                    breakdownDaily7
                    breakdownDaily11
                    normalHours
                    mineHours
                  }
                  materialItems { id category name price note }
                  employees { id name role coyNumber department email phone inductionExpiryDate trainingRecords createdAt updatedAt }
                  employeeHours { id name date timeIn timeOut createdAt updatedAt }
                  currentProjectHours { id name hours project createdAt updatedAt }
                  plannedProjectHours { id name hours project createdAt updatedAt }
                  timeEntries { id title date hours status }
                  timeLogEntries { id action group section timestamp details }
                  listManagement {
                    roles
                    trainings
                    departments
                    projects
                    quoteItems
                  }
                }
              }
            `

        const variables = hasLegacyData ? { input: legacyInput } : {}
        const data = await graphqlRequest(operation, variables)
        const bootstrap = data.migrateLegacyData || data.bootstrap

        if (isCancelled || !bootstrap) return

        hydrateFromBootstrap(bootstrap)

        const nextCounter = (bootstrap.quotationCounter || 0) + 1
        setQuotationNumber(`QUO${nextCounter}`)
        await graphqlRequest(
          `mutation SetQuotationCounter($counter: Int!) { setQuotationCounter(counter: $counter) }`,
          { counter: nextCounter }
        )

        setTimeLogStatus('Data loaded from database.')
        setIsDbHydrated(true)

        if (hasLegacyData && typeof window !== 'undefined') {
          localStorage.removeItem('employee-management-data')
          localStorage.removeItem('time-management-data')
          localStorage.removeItem('labour-prices-data')
          localStorage.removeItem('quotation-history')
          localStorage.removeItem('quotation-panel-data')
          localStorage.removeItem('active-page')
          localStorage.removeItem('quoCounter')
        }
      } catch (error) {
        console.error('Failed to load data from GraphQL API', error)
        setTimeLogStatus('Database sync failed. Ensure API is running.')
      }
    }

    void loadFromDatabase()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isDbHydrated) return

    void graphqlRequest(
      `mutation SetActivePage($page: String!) { setActivePage(page: $page) }`,
      { page: normalizePageKey(activePage) }
    ).catch((error) => {
      console.error('Failed to persist active page', error)
    })
  }, [activePage, isDbHydrated])

  useEffect(() => {
    setEmployeeOptions((prev) => sanitizeEmployeeRoster(prev, labourTitleOptions))
  }, [labourTitleOptions])

  useEffect(() => {
    if (!isDbHydrated || !isListManagementHydrated) return

    void graphqlRequest(
      `
        mutation SaveListManagement($input: ListManagementInput!) {
          saveListManagement(input: $input) {
            roles
            trainings
            departments
            projects
            quoteItems
          }
        }
      `,
      {
        input: managedLists
      }
    ).catch((error) => {
      console.error('Failed to save list settings', error)
      setListManagementStatus('Failed to save list settings. Ensure API is running.')
    })
  }, [managedLists, isDbHydrated, isListManagementHydrated])

  const roleOptions = normalizeUniqueList([
    ...labourTitleOptions,
    ...employeeOptions.map((employee) => employee.role),
    ...managedLists.roles
  ])

  const departmentOptions = normalizeUniqueList([
    ...employeeOptions.map((employee) => employee.department),
    ...managedLists.departments
  ])

  const projectOptions = normalizeUniqueList([
    ...currentProjectHours.map((entry) => entry.project),
    ...plannedProjectHours.map((entry) => entry.project),
    ...managedLists.projects
  ])

  const quoteItemLabels = normalizeUniqueList(managedLists.quoteItems)

  const itemOptions = quoteItemLabels.map((label) => ({
    value: toSlugValue(label),
    label
  }))

  const trainingListOptions = normalizeUniqueList([
    ...employeeOptions.flatMap((employee) => (
      Array.isArray(employee?.trainingRecords)
        ? employee.trainingRecords.map((record) => String(record?.training || '').trim())
        : []
    )),
    ...employeeTrainingRecords.map((record) => String(record?.training || '').trim()),
    ...managedLists.trainings
  ])

  const addManagedListItem = (listKey) => {
    const nextValue = String(listDrafts[listKey] || '').trim()
    if (!nextValue) return

    setManagedLists((currentLists) => ({
      ...currentLists,
      [listKey]: normalizeUniqueList([...(currentLists[listKey] || []), nextValue])
    }))

    setListDrafts((currentDrafts) => ({
      ...currentDrafts,
      [listKey]: ''
    }))
    setListManagementStatus('List updated.')
  }

  const removeManagedListItem = (listKey, value) => {
    setManagedLists((currentLists) => ({
      ...currentLists,
      [listKey]: (currentLists[listKey] || []).filter((item) => item !== value)
    }))
    setListManagementStatus('List updated.')
  }

  const editManagedListItem = (listKey, currentValue) => {
    const nextValue = typeof window === 'undefined'
      ? currentValue
      : window.prompt('Edit list value', currentValue)

    if (nextValue === null) return

    const cleanedValue = String(nextValue || '').trim()
    if (!cleanedValue) {
      removeManagedListItem(listKey, currentValue)
      return
    }

    setManagedLists((currentLists) => ({
      ...currentLists,
      [listKey]: normalizeUniqueList(
        (currentLists[listKey] || []).map((item) => (item === currentValue ? cleanedValue : item))
      )
    }))
    setListManagementStatus('List updated.')
  }

  const handleVendorSelection = (value, target) => {
    const selectedVendor = vendorOptions.find((vendor) => vendor.id === value)
    if (!selectedVendor) return

    setSelectedQuotationVendorId(value)
    setSelectedShippingVendorId(value)
    setQuotationTo(selectedVendor.quotationTo || '')
    setShippingAddress(selectedVendor.shippingAddress || '')
  }

  useEffect(() => {
    if (vendorOptions.length === 0) {
      setSelectedQuotationVendorId('')
      setSelectedShippingVendorId('')
      setQuotationTo('')
      setShippingAddress('')
      return
    }

    const activeVendorId = selectedQuotationVendorId || selectedShippingVendorId || vendorOptions[0]?.id || ''
    const selectedVendor = vendorOptions.find((vendor) => vendor.id === activeVendorId) || vendorOptions[0]

    if (!selectedVendor) {
      return
    }

    if (selectedQuotationVendorId !== selectedVendor.id) {
      setSelectedQuotationVendorId(selectedVendor.id)
    }

    if (selectedShippingVendorId !== selectedVendor.id) {
      setSelectedShippingVendorId(selectedVendor.id)
    }

    setQuotationTo(selectedVendor.quotationTo || '')
    setShippingAddress(selectedVendor.shippingAddress || '')
  }, [vendorOptions, selectedQuotationVendorId, selectedShippingVendorId])

  const resetVendorForm = () => {
    setVendorForm({ company: '', vatNumber: '', quotationTo: '', shippingAddress: '' })
    setEditingVendorId(null)
  }

  const saveVendorRecords = async (nextVendors) => {
    const data = await graphqlRequest(
      `
        mutation SaveVendors($items: [VendorInput!]!) {
          saveVendors(items: $items) {
            id
            company
            vatNumber
            quotationTo
            shippingAddress
          }
        }
      `,
      {
        items: nextVendors.map((vendor) => ({
          id: vendor.id,
          company: vendor.company,
          vatNumber: vendor.vatNumber || '',
          quotationTo: vendor.quotationTo || '',
          shippingAddress: vendor.shippingAddress || ''
        }))
      }
    )

    setVendorOptions(data.saveVendors || [])
    return data.saveVendors || []
  }

  const handleVendorManagementSubmit = async (event) => {
    event.preventDefault()

    const nextCompany = String(vendorForm.company || '').trim()
    const nextQuotationTo = String(vendorForm.quotationTo || '').trim()
    const nextShippingAddress = String(vendorForm.shippingAddress || '').trim()

    if (!nextCompany || !nextQuotationTo || !nextShippingAddress) {
      setListManagementStatus('Company, quotation to, and shipping address are required.')
      return
    }

    const nextRecord = {
      id: editingVendorId || `vendor-${Date.now()}`,
      company: nextCompany,
      vatNumber: String(vendorForm.vatNumber || '').trim(),
      quotationTo: nextQuotationTo,
      shippingAddress: nextShippingAddress
    }

    const nextVendors = editingVendorId
      ? vendorOptions.map((vendor) => (vendor.id === editingVendorId ? nextRecord : vendor))
      : [...vendorOptions, nextRecord]

    await saveVendorRecords(nextVendors)
    resetVendorForm()
    setListManagementStatus('Customer address list updated.')
  }

  const startEditingVendor = (vendor) => {
    setEditingVendorId(vendor.id)
    setVendorForm({
      company: vendor.company || '',
      vatNumber: vendor.vatNumber || '',
      quotationTo: vendor.quotationTo || '',
      shippingAddress: vendor.shippingAddress || ''
    })
  }

  const removeVendorRecord = async (vendorId) => {
    const nextVendors = vendorOptions.filter((vendor) => vendor.id !== vendorId)
    await saveVendorRecords(nextVendors)

    if (editingVendorId === vendorId) {
      resetVendorForm()
    }

    setListManagementStatus('Customer address list updated.')
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
    const defaultItemValue = itemOptions[0]?.value || ''
    setLineItems([
      ...lineItems,
      {
        id: newId,
        qty: newLineItem.qty,
        item: newLineItem.item || defaultItemValue,
        description: newLineItem.description,
        unitPrice: newLineItem.unitPrice
      }
    ])
    setNewLineItem({ qty: '', item: defaultItemValue, description: '', unitPrice: '' })
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

    try {
      await graphqlRequest(
        `
          mutation AddTimeLogEntry($input: TimeLogEntryInput!) {
            addTimeLogEntry(input: $input) { id }
          }
        `,
        {
          input: {
            id: entry.id,
            action: entry.action,
            group: entry.group,
            section: entry.section,
            timestamp: entry.timestamp,
            details: JSON.stringify(details || {})
          }
        }
      )
    } catch (error) {
      console.error('Failed to persist time log entry', error)
    }
  }

  const addEmployeeHour = async () => {
    if (!employeeForm.name || !employeeForm.date || !employeeForm.timeIn || !employeeForm.timeOut) return

    const data = await graphqlRequest(
      `
        mutation AddEmployeeHour($input: EmployeeHourInput!) {
          addEmployeeHour(input: $input) { id name date timeIn timeOut createdAt updatedAt }
        }
      `,
      {
        input: {
          employeeName: employeeForm.name,
          date: employeeForm.date,
          timeIn: employeeForm.timeIn,
          timeOut: employeeForm.timeOut
        }
      }
    )

    const newEntry = data.addEmployeeHour
    setEmployeeHours((prev) => [newEntry, ...prev])
    setEmployeeForm({ name: '', date: '', timeIn: '', timeOut: '' })
    void appendTimeLogEntry('add', 'employee-hours', { entry: newEntry })
  }

  const updateEmployeeHour = async (id, field, value) => {
    const currentEntry = employeeHours.find((item) => item.id === id)
    if (!currentEntry) return

    const nextEntry = { ...currentEntry, [field]: value }
    const data = await graphqlRequest(
      `
        mutation UpdateEmployeeHour($id: ID!, $input: EmployeeHourInput!) {
          updateEmployeeHour(id: $id, input: $input) { id name date timeIn timeOut createdAt updatedAt }
        }
      `,
      {
        id,
        input: {
          employeeName: nextEntry.name,
          date: nextEntry.date,
          timeIn: nextEntry.timeIn,
          timeOut: nextEntry.timeOut
        }
      }
    )

    setEmployeeHours((prev) => prev.map((item) => (item.id === id ? data.updateEmployeeHour : item)))

    if (currentEntry[field] !== value) {
      void appendTimeLogEntry('edit', 'employee-hours', {
        itemId: id,
        field,
        previousValue: currentEntry[field],
        newValue: value
      })
    }
  }

  const removeEmployeeHour = async (id) => {
    const entryToRemove = employeeHours.find((item) => item.id === id)
    await graphqlRequest(
      `mutation DeleteEmployeeHour($id: ID!) { deleteEmployeeHour(id: $id) }`,
      { id }
    )
    setEmployeeHours(employeeHours.filter((item) => item.id !== id))
    if (entryToRemove) {
      void appendTimeLogEntry('remove', 'employee-hours', { itemId: id, entry: entryToRemove })
    }
  }

  const addCurrentProjectHour = async () => {
    const parsedHours = parseFloat(currentProjectForm.hours)
    const isValidHours = !Number.isNaN(parsedHours) && parsedHours > 0

    if (!isValidHours || !currentProjectForm.project) return

    const addCurrentEntry = async (employeeName) => {
      const data = await graphqlRequest(
        `
          mutation AddCurrentProjectHour($input: ProjectHourInput!) {
            addCurrentProjectHour(input: $input) { id name hours project createdAt updatedAt }
          }
        `,
        {
          input: {
            employeeName,
            hours: parsedHours,
            project: currentProjectForm.project
          }
        }
      )

      return data.addCurrentProjectHour
    }

    const employeeNames = currentProjectEmployeeMode === 'bulk'
      ? currentProjectBulkEmployees
      : [currentProjectForm.name]

    if (!employeeNames.length || employeeNames.some((name) => !name)) return

    const newEntries = await Promise.all(employeeNames.map((employeeName) => addCurrentEntry(employeeName)))

    setCurrentProjectHours((prev) => [...newEntries, ...prev])
    setCurrentProjectForm({ name: '', hours: '', project: '' })
    setCurrentProjectBulkEmployees([])
    setCurrentProjectBulkOpen(false)

    newEntries.forEach((entry) => {
      void appendTimeLogEntry('add', 'current-project-hours', { entry })
    })
  }

  const updateCurrentProjectHour = async (id, field, value) => {
    const currentEntry = currentProjectHours.find((item) => item.id === id)
    if (!currentEntry) return

    const nextEntry = { ...currentEntry, [field]: value }
    const data = await graphqlRequest(
      `
        mutation UpdateCurrentProjectHour($id: ID!, $input: ProjectHourInput!) {
          updateCurrentProjectHour(id: $id, input: $input) { id name hours project createdAt updatedAt }
        }
      `,
      {
        id,
        input: {
          employeeName: nextEntry.name,
          hours: parseFloat(nextEntry.hours) || 0,
          project: nextEntry.project
        }
      }
    )

    setCurrentProjectHours((prev) => prev.map((item) => (item.id === id ? data.updateCurrentProjectHour : item)))

    if (currentEntry[field] !== value) {
      void appendTimeLogEntry('edit', 'current-project-hours', {
        itemId: id,
        field,
        previousValue: currentEntry[field],
        newValue: value
      })
    }
  }

  const removeCurrentProjectHour = async (id) => {
    const entryToRemove = currentProjectHours.find((item) => item.id === id)
    await graphqlRequest(
      `mutation DeleteCurrentProjectHour($id: ID!) { deleteCurrentProjectHour(id: $id) }`,
      { id }
    )
    setCurrentProjectHours(currentProjectHours.filter((item) => item.id !== id))
    if (entryToRemove) {
      void appendTimeLogEntry('remove', 'current-project-hours', { itemId: id, entry: entryToRemove })
    }
  }

  const addPlannedProjectHour = async () => {
    const parsedHours = parseFloat(plannedProjectForm.hours)
    const isValidHours = !Number.isNaN(parsedHours) && parsedHours > 0

    if (!isValidHours || !plannedProjectForm.project) return

    const addPlannedEntry = async (employeeName) => {
      const data = await graphqlRequest(
        `
          mutation AddPlannedProjectHour($input: ProjectHourInput!) {
            addPlannedProjectHour(input: $input) { id name hours project createdAt updatedAt }
          }
        `,
        {
          input: {
            employeeName,
            hours: parsedHours,
            project: plannedProjectForm.project
          }
        }
      )

      return data.addPlannedProjectHour
    }

    const employeeNames = plannedProjectEmployeeMode === 'bulk'
      ? plannedProjectBulkEmployees
      : [plannedProjectForm.name]

    if (!employeeNames.length || employeeNames.some((name) => !name)) return

    const newEntries = await Promise.all(employeeNames.map((employeeName) => addPlannedEntry(employeeName)))

    setPlannedProjectHours((prev) => [...newEntries, ...prev])
    setPlannedProjectForm({ name: '', hours: '', project: '' })
    setPlannedProjectBulkEmployees([])
    setPlannedProjectBulkOpen(false)

    newEntries.forEach((entry) => {
      void appendTimeLogEntry('add', 'planned-project-hours', { entry })
    })
  }

  const updatePlannedProjectHour = async (id, field, value) => {
    const currentEntry = plannedProjectHours.find((item) => item.id === id)
    if (!currentEntry) return

    const nextEntry = { ...currentEntry, [field]: value }
    const data = await graphqlRequest(
      `
        mutation UpdatePlannedProjectHour($id: ID!, $input: ProjectHourInput!) {
          updatePlannedProjectHour(id: $id, input: $input) { id name hours project createdAt updatedAt }
        }
      `,
      {
        id,
        input: {
          employeeName: nextEntry.name,
          hours: parseFloat(nextEntry.hours) || 0,
          project: nextEntry.project
        }
      }
    )

    setPlannedProjectHours((prev) => prev.map((item) => (item.id === id ? data.updatePlannedProjectHour : item)))

    if (currentEntry[field] !== value) {
      void appendTimeLogEntry('edit', 'planned-project-hours', {
        itemId: id,
        field,
        previousValue: currentEntry[field],
        newValue: value
      })
    }
  }

  const removePlannedProjectHour = async (id) => {
    const entryToRemove = plannedProjectHours.find((item) => item.id === id)
    await graphqlRequest(
      `mutation DeletePlannedProjectHour($id: ID!) { deletePlannedProjectHour(id: $id) }`,
      { id }
    )
    setPlannedProjectHours(plannedProjectHours.filter((item) => item.id !== id))
    if (entryToRemove) {
      void appendTimeLogEntry('remove', 'planned-project-hours', { itemId: id, entry: entryToRemove })
    }
  }

  const resetEmployeeManagementForm = () => {
    setEmployeeManagementForm({ name: '', role: '', coyNumber: '', department: '', email: '', phone: '', inductionExpiryDate: '' })
    setEmployeeTrainingMode('single')
    setEmployeeTrainingSingle({ training: '', expiryDate: '' })
    setEmployeeTrainingBulk({ trainings: [], expiryDate: '' })
    setEmployeeTrainingBulkOpen(false)
    setEmployeeTrainingRecords([])
    setEditingEmployeeManagementId(null)
    setEmployeeFormOpen(false)
  }

  const handleEmployeeManagementSubmit = async (event) => {
    event.preventDefault()

    const trainingRecordsPayload = JSON.stringify(employeeTrainingRecords)
    const employeeInput = {
      ...employeeManagementForm,
      trainingRecords: trainingRecordsPayload
    }

    if (!roleOptions.includes(employeeManagementForm.role)) {
      setEmployeeManagementStatus('Please select a valid role from the managed role list.')
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
      const data = await graphqlRequest(
        `
          mutation UpdateEmployee($id: ID!, $input: EmployeeInput!) {
            updateEmployee(id: $id, input: $input) { id name role coyNumber department email phone inductionExpiryDate trainingRecords createdAt updatedAt }
          }
        `,
        {
          id: editingEmployeeManagementId,
          input: employeeInput
        }
      )

      const nextEmployees = sanitizeEmployeeRoster(
        employeeOptions.map((employee) => (
          employee.id === editingEmployeeManagementId ? data.updateEmployee : employee
        )),
        labourTitleOptions
      )

      setEmployeeOptions(nextEmployees)
      setEmployeeManagementStatus('Employee updated in the database.')
    } else {
      const data = await graphqlRequest(
        `
          mutation AddEmployee($input: EmployeeInput!) {
            addEmployee(input: $input) { id name role coyNumber department email phone inductionExpiryDate trainingRecords createdAt updatedAt }
          }
        `,
        { input: employeeInput }
      )

      const newEmployee = data.addEmployee
      const nextEmployees = sanitizeEmployeeRoster([newEmployee, ...employeeOptions], labourTitleOptions)
      setEmployeeOptions(nextEmployees)
      setEmployeeManagementStatus('Employee added to the database.')
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
      phone: employee.phone || '',
      inductionExpiryDate: employee.inductionExpiryDate || ''
    })
    setEmployeeTrainingMode('single')
    setEmployeeTrainingSingle({ training: '', expiryDate: '' })
    setEmployeeTrainingBulk({ trainings: [], expiryDate: '' })
    setEmployeeTrainingBulkOpen(false)
    setEmployeeTrainingRecords(Array.isArray(employee.trainingRecords) ? employee.trainingRecords : [])
  }

  const deleteEmployee = async (id) => {
    await graphqlRequest(`mutation DeleteEmployee($id: ID!) { deleteEmployee(id: $id) }`, { id })
    const nextEmployees = employeeOptions.filter((employee) => employee.id !== id)
    setEmployeeOptions(nextEmployees)
    if (expandedEmployeeId === id) {
      setExpandedEmployeeId(null)
    }
    setEmployeeManagementStatus('Employee removed from the database.')

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

  const saveLabourPrices = async () => {
    const data = await graphqlRequest(
      `
        mutation SaveLabourPrices($items: [LabourPriceInput!]!) {
          saveLabourPrices(items: $items) { id }
        }
      `,
      { items: labourPrices }
    )

    if (data?.saveLabourPrices) {
      setPriceCalculatorStatus('Labour prices saved to database.')
    }
  }

  const savePanelDescription = async () => {
    await graphqlRequest(
      `mutation SetPanelDescription($description: String!) { setPanelDescription(description: $description) }`,
      { description: panelDescription }
    )
    setPanelStatus('Panel description saved to the database.')
  }

  // const pickSaveLocation = async () => {
  //   const fixedPath = 'C:/Users/Welcome/Documents/Quotations'
  //   setSaveLocationHandle(null)
  //   setSaveLocationLabel(fixedPath)
  // }

  const saveQuotationHistory = (quoteData) => {
    const nextHistory = [quoteData, ...quotationHistory].slice(0, 20)
    setQuotationHistory(nextHistory)
    void graphqlRequest(
      `
        mutation SaveQuotationHistory($items: [QuotationHistoryInput!]!) {
          saveQuotationHistory(items: $items) { id }
        }
      `,
      { items: nextHistory }
    ).catch((error) => {
      console.error('Failed to save quotation history', error)
    })
    return quoteData
  }

  const saveQuotationRecord = async ({ persistPdf = false, pdfBlob = null, pdfFileName = '' } = {}) => {
    const shouldPersistPdf = persistPdf && import.meta.env.VITE_STORE_QUOTATION_PDF_IN_DB === 'true' && pdfBlob

    const payload = {
      id: activeQuotationId || undefined,
      quotationNumber,
      quotationDate,
      vendorId: selectedQuotationVendorId || selectedShippingVendorId || '',
      quotationTo,
      shippingAddress,
      panelDescription,
      lineItems: JSON.stringify(lineItems),
      totalPrice: parseFloat(calculateTotalPrice()).toFixed(2),
      status: 'draft',
      persistPdf: Boolean(shouldPersistPdf),
      pdfFileName: shouldPersistPdf ? pdfFileName : '',
      pdfMimeType: shouldPersistPdf ? 'application/pdf' : '',
      pdfBase64: shouldPersistPdf ? await blobToBase64(pdfBlob) : ''
    }

    const data = await graphqlRequest(
      `
        mutation SaveQuotation($input: QuotationInput!) {
          saveQuotation(input: $input) {
            id
            quotationNumber
            quotationDate
            vendorId
            quotationTo
            shippingAddress
            panelDescription
            lineItems
            totalPrice
            status
            pdfFileName
            pdfMimeType
            hasPdf
            createdAt
            updatedAt
          }
        }
      `,
      { input: payload }
    )

    const savedQuotation = data?.saveQuotation
    if (!savedQuotation) return null

    setActiveQuotationId(savedQuotation.id)
    setQuotations((currentQuotations) => {
      const nextQuotations = [
        savedQuotation,
        ...currentQuotations.filter((item) => item.id !== savedQuotation.id)
      ]

      return nextQuotations
    })

    return savedQuotation
  }

  const persistPdfToQuotation = async (quotation, pdfBlob, pdfFileName) => {
    const payload = {
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      quotationDate: quotation.quotationDate || '',
      vendorId: quotation.vendorId || '',
      quotationTo: quotation.quotationTo || '',
      shippingAddress: quotation.shippingAddress || '',
      panelDescription: quotation.panelDescription || '',
      lineItems: quotation.lineItems || '[]',
      totalPrice: quotation.totalPrice || '0.00',
      status: quotation.status || 'draft',
      persistPdf: true,
      pdfFileName,
      pdfMimeType: 'application/pdf',
      pdfBase64: await blobToBase64(pdfBlob)
    }

    const data = await graphqlRequest(
      `
        mutation SaveQuotation($input: QuotationInput!) {
          saveQuotation(input: $input) {
            id
            quotationNumber
            quotationDate
            vendorId
            quotationTo
            shippingAddress
            panelDescription
            lineItems
            totalPrice
            status
            pdfFileName
            pdfMimeType
            hasPdf
            createdAt
            updatedAt
          }
        }
      `,
      { input: payload }
    )

    const savedQuotation = data?.saveQuotation
    if (!savedQuotation) return null

    setQuotations((currentQuotations) =>
      currentQuotations.map((item) => (item.id === savedQuotation.id ? savedQuotation : item))
    )

    return savedQuotation
  }

  const saveCurrentQuotation = async () => {
    try {
      const savedQuotation = await saveQuotationRecord()
      if (savedQuotation) {
        setQuoteSaveStatus(`Saved ${savedQuotation.quotationNumber} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`)
      }
    } catch (error) {
      console.error('Failed to save quotation record', error)
      setQuoteSaveStatus('Failed to save quotation. Ensure API is running.')
    }
  }

  const applySavedQuotation = (quotation, { switchPage = true } = {}) => {
    if (!quotation) return

    let parsedLineItems = []

    try {
      const lineItemsPayload = JSON.parse(quotation.lineItems || '[]')
      parsedLineItems = Array.isArray(lineItemsPayload) ? lineItemsPayload : []
    } catch (error) {
      parsedLineItems = []
    }

    setActiveQuotationId(quotation.id)
    setQuotationNumber(quotation.quotationNumber || 'QUO1')
    setQuotationDate(quotation.quotationDate || new Date().toISOString().split('T')[0])
    setQuotationTo(quotation.quotationTo || '')
    setShippingAddress(quotation.shippingAddress || '')
    setPanelDescription(quotation.panelDescription || '')
    setLineItems(
      parsedLineItems.length > 0
        ? parsedLineItems
        : [{ id: 1, qty: '', item: itemOptions[0]?.value || '', description: '', unitPrice: '' }]
    )

    const matchedVendor = vendorOptions.find((vendor) => vendor.id === quotation.vendorId)
    if (matchedVendor) {
      setSelectedQuotationVendorId(matchedVendor.id)
      setSelectedShippingVendorId(matchedVendor.id)
    }

    if (switchPage) {
      setActivePage('builder')
    }

    setQuoteSaveStatus(`Loaded ${quotation.quotationNumber} for editing.`)
  }

  const openSavedQuotation = (quotation) => {
    applySavedQuotation(quotation, { switchPage: true })
  }

  const previewSavedQuotation = async (quotation) => {
    if (!quotation) return

    if (quotation.hasPdf) {
      try {
        const data = await graphqlRequest(
          `
            query QuotationPdf($quotationId: ID!) {
              quotationPdf(quotationId: $quotationId) {
                id
                fileName
                mimeType
                base64Data
              }
            }
          `,
          { quotationId: quotation.id }
        )

        const storedPdf = data?.quotationPdf
        if (storedPdf?.base64Data) {
          const previewUrl = base64ToBlobUrl(storedPdf.base64Data, storedPdf.mimeType || 'application/pdf')
          setSelectedHistoryQuote({
            id: storedPdf.id,
            quotationNumber: quotation.quotationNumber,
            pdfPreviewUrl: previewUrl
          })
          setHistoryOpen(true)
          return
        }
      } catch (error) {
        console.error('Failed to load stored PDF preview', error)
      }
    }

    applySavedQuotation(quotation, { switchPage: false })

    await new Promise((resolve) => setTimeout(resolve, 80))
    await generatePDF({
      download: false,
      persistQuotation: false,
      persistToQuotation: quotation,
      saveToHistory: false,
      openModal: true,
      fileNameOverride: `${quotation.quotationNumber}.pdf`
    })
  }

  const deleteSavedQuotation = async (quotationId) => {
    try {
      await graphqlRequest(
        `mutation DeleteQuotation($id: ID!) { deleteQuotation(id: $id) }`,
        { id: quotationId }
      )

      setQuotations((currentQuotations) => currentQuotations.filter((quotation) => quotation.id !== quotationId))

      if (activeQuotationId === quotationId) {
        setActiveQuotationId('')
      }
    } catch (error) {
      console.error('Failed to delete quotation', error)
      setQuoteSaveStatus('Failed to delete quotation.')
    }
  }

  const nextReportNumber = () => {
    if (typeof window === 'undefined') return 1
    const current = Number.parseInt(localStorage.getItem('report-download-counter') || '0', 10) || 0
    const next = current + 1
    localStorage.setItem('report-download-counter', String(next))
    return next
  }

  const openHistoryModal = (quote) => {
    setSelectedHistoryQuote(quote)
  }

  const closeHistoryModal = () => {
    if (selectedHistoryQuote?.pdfPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(selectedHistoryQuote.pdfPreviewUrl)
    }

    setSelectedHistoryQuote(null)
  }

  const handleHeaderExport = async () => {
    if (activePage === 'time-management') {
      await generateReportPDF('time-report')
      return
    }

    if (activePage === 'employee-management') {
      await generateReportPDF('employee-report')
      return
    }

    if (activePage === 'price-calculator') {
      await generateReportPDF('price-report')
      return
    }

    await generatePDF()
  }

  const generatePDF = async ({
    download = true,
    persistQuotation = true,
    persistToQuotation = null,
    saveToHistory = true,
    openModal = true,
    fileNameOverride = ''
  } = {}) => {
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

      const fileName = fileNameOverride || `${quotationNumber}.pdf`
      const targetPath = `${saveLocationLabel || 'C:/Users/Welcome/Documents/Quotations'}/${fileName}`
      const pdfBlob = pdf.output('blob')
      const pdfPreviewUrl = URL.createObjectURL(pdfBlob)

      if (download) {
        const link = document.createElement('a')
        link.href = pdfPreviewUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }

      if (persistQuotation) {
        try {
          await saveQuotationRecord({
            persistPdf: true,
            pdfBlob,
            pdfFileName: fileName
          })
        } catch (error) {
          console.error('Failed to persist quotation record', error)
        }
      } else if (persistToQuotation) {
        try {
          await persistPdfToQuotation(persistToQuotation, pdfBlob, fileName)
        } catch (error) {
          console.error('Failed to persist quotation PDF', error)
        }
      }

      if (saveToHistory) {
        const savedQuote = saveQuotationHistory({
          ...quoteHistoryItem,
          fileName: targetPath,
          pdfPreviewUrl
        })

        if (openModal) {
          setSelectedHistoryQuote(savedQuote)
          setHistoryOpen(true)
        }
      } else if (openModal) {
        setSelectedHistoryQuote({
          id: `preview-${Date.now()}`,
          quotationNumber,
          pdfPreviewUrl
        })
        setHistoryOpen(true)
      }

      if (!openModal) {
        URL.revokeObjectURL(pdfPreviewUrl)
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Error generating PDF. Please check the console for details.')
    }
  }

  const generateReportPDF = async (mode) => {
    const reportNumber = nextReportNumber()
    const generatedAt = new Date()
    const timestampSegment = formatReportTimestampSegment(generatedAt)
    const reportCode = `RPT${String(reportNumber).padStart(4, '0')}`
    const fileName = `${getReportPrefix(mode)}-${reportCode}-${timestampSegment}.pdf`
    setReportMetadata({
      reportNumber,
      generatedAtIso: generatedAt.toISOString(),
      fileName
    })

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

  const generatedReportDate = reportMetadata.generatedAtIso ? new Date(reportMetadata.generatedAtIso) : new Date()
  const generatedReportLabel = generatedReportDate.toLocaleString()
  const generatedReportCode = reportMetadata.reportNumber > 0 ? `RPT${String(reportMetadata.reportNumber).padStart(4, '0')}` : 'RPT0000'

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
          {/* <button
            type="button"
            className={`nav-item ${activePage === 'preview' ? 'active' : ''}`}
            onClick={() => setActivePage('preview')}
          >
            <span className="nav-icon">🖨️</span>
            Preview
          </button> */}
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
          <button
            type="button"
            className={`nav-item ${activePage === 'list-management' ? 'active' : ''}`}
            onClick={() => setActivePage('list-management')}
          >
            <span className="nav-icon">🗂️</span>
            List Management
          </button>
        </nav>

        {activePage === 'builder' && (
          <div className="sidebar-card">
            <p className="card-label">Current quote</p>
            <h3>{quotationNumber}</h3>
            <p>{quotationTo || 'Pick a customer'}</p>
            <ul className="sidebar-card-list">
              <li>
                <span>Customer</span>
                <strong>{quotationTo || 'Not selected'}</strong>
              </li>
              <li>
                <span>Delivery</span>
                <strong>{shippingAddress || 'Not selected'}</strong>
              </li>
              <li>
                <span>Line items</span>
                <strong>{lineItems.length}</strong>
              </li>
              <li>
                <span>Status</span>
                <strong>Draft</strong>
              </li>
            </ul>
            <div className="summary-metric">
              <span>Total</span>
              <strong>R{parseFloat(calculateTotalPrice()).toFixed(2)}</strong>
            </div>
          </div>
        )}
      </aside>

      <main className="app-main">
        <header className="app-header">
          <div>
            <p className="eyebrow">Multi-page workspace</p>
            <h1>{activePage === 'builder' ? 'Quote builder' : activePage === 'history' ? 'Quotation history' : activePage === 'time-management' ? 'Time management' : activePage === 'employee-management' ? 'Employee management' : activePage === 'price-calculator' ? 'Price calculator' : activePage === 'list-management' ? 'List management' : 'PDF preview'}</h1>
          </div>
          <div className="header-actions">
            {/* <button type="button" className="btn-secondary" onClick={() => setActivePage('history')}>
              View history
            </button> */}
            {/* <button type="button" className="btn-secondary" onClick={() => setActivePage('preview')}>
              Preview output
            </button> */}
            {(activePage === 'builder' || activePage === 'preview') && (
              <button className="btn-generate" onClick={handleHeaderExport}>
                Download PDF
              </button>
            )}
            {activePage === 'builder' && (
              <button type="button" className="btn-secondary" onClick={saveCurrentQuotation}>
                Save quote
              </button>
            )}
            {activePage === 'builder' && quoteSaveStatus ? (
              <span className="status-badge">{quoteSaveStatus}</span>
            ) : null}
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

            {activeQuotationId ? (
              <p className="time-log-status">Editing saved quotation: {quotationNumber}</p>
            ) : null}

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
                    {/* <button type="button" className="accordion-toggle" onClick={() => setAccordionOpen(!accordionOpen)}>
                      <span>Additional Panel</span>
                      <span className="accordion-icon">{accordionOpen ? '−' : '+'}</span>
                    </button> */}

                    {accordionOpen && (
                      <div className="accordion-content">
                        <label htmlFor="panel-description">Description</label>
                        <textarea
                          id="panel-description"
                          value={panelDescription}
                          onChange={(e) => setPanelDescription(e.target.value)}
                          rows="6"
                          placeholder="Enter description for the quotation panel"
                        />

                        <div className="accordion-actions">
                          <button type="button" className="btn-save-json" onClick={savePanelDescription}>
                            Save panel
                          </button>
                          {panelStatus ? <span className="save-status">{panelStatus}</span> : null}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="line-items-section">
                    <div className="line-items-header">
                      <div>
                        <h2>Line Items</h2>
                        <p>Edit existing rows and add the next line item directly from the new-row inputs at the bottom.</p>
                      </div>
                    </div>

                    <div className="line-items-table-wrap">
                      <table className="line-items-compact-table">
                        <thead>
                          <tr>
                            <th>Qty</th>
                            <th>Item</th>
                            <th>Description</th>
                            <th>Unit price</th>
                            <th>Line total</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((item, index) => (
                            <tr key={item.id}>
                              <td data-label="Qty">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.qty}
                                  onChange={(e) => handleLineItemChange(item.id, 'qty', e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                              <td data-label="Item">
                                <select
                                  value={item.item}
                                  onChange={(e) => handleLineItemChange(item.id, 'item', e.target.value)}
                                >
                                  {itemOptions.length === 0 ? (
                                    <option value="">No quote items configured</option>
                                  ) : null}
                                  {itemOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </td>
                              <td data-label="Description">
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
                              </td>
                              <td data-label="Unit price">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => handleLineItemChange(item.id, 'unitPrice', e.target.value)}
                                  placeholder="0.00"
                                />
                              </td>
                              <td data-label="Line total" className="line-items-total-cell">
                                <strong>R{calculateLineTotal(item.qty, item.unitPrice)}</strong>
                              </td>
                              <td data-label="Action" className="line-items-action-cell">
                                <button
                                  type="button"
                                  className="employee-action-btn employee-action-btn-delete"
                                  onClick={() => removeLineItem(item.id)}
                                  disabled={lineItems.length === 1}
                                  aria-label={`Delete line item ${index + 1}`}
                                  title={lineItems.length === 1 ? 'At least one line item is required' : `Delete line item ${index + 1}`}
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                    <path d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                          <tr className="line-items-new-row">
                            <td data-label="Qty">
                              <input
                                type="number"
                                min="0"
                                value={newLineItem.qty}
                                onChange={(e) => setNewLineItem((currentItem) => ({ ...currentItem, qty: e.target.value }))}
                                placeholder="0"
                              />
                            </td>
                            <td data-label="Item">
                              <select
                                value={newLineItem.item}
                                onChange={(e) => setNewLineItem((currentItem) => ({ ...currentItem, item: e.target.value }))}
                              >
                                {itemOptions.length === 0 ? (
                                  <option value="">No quote items configured</option>
                                ) : null}
                                {itemOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                            </td>
                            <td data-label="Description">
                              <textarea
                                value={newLineItem.description}
                                onChange={(e) => {
                                  setNewLineItem((currentItem) => ({ ...currentItem, description: e.target.value }))
                                  resizeTextarea(e.target)
                                }}
                                onInput={(e) => resizeTextarea(e.target)}
                                placeholder="New line item description"
                                rows="2"
                              />
                            </td>
                            <td data-label="Unit price">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={newLineItem.unitPrice}
                                onChange={(e) => setNewLineItem((currentItem) => ({ ...currentItem, unitPrice: e.target.value }))}
                                placeholder="0.00"
                              />
                            </td>
                            <td data-label="Line total" className="line-items-total-cell line-items-new-total-cell">
                              <strong>R{calculateLineTotal(newLineItem.qty, newLineItem.unitPrice)}</strong>
                            </td>
                            <td data-label="Action" className="line-items-action-cell">
                              <button
                                type="button"
                                className="btn-add line-items-add-row-button"
                                onClick={addLineItem}
                              >
                                Add
                              </button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="totals-section">
                    <div className="total-price">
                      <span>TOTAL PRICE:</span>
                      <strong>R{parseFloat(calculateTotalPrice()).toFixed(2)}</strong>
                    </div>
                  </div>

                  {/* <div className="form-group">
                    <label>PDF save location</label>
                    <div className="save-location-row">
                      <span className="save-location-label">{saveLocationLabel}</span>
                    </div>
                  </div> */}
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
              {quotations.length === 0 ? (
                <p className="empty-history">No saved quotations yet.</p>
              ) : (
                <div className="history-list history-list-page">
                  {quotations.map((quote) => (
                    <article key={quote.id} className="history-item history-item-quote">
                      <div className="history-item-left">
                        <strong>{quote.quotationNumber}</strong>
                        <span>{quote.quotationDate || '-'}</span>
                      </div>
                      <div className="history-item-right">R{quote.totalPrice || '0.00'}</div>
                      <div className="history-item-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openSavedQuotation(quote)}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => previewSavedQuotation(quote)}
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          className="btn-delete"
                          onClick={() => deleteSavedQuotation(quote.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
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
                  Add
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
                <strong>{latestUpdatedEmployee?.name || 'No roster yet'}</strong>
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
                        <option value="">Select role</option>
                        {roleOptions.map((title) => (
                          <option key={title} value={title}>
                            {title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Department</span>
                      <input
                        list="department-options"
                        value={employeeManagementForm.department}
                        onChange={(e) => setEmployeeManagementForm({ ...employeeManagementForm, department: e.target.value })}
                        placeholder="Department"
                      />
                      <datalist id="department-options">
                        {departmentOptions.map((department) => (
                          <option key={department} value={department} />
                        ))}
                      </datalist>
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
                    <label className="employee-form-full-width">
                      <span>Induction expiry date</span>
                      <input
                        type="date"
                        value={employeeManagementForm.inductionExpiryDate}
                        onChange={(e) => setEmployeeManagementForm({ ...employeeManagementForm, inductionExpiryDate: e.target.value })}
                      />
                    </label>

                    <div className="employee-training-panel employee-form-full-width">
                      <div className="employee-card-header employee-training-header">
                        <h4>Training compliance</h4>
                        <div className="employee-training-mode-toggle" role="tablist" aria-label="Training entry mode">
                          <button
                            type="button"
                            className={`employee-training-mode-button ${employeeTrainingMode === 'single' ? 'active' : ''}`}
                            onClick={() => {
                              setEmployeeTrainingMode('single')
                              setEmployeeTrainingBulkOpen(false)
                            }}
                          >
                            Single
                          </button>
                          <button
                            type="button"
                            className={`employee-training-mode-button ${employeeTrainingMode === 'bulk' ? 'active' : ''}`}
                            onClick={() => {
                              setEmployeeTrainingMode('bulk')
                              setEmployeeTrainingSingle((currentSingle) => ({ ...currentSingle, training: '' }))
                            }}
                          >
                            Bulk
                          </button>
                        </div>
                      </div>

                      {employeeTrainingMode === 'single' ? (
                        <div className="employee-training-grid">
                          <label>
                            <span>Training</span>
                            <input
                              list="employee-training-options"
                              value={employeeTrainingSingle.training}
                              onChange={(e) => setEmployeeTrainingSingle({ ...employeeTrainingSingle, training: e.target.value })}
                              placeholder="Select or type training"
                            />
                            <datalist id="employee-training-options">
                              {trainingListOptions.map((training) => (
                                <option key={training} value={training} />
                              ))}
                            </datalist>
                          </label>
                          <label>
                            <span>Expiry date</span>
                            <input
                              type="date"
                              value={employeeTrainingSingle.expiryDate}
                              onChange={(e) => setEmployeeTrainingSingle({ ...employeeTrainingSingle, expiryDate: e.target.value })}
                            />
                          </label>
                          <div className="employee-training-actions">
                            <button type="button" className="btn-secondary" onClick={addSingleEmployeeTraining}>
                              Add training
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="employee-training-grid">
                          <div className="employee-training-select-wrapper">
                            <span>Training list</span>
                            <button
                              type="button"
                              className="employee-training-dropdown-button"
                              onClick={() => setEmployeeTrainingBulkOpen(!employeeTrainingBulkOpen)}
                            >
                              {employeeTrainingBulk.trainings.length > 0
                                ? `${employeeTrainingBulk.trainings.length} selected`
                                : 'Choose trainings'}
                            </button>
                            {employeeTrainingBulkOpen && (
                              <div className="employee-training-dropdown-panel">
                                {trainingListOptions.map((training) => {
                                  const isSelected = employeeTrainingBulk.trainings.includes(training)

                                  return (
                                    <label key={training} className="employee-training-checkbox-row">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => {
                                          setEmployeeTrainingBulk((currentBulk) => {
                                            const nextTrainings = isSelected
                                              ? currentBulk.trainings.filter((item) => item !== training)
                                              : [...currentBulk.trainings, training]

                                            return {
                                              ...currentBulk,
                                              trainings: nextTrainings
                                            }
                                          })
                                        }}
                                      />
                                      <span>{training}</span>
                                    </label>
                                  )
                                })}
                                {trainingListOptions.length === 0 && (
                                  <p className="employee-training-empty">No training options available yet.</p>
                                )}
                              </div>
                            )}
                          </div>
                          <label>
                            <span>Expiry date</span>
                            <input
                              type="date"
                              value={employeeTrainingBulk.expiryDate}
                              onChange={(e) => setEmployeeTrainingBulk({ ...employeeTrainingBulk, expiryDate: e.target.value })}
                            />
                          </label>
                          <div className="employee-training-actions">
                            <button type="button" className="btn-secondary" onClick={addBulkEmployeeTraining}>
                              Add selected trainings
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="employee-training-records">
                        <div className="employee-training-records-header">
                          <span>Saved training entries</span>
                          <strong>{employeeTrainingRecords.length}</strong>
                        </div>
                        {employeeTrainingRecords.length === 0 ? (
                          <p className="employee-training-empty">No training added yet.</p>
                        ) : (
                          <ul className="employee-training-list">
                            {employeeTrainingRecords.map((record) => (
                              <li key={`${record.training}-${record.expiryDate}`}>
                                <span>{record.training}</span>
                                <strong>{record.expiryDate || 'DD/MM/YYYY'}</strong>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                    <div className="employee-form-actions">
                      <button type="submit" className="btn-add">{editingEmployeeManagementId ? 'Save changes' : 'Add employee'}</button>
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
                            <th aria-sort="ascending">
                              <span className="employee-sort-label">
                                <span>Name</span>
                                <span className="employee-sort-indicator" aria-hidden="true">▲</span>
                              </span>
                            </th>
                            <th aria-sort={employeeRosterSort.column === 'role' ? (employeeRosterSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                              <button type="button" className="employee-sort-button" onClick={() => toggleEmployeeRosterSort('role')}>
                                <span>Role</span>
                                <span className="employee-sort-indicator" aria-hidden="true">
                                  {employeeRosterSort.column === 'role' ? (employeeRosterSort.direction === 'asc' ? '▲' : '▼') : '↕'}
                                </span>
                              </button>
                            </th>
                            <th>Coy Number</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedEmployeeOptions.map((employee) => {
                            const isExpanded = expandedEmployeeId === employee.id
                            const matchingLabourRate = findLabourRateByRole(employee.role, labourPrices)

                            return (
                              <Fragment key={employee.id}>
                                <tr
                                  className={`employee-roster-row ${isExpanded ? 'is-expanded' : ''}`}
                                  onClick={() => toggleEmployeeDetails(employee.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      toggleEmployeeDetails(employee.id)
                                    }
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  aria-expanded={isExpanded}
                                  aria-label={`Toggle details for ${employee.name || 'employee'}`}
                                >
                                  <td>{employee.name || 'Not set'}</td>
                                  <td>{employee.role || 'Role not set'}</td>
                                  <td>{employee.coyNumber || 'Not set'}</td>
                                  <td className="employee-actions-cell" onClick={(event) => event.stopPropagation()}>
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
                                {isExpanded && (
                                  <tr className="employee-details-row">
                                    <td colSpan="4">
                                      <div className="employee-details-panel">
                                        <div className="employee-details-header">
                                          <div>
                                            {/* <p className="employee-details-kicker">Additional information</p>
                                            <h4>{employee.name || 'Employee details'}</h4> */}
                                          </div>
                                          <span className="employee-details-badge">Expanded</span>
                                        </div>
                                        <div className="employee-rates-section">
                                          <div className="employee-compliance-header">
                                            <div>
                                              <p className="employee-details-kicker">Contact</p>
                                              <h4>Employee contact details</h4>
                                            </div>
                                          </div>
                                          <div className="employee-compliance-table-wrap">
                                            <table className="employee-compliance-table">
                                              <thead>
                                                <tr>
                                                  <th>Field</th>
                                                  <th>Value</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                <tr>
                                                  <td>Department</td>
                                                  <td className="employee-compliance-placeholder">{employee.department || 'Department pending'}</td>
                                                </tr>
                                                <tr>
                                                  <td>Email</td>
                                                  <td className="employee-compliance-placeholder">{employee.email || 'Not provided'}</td>
                                                </tr>
                                                <tr>
                                                  <td>Phone</td>
                                                  <td className="employee-compliance-placeholder">{employee.phone || 'Not provided'}</td>
                                                </tr>
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                        <div className="employee-rates-section">
                                          <div className="employee-compliance-header">
                                            <div>
                                              <p className="employee-details-kicker">Rates</p>
                                              <h4>Hourly rates from price calculator</h4>
                                            </div>
                                          </div>
                                          {matchingLabourRate ? (
                                            <div className="employee-compliance-table-wrap">
                                              <table className="employee-compliance-table">
                                                <thead>
                                                  <tr>
                                                    <th>Fee type</th>
                                                    <th>Hourly rate</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  <tr>
                                                    <td>Workshop / Normal</td>
                                                    <td className="employee-compliance-placeholder">R{matchingLabourRate.normalHourlyRate || 0}/hr</td>
                                                  </tr>
                                                  <tr>
                                                    <td>Onsite (Mine)</td>
                                                    <td className="employee-compliance-placeholder">R{matchingLabourRate.onsiteHourlyRate || 0}/hr</td>
                                                  </tr>
                                                  <tr>
                                                    <td>Breakdown (Out of Hours)</td>
                                                    <td className="employee-compliance-placeholder">R{matchingLabourRate.breakdownHourlyRate || 0}/hr</td>
                                                  </tr>
                                                </tbody>
                                              </table>
                                            </div>
                                          ) : (
                                            <p className="employee-rates-empty">No hourly rate found for this employee role.</p>
                                          )}
                                        </div>
                                        <div className="employee-compliance-section">
                                          <div className="employee-compliance-header">
                                            <div>
                                              <p className="employee-details-kicker">Compliance</p>
                                              <h4>Induction and training</h4>
                                            </div>
                                          </div>
                                          <div className="employee-compliance-table-wrap">
                                            <table className="employee-compliance-table">
                                              <thead>
                                                <tr>
                                                  {/* <th>Requirement</th> */}
                                                  <th>Expiry date</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {getEmployeeComplianceRows(employee).length > 0 ? (
                                                  getEmployeeComplianceRows(employee).map((item) => (
                                                    <tr key={item.label}>
                                                      <td>{item.label}</td>
                                                      <td className="employee-compliance-placeholder">{item.value}</td>
                                                    </tr>
                                                  ))
                                                ) : (
                                                  <tr>
                                                    <td colSpan="2" className="employee-compliance-empty">No training assigned to this employee yet.</td>
                                                  </tr>
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          })}
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
                    <strong>{estimatedWeeklyHours.toFixed(1)} hrs</strong>
                  </div>
                  <div>
                    <span>Scheduled activities</span>
                    <strong>{upcomingActivities.length} tasks</strong>
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
                      {upcomingActivities.length > 0 ? (
                        upcomingActivities.map((entry) => (
                          <tr key={entry.id}>
                            <td>{entry.activity}</td>
                            <td>{entry.date}</td>
                            <td>{entry.hours.toFixed(1)} hrs</td>
                            <td>{entry.status}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4">No upcoming activities scheduled.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="time-section-grid">
              <section className="time-table-card">
                <div className="time-table-header">
                  <h3>Employee hours</h3>
                  <div className="time-table-header-tools">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setEmployeeHoursFormOpen((prev) => !prev)}
                    >
                      Add
                    </button>
                    <span>Attendance</span>

                  </div>
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
                {employeeHoursFormOpen && (
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
                )}
              </section>

              <section className="time-table-card">
                <div className="time-table-header">
                  <h3>Current project hours</h3>
                  <div className="time-table-header-tools">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setCurrentProjectFormOpen((prev) => !prev)}
                    >
                      Add
                    </button>
                    <span>Live allocation</span>
                  </div>
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
                                      list="project-options"
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
                {currentProjectFormOpen && (
                  <div className="time-form">
                    <div className="employee-training-mode-toggle" role="tablist" aria-label="Current project employee add mode">
                      <button
                        type="button"
                        className={`employee-training-mode-button ${currentProjectEmployeeMode === 'single' ? 'active' : ''}`}
                        onClick={() => {
                          setCurrentProjectEmployeeMode('single')
                          setCurrentProjectBulkOpen(false)
                        }}
                      >
                        Single
                      </button>
                      <button
                        type="button"
                        className={`employee-training-mode-button ${currentProjectEmployeeMode === 'bulk' ? 'active' : ''}`}
                        onClick={() => {
                          setCurrentProjectEmployeeMode('bulk')
                          setCurrentProjectForm((currentForm) => ({ ...currentForm, name: '' }))
                        }}
                      >
                        Bulk
                      </button>
                    </div>
                    {currentProjectEmployeeMode === 'single' ? (
                      <select
                        value={currentProjectForm.name}
                        onChange={(e) => setCurrentProjectForm({ ...currentProjectForm, name: e.target.value })}
                      >
                        <option value="">Select employee</option>
                        {sortedEmployeeOptions.map((employee) => (
                          <option key={employee.id} value={employee.name}>
                            {employee.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="employee-training-select-wrapper">
                        <span>Employees</span>
                        <button
                          type="button"
                          className="employee-training-dropdown-button"
                          onClick={() => setCurrentProjectBulkOpen((open) => !open)}
                        >
                          {currentProjectBulkEmployees.length > 0
                            ? `${currentProjectBulkEmployees.length} selected`
                            : 'Choose employees'}
                        </button>
                        {currentProjectBulkOpen && (
                          <div className="employee-training-dropdown-panel">
                            {sortedEmployeeOptions.map((employee) => {
                              const isSelected = currentProjectBulkEmployees.includes(employee.name)

                              return (
                                <label key={employee.id} className="employee-training-checkbox-row">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      setCurrentProjectBulkEmployees((currentEmployees) => {
                                        if (isSelected) {
                                          return currentEmployees.filter((employeeName) => employeeName !== employee.name)
                                        }

                                        return [...currentEmployees, employee.name]
                                      })
                                    }}
                                  />
                                  <span>{employee.name}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Hours"
                      value={currentProjectForm.hours}
                      onChange={(e) => setCurrentProjectForm({ ...currentProjectForm, hours: e.target.value })}
                    />
                    <input
                      type="text"
                      list="project-options"
                      placeholder="Project"
                      value={currentProjectForm.project}
                      onChange={(e) => setCurrentProjectForm({ ...currentProjectForm, project: e.target.value })}
                    />
                    <datalist id="project-options">
                      {projectOptions.map((project) => (
                        <option key={project} value={project} />
                      ))}
                    </datalist>
                    <button type="button" className="btn-add" onClick={addCurrentProjectHour}>
                      {currentProjectEmployeeMode === 'bulk' ? 'Add selected employees' : 'Add'}
                    </button>
                  </div>
                )}
              </section>

              <section className="time-table-card">
                <div className="time-table-header">
                  <h3>Planned project hours</h3>
                  <div className="time-table-header-tools">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setPlannedProjectFormOpen((prev) => !prev)}
                    >
                      Add
                    </button>
                    <span>Upcoming</span>
                  </div>
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
                                      list="project-options"
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
                {plannedProjectFormOpen && (
                  <div className="time-form">
                    <div className="employee-training-mode-toggle" role="tablist" aria-label="Planned project employee add mode">
                      <button
                        type="button"
                        className={`employee-training-mode-button ${plannedProjectEmployeeMode === 'single' ? 'active' : ''}`}
                        onClick={() => {
                          setPlannedProjectEmployeeMode('single')
                          setPlannedProjectBulkOpen(false)
                        }}
                      >
                        Single
                      </button>
                      <button
                        type="button"
                        className={`employee-training-mode-button ${plannedProjectEmployeeMode === 'bulk' ? 'active' : ''}`}
                        onClick={() => {
                          setPlannedProjectEmployeeMode('bulk')
                          setPlannedProjectForm((currentForm) => ({ ...currentForm, name: '' }))
                        }}
                      >
                        Bulk
                      </button>
                    </div>
                    {plannedProjectEmployeeMode === 'single' ? (
                      <select
                        value={plannedProjectForm.name}
                        onChange={(e) => setPlannedProjectForm({ ...plannedProjectForm, name: e.target.value })}
                      >
                        <option value="">Select employee</option>
                        {sortedEmployeeOptions.map((employee) => (
                          <option key={employee.id} value={employee.name}>
                            {employee.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="employee-training-select-wrapper">
                        <span>Employees</span>
                        <button
                          type="button"
                          className="employee-training-dropdown-button"
                          onClick={() => setPlannedProjectBulkOpen((open) => !open)}
                        >
                          {plannedProjectBulkEmployees.length > 0
                            ? `${plannedProjectBulkEmployees.length} selected`
                            : 'Choose employees'}
                        </button>
                        {plannedProjectBulkOpen && (
                          <div className="employee-training-dropdown-panel">
                            {sortedEmployeeOptions.map((employee) => {
                              const isSelected = plannedProjectBulkEmployees.includes(employee.name)

                              return (
                                <label key={employee.id} className="employee-training-checkbox-row">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      setPlannedProjectBulkEmployees((currentEmployees) => {
                                        if (isSelected) {
                                          return currentEmployees.filter((employeeName) => employeeName !== employee.name)
                                        }

                                        return [...currentEmployees, employee.name]
                                      })
                                    }}
                                  />
                                  <span>{employee.name}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Hours"
                      value={plannedProjectForm.hours}
                      onChange={(e) => setPlannedProjectForm({ ...plannedProjectForm, hours: e.target.value })}
                    />
                    <input
                      type="text"
                      list="project-options"
                      placeholder="Project"
                      value={plannedProjectForm.project}
                      onChange={(e) => setPlannedProjectForm({ ...plannedProjectForm, project: e.target.value })}
                    />
                    <button type="button" className="btn-add" onClick={addPlannedProjectHour}>
                      {plannedProjectEmployeeMode === 'bulk' ? 'Add selected employees' : 'Add'}
                    </button>
                  </div>
                )}
              </section>
            </div>
          </section>
        )}

        {activePage === 'list-management' && (
          <section className="page-card">
            <div className="page-header">
              <div>
                <p className="section-kicker">Configuration</p>
                <h2>Reusable lists</h2>
              </div>
              <span className="page-badge">Data source</span>
            </div>

            <p className="time-log-status">{listManagementStatus}</p>

            <div className="list-management-grid">
              {[
                { key: 'roles', title: 'Roles', hint: 'Used by employee role selection.' },
                { key: 'trainings', title: 'Trainings', hint: 'Used by training compliance (single and bulk).' },
                { key: 'departments', title: 'Departments', hint: 'Used by employee department entry.' },
                { key: 'projects', title: 'Projects', hint: 'Used by current/planned project forms.' },
                { key: 'quoteItems', title: 'Quote items', hint: 'Used by line-item ITEM dropdown.' }
              ].map((listConfig) => {
                const listValues = managedLists[listConfig.key] || []

                return (
                  <section key={listConfig.key} className="list-management-card">
                    <div className="list-management-card-header">
                      <div>
                        <h3>{listConfig.title}</h3>
                        <p>{listConfig.hint}</p>
                      </div>
                      <strong>{listValues.length}</strong>
                    </div>

                    {listValues.length === 0 ? (
                      <p className="list-management-empty">No items added yet.</p>
                    ) : (
                      <ul className="list-management-list">
                        {listValues.map((value) => (
                          <li key={`${listConfig.key}-${value}`}>
                            <span>{value}</span>
                            <div className="list-management-actions">
                              <button
                                type="button"
                                className="employee-action-btn employee-action-btn-edit"
                                onClick={() => editManagedListItem(listConfig.key, value)}
                                aria-label={`Edit ${value}`}
                                title={`Edit ${value}`}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                  <path d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l10.06-10.06.92.92L5.92 19.58zM20.71 5.63a1 1 0 0 0 0-1.41L19.78 3.29a1 1 0 0 0-1.41 0l-1.15 1.15 3.75 3.75 1.74-1.56z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="employee-action-btn employee-action-btn-delete"
                                onClick={() => removeManagedListItem(listConfig.key, value)}
                                aria-label={`Remove ${value}`}
                                title={`Remove ${value}`}
                              >
                                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                                  <path d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z" />
                                </svg>
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="list-management-add-row">
                      <input
                        type="text"
                        value={listDrafts[listConfig.key] || ''}
                        onChange={(event) => {
                          const { value } = event.target
                          setListDrafts((currentDrafts) => ({
                            ...currentDrafts,
                            [listConfig.key]: value
                          }))
                        }}
                        placeholder={`Add ${listConfig.title.toLowerCase().slice(0, -1) || 'item'}`}
                      />
                      <button
                        type="button"
                        className="btn-add"
                        onClick={() => addManagedListItem(listConfig.key)}
                      >
                        Add
                      </button>
                    </div>
                  </section>
                )
              })}
            </div>

            <section className="list-management-vendor-card">
              <div className="list-management-card-header">
                <div>
                  <h3>Customer addresses</h3>
                  <p>Used by the Quotation To and Shipping Address dropdowns on Create Quote.</p>
                </div>
                <strong>{vendorOptions.length}</strong>
              </div>

              {vendorOptions.length === 0 ? (
                <p className="list-management-empty">No customer address records added yet.</p>
              ) : (
                <div className="list-management-vendor-list">
                  {vendorOptions.map((vendor) => (
                    <article key={vendor.id} className="list-management-vendor-item">
                      <div className="list-management-vendor-copy">
                        <h4>{vendor.company}</h4>
                        {vendor.vatNumber ? <p>VAT: {vendor.vatNumber}</p> : null}
                        <div className="list-management-vendor-addresses">
                          <div>
                            <span>Quotation To</span>
                            <pre>{vendor.quotationTo || '-'}</pre>
                          </div>
                          <div>
                            <span>Shipping Address</span>
                            <pre>{vendor.shippingAddress || '-'}</pre>
                          </div>
                        </div>
                      </div>
                      <div className="list-management-actions">
                        <button
                          type="button"
                          className="employee-action-btn employee-action-btn-edit"
                          onClick={() => startEditingVendor(vendor)}
                          aria-label={`Edit ${vendor.company}`}
                          title={`Edit ${vendor.company}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l10.06-10.06.92.92L5.92 19.58zM20.71 5.63a1 1 0 0 0 0-1.41L19.78 3.29a1 1 0 0 0-1.41 0l-1.15 1.15 3.75 3.75 1.74-1.56z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="employee-action-btn employee-action-btn-delete"
                          onClick={() => removeVendorRecord(vendor.id)}
                          aria-label={`Remove ${vendor.company}`}
                          title={`Remove ${vendor.company}`}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                            <path d="M6 7h12l-1 14H7L6 7zm3-4h6l1 2h4v2H4V5h4l1-2z" />
                          </svg>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <form className="list-management-vendor-form" onSubmit={handleVendorManagementSubmit}>
                <label>
                  <span>Company</span>
                  <input
                    type="text"
                    value={vendorForm.company}
                    onChange={(event) => setVendorForm((currentForm) => ({ ...currentForm, company: event.target.value }))}
                    placeholder="Company name"
                  />
                </label>
                <label>
                  <span>VAT number</span>
                  <input
                    type="text"
                    value={vendorForm.vatNumber}
                    onChange={(event) => setVendorForm((currentForm) => ({ ...currentForm, vatNumber: event.target.value }))}
                    placeholder="Optional VAT number"
                  />
                </label>
                <label className="list-management-vendor-form-full">
                  <span>Quotation To</span>
                  <textarea
                    value={vendorForm.quotationTo}
                    onChange={(event) => setVendorForm((currentForm) => ({ ...currentForm, quotationTo: event.target.value }))}
                    placeholder="Customer / quotation address"
                    rows="4"
                  />
                </label>
                <label className="list-management-vendor-form-full">
                  <span>Shipping Address</span>
                  <textarea
                    value={vendorForm.shippingAddress}
                    onChange={(event) => setVendorForm((currentForm) => ({ ...currentForm, shippingAddress: event.target.value }))}
                    placeholder="Shipping / delivery address"
                    rows="4"
                  />
                </label>
                <div className="list-management-vendor-form-actions">
                  {editingVendorId ? (
                    <button type="button" className="btn-secondary" onClick={resetVendorForm}>
                      Cancel
                    </button>
                  ) : null}
                  <button type="submit" className="btn-add">
                    {editingVendorId ? 'Save customer' : 'Add customer'}
                  </button>
                </div>
              </form>
            </section>
          </section>
        )}
      </main>

      {/* PDF Template */}
      {selectedHistoryQuote && (
        <div className="modal-overlay" onClick={closeHistoryModal}>
          <div className="modal-content modal-content-pdf" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close modal-close-top" type="button" onClick={closeHistoryModal}>&times;</button>
            {selectedHistoryQuote.pdfPreviewUrl ? (
              <div className="pdf-preview-frame only-preview">
                <Suspense fallback={<p className="pdf-canvas-preview-error">Loading preview…</p>}>
                  <PdfCanvasPreview fileUrl={selectedHistoryQuote.pdfPreviewUrl} />
                </Suspense>
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
              {pdfTemplateMode !== 'quote' && (
                <p className="report-meta-inline">{generatedReportCode} • {generatedReportLabel}</p>
              )}
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

              <table className={`items-table ${pdfTemplateMode === 'quote' ? '' : 'report-items-table'}`.trim()}>
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
                    {pdfTemplateMode === 'time-report'
                      ? `Report: ${generatedReportCode}\nGenerated: ${generatedReportLabel}\nEntries: ${employeeHours.length + currentProjectHours.length + plannedProjectHours.length}`
                      : pdfTemplateMode === 'employee-report'
                        ? `Report: ${generatedReportCode}\nGenerated: ${generatedReportLabel}\nEmployees: ${employeeOptions.length}`
                        : `Report: ${generatedReportCode}\nGenerated: ${generatedReportLabel}\nLabour Categories: ${labourPrices.length}`}
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
                      pdfTemplateMode === 'time-report' ? (
                        <>
                          <th style={{width: '25%'}}>SECTION</th>
                          <th style={{width: '25%'}}>ITEM</th>
                          <th style={{width: '30%', textAlign: 'left'}}>DETAILS</th>
                          <th style={{width: '20%', textAlign: 'right'}}>VALUE</th>
                        </>
                      ) : (
                        <>
                          <th style={{width: '18%'}}>NAME</th>
                          <th style={{width: '14%'}}>ROLE</th>
                          <th style={{width: '14%'}}>DEPARTMENT</th>
                          <th style={{width: '54%', textAlign: 'left'}}>CONTACT, COMPLIANCE & RATES</th>
                        </>
                      )
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
                    sortedEmployeeOptions.map((employee) => {
                      const matchingLabourRate = findLabourRateByRole(employee.role, labourPrices)
                      const trainingSummary = Array.isArray(employee.trainingRecords) && employee.trainingRecords.length > 0
                        ? employee.trainingRecords.map((record) => `${record.training} (${record.expiryDate || '-'})`).join('; ')
                        : 'Not assigned'
                      const ratesSummary = matchingLabourRate
                        ? `Normal R${matchingLabourRate.normalHourlyRate || 0}/hr | Onsite R${matchingLabourRate.onsiteHourlyRate || 0}/hr | Breakdown R${matchingLabourRate.breakdownHourlyRate || 0}/hr`
                        : 'No rate mapped for role'

                      return (
                        <tr key={employee.id}>
                          <td>{employee.name || 'Unknown'}</td>
                          <td>{employee.role || '-'}</td>
                          <td>{employee.department || '-'}</td>
                          <td className="report-employee-details-cell">
                            <div className="report-employee-line">
                              <span className="report-employee-label">Email</span>
                              <span className="report-employee-value">{employee.email || '-'}</span>
                            </div>
                            <div className="report-employee-line">
                              <span className="report-employee-label">Phone</span>
                              <span className="report-employee-value">{employee.phone || '-'}</span>
                            </div>
                            <div className="report-employee-line">
                              <span className="report-employee-label">Induction Expiry</span>
                              <span className="report-employee-value">{employee.inductionExpiryDate || '-'}</span>
                            </div>
                            <div className="report-employee-line">
                              <span className="report-employee-label">Training</span>
                              <span className="report-employee-value">{trainingSummary}</span>
                            </div>
                            <div className="report-employee-line report-employee-line-rates">
                              <span className="report-employee-label">Rates</span>
                              <span className="report-employee-value">{ratesSummary}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })
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
