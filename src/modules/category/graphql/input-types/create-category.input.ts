import { Field, InputType } from 'type-graphql'
import { IsOptional, Length, Matches, MaxLength } from 'class-validator'

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
