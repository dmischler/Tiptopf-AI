export const STORE_CORRUPT_DIGEST_PREFIX = 'STORE_CORRUPT'

function toStoreCorruptDigest(backupPath?: string) {
  return backupPath ? `${STORE_CORRUPT_DIGEST_PREFIX};${backupPath}` : STORE_CORRUPT_DIGEST_PREFIX
}

export class StoreCorruptError extends Error {
  readonly backupPath?: string
  readonly digest: string

  constructor(backupPath?: string, options?: ErrorOptions) {
    const location = backupPath ? ` Die Datei liegt unter ${backupPath}.` : ''
    super(`Die Bibliothek-Datei ist beschädigt.${location} Stelle ein Backup wieder her.`, options)
    this.name = 'StoreCorruptError'
    this.backupPath = backupPath
    this.digest = toStoreCorruptDigest(backupPath)
  }
}

export function isStoreCorruptError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  if (error instanceof StoreCorruptError) {
    return true
  }

  if ('name' in error && error.name === 'StoreCorruptError') {
    return true
  }

  if (
    'digest' in error &&
    typeof error.digest === 'string' &&
    error.digest.startsWith(STORE_CORRUPT_DIGEST_PREFIX)
  ) {
    return true
  }

  return (
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.includes('Bibliothek-Datei ist beschädigt')
  )
}

export function getStoreCorruptBackupPath(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  if ('backupPath' in error && typeof error.backupPath === 'string' && error.backupPath.length > 0) {
    return error.backupPath
  }

  if ('digest' in error && typeof error.digest === 'string') {
    const prefix = `${STORE_CORRUPT_DIGEST_PREFIX};`
    if (error.digest.startsWith(prefix)) {
      const pathFromDigest = error.digest.slice(prefix.length)
      return pathFromDigest.length > 0 ? pathFromDigest : undefined
    }
  }

  return undefined
}
