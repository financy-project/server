#!/usr/bin/env node
/**
 * Scaffolds a new module under src/modules/<name> following the project's
 * GraphQL + Apollo Server + TypeGraphQL + Prisma architecture.
 * See docs/architecture/01-module-structure.md for the pattern this mirrors.
 *
 * Usage: node scripts/scaffold-module.js <module-name>
 */

const fs = require('fs')
const path = require('path')

const moduleName = process.argv[2]

if (!moduleName) {
  console.error('❌ Usage: node scripts/scaffold-module.js <module-name>')
  process.exit(1)
}

if (!/^[a-z][a-z0-9-]*$/.test(moduleName)) {
  console.error(`❌ Invalid module name: '${moduleName}'`)
  console.error(
    '→ Use lowercase, hyphens allowed: transaction, budget-category',
  )
  process.exit(1)
}

const root = process.cwd()
const moduleDir = path.join(root, 'src', 'modules', moduleName)

if (fs.existsSync(moduleDir)) {
  console.error(`❌ Module '${moduleName}' already exists`)
  console.error('→ Choose a different name or delete the existing module first')
  process.exit(1)
}

const pascalCase = moduleName
  .split('-')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join('')

const directories = [
  'entity',
  'types',
  'enums',
  'errors',
  'graphql/object-types',
  'graphql/input-types',
  'graphql/args',
  'validation',
  'mappers',
  'repository',
  'use-cases',
  'resolvers',
  '__tests__/unit/entity',
  '__tests__/unit/validation',
  '__tests__/unit/use-cases',
  '__tests__/unit/mappers',
  '__tests__/integration/repository',
  '__tests__/integration/e2e',
  '__tests__/factories',
]

const barrelFiles = {
  'entity/index.ts': `export {} // export { ${pascalCase} } from './${moduleName}.entity'\n`,
  'types/index.ts': `export {} // export type { ${pascalCase}Props, Create${pascalCase}Props } from '../entity/${moduleName}.entity'\n`,
  'enums/index.ts': `export {} // export { ${pascalCase}Status } from './${moduleName}-status.enum'\n`,
  'errors/index.ts': `export {} // export { ${pascalCase}NotFoundError } from './${moduleName}-errors'\n`,
  'graphql/object-types/index.ts': `export {} // export { ${pascalCase}Type } from './${moduleName}.object-type'\n`,
  'graphql/input-types/index.ts': `export {} // export { Create${pascalCase}Input } from './create-${moduleName}.input'\n`,
  'graphql/args/index.ts': `export {} // export { Find${pascalCase}Args } from './find-${moduleName}.args'\n`,
  'validation/index.ts': `export {} // export { Create${pascalCase}Validation } from './create-${moduleName}.validation'\n`,
  'mappers/index.ts': `export {} // export { to${pascalCase}Type } from './${moduleName}.mapper'\n`,
  'repository/index.ts': `export {} // export { ${pascalCase}Repository } from './${moduleName}.repository'\n`,
  'use-cases/index.ts': `export {} // export { Create${pascalCase}UseCase } from './create-${moduleName}.use-case'\n`,
  'resolvers/index.ts': `export {} // export { ${pascalCase}Resolver } from './${moduleName}.resolver'\n`,
  'index.ts': `// Public API for the '${moduleName}' module.
// Only export: entity, types, enums, errors, repository, resolver.
// NEVER export: use-cases, validation wrappers, mappers, ports, adapters, gateways, loaders.

export {} // export { ${pascalCase} } from './entity'
// export type { ${pascalCase}Props } from './types'
// export { ${pascalCase}Repository } from './repository'
// export { ${pascalCase}NotFoundError } from './errors'
// export { ${pascalCase}Resolver } from './resolvers'
`,
}

for (const dir of directories) {
  fs.mkdirSync(path.join(moduleDir, dir), { recursive: true })
}

for (const [relativePath, content] of Object.entries(barrelFiles)) {
  fs.writeFileSync(path.join(moduleDir, relativePath), content)
}

console.log(`✅ Module '${moduleName}' created successfully!`)
console.log(`📁 Location: src/modules/${moduleName}/`)
console.log('')
console.log('📋 Directory structure created:')
console.log(
  '  entity/                     # Domain entity (private constructor + create/fromRepository, no decorators)',
)
console.log(
  '  types/                      # Plain TypeScript type definitions only',
)
console.log(
  '  enums/                      # Enums with SCREAMING_SNAKE_CASE keys',
)
console.log(
  '  errors/                     # Custom domain errors extending DomainError',
)
console.log(
  '  graphql/object-types/       # @ObjectType() — schema output shape',
)
console.log(
  '  graphql/input-types/        # @InputType() + class-validator decorators',
)
console.log(
  '  graphql/args/               # @ArgsType() — grouped scalar arguments',
)
console.log('  validation/                 # validateInput() wrappers')
console.log(
  '  mappers/                    # Pure entity → object-type functions',
)
console.log(
  '  repository/                 # Data access layer (Prisma internal)',
)
console.log('  use-cases/                  # Business logic orchestrators')
console.log(
  '  resolvers/                  # GraphQL Query/Mutation/FieldResolver binding',
)
console.log('  __tests__/')
console.log(
  '    ├── unit/                 # Entity, validation, use-case, mapper tests (mocked)',
)
console.log(
  '    ├── integration/          # Repository tests (real database) + E2E operation tests',
)
console.log('    └── factories/            # Test data generators')
console.log('')
console.log('⚡ Implementation Order (TDD):')
console.log(`  1. Entity: entity/${moduleName}.entity.ts`)
console.log(`  2. Errors: errors/${moduleName}-errors.ts`)
console.log(
  `  3. GraphQL Input/Args + Validation: graphql/input-types/, validation/`,
)
console.log(`  4. Repository: repository/${moduleName}.repository.ts`)
console.log(`  5. Use-Case: use-cases/*.use-case.ts`)
console.log(
  `  6. GraphQL Object Type + Mapper: graphql/object-types/, mappers/`,
)
console.log(`  7. Resolver: resolvers/${moduleName}.resolver.ts`)
console.log('  8. Register the resolver in src/schema/build-schema.ts')
console.log('  9. Update all barrel files (index.ts) as you add files')
console.log('')
console.log('📚 Reference:')
console.log(
  '  - Implementation Guide: docs/architecture/13-backend-development-checklist.md',
)
console.log('  - Architecture: docs/architecture/')
console.log('  - Checklist: docs/architecture/checklist.md')
