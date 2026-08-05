import sqlite3 from 'sqlite3'
import {
  currentProjectHourSeedData,
  employeeHourSeedData,
  employeeSeedData,
  labourPriceSeedData,
  materialItemSeedData,
  plannedProjectHourSeedData,
  timeEntrySeedData,
  vendorSeedData
} from './seed-data.js'

const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || './server/data.sqlite'

export const db = new sqlite3.Database(SQLITE_DB_PATH)

export const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(err) {
    if (err) {
      reject(err)
      return
    }

    resolve({ lastID: this.lastID, changes: this.changes })
  })
})

export const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) {
      reject(err)
      return
    }

    resolve(row)
  })
})

export const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) {
      reject(err)
      return
    }

    resolve(rows)
  })
})

const upsertAppSetting = async (key, value) => {
  await run(
    `
      INSERT INTO app_settings (key, value, updatedAt)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP
    `,
    [key, value]
  )
}

export const getAppSetting = async (key, fallback = null) => {
  const row = await get('SELECT value FROM app_settings WHERE key = ?', [key])
  if (!row) return fallback
  return row.value
}

export const getJsonSetting = async (key, fallback) => {
  const raw = await getAppSetting(key, null)
  if (!raw) return fallback

  try {
    return JSON.parse(raw)
  } catch (error) {
    return fallback
  }
}

export const setJsonSetting = async (key, value) => {
  await upsertAppSetting(key, JSON.stringify(value))
}

const seedReferenceData = async () => {
  const vendorCount = await get('SELECT COUNT(*) AS count FROM vendors')
  if ((vendorCount?.count || 0) === 0) {
    for (const vendor of vendorSeedData) {
      await run(
        `INSERT INTO vendors (id, company, vatNumber, quotationTo, shippingAddress) VALUES (?, ?, ?, ?, ?)`,
        [vendor.id, vendor.company || '', vendor.vatNumber || '', vendor.quotationTo || '', vendor.shippingAddress || '']
      )
    }
  }

  const labourCount = await get('SELECT COUNT(*) AS count FROM labour_prices')
  if ((labourCount?.count || 0) === 0) {
    for (const labour of labourPriceSeedData) {
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
          labour.title || '', labour.normalHourlyRate || 0, labour.normalDaily7 || 0, labour.normalDaily11 || 0,
          labour.onsiteHourlyRate || 0, labour.onsiteDaily7 || 0, labour.onsiteDaily11 || 0,
          labour.breakdownHourlyRate || 0, labour.breakdownDaily7 || 0, labour.breakdownDaily11 || 0,
          labour.normalHours || 7.5, labour.mineHours || 11.5
        ]
      )
    }
  }

  const materialCount = await get('SELECT COUNT(*) AS count FROM material_items')
  if ((materialCount?.count || 0) === 0) {
    const categories = ['plates', 'angleIron', 'linerPlates']

    for (const category of categories) {
      const items = materialItemSeedData[category] || []
      for (const item of items) {
        await run(
          `INSERT INTO material_items (category, name, price, note) VALUES (?, ?, ?, ?)`,
          [category, item.name || '', Number.parseFloat(item.price) || 0, item.note || '']
        )
      }
    }
  }

  const employeeCount = await get('SELECT COUNT(*) AS count FROM employees')
  if ((employeeCount?.count || 0) === 0) {
    for (const employee of employeeSeedData) {
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

  const employeeHoursCount = await get('SELECT COUNT(*) AS count FROM employee_hours')
  const currentProjectCount = await get('SELECT COUNT(*) AS count FROM current_project_hours')
  const plannedProjectCount = await get('SELECT COUNT(*) AS count FROM planned_project_hours')
  if ((employeeHoursCount?.count || 0) === 0 && (currentProjectCount?.count || 0) === 0 && (plannedProjectCount?.count || 0) === 0) {
    for (const row of employeeHourSeedData) {
      await run(
        `INSERT INTO employee_hours (employeeName, date, timeIn, timeOut) VALUES (?, ?, ?, ?)`,
        [row.name || '', row.date || '', row.timeIn || '', row.timeOut || '']
      )
    }

    for (const row of currentProjectHourSeedData) {
      await run(
        `INSERT INTO current_project_hours (employeeName, hours, project) VALUES (?, ?, ?)`,
        [row.name || '', Number.parseFloat(row.hours) || 0, row.project || '']
      )
    }

    for (const row of plannedProjectHourSeedData) {
      await run(
        `INSERT INTO planned_project_hours (employeeName, hours, project) VALUES (?, ?, ?)`,
        [row.name || '', Number.parseFloat(row.hours) || 0, row.project || '']
      )
    }
  }

  const timeEntries = await getJsonSetting('timeEntries', null)
  if (!timeEntries) {
    await setJsonSetting('timeEntries', timeEntrySeedData)
  }

  if (await getAppSetting('activePage', null) === null) {
    await upsertAppSetting('activePage', 'builder')
  }

  if (await getAppSetting('quotationCounter', null) === null) {
    await upsertAppSetting('quotationCounter', '0')
  }

  if (await getAppSetting('panelDescription', null) === null) {
    await upsertAppSetting('panelDescription', '')
  }

  const quoteHistory = await getJsonSetting('quotationHistory', null)
  if (!quoteHistory) {
    await setJsonSetting('quotationHistory', [])
  }
}

export const initializeDatabase = async () => {
  await run('PRAGMA foreign_keys = ON')

  await run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS vendors (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      vatNumber TEXT DEFAULT '',
      quotationTo TEXT DEFAULT '',
      shippingAddress TEXT DEFAULT ''
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS labour_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      normalHourlyRate REAL NOT NULL DEFAULT 0,
      normalDaily7 REAL NOT NULL DEFAULT 0,
      normalDaily11 REAL NOT NULL DEFAULT 0,
      onsiteHourlyRate REAL NOT NULL DEFAULT 0,
      onsiteDaily7 REAL NOT NULL DEFAULT 0,
      onsiteDaily11 REAL NOT NULL DEFAULT 0,
      breakdownHourlyRate REAL NOT NULL DEFAULT 0,
      breakdownDaily7 REAL NOT NULL DEFAULT 0,
      breakdownDaily11 REAL NOT NULL DEFAULT 0,
      normalHours REAL NOT NULL DEFAULT 7.5,
      mineHours REAL NOT NULL DEFAULT 11.5,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS material_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT DEFAULT '',
      coyNumber TEXT DEFAULT '',
      department TEXT DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS employee_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeName TEXT NOT NULL,
      date TEXT NOT NULL,
      timeIn TEXT NOT NULL,
      timeOut TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS current_project_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeName TEXT NOT NULL,
      hours REAL NOT NULL,
      project TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS planned_project_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employeeName TEXT NOT NULL,
      hours REAL NOT NULL,
      project TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS time_log_entries (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      groupName TEXT DEFAULT '',
      section TEXT DEFAULT '',
      timestamp TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}'
    )
  `)

  await seedReferenceData()
}
