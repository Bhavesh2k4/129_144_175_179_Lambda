import * as z from 'zod';

export const LoginSchema = z.object({
    email: z.string().email({
        message: "Please enter a valid email address"
    }).toLowerCase(),
    password: z.string().min(1,{message: "Please enter a Password"}),
});

export const RegisterSchema = z.object({
    email: z.string().email({
        message: "Please enter a valid email address"
    }).toLowerCase(),
    password: z.string().min(6,{message: "Minimum 6 characters required"}),
    name: z.string().min(1,{message: "Name is required"}),
});