import { readFileSync } from 'fs'
import { join } from 'path'

// Read at runtime (not a static TS import) so this works identically whether
// running via ts-node from src/ or the compiled output in dist/ — both sit
// one directory below the project root, so '../../package.json' resolves
// correctly from either location.
let cachedVersion: string | undefined

export const getAppVersion = (): string => {
  if (cachedVersion) return cachedVersion

  const packageJsonPath = join(__dirname, '../../package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
    version: string
  }

  cachedVersion = packageJson.version
  return cachedVersion
}
