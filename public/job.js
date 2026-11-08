const container = document.querySelector('#job-detail');

async function loadJob() {
  const jobId = new URLSearchParams(window.location.search).get('id');
  if (!jobId) {
    showError('موقعیت شغلی مشخص نشده است.');
    return;
  }

  try {
    const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'دریافت اطلاعات موقعیت شغلی ناموفق بود.');
    renderJob(data.job);
  } catch (error) {
    showError(error.message);
  }
}

function renderJob(job) {
  const card = document.createElement('article');
  card.className = 'job-page-card';

  const header = document.createElement('header');
  header.className = 'dialog-head';
  const eyebrow = document.createElement('div');
  eyebrow.className = 'eyebrow';
  eyebrow.innerHTML = '<span class="eyebrow-dot"></span> فرصت همکاری در CodeNest';
  const title = document.createElement('h1');
  title.textContent = job.title;
  document.title = `${job.title} | فرصت‌های شغلی CodeNest`;
  const description = document.createElement('p');
  description.textContent = job.description;
  const meta = document.createElement('div');
  meta.className = 'dialog-meta';
  for (const value of [job.department, job.location, job.type, job.experience, `حقوق ${job.salary}`]) {
    const tag = document.createElement('span');
    tag.textContent = value;
    meta.append(tag);
  }
  header.append(eyebrow, title, description, meta);

  const sections = [
    ['مسئولیت‌های این نقش', job.responsibilities],
    ['چه تجربه‌ای لازم داری؟', job.requirements],
    ['مزایای همکاری', job.benefits]
  ];
  card.append(header);
  for (const [heading, items] of sections) {
    const section = document.createElement('section');
    section.className = 'dialog-section';
    const sectionHeading = document.createElement('h2');
    sectionHeading.textContent = heading;
    const list = document.createElement('ul');
    for (const item of items) {
      const entry = document.createElement('li');
      entry.textContent = item;
      list.append(entry);
    }
    section.append(sectionHeading, list);
    card.append(section);
  }

  const apply = document.createElement('a');
  apply.className = 'button button-primary dialog-apply';
  apply.href = `/apply.html?jobId=${encodeURIComponent(job.id)}`;
  apply.textContent = 'ثبت درخواست برای این موقعیت';
  card.append(apply);
  container.replaceChildren(card);
}

function showError(message) {
  const error = document.createElement('div');
  error.className = 'page-error';
  error.textContent = message;
  container.replaceChildren(error);
}

loadJob();
