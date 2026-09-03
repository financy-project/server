import { Category } from '../../../entity/category.entity'

describe('Category', () => {
  const props = {
    userId: 'user-123',
    title: 'Groceries',
    description: 'Weekly food shopping',
    icon: 'cart',
    color: '#FF00AA',
  }

  describe('create()', () => {
    it('generates a UUID id', () => {
      const category = Category.create(props)

      expect(category.id).toBeDefined()
      expect(typeof category.id).toBe('string')
      expect(category.id.length).toBeGreaterThan(0)
    })

    it('generates a unique id per call', () => {
      const category1 = Category.create(props)
      const category2 = Category.create(props)

      expect(category1.id).not.toBe(category2.id)
    })

    it('copies userId, title, description, icon and color', () => {
      const category = Category.create(props)

      expect(category.userId).toBe(props.userId)
      expect(category.title).toBe(props.title)
      expect(category.description).toBe(props.description)
      expect(category.icon).toBe(props.icon)
      expect(category.color).toBe(props.color)
    })

    it('defaults description to whatever was passed, including null', () => {
      const category = Category.create({ ...props, description: null })

      expect(category.description).toBeNull()
    })
  })

  describe('fromRepository()', () => {
    it('sets all provided props', () => {
      const repositoryProps = {
        id: 'fixed-id-123',
        userId: 'user-123',
        title: 'Groceries',
        description: null,
        icon: 'cart',
        color: '#FF00AA',
      }

      const category = Category.fromRepository(repositoryProps)

      expect(category.id).toBe(repositoryProps.id)
      expect(category.userId).toBe(repositoryProps.userId)
      expect(category.title).toBe(repositoryProps.title)
      expect(category.description).toBe(repositoryProps.description)
      expect(category.icon).toBe(repositoryProps.icon)
      expect(category.color).toBe(repositoryProps.color)
    })
  })

  describe('belongsTo()', () => {
    it('returns true for the owning userId', () => {
      const category = Category.create({ ...props, userId: 'owner-user' })

      expect(category.belongsTo('owner-user')).toBe(true)
    })

    it('returns false for a different userId', () => {
      const category = Category.create({ ...props, userId: 'owner-user' })

      expect(category.belongsTo('someone-else')).toBe(false)
    })
  })
})
