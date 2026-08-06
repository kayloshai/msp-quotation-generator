import { all, get, getAppSetting, getJsonSetting, run, setJsonSetting } from './db.js'

export const typeDefs = `#graphql
  type ListManagementData {
    roles: [String!]!
    trainings: [String!]!
    departments: [String!]!
    projects: [String!]!
    quoteItems: [String!]!
  }

  type Vendor {
    id: ID!
    company: String!
    vatNumber: String
    quotationTo: String
    shippingAddress: String
  }

  type LabourPrice {
    id: ID!
    title: String!
    normalHourlyRate: Float!
    normalDaily7: Float!
    normalDaily11: Float!
    onsiteHourlyRate: Float!
    onsiteDaily7: Float!
    onsiteDaily11: Float!
    breakdownHourlyRate: Float!
    breakdownDaily7: Float!
    breakdownDaily11: Float!
    normalHours: Float!
    mineHours: Float!
  }

  type MaterialItem {
    id: ID!
    category: String!
    name: String!
    price: Float!
    note: String
  }

  type TimeEntry {
    id: ID!
    title: String!
    date: String!
    hours: String!
    status: String!
  }

  type TimeLogEntry {
    id: ID!
    action: String!
    group: String
    section: String
    timestamp: String!
    details: String!
  }

  type QuotationHistoryItem {
    id: ID!
    quotationNumber: String
    dateCreated: String
    timeCreated: String
    quotationTo: String
    shippingAddress: String
    totalPrice: String
    savedAt: String
    fileName: String
    pdfPreviewUrl: String
  }

  type Quotation {
    id: ID!
    quotationNumber: String!
    quotationDate: String
    vendorId: String
    quotationTo: String
    shippingAddress: String
    panelDescription: String
    lineItems: String!
    totalPrice: String
    status: String
    pdfFileName: String
    pdfMimeType: String
    hasPdf: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type QuotationPdf {
    id: ID!
    quotationId: ID!
    fileName: String
    mimeType: String
    base64Data: String!
    updatedAt: String!
  }

  type BootstrapData {
    activePage: String!
    quotationCounter: Int!
    panelDescription: String!
    quotationHistory: [QuotationHistoryItem!]!
    quotations: [Quotation!]!
    vendors: [Vendor!]!
    labourPrices: [LabourPrice!]!
    materialItems: [MaterialItem!]!
    employees: [Employee!]!
    employeeHours: [EmployeeHour!]!
    currentProjectHours: [ProjectHour!]!
    plannedProjectHours: [ProjectHour!]!
    timeEntries: [TimeEntry!]!
    timeLogEntries: [TimeLogEntry!]!
    listManagement: ListManagementData!
  }

  type Employee {
    id: ID!
    name: String!
    role: String
    coyNumber: String
    department: String
    email: String
    phone: String
    inductionExpiryDate: String
    trainingRecords: String
    createdAt: String!
    updatedAt: String!
  }

  type EmployeeHour {
    id: ID!
    name: String!
    date: String!
    timeIn: String!
    timeOut: String!
    createdAt: String!
    updatedAt: String!
  }

  type ProjectHour {
    id: ID!
    name: String!
    hours: Float!
    project: String!
    createdAt: String!
    updatedAt: String!
  }

  type Query {
    bootstrap: BootstrapData!
    quotations: [Quotation!]!
    quotation(id: ID!): Quotation
    quotationPdf(quotationId: ID!): QuotationPdf
    listManagement: ListManagementData!
    vendors: [Vendor!]!
    labourPrices: [LabourPrice!]!
    materialItems(category: String): [MaterialItem!]!
    timeEntries: [TimeEntry!]!
    quotationHistory: [QuotationHistoryItem!]!
    panelDescription: String!
    activePage: String!
    quotationCounter: Int!
    timeLogEntries: [TimeLogEntry!]!
    employees: [Employee!]!
    employeeHours: [EmployeeHour!]!
    currentProjectHours: [ProjectHour!]!
    plannedProjectHours: [ProjectHour!]!
  }

  input EmployeeInput {
    name: String!
    role: String
    coyNumber: String
    department: String
    email: String
    phone: String
    inductionExpiryDate: String
    trainingRecords: String
  }

  input EmployeeHourInput {
    employeeName: String!
    date: String!
    timeIn: String!
    timeOut: String!
  }

  input ProjectHourInput {
    employeeName: String!
    hours: Float!
    project: String!
  }

  input LabourPriceInput {
    id: ID
    title: String!
    normalHourlyRate: Float!
    normalDaily7: Float!
    normalDaily11: Float!
    onsiteHourlyRate: Float!
    onsiteDaily7: Float!
    onsiteDaily11: Float!
    breakdownHourlyRate: Float!
    breakdownDaily7: Float!
    breakdownDaily11: Float!
    normalHours: Float!
    mineHours: Float!
  }

  input MaterialItemInput {
    id: ID
    category: String!
    name: String!
    price: Float!
    note: String
  }

  input TimeEntryInput {
    id: ID!
    title: String!
    date: String!
    hours: String!
    status: String!
  }

  input TimeLogEntryInput {
    id: ID!
    action: String!
    group: String
    section: String
    timestamp: String!
    details: String!
  }

  input QuotationHistoryInput {
    id: ID!
    quotationNumber: String
    dateCreated: String
    timeCreated: String
    quotationTo: String
    shippingAddress: String
    totalPrice: String
    savedAt: String
    fileName: String
    pdfPreviewUrl: String
  }

  input QuotationInput {
    id: ID
    quotationNumber: String!
    quotationDate: String
    vendorId: String
    quotationTo: String
    shippingAddress: String
    panelDescription: String
    lineItems: String!
    totalPrice: String
    status: String
    pdfFileName: String
    pdfMimeType: String
    pdfBase64: String
    persistPdf: Boolean
  }

  input VendorInput {
    id: ID!
    company: String!
    vatNumber: String
    quotationTo: String
    shippingAddress: String
  }

  input LegacyDataInput {
    employeeManagementData: String
    timeManagementData: String
    labourPricesData: String
    quotationHistory: String
    quotationPanelData: String
    activePage: String
    quoCounter: String
  }

  input ListManagementInput {
    roles: [String!]
    trainings: [String!]
    departments: [String!]
    projects: [String!]
    quoteItems: [String!]
  }

  type Mutation {
    migrateLegacyData(input: LegacyDataInput): BootstrapData!
    setActivePage(page: String!): String!
    setQuotationCounter(counter: Int!): Int!
    setPanelDescription(description: String!): String!
    saveQuotationHistory(items: [QuotationHistoryInput!]!): [QuotationHistoryItem!]!
    saveQuotation(input: QuotationInput!): Quotation!
    deleteQuotation(id: ID!): Boolean!
    saveVendors(items: [VendorInput!]!): [Vendor!]!
    saveTimeEntries(items: [TimeEntryInput!]!): [TimeEntry!]!
    saveLabourPrices(items: [LabourPriceInput!]!): [LabourPrice!]!
    saveMaterialItems(category: String!, items: [MaterialItemInput!]!): [MaterialItem!]!
    saveListManagement(input: ListManagementInput!): ListManagementData!
    addTimeLogEntry(input: TimeLogEntryInput!): TimeLogEntry!

    addEmployee(input: EmployeeInput!): Employee!
    updateEmployee(id: ID!, input: EmployeeInput!): Employee!
    deleteEmployee(id: ID!): Boolean!

    addEmployeeHour(input: EmployeeHourInput!): EmployeeHour!
    updateEmployeeHour(id: ID!, input: EmployeeHourInput!): EmployeeHour!
    deleteEmployeeHour(id: ID!): Boolean!

    addCurrentProjectHour(input: ProjectHourInput!): ProjectHour!
    updateCurrentProjectHour(id: ID!, input: ProjectHourInput!): ProjectHour!
    deleteCurrentProjectHour(id: ID!): Boolean!

    addPlannedProjectHour(input: ProjectHourInput!): ProjectHour!
    updatePlannedProjectHour(id: ID!, input: ProjectHourInput!): ProjectHour!
    deletePlannedProjectHour(id: ID!): Boolean!
  }
`

