const content = document.querySelector('#application-content');
const toast = document.querySelector('#toast');
const jobId = new URLSearchParams(window.location.search).get('jobId');
let job;
let toastTimer;

async function loadApplicationForm() {
  if (!jobId) {
    showError('موقعیت شغلی مشخص نشده است.');
    return;
  }

  try {
    const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'دریافت اطلاعات موقعیت شغلی ناموفق بود.');
    job = data.job;
    document.querySelector('#job-back-link').href = `/job.html?id=${encodeURIComponent(job.id)}`;
    document.title = `ثبت درخواست ${job.title} | CodeNest`;
    renderForm();
  } catch (error) {
    showError(error.message);
  }
}

function renderForm() {
  content.innerHTML = `
    <form class="application-form" enctype="multipart/form-data">
      <h1>فرم درخواست همکاری</h1>
      <p>برای موقعیت «${escapeHtml(job.title)}» اطلاعاتت را وارد کن.</p>
      <div class="form-grid">
        <label class="form-field">نام و نام خانوادگی *
          <input name="fullName" required maxlength="120" autocomplete="name" placeholder="مثلاً سارا محمدی">
        </label>
        <label class="form-field">ایمیل *
          <input name="email" type="email" required maxlength="254" autocomplete="email" placeholder="name@example.com">
        </label>
        <label class="form-field">شماره تماس *
          <input name="phone" type="tel" required maxlength="40" autocomplete="tel" placeholder="۰۹۱۲۱۲۳۴۵۶۷">
        </label>
        <label class="form-field">لینک LinkedIn
          <input name="linkedin" type="url" maxlength="500" placeholder="https://linkedin.com/in/...">
        </label>
        <label class="form-field wide">رزومه * <span class="file-help">PDF متنی یا اسکن‌شده · حداکثر ۱ مگابایت و ۳ صفحه (پلن رایگان OCR.space)</span>
          <input name="resume" type="file" accept=".pdf,application/pdf" required>
        </label>
        <label class="form-field wide">چند خط درباره خودت
          <textarea name="coverLetter" maxlength="2000" placeholder="چه چیزی تو را برای این موقعیت مشتاق کرده؟"></textarea>
        </label>
      </div>
      <label class="consent"><input name="consent" type="checkbox" required><span>با ذخیره و بررسی اطلاعات و ارسال رزومه به سرویس‌های OCR و هوش مصنوعی برای ارزیابی درخواست استخدام موافقم.</span></label>
      <button class="button button-primary submit-button" type="submit">ارسال درخواست <span aria-hidden="true">←</span></button>
    </form>
  `;
  content.querySelector('form').addEventListener('submit', submitApplication);
}

async function submitApplication(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'در حال ارسال...';

  const formData = new FormData(form);
  formData.set('jobId', job.id);
  formData.set('consent', form.elements.consent.checked ? 'true' : 'false');
  try {
    const response = await fetch('/api/applications', { method: 'POST', body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'ثبت درخواست انجام نشد.');
    content.innerHTML = `
      <div class="success-state">
        <span class="success-icon" aria-hidden="true">✓</span>
        <h1>درخواستت ثبت شد!</h1>
        <p>ممنون که به CodeNest علاقه‌مند شدی. تیم ما درخواستت را بررسی می‌کند.</p>
        <a class="button button-primary" href="/">بازگشت به فرصت‌های شغلی</a>
      </div>
    `;
  } catch (error) {
    showToast(error.message, true);
    button.disabled = false;
    button.innerHTML = 'ارسال درخواست <span aria-hidden="true">←</span>';
  }
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3800);
}

function showError(message) {
  const error = document.createElement('div');
  error.className = 'page-error';
  error.textContent = message;
  content.replaceChildren(error);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

loadApplicationForm();
