import sqlite3 from 'sqlite3'

const db = new sqlite3.Database('./server/data.sqlite')

const queryAll = (sql) => new Promise((resolve, reject) => {
  db.all(sql, (err, rows) => {
    if (err) {
      reject(err)
      return
    }

    resolve(rows)
  })
})

const run = async () => {
  const duplicateChecks = [
    ['employees_exact', "SELECT COUNT(*) AS c FROM (SELECT 1 FROM employees GROUP BY lower(trim(name)), lower(trim(role)), trim(coyNumber), lower(trim(COALESCE(department, ''))), lower(trim(COALESCE(email, ''))), trim(COALESCE(phone, '')) HAVING COUNT(*) > 1)"],
    ['employee_hours_exact', "SELECT COUNT(*) AS c FROM (SELECT 1 FROM employee_hours GROUP BY lower(trim(employeeName)), date, timeIn, timeOut HAVING COUNT(*) > 1)"],
    ['current_project_hours_exact', "SELECT COUNT(*) AS c FROM (SELECT 1 FROM current_project_hours GROUP BY lower(trim(employeeName)), hours, lower(trim(project)) HAVING COUNT(*) > 1)"],
    ['planned_project_hours_exact', "SELECT COUNT(*) AS c FROM (SELECT 1 FROM planned_project_hours GROUP BY lower(trim(employeeName)), hours, lower(trim(project)) HAVING COUNT(*) > 1)"],
    ['labour_prices_title', "SELECT COUNT(*) AS c FROM (SELECT 1 FROM labour_prices GROUP BY lower(trim(title)) HAVING COUNT(*) > 1)"],
    ['material_items_exact', "SELECT COUNT(*) AS c FROM (SELECT 1 FROM material_items GROUP BY category, lower(trim(name)), price, COALESCE(note, '') HAVING COUNT(*) > 1)"]
  ]

  for (const [name, sql] of duplicateChecks) {
    const rows = await queryAll(sql)
    console.log(`${name}: ${rows[0]?.c ?? 0}`)
  }

  const indexes = await queryAll("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%_unique' ORDER BY name")
  console.log(`unique_indexes: ${indexes.map((row) => row.name).join(',')}`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    db.close()
  })
