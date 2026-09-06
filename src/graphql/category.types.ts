import { Field, ID, InputType, Int, ObjectType } from 'type-graphql'
import {
  IsOptional,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator'
import type { Category, UpdateCategoryPatch } from '@/entities/category.entity'

@ObjectType()
export class CategoryType {
  @Field(() => ID)
  id!: string

  @Field()
  title!: string

  @Field(() => String, { nullable: true })
  description?: string | null

  @Field()
  icon!: string

  @Field()
  color!: string

  // Resolved via @FieldResolver on CategoryResolver (DataLoader), not a
  // plain mapped field.
  @Field(() => Int)
  transactionsQuantity!: number
}

export const toCategoryType = (category: Category): CategoryType => {
  const type = new CategoryType()
  type.id = category.id
  type.title = category.title
  type.description = category.description
  type.icon = category.icon
  type.color = category.color
  return type
}

@InputType()
export class CreateCategoryInput {
  @Field()
  @Length(1, 100, { message: 'validations.category_title_required' })
  title!: string

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(500, { message: 'validations.category_description_max' })
  description?: string | null

  @Field()
  @Length(1, 100, { message: 'validations.category_icon_required' })
  icon!: string

  @Field()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'validations.category_color_format',
  })
  color!: string
}

// title/icon/color back NOT NULL columns, so a field may be omitted (no
// change) but never explicitly nulled — ValidateIf only skips validation
// when the field is absent; @IsOptional() would also skip it on `null`.
@InputType()
export class UpdateCategoryInput {
  @Field({ nullable: true })
  @ValidateIf((input: UpdateCategoryInput) => input.title !== undefined)
  @Length(1, 100, { message: 'validations.category_title_required' })
  title?: string

  @Field(() => String, { nullable: true })
  @IsOptional()
  @MaxLength(500, { message: 'validations.category_description_max' })
  description?: string | null

  @Field({ nullable: true })
  @ValidateIf((input: UpdateCategoryInput) => input.icon !== undefined)
  @Length(1, 100, { message: 'validations.category_icon_required' })
  icon?: string

  @Field({ nullable: true })
  @ValidateIf((input: UpdateCategoryInput) => input.color !== undefined)
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'validations.category_color_format',
  })
  color?: string
}

export const toUpdateCategoryPatch = (
  input: UpdateCategoryInput,
): UpdateCategoryPatch => {
  const patch: UpdateCategoryPatch = {}
  if (input.title !== undefined) patch.title = input.title
  if (input.description !== undefined) patch.description = input.description
  if (input.icon !== undefined) patch.icon = input.icon
  if (input.color !== undefined) patch.color = input.color
  return patch
}

// Plain validateInput() DTO, not a bound GraphQL @ArgsType — every mutation
// takes `id` as a hand-rolled @Arg('id') and validates it through
// validateInput(CategoryIdArgs, ...) (buildSchema runs with
// `validate: false`; see src/schema/build-schema.ts), so no TypeGraphQL
// decorators belong here.
export class CategoryIdArgs {
  @IsUUID('all', { message: 'validations.category_id_invalid' })
  id!: string
}
