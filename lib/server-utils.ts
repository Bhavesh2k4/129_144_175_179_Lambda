import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import { exec as callbackExec } from 'child_process';
import util from 'util';

const exec = util.promisify(callbackExec);

// Make sure the Node.js user has passwordless sudo for necessary commands
export async function runScript(scriptName: string, args: string[] = []) {
  const scriptDir = path.resolve(process.cwd(), 'firecracker', 'scripts');
  const scriptPath = path.join(scriptDir, scriptName);
  const command = `sudo bash ${scriptPath} ${args.join(' ')}`;
  try {
    const { stdout, stderr } = await exec(command, { cwd: scriptDir });

    if (stdout.trim()) console.log(`${scriptName} stdout:\n${stdout}`);
    if (stderr.trim()) console.log(`${scriptName} stderr:\n${stderr}`);

    return { stdout, stderr };
  } catch (error: any) {
    throw new Error(`Failed to run ${scriptName}: ${error.message}\nStderr: ${error.stderr || 'N/A'}`);
  }
}

export function createTempFile(filename: string, data: Buffer): { filePath: string; cleanup: () => void } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'my-app-temp-')); // Use a unique prefix
  const filePath = path.join(tempDir, filename);
  fs.writeFileSync(filePath, data);

  const cleanup = () => {
    try {
      fs.unlinkSync(filePath);
      fs.rmdirSync(tempDir);
    } catch (err) {
      console.error(`Error cleaning up temp file ${filePath} in dir ${tempDir}:`, err);
    }
  };

  return { filePath, cleanup };
}

export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}
