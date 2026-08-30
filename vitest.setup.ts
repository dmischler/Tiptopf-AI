import { mkdirSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = mkdtempSync(path.join(os.tmpdir(), 'tiptopf-vitest-'))
mkdirSync(path.join(dir, 'recipe-images'), { recursive: true })
process.env.DATA_DIR = dir
