const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const multer = require('multer');

const app = express();
const port = Number(process.env.PORT) || 3000;
const root = __dirname;
const dataDirectory = path.join(root, 'data');
const uploadDirectory = path.join(root, 'uploads');
const applicationsFile = path.join(dataDirectory, 'applications.json');
const jobsFile = path.join(dataDirectory, 'jobs.json');
const allowedResumeTypes = new Set(['application/pdf']);
const allowedResumeExtensions = new Set(['.pdf']);
let jobs = [];
let applications = [];
let writeQueue = Promise.resolve();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => {
      callback(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
    }
  }),
  limits: { fileSize: 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedResumeTypes.has(file.mimetype) || !allowedResumeExtensions.has(extension)) {
      callback(new Error('برای تحلیل خودکار، رزومه را فقط با فرمت PDF بارگذاری کنید.'));
      return;
    }
    callback(null, true);
  }
});

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(root, 'public')));

function requireN8nApiToken(req, res, next) {
  const token = process.env.N8N_API_TOKEN;
  if (!token) {
    res.status(503).json({ error: 'API دریافت درخواست‌ها هنوز پیکربندی نشده است.' });
    return;
  }
  const expected = Buffer.from('Bearer ' + token);
  const actual = Buffer.from(req.get('authorization') || '');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    res.status(401).json({ error: 'دسترسی به API درخواست‌ها مجاز نیست.' });
    return;
  }
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/jobs', (req, res) => {
  const search = String(req.query.search || '').trim().toLocaleLowerCase('fa');
  const department = String(req.query.department || '').trim();
  const results = jobs.filter((job) => {
    const matchesSearch = !search || [job.title, job.department, job.summary]
      .some((value) => value.toLocaleLowerCase('fa').includes(search));
    return matchesSearch && (!department || department === 'همه' || job.department === department);
  });
  res.json({ jobs: results, total: results.length });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.find((item) => item.id === req.params.id);
  if (!job) {
    res.status(404).json({ error: 'موقعیت شغلی موردنظر پیدا نشد.' });
    return;
  }
  res.json({ job });
});

app.get('/api/applications', requireN8nApiToken, (req, res) => {
  const status = String(req.query.status || 'pending');
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 100);
  const results = applications
    .filter((application) => status === 'all'
      || (status === 'pending'
        ? application.processingStatus !== 'processed'
        : application.processingStatus === status))
    .slice(0, limit)
    .map(({ id, jobId, jobTitle, fullName, email, phone, coverLetter, createdAt, processingStatus, resume }) => ({
      id,
      jobId,
      jobTitle,
      fullName,
      email,
      phone,
      coverLetter,
      createdAt,
      processingStatus,
      resume: resume ? { originalName: resume.originalName, mimeType: resume.mimeType, size: resume.size } : null,
      resumeUrl: `/api/applications/${encodeURIComponent(id)}/resume`
    }));
  res.json({ applications: results, total: results.length });
});

app.get('/api/applications/:id/resume', requireN8nApiToken, (req, res, next) => {
  const application = applications.find((item) => item.id === req.params.id);
  if (!application?.resume?.filename) {
    res.status(404).json({ error: 'فایل رزومه این درخواست پیدا نشد.' });
    return;
  }
  res.type('application/pdf').sendFile(application.resume.filename, { root: uploadDirectory }, (error) => {
    if (error && !res.headersSent) next(error);
  });
});