const toId = (id) => Number.parseInt(id, 10)
const defaultListManagement = {
  roles: [],
  trainings: [
    'Basic rigging',
    'Working at heights level 1',
    'Working at heights level 2',
    'Basic fire fighting'
  ],
  departments: [],
  projects: [],
  quoteItems: ['Manufacture', 'Fabricate', 'Supply']
}

const normalizeListValues = (values) => {
  return Array.from(
    new Map(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .map((value) => [value.toLowerCase(), value])
    ).values()
  ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true }))
}

const normalizeListManagement = (value = {}) => {
  return {
    roles: normalizeListValues(value.roles || []),
    trainings: normalizeListValues(value.trainings || []),
    departments: normalizeListValues(value.departments || []),
    projects: normalizeListValues(value.projects || []),
    quoteItems: normalizeListValues(value.quoteItems || [])
  }
}

const loadListManagement = async () => {
  const stored = await getJsonSetting('listManagement', null)

  if (!stored) {
    const seeded = normalizeListManagement(defaultListManagement)
    await setJsonSetting('listManagement', seeded)
    return seeded
  }

  return normalizeListManagement(stored)
}

const mapQuotationRow = (row) => {
  if (!row) return null

  return {
    id: row.id,
    quotationNumber: row.quotationNumber,
    quotationDate: row.quotationDate || '',
    vendorId: row.vendorId || '',
    quotationTo: row.quotationTo || '',
    shippingAddress: row.shippingAddress || '',
    panelDescription: row.panelDescription || '',
    lineItems: row.lineItemsJson || '[]',
    totalPrice: row.totalPrice || '0.00',
    status: row.status || 'draft',
    pdfFileName: row.pdfFileName || '',
    pdfMimeType: row.pdfMimeType || 'application/pdf',
    hasPdf: Boolean(row.hasPdf),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

const selectQuotationSql = `
  SELECT
    id,
    quotationNumber,
    quotationDate,
    vendorId,
    quotationTo,
    shippingAddress,
    panelDescription,
    lineItemsJson,
    totalPrice,
    status,
    pdfFileName,
    pdfMimeType,
    CASE WHEN pdfData IS NOT NULL AND length(pdfData) > 0 THEN 1 ELSE 0 END AS hasPdf,
    createdAt,
    updatedAt
  FROM quotations
`

const listQuotations = async () => {
  const rows = await all(`${selectQuotationSql} ORDER BY datetime(updatedAt) DESC`)
  return rows.map((row) => mapQuotationRow(row))
}

const getQuotationById = async (id) => {
  const row = await get(`${selectQuotationSql} WHERE id = ?`, [id])
  return mapQuotationRow(row)
}

const parseJson = (value, fallback) => {
  if (!value) return fallback

  try {
    return JSON.parse(value)
  } catch (error) {
    return fallback
  }
}

const loadBootstrap = async () => {
  const activePage = await getAppSetting('activePage', 'builder')
  const quotationCounterRaw = await getAppSetting('quotationCounter', '0')
  const panelDescription = await getAppSetting('panelDescription', '')
  const quotationHistory = await getJsonSetting('quotationHistory', [])
  const timeEntries = await getJsonSetting('timeEntries', [])
  const timeLogEntries = await all(
    `SELECT id, action, groupName AS "group", section, timestamp, details FROM time_log_entries ORDER BY timestamp DESC LIMIT 200`
  )
  const listManagement = await loadListManagement()
  const quotations = await listQuotations()

  return {
    activePage,
    quotationCounter: Number.parseInt(quotationCounterRaw || '0', 10) || 0,
    panelDescription,
    quotationHistory,
    quotations,
    vendors: await all('SELECT * FROM vendors ORDER BY company ASC'),
    labourPrices: await all('SELECT * FROM labour_prices ORDER BY id ASC'),
    materialItems: await all('SELECT * FROM material_items ORDER BY category ASC, id ASC'),
    employees: await all('SELECT * FROM employees ORDER BY id DESC'),
    employeeHours: await all(`SELECT id, employeeName AS name, date, timeIn, timeOut, createdAt, updatedAt FROM employee_hours ORDER BY id DESC`),
    currentProjectHours: await all(`SELECT id, employeeName AS name, hours, project, createdAt, updatedAt FROM current_project_hours ORDER BY id DESC`),
    plannedProjectHours: await all(`SELECT id, employeeName AS name, hours, project, createdAt, updatedAt FROM planned_project_hours ORDER BY id DESC`),
    timeEntries,
    timeLogEntries,
    listManagement
  }
}

const replaceLabourPrices = async (items) => {
  const deduped = Array.from(
    new Map((items || []).map((row) => [String(row.title || '').trim(), row])).values()
  ).filter((row) => row?.title)

  await run('DELETE FROM labour_prices')

  for (const row of deduped) {
    await run(
      `
        INSERT INTO labour_prices (
          title, normalHourlyRate, normalDaily7, normalDaily11,
          onsiteHourlyRate, onsiteDaily7, onsiteDaily11,
          breakdownHourlyRate, breakdownDaily7, breakdownDaily11,
          normalHours, mineHours
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        row.title || '', row.normalHourlyRate || 0, row.normalDaily7 || 0, row.normalDaily11 || 0,
        row.onsiteHourlyRate || 0, row.onsiteDaily7 || 0, row.onsiteDaily11 || 0,
        row.breakdownHourlyRate || 0, row.breakdownDaily7 || 0, row.breakdownDaily11 || 0,
        row.normalHours || 7.5, row.mineHours || 11.5
      ]
    )
  }

  return all('SELECT * FROM labour_prices ORDER BY id ASC')
}

const replaceMaterialItems = async (category, items) => {
  await run('DELETE FROM material_items WHERE category = ?', [category])

  for (const row of items) {
    await run(
      `INSERT INTO material_items (category, name, price, note, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [category, row.name || '', row.price || 0, row.note || '']
    )
  }

  return all('SELECT * FROM material_items WHERE category = ? ORDER BY id ASC', [category])
}

const replaceVendors = async (items) => {
  const normalizedVendors = Array.from(
    new Map(
      (Array.isArray(items) ? items : [])
        .map((row) => ({
          id: String(row?.id || '').trim(),
          company: String(row?.company || '').trim(),
          vatNumber: String(row?.vatNumber || '').trim(),
          quotationTo: String(row?.quotationTo || '').trim(),
          shippingAddress: String(row?.shippingAddress || '').trim()
        }))
        .filter((row) => row.id && row.company)
        .map((row) => [row.id, row])
    ).values()
  )

  await run('DELETE FROM vendors')

  for (const row of normalizedVendors) {
    await run(
      `INSERT INTO vendors (id, company, vatNumber, quotationTo, shippingAddress) VALUES (?, ?, ?, ?, ?)`,
      [row.id, row.company, row.vatNumber, row.quotationTo, row.shippingAddress]
    )
  }

  return all('SELECT * FROM vendors ORDER BY company ASC')
}

const saveQuotationRecord = async (input = {}) => {
  const nowId = `quote-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const quotationId = String(input.id || nowId).trim()
  const quotationNumber = String(input.quotationNumber || '').trim()

  if (!quotationNumber) {
    throw new Error('Quotation number is required.')
  }

  const lineItemsRaw = String(input.lineItems || '[]').trim() || '[]'
  let lineItems = []

  try {
    const parsedLineItems = JSON.parse(lineItemsRaw)
    lineItems = Array.isArray(parsedLineItems) ? parsedLineItems : []
  } catch (error) {
    lineItems = []
  }

  const normalizedLineItems = JSON.stringify(lineItems)
  const persistPdf = Boolean(input.persistPdf)
  const pdfBuffer = persistPdf && input.pdfBase64 ? Buffer.from(input.pdfBase64, 'base64') : null
  const pdfFileName = String(input.pdfFileName || '').trim()
  const pdfMimeType = String(input.pdfMimeType || 'application/pdf').trim() || 'application/pdf'

  const existing = await get('SELECT id FROM quotations WHERE id = ?', [quotationId])

  if (existing) {
    if (persistPdf && pdfBuffer) {
      await run(
        `
          UPDATE quotations
          SET
            quotationNumber = ?,
            quotationDate = ?,
            vendorId = ?,
            quotationTo = ?,
            shippingAddress = ?,
            panelDescription = ?,
            lineItemsJson = ?,
            totalPrice = ?,
            status = ?,
            pdfFileName = ?,
            pdfMimeType = ?,
            pdfData = ?,
            updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          quotationNumber,
          String(input.quotationDate || '').trim(),
          String(input.vendorId || '').trim(),
          String(input.quotationTo || '').trim(),
          String(input.shippingAddress || '').trim(),
          String(input.panelDescription || '').trim(),
          normalizedLineItems,
          String(input.totalPrice || '0.00').trim(),
          String(input.status || 'draft').trim(),
          pdfFileName,
          pdfMimeType,
          pdfBuffer,
          quotationId
        ]
      )
    } else {
      await run(
        `
          UPDATE quotations
          SET
            quotationNumber = ?,
            quotationDate = ?,
            vendorId = ?,
            quotationTo = ?,
            shippingAddress = ?,
            panelDescription = ?,
            lineItemsJson = ?,
            totalPrice = ?,
            status = ?,
            updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          quotationNumber,
          String(input.quotationDate || '').trim(),
          String(input.vendorId || '').trim(),
          String(input.quotationTo || '').trim(),
          String(input.shippingAddress || '').trim(),
          String(input.panelDescription || '').trim(),
          normalizedLineItems,
          String(input.totalPrice || '0.00').trim(),
          String(input.status || 'draft').trim(),
          quotationId
        ]
      )
    }
  } else {
    await run(
      `
        INSERT INTO quotations (
          id,
          quotationNumber,
          quotationDate,
          vendorId,
          quotationTo,
          shippingAddress,
          panelDescription,
          lineItemsJson,
          totalPrice,
          status,
          pdfFileName,
          pdfMimeType,
          pdfData
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        quotationId,
        quotationNumber,
        String(input.quotationDate || '').trim(),
        String(input.vendorId || '').trim(),
        String(input.quotationTo || '').trim(),
        String(input.shippingAddress || '').trim(),
        String(input.panelDescription || '').trim(),
        normalizedLineItems,
        String(input.totalPrice || '0.00').trim(),
        String(input.status || 'draft').trim(),
        persistPdf ? pdfFileName : '',
        persistPdf ? pdfMimeType : 'application/pdf',
        persistPdf ? pdfBuffer : null
      ]
    )
  }

  return getQuotationById(quotationId)
}

