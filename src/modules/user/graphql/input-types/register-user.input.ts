import { Field, InputType } from 'type-graphql'
import { IsEmail, Length, Matches, MinLength } from 'class-validator'

@InputType()
export class RegisterUserInput {
  @Field()
  @IsEmail({}, { message: 'validations.email' })
  email!: string

  @Field()
  @Length(1, 255, { message: 'validations.name_required' })
  name!: string

  @Field()
  @MinLength(8, { message: 'validations.password_min' })
  @Matches(/[A-Z]/, { message: 'validations.password_uppercase' })
  @Matches(/[0-9]/, { message: 'validations.password_number' })
  password!: string
}
