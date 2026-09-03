import { Field, InputType } from 'type-graphql'
import {
  IsOptional,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator'

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
