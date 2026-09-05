import 'reflect-metadata'
import { Category } from '@/entities/category.entity'
import {
  toCategoryType,
  toUpdateCategoryPatch,
  type UpdateCategoryInput,
} from '@/graphql/category.types'

describe('toCategoryType mapper', () => {
  it('T-013: maps id, title, description, icon and color from the entity', () => {
    const category = Category.fromRepository({
      id: 'cat-1',
      userId: 'user-123',
      title: 'Groceries',
      description: 'Weekly food shopping',
      icon: 'cart',
      color: '#FF00AA',
    })

    const result = toCategoryType(category)

    expect(result.id).toBe('cat-1')
    expect(result.title).toBe('Groceries')
    expect(result.description).toBe('Weekly food shopping')
    expect(result.icon).toBe('cart')
    expect(result.color).toBe('#FF00AA')
  })

  it('T-013: maps a null description as-is', () => {
    const category = Category.fromRepository({
      id: 'cat-2',
      userId: 'user-123',
      title: 'Rent',
      description: null,
      icon: 'home',
      color: '#00FF00',
    })

    const result = toCategoryType(category)

    expect(result.description).toBeNull()
  })

  it('T-013: does not expose userId', () => {
    const category = Category.fromRepository({
      id: 'cat-3',
      userId: 'user-123',
      title: 'Rent',
      description: null,
      icon: 'home',
      color: '#00FF00',
    })

    const result = toCategoryType(category)

    expect(result).not.toHaveProperty('userId')
  })
})

describe('toUpdateCategoryPatch mapper', () => {
  it('maps every field from a fully-populated input', () => {
    const input = {
      title: 'Groceries',
      description: 'Weekly food shopping',
      icon: 'cart',
      color: '#FF00AA',
    } as UpdateCategoryInput

    expect(toUpdateCategoryPatch(input)).toEqual({
      title: 'Groceries',
      description: 'Weekly food shopping',
      icon: 'cart',
      color: '#FF00AA',
    })
  })

  it('carries an explicit null description through as-is', () => {
    const input = { description: null } as UpdateCategoryInput

    expect(toUpdateCategoryPatch(input).description).toBeNull()
  })

  it('carries omitted fields through as undefined', () => {
    const input = {} as UpdateCategoryInput

    const patch = toUpdateCategoryPatch(input)

    expect(patch.title).toBeUndefined()
    expect(patch.icon).toBeUndefined()
    expect(patch.color).toBeUndefined()
  })
})
