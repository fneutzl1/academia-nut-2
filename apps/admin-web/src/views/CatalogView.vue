<script setup lang="ts">
import type { CatalogYearSummary, CourseListItem, DepartmentListItem } from '@academia-nut/shared';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { catalogApi } from '../api';

const MAX_ROWS = 300;

const route = useRoute();
const router = useRouter();

const years = ref<CatalogYearSummary[]>([]);
const year = ref(String(route.query.year ?? ''));
const tab = ref<'courses' | 'departments'>(route.query.tab === 'departments' ? 'departments' : 'courses');
const search = ref(String(route.query.q ?? ''));
const subject = ref('');
const courses = ref<CourseListItem[]>([]);
const departments = ref<DepartmentListItem[]>([]);
const loading = ref(false);
const error = ref('');

const currentYear = computed(() => years.value.find((y) => y.code === year.value));
const subjects = computed(() => [...new Set(courses.value.map((c) => c.subject))].sort());

const filteredCourses = computed(() => {
  const q = search.value.trim().toLowerCase();
  return courses.value.filter(
    (c) =>
      (!subject.value || c.subject === subject.value) &&
      (!q || c.courseCode.toLowerCase().includes(q) || c.courseCode.replace('-', '').toLowerCase().includes(q) || c.name.toLowerCase().includes(q)),
  );
});

const filteredDepartments = computed(() => {
  const q = search.value.trim().toLowerCase();
  return departments.value.filter((d) => !q || d.name.toLowerCase().includes(q) || (d.code ?? '').toLowerCase().includes(q));
});

const credits = (c: CourseListItem) => (c.creditsMax === null || c.creditsMax === c.creditsMin ? `${c.creditsMin}` : `${c.creditsMin}–${c.creditsMax}`);
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '');

async function loadYears() {
  try {
    years.value = await catalogApi.years();
    if (!years.value.some((y) => y.code === year.value)) year.value = years.value[0]?.code ?? '';
  } catch (err) {
    error.value = (err as Error).message;
  }
}

async function loadYear() {
  if (!year.value) return;
  loading.value = true;
  error.value = '';
  try {
    [courses.value, departments.value] = await Promise.all([catalogApi.courses(year.value), catalogApi.departments(year.value)]);
    if (subject.value && !subjects.value.includes(subject.value)) subject.value = '';
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    loading.value = false;
  }
}

watch(year, loadYear);
// Keep year / tab / search in the URL so a view can be shared or reloaded
watch([year, tab, search], () => {
  router.replace({ query: { year: year.value || undefined, tab: tab.value, q: search.value || undefined } });
});

onMounted(async () => {
  await loadYears();
  await loadYear();
});
</script>

<template>
  <section>
    <div class="row">
      <h1>Catalog</h1>
      <small>Read from the public API (<code>/api/catalog</code>)</small>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="toolbar">
      <label>
        Catalog year
        <select v-model="year">
          <option v-for="y in years" :key="y.code" :value="y.code">
            {{ y.code }} · {{ y.status === 'OPEN' ? 'open' : 'complete' }}
          </option>
        </select>
      </label>
      <div class="tabs" role="tablist">
        <button :class="{ active: tab === 'courses' }" role="tab" @click="tab = 'courses'">
          Courses <small v-if="currentYear">{{ currentYear.courseCount }}</small>
        </button>
        <button :class="{ active: tab === 'departments' }" role="tab" @click="tab = 'departments'">
          Departments <small v-if="currentYear">{{ currentYear.departmentCount }}</small>
        </button>
      </div>
      <select v-if="tab === 'courses'" v-model="subject" aria-label="Subject">
        <option value="">All subjects</option>
        <option v-for="s in subjects" :key="s" :value="s">{{ s }}</option>
      </select>
      <input v-model="search" class="grow" type="search" :placeholder="tab === 'courses' ? 'Search code or name' : 'Search departments'" />
    </div>

    <p v-if="currentYear">
      <span :class="['state', currentYear.status === 'OPEN' ? 'running' : 'succeeded']">{{ currentYear.status }}</span>
      <small v-if="currentYear.completedAt"> · completed {{ formatDate(currentYear.completedAt) }} by {{ currentYear.completedBy }}</small>
      <small v-else> · pulls write to this year</small>
      <small v-if="loading"> · loading…</small>
    </p>

    <template v-if="tab === 'courses'">
      <table>
        <thead>
          <tr><th>Course</th><th>Name</th><th>Credits</th><th>Status</th><th>Source</th></tr>
        </thead>
        <tbody>
          <tr v-for="c in filteredCourses.slice(0, MAX_ROWS)" :key="c.courseId">
            <td>
              <RouterLink :to="{ path: `/catalog/courses/${c.courseId}`, query: { year } }"><strong>{{ c.courseCode }}</strong></RouterLink>
            </td>
            <td>{{ c.name }}</td>
            <td>{{ credits(c) }}</td>
            <td>{{ c.status }}</td>
            <td><span class="tag">{{ c.origin.toLowerCase() }}</span> <small>{{ formatDate(c.updatedAt) }}</small></td>
          </tr>
        </tbody>
      </table>
      <p><small>
        {{ filteredCourses.length }} of {{ courses.length }} courses<template v-if="filteredCourses.length > MAX_ROWS">, showing the first {{ MAX_ROWS }}. Search or pick a subject to narrow it down</template>.
      </small></p>
    </template>

    <template v-else>
      <table>
        <thead>
          <tr><th>Department</th><th>Code</th><th>Programs</th><th>Sub-departments</th><th>Source</th></tr>
        </thead>
        <tbody>
          <tr v-for="d in filteredDepartments" :key="d.departmentId">
            <td>
              <a v-if="d.link" :href="d.link" target="_blank" rel="noopener"><strong>{{ d.name }}</strong></a>
              <strong v-else>{{ d.name }}</strong>
              <div><small>{{ d.airtableId }}</small></div>
            </td>
            <td>{{ d.code }}</td>
            <td>{{ d.programCount }}</td>
            <td>{{ d.subDepartments.length || '' }}</td>
            <td><span class="tag">{{ d.origin.toLowerCase() }}</span> <small>{{ formatDate(d.updatedAt) }}</small></td>
          </tr>
        </tbody>
      </table>
      <p><small>{{ filteredDepartments.length }} of {{ departments.length }} departments.</small></p>
    </template>
  </section>
</template>

<style scoped>
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
.toolbar label { display: flex; gap: 6px; align-items: center; }
.tabs { display: flex; gap: 4px; }
.tabs button.active { border-color: var(--accent); color: var(--accent); font-weight: 600; }
a { color: var(--accent); text-decoration: none; }
</style>
