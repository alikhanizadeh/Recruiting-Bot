# CodeNest Careers

وب‌سایت فارسی فرصت‌های شغلی به همراه API بک‌اند برای فهرست موقعیت‌ها و ثبت درخواست استخدام. سایت با Node.js اجرا می‌شود و به فریم‌ورک فرانت‌اند یا پایگاه داده خارجی نیاز ندارد.

## اجرا

```powershell
npm.cmd install
npm.cmd start
```

سایت در `http://localhost:3000` در دسترس است. برای توسعه با راه‌اندازی مجدد خودکار:

```powershell
npm.cmd run dev
```

## API

- `GET /api/jobs` — فهرست کامل موقعیت‌های شغلی؛ قابل فیلتر با `search` و `department`.
- `GET /api/jobs/:id` — جزئیات کامل یک موقعیت.
- `POST /api/applications` — ثبت درخواست به‌صورت `multipart/form-data`. فیلدهای لازم: `jobId`، `fullName`، `email`، `phone`، `consent=true` و فایل `resume`. برای سازگاری با پلن رایگان OCR.space فایل PDF تا ۱ مگابایت و ۳ صفحه پذیرفته می‌شود؛ OCR.space متن PDFهای اسکن‌شده را نیز استخراج می‌کند.
- `GET /api/applications?status=pending&limit=10` — دریافت درخواست‌های تحلیل‌نشده برای n8n.
- `GET /api/applications/:id/resume` — دریافت PDF رزومه یک درخواست.
- `POST /api/applications/:id/processed` — ثبت نتیجه تحلیل و تغییر وضعیت درخواست به پردازش‌شده.
- `GET /api/health` — بررسی سلامت سرویس.

اطلاعات موقعیت‌ها در `data/jobs.json` نگهداری می‌شود. درخواست‌ها و فایل‌های رزومه پس از ثبت به‌ترتیب در `data/applications.json` و `uploads/` ذخیره می‌شوند. هر درخواست `jobId` و `jobTitle` موقعیت انتخاب‌شده را نگه می‌دارد. فایل رزومه از مسیر عمومی سایت قابل دریافت نیست. APIهای درخواست‌ها فقط با هدر `Authorization: Bearer <N8N_API_TOKEN>` قابل استفاده‌اند.

## اتصال به n8n

برای بررسی خودکار درخواست‌ها، workflow موجود را import کنید، credentialهای Gmail/Groq/Google Sheets/Telegram را تنظیم و workflow را فعال کنید. متغیر `N8N_API_TOKEN` را در سرور تنظیم کنید و در n8n یک Credential نوع Header Auth با نام هدر `Authorization` و مقدار `Bearer <همان توکن>` بسازید. Workflow هر دقیقه `GET /api/applications?status=pending` را می‌خواند، PDF را از API دریافت می‌کند و پس از ذخیره نتیجه، درخواست را به‌عنوان پردازش‌شده علامت می‌زند. URLهای `Fetch Pending Applications` و `Download Application Resume` باید از محیط n8n به سرور دسترسی داشته باشند؛ به‌صورت پیش‌فرض از `http://host.docker.internal:3000` استفاده می‌کنند.

برای Gmail، فقط وقتی پیوست PDF وجود داشته باشد OCR اجرا می‌شود؛ بدون PDF، متن ایمیل برای تحلیل استفاده می‌شود. در نود `OCR Resume with OCR.space` یک Credential نوع Header Auth بسازید و نام header را `apikey` و مقدار آن را API Key حساب OCR.space قرار دهید. OCR.space برای پلن رایگان محدودیت ۱ مگابایت و ۳ صفحه دارد؛ پلن‌های تجاری endpoint مخصوص به خود دارند و باید URL نود OCR را مطابق endpoint دریافتی تغییر دهید. رزومه‌ها برای OCR.space و متن استخراج‌شده برای Groq ارسال می‌شوند.

### همگام‌سازی موقعیت‌های شغلی با PostgreSQL

Workflow از `GET /api/jobs` هر ۱۵ دقیقه فهرست کامل مشاغل را می‌خواند و با `INSERT ... ON CONFLICT` در جدول `public.codenest_jobs` درج یا به‌روزرسانی می‌کند. هنگام تحلیل درخواست وب‌سایت، workflow از `jobId` ذخیره‌شده در درخواست، همان ردیف شغل را از PostgreSQL می‌خواند و شرح، نیازمندی‌ها و جزئیات آن را برای Groq می‌فرستد. بنابراین ابتدا نود `Create Jobs Table Once` را دستی اجرا کنید و همگام‌سازی مشاغل را یک‌بار انجام دهید. پس از import، Credentialهای نوع PostgreSQL و Header Auth را روی نودهای مربوطه تنظیم کنید. URL نود `Fetch Jobs API` باید از **خود محیط n8n** قابل دسترسی باشد. مقدار پیش‌فرض `http://host.docker.internal:3000/api/jobs` برای Docker Desktop روی Windows است؛ اگر n8n جای دیگری اجرا می‌شود، از URL شبکه‌ای/عمومی سایت استفاده کنید، نه `localhost`. سپس workflow را فعال کنید یا نود `Run Jobs Sync Now` را دستی اجرا کنید. ساخت جدول به مجوز `CREATE` در schema عمومی PostgreSQL نیاز دارد. ستون `job_data` نیز نسخه کامل پاسخ هر شغل را به‌صورت JSONB نگه می‌دارد.

برای ثبت عنوان و شناسه شغل کنار امتیاز متقاضی در Google Sheets، سرستون‌های `jobId` و `jobTitle` را به Sheet اضافه کنید.

در استقرار واقعی از HTTPS و فضای ذخیره‌سازی دائمی و پشتیبان‌گیری‌شده برای `data/` و `uploads/` استفاده کنید.
