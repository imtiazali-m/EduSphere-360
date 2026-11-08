export interface CsvColumn { key: string; label: string }

// Cells that begin with these characters can be executed as formulas by spreadsheet apps.
function guardCell(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

export function toCsv(rows: Record<string, unknown>[], columns: CsvColumn[]) {
  const escape = (raw: unknown) => {
    const text = guardCell(raw === null || raw === undefined ? '' : String(raw))
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const header = columns.map(column => escape(column.label)).join(',')
  const lines = rows.map(row => columns.map(column => escape(row[column.key])).join(','))
  return [header, ...lines].join('\r\n')
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[], columns: CsvColumn[]) {
  const blob = new Blob(['﻿', toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
