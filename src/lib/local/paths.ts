import path from 'node:path'

const DEFAULT_DATA_DIR_NAME = 'data'

export function getDataDir() {
  const configured = process.env.DATA_DIR?.trim()
  if (!configured) {
    return path.join(/*turbopackIgnore: true*/ process.cwd(), DEFAULT_DATA_DIR_NAME)
  }

  return path.isAbsolute(configured)
    ? configured
    : path.join(/*turbopackIgnore: true*/ process.cwd(), configured)
}

export function getStoreFilePath() {
  return path.join(getDataDir(), 'tiptopf.json')
}

export function getRecipeImagesDir() {
  return path.join(getDataDir(), 'recipe-images')
}
