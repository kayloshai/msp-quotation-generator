export const vendorSeedData = [
  {
    id: 'vendor-001',
    company: 'Rhovan Pooling & Sharing Venture',
    vatNumber: '4270257969',
    quotationTo: 'Rhovan Pooling & Sharing Venture\nShared Services Centre\nPrivate Bag 82100\nRustenburg\n0300',
    shippingAddress: 'Rhovan Pooling & Sharing Venture\nRhovan PSV Operation - Main Store\nBrits, 0250\nNorth West'
  },
  {
    id: 'vendor-002',
    company: 'Silver Valley Industries',
    vatNumber: '5743209801',
    quotationTo: 'Silver Valley Industries\nProcurement Department\nSuite 310, 22 Industrial Road\nGqeberha, 6011\nEastern Cape',
    shippingAddress: 'Silver Valley Industries\nWarehouse 3, 14 Port Drive\nGqeberha, 6011\nEastern Cape'
  },
  {
    id: 'vendor-003',
    company: 'Kalahari Mining Services',
    vatNumber: '6890123456',
    quotationTo: 'Kalahari Mining Services\nAccounts Payable\nPO Box 435\nKimberley\n8300',
    shippingAddress: 'Kalahari Mining Services\nMain Plant, 47 Kalahari Road\nKimberley\n8300\nNorthern Cape'
  }
]

export const labourPriceSeedData = [
  { title: 'Supervisor', normalHourlyRate: 750, normalDaily7: 5625, normalDaily11: 8625, onsiteHourlyRate: 750, onsiteDaily7: 5625, onsiteDaily11: 8625, breakdownHourlyRate: 1500, breakdownDaily7: 11250, breakdownDaily11: 17250, normalHours: 7.5, mineHours: 11.5 },
  { title: 'Boilermaker', normalHourlyRate: 650, normalDaily7: 4875, normalDaily11: 7475, onsiteHourlyRate: 650, onsiteDaily7: 4875, onsiteDaily11: 7475, breakdownHourlyRate: 1300, breakdownDaily7: 9750, breakdownDaily11: 14950, normalHours: 7.5, mineHours: 11.5 },
  { title: 'Boilermaker assistant', normalHourlyRate: 400, normalDaily7: 3000, normalDaily11: 4600, onsiteHourlyRate: 400, onsiteDaily7: 3000, onsiteDaily11: 4600, breakdownHourlyRate: 800, breakdownDaily7: 6000, breakdownDaily11: 9200, normalHours: 7.5, mineHours: 11.5 },
  { title: 'Welder', normalHourlyRate: 550, normalDaily7: 4125, normalDaily11: 6325, onsiteHourlyRate: 550, onsiteDaily7: 4125, onsiteDaily11: 6325, breakdownHourlyRate: 1100, breakdownDaily7: 8250, breakdownDaily11: 12650, normalHours: 7.5, mineHours: 11.5 },
  { title: 'Boilermaker helper', normalHourlyRate: 300, normalDaily7: 2250, normalDaily11: 3450, onsiteHourlyRate: 300, onsiteDaily7: 2250, onsiteDaily11: 3450, breakdownHourlyRate: 600, breakdownDaily7: 4500, breakdownDaily11: 6900, normalHours: 7.5, mineHours: 11.5 },
  { title: 'Fitter', normalHourlyRate: 500, normalDaily7: 3750, normalDaily11: 5750, onsiteHourlyRate: 500, onsiteDaily7: 3750, onsiteDaily11: 5750, breakdownHourlyRate: 1000, breakdownDaily7: 7500, breakdownDaily11: 11500, normalHours: 7.5, mineHours: 11.5 },
  { title: 'Fitter helper', normalHourlyRate: 350, normalDaily7: 2625, normalDaily11: 4025, onsiteHourlyRate: 350, onsiteDaily7: 2625, onsiteDaily11: 4025, breakdownHourlyRate: 700, breakdownDaily7: 5250, breakdownDaily11: 8050, normalHours: 7.5, mineHours: 11.5 },
  { title: 'General helper', normalHourlyRate: 250, normalDaily7: 1875, normalDaily11: 2875, onsiteHourlyRate: 250, onsiteDaily7: 1875, onsiteDaily11: 2875, breakdownHourlyRate: 500, breakdownDaily7: 3750, breakdownDaily11: 5750, normalHours: 7.5, mineHours: 11.5 }
]

export const materialItemSeedData = {
  plates: [
    { name: 'Mild steel 2500 x 1200 x 12 mm', price: 6281.6 },
    { name: 'Mild steel 2500 x 1200 x 16 mm', price: 8834.4 },
    { name: 'Mild steel 2500 x 1200 x 20 mm', price: 10390.98 }
  ],
  angleIron: [
    { name: 'Angle iron 50 x 50 x 6 mm (6m)', price: 678.6 },
    { name: 'Angle iron 75 x 75 x 8 mm (6m)', price: 1530 },
    { name: 'Angle iron 100 x 100 x 10 mm (6m)', price: 2248.8 }
  ],
  linerPlates: [
    { name: 'VRN450', price: 8500, note: 'Contact supplier for current quote' },
    { name: 'VRN500', price: 10200, note: 'Contact supplier for current quote' },
    { name: 'NM450', price: 7800, note: 'Contact supplier for current quote' },
    { name: 'NM500', price: 9400, note: 'Contact supplier for current quote' }
  ]
}

export const employeeSeedData = [
  { name: 'A. Mokoena', role: 'Supervisor', coyNumber: '10000001', department: '', email: '', phone: '' },
  { name: 'L. Kgosi', role: 'Boilermaker', coyNumber: '10000002', department: '', email: '', phone: '' },
  { name: 'K. Ndlovu', role: 'Welder', coyNumber: '10000003', department: '', email: '', phone: '' },
  { name: 'T. Maseko', role: 'Fitter', coyNumber: '10000004', department: '', email: '', phone: '' }
]

export const employeeHourSeedData = [
  { name: 'A. Mokoena', date: '2026-07-29', timeIn: '07:30', timeOut: '16:00' },
  { name: 'L. Kgosi', date: '2026-07-29', timeIn: '08:00', timeOut: '15:30' }
]

export const currentProjectHourSeedData = [
  { name: 'A. Mokoena', hours: '6.5', project: 'Mine Shaft Upgrade' },
  { name: 'L. Kgosi', hours: '4.0', project: 'Mine Shaft Upgrade' }
]

export const plannedProjectHourSeedData = [
  { name: 'A. Mokoena', hours: '8.0', project: 'Pump Station Build' },
  { name: 'L. Kgosi', hours: '5.5', project: 'Pump Station Build' }
]

export const timeEntrySeedData = [
  { id: 1, title: 'Review client quote', date: '2026-07-29', hours: '2.5', status: 'Planned' },
  { id: 2, title: 'Site coordination call', date: '2026-07-30', hours: '1.0', status: 'In progress' }
]
