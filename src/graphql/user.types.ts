import { Field, ID, InputType, ObjectType } from 'type-graphql'
import { IsEmail, Length, Matches, MinLength } from 'class-validator'
import type { User } from '@/entities/user.entity'

@ObjectType()
export class UserType {
  @Field(() => ID)
  id!: string

  @Field()
  email!: string

  @Field()
  name!: string
}

export const toUserType = (user: User): UserType => {
  const type = new UserType()
  type.id = user.id
  type.email = user.email
  type.name = user.name
  return type
}

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