const deleteQuotationRecord = async (id) => {
  const result = await run('DELETE FROM quotations WHERE id = ?', [id])
  return result.changes > 0
}

const getQuotationPdfRecord = async (quotationId) => {
  const row = await get(
    `
      SELECT id, pdfFileName, pdfMimeType, pdfData, updatedAt
      FROM quotations
      WHERE id = ?
    `,
    [quotationId]
  )

  if (!row || !row.pdfData) return null

  return {
    id: `${row.id}-pdf`,
    quotationId: row.id,
    fileName: row.pdfFileName || `${row.id}.pdf`,
    mimeType: row.pdfMimeType || 'application/pdf',
    base64Data: Buffer.from(row.pdfData).toString('base64'),
    updatedAt: row.updatedAt
  }
}

const migrateLegacyData = async (input = {}) => {
  const legacyEmployees = parseJson(input.employeeManagementData, null)
  if (Array.isArray(legacyEmployees) && legacyEmployees.length > 0) {
    await run('DELETE FROM employees')
    for (const employee of legacyEmployees) {
      await run(
        `INSERT INTO employees (name, role, coyNumber, department, email, phone) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          employee.name || '',
          employee.role || employee.title || '',
          employee.coyNumber || '',
          employee.department || '',
          employee.email || '',
          employee.phone || ''
        ]
      )
    }
  }

  const legacyTimeData = parseJson(input.timeManagementData, null)
  if (legacyTimeData) {
    await run('DELETE FROM employee_hours')
    await run('DELETE FROM current_project_hours')
    await run('DELETE FROM planned_project_hours')
    await run('DELETE FROM time_log_entries')

    for (const row of legacyTimeData.employeeHours || []) {
      await run(
        `INSERT INTO employee_hours (employeeName, date, timeIn, timeOut) VALUES (?, ?, ?, ?)`,
        [row.name || '', row.date || '', row.timeIn || '', row.timeOut || '']
      )
    }

    for (const row of legacyTimeData.currentProjectHours || []) {
      await run(
        `INSERT INTO current_project_hours (employeeName, hours, project) VALUES (?, ?, ?)`,
        [row.name || '', Number.parseFloat(row.hours) || 0, row.project || '']
      )
    }

    for (const row of legacyTimeData.plannedProjectHours || []) {
      await run(
        `INSERT INTO planned_project_hours (employeeName, hours, project) VALUES (?, ?, ?)`,
        [row.name || '', Number.parseFloat(row.hours) || 0, row.project || '']
      )
    }

    for (const row of legacyTimeData.activityLog || []) {
      await run(
        `INSERT INTO time_log_entries (id, action, groupName, section, timestamp, details) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          row.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          row.action || '',
          row.group || row.action || '',
          row.section || '',
          row.timestamp || new Date().toISOString(),
          JSON.stringify(row)
        ]
      )
    }
  }

  const labourPayload = parseJson(input.labourPricesData, null)
  if (Array.isArray(labourPayload?.labourPrices) && labourPayload.labourPrices.length > 0) {
    await replaceLabourPrices(labourPayload.labourPrices)
  }

  const historyPayload = parseJson(input.quotationHistory, null)
  if (Array.isArray(historyPayload)) {
    await setJsonSetting('quotationHistory', historyPayload)
  }

  const panelPayload = parseJson(input.quotationPanelData, null)
  if (panelPayload && typeof panelPayload.description === 'string') {
    await run(
      `
        INSERT INTO app_settings (key, value, updatedAt)
        VALUES ('panelDescription', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
      `,
      [panelPayload.description]
    )
  }

  if (input.activePage) {
    await run(
      `
        INSERT INTO app_settings (key, value, updatedAt)
        VALUES ('activePage', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
      `,
      [input.activePage]
    )
  }

  const parsedCounter = Number.parseInt(input.quoCounter || '', 10)
  if (!Number.isNaN(parsedCounter)) {
    await run(
      `
        INSERT INTO app_settings (key, value, updatedAt)
        VALUES ('quotationCounter', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
      `,
      [String(parsedCounter)]
    )
  }
}

