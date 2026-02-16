import { ErrorCategory, ErrorCodes, ErrorSeverity, getErrorByName, getErrorInfo, getErrorsByCategory, getErrorsBySeverity } from '../../utils/ErrorCodes.js'

describe('ErrorCodes helpers', () => {
  test('getErrorInfo finds by error code', () => {
    const info = getErrorInfo('E1101')
    expect(info).toBeTruthy()
    expect(info.code).toBe('E1101')
  })

  test('getErrorInfo returns null for unknown code', () => {
    expect(getErrorInfo('E9999')).toBe(null)
  })

  test('getErrorByName returns error definition', () => {
    const info = getErrorByName('PLAYER_NOT_FOUND')
    expect(info).toBe(ErrorCodes.PLAYER_NOT_FOUND)
  })

  test('getErrorsByCategory filters list', () => {
    const list = getErrorsByCategory(ErrorCategory.VALIDATION)
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
    expect(list.every(e => e.category === ErrorCategory.VALIDATION)).toBe(true)
  })

  test('getErrorsBySeverity filters list', () => {
    const list = getErrorsBySeverity(ErrorSeverity.CRITICAL)
    expect(Array.isArray(list)).toBe(true)
    expect(list.every(e => e.severity === ErrorSeverity.CRITICAL)).toBe(true)
  })
})

