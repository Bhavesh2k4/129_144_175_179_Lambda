"use server"
import * as z from 'zod';
import { RegisterSchema } from "@/schema";
import bcrypt from "bcryptjs";
import { db } from '@/lib/db';
import { getUserByEmail } from '@/data/user';
export const register = async (values:z.infer<typeof RegisterSchema>) => {
  console.log(values)
  const validatedValues = RegisterSchema.safeParse(values)
  if (!validatedValues.success) {
    return {
        error:"Invalid Credentials",
    };
  }
  const {email, password, name} = validatedValues.data;
  const hashedPassword = await bcrypt.hash(password, 10);
  const existingUser= await getUserByEmail(email)
  if (existingUser) {
    return {
        error:"User already exists",
    };
  }
  await db.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name,
    },
  })

  //send verification token email

  return {
    success: "Email Sent Successfully",
  }

}