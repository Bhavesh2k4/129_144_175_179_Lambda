import { auth } from '@/auth'
import { db } from '@/lib/db';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

const s3 = new S3Client({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  
  const file = formData.get('functionFile') as File
  const buffer = Buffer.from(await file.arrayBuffer())
  const name = formData.get('name')?.toString().toLowerCase()!
  const description = formData.get('description')?.toString() || ''
  const runtime = formData.get('runtime')?.toString().toLowerCase()!
  const handler = formData.get('handler')?.toString().toLowerCase()!
  const timeout = parseInt(formData.get('timeout')?.toString() || '30')
  const memory = parseInt(formData.get('memory')?.toString() || '128')

  const user = await db.user.findUnique({
    where: { email: session.user.email },
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const s3Key = `user_${user.id}/${name}`

  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: s3Key,
    Body: buffer,
  }))

  try {
    await db.function.create({
      data: {
        name,
        description,
        runtime,
        handler,
        timeout,
        memory,
        s3Key,
        userId: user.id,
      },
    })
  } catch (err: any) {
    if (err.code === 'P2002') {
      return NextResponse.json({ error: 'Function already exists' }, { status: 400 })
    }
    console.error(err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }  

  return NextResponse.json({ success: true })
}
