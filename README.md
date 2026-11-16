# CodeNest Careers

A Persian-language job board with a backend API for listing positions and submitting job applications. The site runs on Node.js and does not require a frontend framework or an external database.

### 🌐 Multi-Language Support

[English](README.md) | [فارسی](README.fa.md)

## Run

```powershell
npm.cmd install
npm.cmd start
```

The site is available at `http://localhost:3000`. To run it in development mode with automatic restarts:

```powershell
npm.cmd run dev
```

## API

- `GET /api/jobs` — List all job positions; can be filtered with `search` and `department`.
- `GET /api/jobs/:id` — Get the details of a job position.
- `POST /api/applications` — Submit an application as `multipart/form-data`. Required fields: `jobId`, `fullName`, `email`, `phone`, `consent=true`, and the `resume` file. For compatibility with the OCR.space free plan, PDF files up to 1 MB and 3 pages are accepted; OCR.space also extracts text from scanned PDFs.
- `GET /api/applications?status=pending&limit=10` — Get unprocessed applications for n8n.
- `GET /api/applications/:id/resume` — Download an application's resume PDF.
- `POST /api/applications/:id/processed` — Save the analysis result and mark the application as processed.
- `GET /api/health` — Check the service health.

Job data is stored in `data/jobs.json`. Submitted applications and resume files are stored in `data/applications.json` and `uploads/`, respectively. Each application retains the `jobId` and `jobTitle` of the selected position. Resume files are not accessible through the site's public paths. Application API endpoints require the `Authorization: Bearer <N8N_API_TOKEN>` header.

## Connect to n8n

To automatically review applications, import the existing workflow, configure the Gmail/Groq/Google Sheets/Telegram credentials, and activate the workflow. Set `N8N_API_TOKEN` on the server, then create an n8n Header Auth credential with the header name `Authorization` and the value `Bearer <the same token>`. Every minute, the workflow fetches `GET /api/applications?status=pending`, downloads each PDF through the API, and marks the application as processed after saving the result. The URLs for `Fetch Pending Applications` and `Download Application Resume` must be reachable from the n8n environment; by default, they use `http://host.docker.internal:3000`.

For Gmail, OCR runs only when a PDF attachment is present; without a PDF, the email text is used for analysis. Create a Header Auth credential for the `OCR Resume with OCR.space` node, using `apikey` as the header name and your OCR.space account API key as its value. OCR.space's free plan is limited to 1 MB and 3 pages. Commercial plans have their own endpoints, so update the OCR node URL to match the endpoint provided to you. Resumes are sent to OCR.space, and the extracted text is sent to Groq.

### Sync job positions with PostgreSQL

Every 15 minutes, the workflow fetches the complete job list from `GET /api/jobs` and inserts or updates rows in the `public.codenest_jobs` table using `INSERT ... ON CONFLICT`. When analyzing a website application, the workflow uses the application's stored `jobId` to fetch the corresponding job row from PostgreSQL, then sends its description, requirements, and details to Groq. First, run the `Create Jobs Table Once` node manually and perform the job sync once. After importing the workflow, configure the PostgreSQL and Header Auth credentials on the relevant nodes. The URL in the `Fetch Jobs API` node must be reachable **from the n8n environment itself**. The default `http://host.docker.internal:3000/api/jobs` works with Docker Desktop on Windows; if n8n runs elsewhere, use a network-accessible or public site URL, not `localhost`. Then activate the workflow or run the `Run Jobs Sync Now` node manually. Creating the table requires `CREATE` permission in the PostgreSQL `public` schema. The `job_data` column also stores the complete response for each job as JSONB.

To include the job title and ID alongside the applicant's score in Google Sheets, add the `jobId` and `jobTitle` column headers to the sheet.

For production deployments, use HTTPS and persistent, backed-up storage for `data/` and `uploads/`.
