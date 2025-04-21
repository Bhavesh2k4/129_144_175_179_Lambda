# Serverless Function Execution Platform

A serverless compute platform that allows users to upload, manage and execute functions on-demand with no infrastructure management required. This project provides a complete solution from authentication to function execution using both Docker containers and Nanos unikernels.

<p float="left" align="center">
  <img src="https://github.com/user-attachments/assets/009148d2-0fe7-4fc4-9fb2-adb9f90eb83b" width="45%" alt="Dashboard"/>
  <img src="https://github.com/user-attachments/assets/73b78c34-e41c-4457-aedc-df80493f0d99" width="45%" alt="Upload Function"/>
</p>

<p float="left" align="center">
  <b>📊 Dashboard</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <b>📤 Upload Function</b>
</p>

<br>

<p float="left" align="center">
  <img src="https://github.com/user-attachments/assets/9b0aa71b-ab0c-4db1-b289-7a377a058f80" width="45%" alt="View All Functions"/>
  <img src="https://github.com/user-attachments/assets/ef4e63e4-4983-4c19-8257-9d1f9986aaf4" width="45%" alt="S3 Integration"/>
</p>

<p float="left" align="center">
  <b>📁 View All Functions</b> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <b>☁️ S3 Integration</b>
</p>






## Features

- **Secure Authentication System**
  - Email/Password registration with email verification
  - OAuth login via Google and GitHub
  - Password reset functionality with email notifications
  - Session management using NextAuth

- **Function Management**
  - Upload code in Python or JavaScript
  - Function metadata stored in PostgreSQL
  - Function code stored in AWS S3
  - Custom memory and timeout configurations

- **Execution Engines**
  - Docker-based execution environment
  - Nanos unikernel lightweight virtualization
  - HTTP-based function invocation with parameter passing
  - Output and error capture with execution metrics

- **User Interface**
  - Clean, responsive dashboard
  - Function management portal
  - Performance metrics

## Architecture

```mermaid
graph TD
    A[Client Browser] --> B[Next.js Frontend]
    B <--> C[NextAuth Authentication]
    C <--> D[Database - PostgreSQL]
    B <--> E[API Layer]
    E <--> F[AWS S3 Storage]
    E <--> G[Docker Execution Engine]
    E <--> H[Nanos Unikernel Engine]
    D <--> I[Function Metadata]
    F <--> J[Function Code]
    G <--> K[Execution Results]
    H <--> K
    K --> B
    
    subgraph Authentication
        C
    end
    
    subgraph Data Storage
        D
        F
        I
        J
    end
    
    subgraph Execution Engines
        G
        H
        K
    end
```

## Installation Requirements

- Node.js 18+
- PostgreSQL
- Docker
- Nanos/Ops
- AWS S3 Account
- Resend API for transactional emails

## Setup Instructions

### 1. Clone the repository and install dependencies

```bash
git clone https://github.com/yourusername/cloudless-compute.git
cd cloudless-compute
npm install
```

### 2. Configure environment variables
To create a .env.local file
```bash
npx auth secret
```

Create a `.env` file with the following variables:

```
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/cloudless"

NEXT_PUBLIC_BASE_URL="http://localhost:3000"

# OAuth Providers
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Email
RESEND_API_KEY="your-resend-api-key"
EMAIL_FROM="no-reply@yourdomain.com"

# AWS S3
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_REGION="ap-south-1"
AWS_S3_BUCKET="cc-project-lambda"
```

### 3. Setup PostgreSQL Database

```bash
npx prisma generate
# Initialize the database schema
npx prisma db push
```

### 4. Docker Setup

Ensure Docker is installed and running on your system:

```bash
# Install Docker (Ubuntu)
sudo apt-get update
sudo apt-get install docker.io
sudo systemctl enable --now docker

# Verify installation
docker --version

# Allow current user to run Docker without sudo (recommended)
sudo usermod -aG docker $USER
newgrp docker
```

### 5. Nanos Unikernel Setup

Install Ops, the command-line tool for managing Nanos unikernels:

```bash
# Install Ops (Linux)
curl -sSL https://ops.city/get.sh | bash

# Verify installation
ops version

ops update
```

### 6. AWS S3 Bucket Setup

1. Login to AWS Management Console
2. Navigate to S3 service
3. Create a new bucket
4. Configure bucket settings:
   - Set region to `your closest region`
   - Block all public access > off
   - Enable versioning (optional)
   - Create a new Bucket policy

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowUserFullObjectAccess",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::381492234419:user/cc-project-lambda"
            },
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::cc-project-lambda/*"
        }
    ]
}
```
5. Create a new user - Add to Group AmazonS3FullAccess
6. Generate access key and secret access key

### 7. Start the development server

```bash
npm run dev
```

## Usage

### Authentication

1. Register a new account at `/register` with email and password, or use OAuth
2. Verify your email address by clicking the link sent to your inbox
3. Login at `/login` with your credentials

### Managing Functions

1. Navigate to `/user/functions` to see your existing functions
2. Create a new function at `/user/new`
3. Upload your code (Python or JavaScript)
4. Set function parameters (memory, timeout, etc.)

### Executing Functions

Functions can be executed via HTTP requests:

```
GET /api/function/{userId}/{handler}/docker?param1=value1&param2=value2
GET /api/function/{userId}/{handler}/nanos?param1=value1&param2=value2
```

#### Example:

```
GET /api/function/user123/calc.calculator/docker?a=5&b=10
```

### Benchmark Tool

The project includes a benchmark script to compare execution performance between Docker and Nanos engines:

```bash
# Install required Python packages
pip install requests matplotlib

# Run a simple benchmark (assuming you have already uploaded calc.py from Example_code : handler = calc.calculator)
python3 benchmark.py
```

The benchmark script:
1. Sends multiple requests to both Docker and Nanos endpoints
2. Measures execution time and success rate
3. Generates comparison charts
4. Provides performance analysis

Example calculator function for benchmarking:

```python
# Calculator example (calc.py)
import sys

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python calc.py <a> <b>")
        sys.exit(1)
    
    a = int(sys.argv[1])
    b = int(sys.argv[2])
    result = a + b
    print(f"Result: {a} + {b} = {result}")
```

## Project Structure

```
└── bhavesh2k4-129_144_175_179_lambda/
    ├── actions/                 # Server actions for auth/forms
    ├── app/                     # Frontend pages and API routes
    │   ├── (auth)/              # Authentication pages
    │   ├── (protected)/         # Authenticated user pages
    │   └── api/                 # API endpoints
    ├── components/              # UI components
    │   ├── auth/                # Authentication UI
    │   └── ui/                  # General UI components (ShadCN)
    ├── lib/                     # Utility functions
    ├── prisma/                  # Database schema
    └── Example_Code/            # Sample functions
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
