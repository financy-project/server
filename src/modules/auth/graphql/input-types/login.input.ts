import 'reflect-metadata'
import { Field, InputType } from 'type-graphql'
import { IsEmail, IsNotEmpty, IsString } from 'class-validator'

@InputType()
export class LoginInput {
  @Field()
  @IsEmail({}, { message: 'validations.email' })
  email!: string

  @Field()
  @IsString()
  @IsNotEmpty({ message: 'validations.password_required' })
  password!: string
}
