import { randomUUID } from 'node:crypto'
import { mkdir, open, rename, unlink } from 'node:fs/promises'
import path from 'node:path'

export async function writeFileDurable(filePath: string, data: string | Uint8Array): Promise<void> {
  const directory = path.dirname(filePath)
  await mkdir(directory, { recursive: true })

  const tempPath = `${filePath}.tmp.${randomUUID()}`

  try {
    const fileHandle = await open(tempPath, 'w')
    try {
      await fileHandle.writeFile(data)
      await fileHandle.sync()
    } finally {
      await fileHandle.close()
    }

    await rename(tempPath, filePath)

    // Directory fsync makes the rename durable on ext4.
    const dirHandle = await open(directory, 'r')
    try {
      await dirHandle.sync()
    } finally {
      await dirHandle.close()
    }
  } catch (error) {
    await unlink(tempPath).catch(() => undefined)
    throw error
  }
}
