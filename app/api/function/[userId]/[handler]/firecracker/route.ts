import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { streamToBuffer } from "@/lib/server-utils";
import { executeCodeViaSSH, setupFirecrackerVm, 
    shutdownFirecrackerVm } from "@/lib/firecracker";
import path from "path";
import fs from "fs/promises"

const s3 = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function fetchFunctionCode(userId: string, handler: string) {
  const dbFunction = await db.function.findFirst({
    where: {
      userId: userId,
      handler: handler,
    },
  });

  if (!dbFunction) {
    throw new Error("FunctionNotFound");
  }

  const s3Key = dbFunction.s3Key;
  const getObjectCommand = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: s3Key,
  });

  const s3Response = await s3.send(getObjectCommand);

  if (!(s3Response.Body instanceof Readable)) {
    throw new Error("InvalidS3Body");
  }

  const buffer = await streamToBuffer(s3Response.Body);

  // const filePath = path.join(process.cwd(), 'tmp', '1744171306600_main.py'); // test 
  // const buffer = await fs.readFile(filePath);

  return { buffer, runtime: dbFunction.runtime };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string; handler: string;} }
) {
  let vmStarted = false;

  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, handler } = await params;

    let functionData;
    try {
      functionData = await fetchFunctionCode(userId, handler);
    } catch (err: any) {
        if (err.message === "FunctionNotFound") {
            return NextResponse.json({ error: "Function not found" }, { status: 404 });
        }
        if (err.message === "InvalidS3Body") {
            return NextResponse.json({ error: "Invalid S3 response" }, { status: 500 });
        }
        return NextResponse.json({ error: "Internal error while fetching code" }, { status: 500 });
    }

    const { buffer, runtime } = functionData;

    let result;

    try {
      await setupFirecrackerVm(runtime);
      vmStarted = true;

      const executionParams = {
        functionCode: buffer,
        runtime,
        handler,
        sshConfig: {
          host: process.env.FIRECRACKER_VM_SSH_HOST!,
          username: process.env.FIRECRACKER_VM_SSH_USER!,
          privateKeyPath: process.env.FIRECRACKER_SSH_PRIVATE_KEY_PATH!
        },
        eventData: {}, // TODO 
      };
      console.log(executionParams)
      result = await executeCodeViaSSH(executionParams);
    } catch (err: any) {
      console.error(`Firecracker execution failed: ${err.message}`);
      if (err.message.includes("connect to execution environment")) {
        return NextResponse.json({ error: "Failed to connect to execution environment", 
          details: err.message }, { status: 503 }); // Service Unavailable
      }
      return NextResponse.json({ error: "Error during function execution",
          details: err.message }, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error", details: error.message || 
        "Unknown error"}, { status: 500 } );
  } finally {
    if (vmStarted) {
      await shutdownFirecrackerVm();
    }
  }
}
