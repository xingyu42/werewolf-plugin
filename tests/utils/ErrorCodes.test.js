import {
  ErrorCategory,
  ErrorCodes,
  ErrorSeverity,
  getErrorByName,
  getErrorInfo,
  getErrorsByCategory,
  getErrorsBySeverity
} from '../../utils/ErrorCodes.js'

describe('ErrorCodes', () => {
  describe('enumerations', () => {
    it('should expose expected severity values', () => {
      expect(ErrorSeverity).toEqual({
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical'
      })
    })

    it('should expose expected category values', () => {
      expect(ErrorCategory).toEqual({
        VALIDATION: 'validation',
        GAME_LOGIC: 'game_logic',
        SYSTEM: 'system',
        NETWORK: 'network',
        RESOURCE: 'resource',
        PERMISSION: 'permission'
      })
    })

    it('should define well-formed unique error entries', () => {
      const errors = Object.values(ErrorCodes)
      const codes = errors.map(error => error.code)
      const validSeverities = Object.values(ErrorSeverity)
      const validCategories = Object.values(ErrorCategory)

      expect(errors.length).toBeGreaterThanOrEqual(25)
      expect(new Set(codes).size).toBe(codes.length)

      for (const error of errors) {
        expect(error.code).toMatch(/^E\d{4}$/)
        expect(error.message).toEqual(expect.any(String))
        expect(error.message.length).toBeGreaterThan(0)
        expect(validSeverities).toContain(error.severity)
        expect(validCategories).toContain(error.category)
      }
    })
  })

  describe('getErrorInfo', () => {
    it('should return error information by code', () => {
      expect(getErrorInfo('E1100')).toBe(ErrorCodes.INVALID_PLAYER)
      expect(getErrorInfo('E1601')).toMatchObject({
        code: 'E1601',
        message: '模块加载失败',
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.SYSTEM
      })
    })

    it('should return null when code is not found', () => {
      expect(getErrorInfo('E9999')).toBeNull()
      expect(getErrorInfo()).toBeNull()
      expect(getErrorInfo(null)).toBeNull()
    })
  })

  describe('getErrorByName', () => {
    it('should return error information by exported name', () => {
      expect(getErrorByName('INVALID_PLAYER')).toBe(ErrorCodes.INVALID_PLAYER)
      expect(getErrorByName('NOT_SHERIFF')).toBe(ErrorCodes.NOT_SHERIFF)
    })

    it('should return null when name is not found', () => {
      expect(getErrorByName('NOT_EXISTS')).toBeNull()
      expect(getErrorByName()).toBeNull()
      expect(getErrorByName(null)).toBeNull()
    })
  })

  describe('getErrorsByCategory', () => {
    it('should return only errors in the requested category', () => {
      const validationErrors = getErrorsByCategory(ErrorCategory.VALIDATION)

      expect(validationErrors).toContain(ErrorCodes.INVALID_PLAYER)
      expect(validationErrors).toContain(ErrorCodes.INVALID_PARAMETER)
      expect(validationErrors.every(error => error.category === ErrorCategory.VALIDATION)).toBe(true)
    })

    it('should return an empty array for unknown category', () => {
      expect(getErrorsByCategory('missing')).toEqual([])
    })
  })

  describe('getErrorsBySeverity', () => {
    it('should return only errors in the requested severity', () => {
      const criticalErrors = getErrorsBySeverity(ErrorSeverity.CRITICAL)

      expect(criticalErrors).toEqual([ErrorCodes.MODULE_LOAD_ERROR])
      expect(criticalErrors.every(error => error.severity === ErrorSeverity.CRITICAL)).toBe(true)
    })

    it('should return an empty array for unknown severity', () => {
      expect(getErrorsBySeverity('missing')).toEqual([])
    })
  })
})