export const resolvers = {
  Query: {
    bootstrap: async () => loadBootstrap(),
    quotations: async () => listQuotations(),
    quotation: async (_, { id }) => getQuotationById(String(id || '').trim()),
    quotationPdf: async (_, { quotationId }) => getQuotationPdfRecord(String(quotationId || '').trim()),
    listManagement: async () => loadListManagement(),
    vendors: async () => all('SELECT * FROM vendors ORDER BY company ASC'),
    labourPrices: async () => all('SELECT * FROM labour_prices ORDER BY id ASC'),
    materialItems: async (_, { category }) => {
      if (category) {
        return all('SELECT * FROM material_items WHERE category = ? ORDER BY id ASC', [category])
      }

      return all('SELECT * FROM material_items ORDER BY category ASC, id ASC')
    },
    timeEntries: async () => getJsonSetting('timeEntries', []),
    quotationHistory: async () => getJsonSetting('quotationHistory', []),
    panelDescription: async () => getAppSetting('panelDescription', ''),
    activePage: async () => getAppSetting('activePage', 'builder'),
    quotationCounter: async () => {
      const value = await getAppSetting('quotationCounter', '0')
      return Number.parseInt(value || '0', 10) || 0
    },
    timeLogEntries: async () => all(
      `SELECT id, action, groupName AS "group", section, timestamp, details FROM time_log_entries ORDER BY timestamp DESC LIMIT 200`
    ),
    employees: async () => all('SELECT * FROM employees ORDER BY id DESC'),
    employeeHours: async () => all('SELECT id, employeeName AS name, date, timeIn, timeOut, createdAt, updatedAt FROM employee_hours ORDER BY id DESC'),
    currentProjectHours: async () => all('SELECT id, employeeName AS name, hours, project, createdAt, updatedAt FROM current_project_hours ORDER BY id DESC'),
    plannedProjectHours: async () => all('SELECT id, employeeName AS name, hours, project, createdAt, updatedAt FROM planned_project_hours ORDER BY id DESC')
  },
  Mutation: {
    migrateLegacyData: async (_, { input }) => {
      await migrateLegacyData(input || {})
      return loadBootstrap()
    },

    setActivePage: async (_, { page }) => {
      await run(
        `
          INSERT INTO app_settings (key, value, updatedAt)
          VALUES ('activePage', ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
        `,
        [page]
      )

      return page
    },

    setQuotationCounter: async (_, { counter }) => {
      await run(
        `
          INSERT INTO app_settings (key, value, updatedAt)
          VALUES ('quotationCounter', ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
        `,
        [String(counter)]
      )

      return counter
    },

    setPanelDescription: async (_, { description }) => {
      await run(
        `
          INSERT INTO app_settings (key, value, updatedAt)
          VALUES ('panelDescription', ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
        `,
        [description]
      )

      return description
    },

    saveQuotationHistory: async (_, { items }) => {
      await setJsonSetting('quotationHistory', items || [])
      return getJsonSetting('quotationHistory', [])
    },

    saveQuotation: async (_, { input }) => saveQuotationRecord(input || {}),

    deleteQuotation: async (_, { id }) => deleteQuotationRecord(String(id || '').trim()),

    saveVendors: async (_, { items }) => replaceVendors(items || []),

    saveTimeEntries: async (_, { items }) => {
      await setJsonSetting('timeEntries', items || [])
      return getJsonSetting('timeEntries', [])
    },

    saveLabourPrices: async (_, { items }) => replaceLabourPrices(items || []),

    saveMaterialItems: async (_, { category, items }) => replaceMaterialItems(category, items || []),

    saveListManagement: async (_, { input }) => {
      const nextLists = normalizeListManagement(input || {})
      await setJsonSetting('listManagement', nextLists)
      return nextLists
    },

    addTimeLogEntry: async (_, { input }) => {
      await run(
        `INSERT INTO time_log_entries (id, action, groupName, section, timestamp, details) VALUES (?, ?, ?, ?, ?, ?)`,
        [input.id, input.action, input.group || '', input.section || '', input.timestamp, input.details || '{}']
      )

      return {
        id: input.id,
        action: input.action,
        group: input.group || '',
        section: input.section || '',
        timestamp: input.timestamp,
        details: input.details || '{}'
      }
    },

    addEmployee: async (_, { input }) => {
      const result = await run(
        `INSERT INTO employees (name, role, coyNumber, department, email, phone, inductionExpiryDate, trainingRecords) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.name,
          input.role || '',
          input.coyNumber || '',
          input.department || '',
          input.email || '',
          input.phone || '',
          input.inductionExpiryDate || '',
          input.trainingRecords || '[]'
        ]
      )

      return get('SELECT * FROM employees WHERE id = ?', [result.lastID])
    },

    updateEmployee: async (_, { id, input }) => {
      const parsedId = toId(id)
      await run(
        `
          UPDATE employees
          SET name = ?, role = ?, coyNumber = ?, department = ?, email = ?, phone = ?, inductionExpiryDate = ?, trainingRecords = ?, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          input.name,
          input.role || '',
          input.coyNumber || '',
          input.department || '',
          input.email || '',
          input.phone || '',
          input.inductionExpiryDate || '',
          input.trainingRecords || '[]',
          parsedId
        ]
      )

      return get('SELECT * FROM employees WHERE id = ?', [parsedId])
    },

    deleteEmployee: async (_, { id }) => {
      const parsedId = toId(id)
      const result = await run('DELETE FROM employees WHERE id = ?', [parsedId])
      return result.changes > 0
    },

    addEmployeeHour: async (_, { input }) => {
      const result = await run(
        `INSERT INTO employee_hours (employeeName, date, timeIn, timeOut) VALUES (?, ?, ?, ?)`,
        [input.employeeName, input.date, input.timeIn, input.timeOut]
      )

      return get('SELECT id, employeeName AS name, date, timeIn, timeOut, createdAt, updatedAt FROM employee_hours WHERE id = ?', [result.lastID])
    },

    updateEmployeeHour: async (_, { id, input }) => {
      const parsedId = toId(id)
      await run(
        `
          UPDATE employee_hours
          SET employeeName = ?, date = ?, timeIn = ?, timeOut = ?, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [input.employeeName, input.date, input.timeIn, input.timeOut, parsedId]
      )

      return get('SELECT id, employeeName AS name, date, timeIn, timeOut, createdAt, updatedAt FROM employee_hours WHERE id = ?', [parsedId])
    },

    deleteEmployeeHour: async (_, { id }) => {
      const parsedId = toId(id)
      const result = await run('DELETE FROM employee_hours WHERE id = ?', [parsedId])
      return result.changes > 0
    },

    addCurrentProjectHour: async (_, { input }) => {
      const result = await run(
        `INSERT INTO current_project_hours (employeeName, hours, project) VALUES (?, ?, ?)`,
        [input.employeeName, input.hours, input.project]
      )

      return get('SELECT id, employeeName AS name, hours, project, createdAt, updatedAt FROM current_project_hours WHERE id = ?', [result.lastID])
    },

    updateCurrentProjectHour: async (_, { id, input }) => {
      const parsedId = toId(id)
      await run(
        `
          UPDATE current_project_hours
          SET employeeName = ?, hours = ?, project = ?, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [input.employeeName, input.hours, input.project, parsedId]
      )

      return get('SELECT id, employeeName AS name, hours, project, createdAt, updatedAt FROM current_project_hours WHERE id = ?', [parsedId])
    },

    deleteCurrentProjectHour: async (_, { id }) => {
      const parsedId = toId(id)
      const result = await run('DELETE FROM current_project_hours WHERE id = ?', [parsedId])
      return result.changes > 0
    },

    addPlannedProjectHour: async (_, { input }) => {
      const result = await run(
        `INSERT INTO planned_project_hours (employeeName, hours, project) VALUES (?, ?, ?)`,
        [input.employeeName, input.hours, input.project]
      )

      return get('SELECT id, employeeName AS name, hours, project, createdAt, updatedAt FROM planned_project_hours WHERE id = ?', [result.lastID])
    },

    updatePlannedProjectHour: async (_, { id, input }) => {
      const parsedId = toId(id)
      await run(
        `
          UPDATE planned_project_hours
          SET employeeName = ?, hours = ?, project = ?, updatedAt = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [input.employeeName, input.hours, input.project, parsedId]
      )

      return get('SELECT id, employeeName AS name, hours, project, createdAt, updatedAt FROM planned_project_hours WHERE id = ?', [parsedId])
    },

    deletePlannedProjectHour: async (_, { id }) => {
      const parsedId = toId(id)
      const result = await run('DELETE FROM planned_project_hours WHERE id = ?', [parsedId])
      return result.changes > 0
    }
  }
}
