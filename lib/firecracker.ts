import { NodeSSH } from "node-ssh";
import { createTempFile, runScript } from "./server-utils";
import path from "path";

interface SSHConfig {
    host: string;
    username: string;
    privateKeyPath: string;
}

interface ExecutionParams {
    functionCode: Buffer<ArrayBufferLike>;
    runtime: string;
    handler: string;
    sshConfig: SSHConfig;
    eventData?: any; 
}

export async function executeCodeViaSSH(params: ExecutionParams) {
    const { functionCode, runtime, handler, sshConfig, eventData = {} } = params;
    const ssh = new NodeSSH();

    const fileExtension = runtime === 'python' ? 'py' : 'js';
    const filename = `${handler.split('.')[0]}.${fileExtension}`;
    const { filePath, cleanup } = createTempFile(`${Date.now()}_${filename}`, functionCode);
    
    try {
        await ssh.connect(sshConfig);
        console.log("SSH connection established.");
    
        await ssh.execCommand(`mkdir -p ${process.env.FIRECRACKER_VM_CODE_MOUNT_POINT}`);
        await ssh.putFile(filePath, path.posix.join(process.env.FIRECRACKER_VM_CODE_MOUNT_POINT!, filename));

        let agentCommand: string;

        // TODO
        if (runtime === 'python') {
            agentCommand = `python3 /usr/local/bin/execution-agent.py ${handler}`;
        // } else if (runtime === 'nodejs') {
            //  agentCommand = `node /usr/local/bin/execution-agent.js ${handler}`;
        } else {
            throw new Error(`Unsupported runtime for execution agent: ${runtime}`);
        }

        const result = await ssh.execCommand(agentCommand, {
            stdin: JSON.stringify(eventData),
        });

        if (result.code !== 0 && !result.stdout) {
            const executionError = new Error('Function execution failed inside VM.');
            (executionError as any).details = {
                stderr: result.stderr || "No stderr output from agent.",
                stdout: result.stdout,
                exitCode: result.code
            };
            throw executionError;
        }

        try {
            if (!result.stdout.trim()) {
                console.log("Agent produced empty stdout. Returning null.");
                return {};
            }
            return JSON.parse(result.stdout);
        } catch (parseError) {
            console.error("Failed to parse JSON result from agent stdout:", parseError);
             const parsingError = new Error('Failed to parse function execution result from agent.');
             (parsingError as any).details = {
                rawOutput: result.stdout,
                agentStderr: result.stderr,
             };
             throw parsingError;
        }
    }  catch (error: any) {
        console.error("Error during SSH execution:", error);
        if (error.code === 'ECONNREFUSED' || error.message?.includes('Timed out while waiting for handshake')) {
            const connectionError = new Error('Failed to connect to execution environment (SSH Connection Refused/Timeout)');
            (connectionError as any).originalError = error;
            throw connectionError;
        }
        
        if (error.message.startsWith('Function execution failed') || error.message.startsWith('Failed to parse') || error.message.startsWith('Unsupported runtime')) {
            throw error;
        }

        const genericSshError = new Error(`An unexpected SSH error occurred: ${error.message}`);
        (genericSshError as any).originalError = error;
        throw genericSshError;

    } finally {
        if (ssh.isConnected()) {
            console.log("Disconnecting SSH session.");
            ssh.dispose();
        }

        cleanup()
    }
}

export async function setupFirecrackerVm(runtime: string) {
    try {
        await runScript('setup-VM.sh', [runtime]);
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
    } catch (setupError: any) {
        console.error("Failed to setup Firecracker VM:", setupError);
    }
}

export async function shutdownFirecrackerVm() {
    try {
        console.log("shutdown-VM.sh completed.");
    } catch (shutdownError: any) {
        console.error("Error during VM shutdown:", shutdownError);
    }
}