app.post('/api/applications/:id/processed', requireN8nApiToken, async (req, res, next) => {
  try {
    const application = applications.find((item) => item.id === req.params.id);
    if (!application) {
      res.status(404).json({ error: 'درخواست استخدام موردنظر پیدا نشد.' });
      return;
    }

    const score = Number(req.body.score);
    const comment = String(req.body.comment || '');
    if (!Number.isFinite(score) || score < 1 || score > 10 || comment.length > 200) {
      res.status(400).json({ error: 'امتیاز باید بین ۱ تا ۱۰ و نظر حداکثر ۲۰۰ نویسه باشد.' });
      return;
    }

    application.processingStatus = 'processed';
    application.processedAt = new Date().toISOString();
    application.aiEvaluation = { score, comment };
    const pendingWrite = writeQueue.then(() => fs.writeFile(
      applicationsFile,
      `${JSON.stringify(applications, null, 2)}\n`,
      'utf8'
    ));
    writeQueue = pendingWrite.catch((error) => {
      console.error('Could not persist application processing status:', error);
    });
    await pendingWrite;
    res.json({ status: 'processed', applicationId: application.id });
  } catch (error) {
    next(error);
  }
});

app.post('/api/applications', upload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'بارگذاری فایل رزومه الزامی است.' });
      return;
    }

    const { jobId, fullName, email, phone, linkedin, coverLetter, consent } = req.body;
    const job = jobs.find((item) => item.id === jobId);
    if (!job) {
      await fs.unlink(req.file.path);
      res.status(400).json({ error: 'موقعیت شغلی انتخاب‌شده معتبر نیست.' });
      return;
    }
    if (!fullName?.trim() || !email?.trim() || !phone?.trim() || consent !== 'true') {
      await fs.unlink(req.file.path);
      res.status(400).json({ error: 'نام، ایمیل، شماره تماس و تأیید حریم خصوصی الزامی هستند.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      await fs.unlink(req.file.path);
      res.status(400).json({ error: 'لطفاً یک ایمیل معتبر وارد کنید.' });
      return;
    }
    if (fullName.trim().length > 120 || email.trim().length > 254 || phone.trim().length > 40) {
      await fs.unlink(req.file.path);
      res.status(400).json({ error: 'طول یکی از فیلدهای فرم بیش از حد مجاز است.' });
      return;
    }

    const application = {
      id: crypto.randomUUID(),
      jobId: job.id,
      jobTitle: job.title,
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      linkedin: String(linkedin || '').trim(),
      coverLetter: String(coverLetter || '').trim().slice(0, 2000),
      resume: {
        filename: path.basename(req.file.filename),
        originalName: path.basename(req.file.originalname),
        mimeType: req.file.mimetype,
        size: req.file.size
      },
      processingStatus: 'pending',
      createdAt: new Date().toISOString()
    };

    applications.push(application);
    const pendingWrite = writeQueue.then(() => fs.writeFile(
      applicationsFile,
      `${JSON.stringify(applications, null, 2)}\n`,
      'utf8'
    ));
    writeQueue = pendingWrite.catch((error) => {
      console.error('Could not persist application records:', error);
    });
    await pendingWrite;

    res.status(201).json({
      message: 'درخواست شما با موفقیت ثبت شد.',
      applicationId: application.id,
      processingStatus: application.processingStatus
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'در پلن رایگان OCR.space، حجم رزومه PDF نباید بیشتر از ۱ مگابایت باشد.'
      : 'بارگذاری فایل رزومه با خطا روبه‌رو شد.';
    res.status(400).json({ error: message });
    return;
  }
  if (error.message === 'برای تحلیل خودکار، رزومه را فقط با فرمت PDF بارگذاری کنید.') {
    res.status(400).json({ error: error.message });
    return;
  }
  console.error('Request failed:', error);
  res.status(500).json({ error: 'خطای داخلی سرور. لطفاً کمی بعد دوباره تلاش کنید.' });
});

async function start() {
  await fs.mkdir(dataDirectory, { recursive: true });
  await fs.mkdir(uploadDirectory, { recursive: true });
  jobs = JSON.parse(await fs.readFile(jobsFile, 'utf8'));
  try {
    applications = JSON.parse(await fs.readFile(applicationsFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    applications = [];
    await fs.writeFile(applicationsFile, '[]\n', 'utf8');
  }
  app.listen(port, () => {
    console.log(`CodeNest careers is running at http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error('Could not start CodeNest careers:', error);
  process.exitCode = 1;
});
