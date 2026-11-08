const jobGrid = document.querySelector('#job-grid');
const searchInput = document.querySelector('#job-search');
const departmentFilter = document.querySelector('#department-filter');
const countElement = document.querySelector('#jobs-count');
const emptyState = document.querySelector('#empty-state');
const toast = document.querySelector('#toast');

let jobs = [];
let toastTimer;
const jobIcons = ['⌘', '✳', '◈', '⌬', '∑', '✓', '{}', '▣', '◉', '◇'];

async function loadJobs() {
  try {
    const response = await fetch('/api/jobs');
    if (!response.ok) throw new Error('دریافت موقعیت‌های شغلی با خطا روبه‌رو شد.');
    const data = await response.json();
    jobs = data.jobs;
    const departments = [...new Set(jobs.map((job) => job.department))];
    for (const department of departments) {
      const option = document.createElement('option');
      option.value = department;
      option.textContent = department;
      departmentFilter.append(option);
    }
    renderJobs();
  } catch (error) {
    showToast(error.message, true);
    emptyState.hidden = false;
  }
}

function renderJobs() {
  const search = searchInput.value.trim().toLocaleLowerCase('fa');
  const department = departmentFilter.value;
  const filtered = jobs.filter((job) => {
    const searchable = `${job.title} ${job.department} ${job.summary}`.toLocaleLowerCase('fa');
    return (!search || searchable.includes(search)) && (department === 'همه' || job.department === department);
  });
  jobGrid.replaceChildren(...filtered.map((job) => createJobCard(job)));
  emptyState.hidden = filtered.length !== 0;
  countElement.textContent = `${toPersianNumber(filtered.length)} موقعیت فعال`;
}

function createJobCard(job) {
  const index = jobs.indexOf(job);
  const card = document.createElement('article');
  card.className = 'job-card';

  const top = document.createElement('div');
  top.className = 'card-top';
  const icon = document.createElement('span');
  icon.className = `job-icon ${['', 'green', 'orange', 'blue'][index % 4]}`;
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = jobIcons[index % jobIcons.length];
  const titleWrap = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = job.title;
  const department = document.createElement('span');
  department.className = 'job-department';
  department.textContent = job.department;
  titleWrap.append(title, department);
  top.append(icon, titleWrap);

  const summary = document.createElement('p');
  summary.className = 'job-summary';
  summary.textContent = job.summary;

  const bottom = document.createElement('div');
  bottom.className = 'card-bottom';
  const meta = document.createElement('div');
  meta.className = 'job-meta';
  meta.innerHTML = `<span>◷ ${escapeHtml(job.type)}</span><span>⌖ ${escapeHtml(job.location.split('·')[0].trim())}</span>`;
  const details = document.createElement('a');
  details.className = 'details-link';
  details.href = `/job.html?id=${encodeURIComponent(job.id)}`;
  details.innerHTML = 'مشاهده جزئیات <span aria-hidden="true">←</span>';
  bottom.append(meta, details);
  card.append(top, summary, bottom);
  return card;
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3800);
}

function toPersianNumber(value) {
  return new Intl.NumberFormat('fa-IR').format(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

searchInput.addEventListener('input', renderJobs);
departmentFilter.addEventListener('change', renderJobs);
loadJobs();
