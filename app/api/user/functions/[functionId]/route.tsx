import { auth } from '@/auth'
import { db } from '@/lib/db'
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

const s3 = new S3Client({
  region: 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function DELETE(request: NextRequest) {
  try {
    // First authenticate the user - this is an async operation
    const session = await auth()
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get the function ID from the URL instead of context.params
    const url = request.url
    const urlParts = url.split('/')
    const functionId = urlParts[urlParts.length - 1]
    
    const user = await db.user.findUnique({
      where: { email: session.user.email },
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    const functionToDelete = await db.function.findFirst({
      where: {
        id: functionId,
        userId: user.id,
      },
    })
    
    if (!functionToDelete) {
      return NextResponse.json({ error: 'Function not found' }, { status: 404 })
    }
    
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: functionToDelete.s3Key,
    }))
    
    await db.function.delete({
      where: { id: functionId },
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting function:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}