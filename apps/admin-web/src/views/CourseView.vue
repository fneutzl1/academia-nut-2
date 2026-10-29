<script setup lang="ts">
import type { ChangeEntry, CourseDetail } from '@academia-nut/shared';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { adminApi, catalogApi } from '../api';

const props = defineProps<{ id: string }>();
const route = useRoute();
const router = useRouter();

const detail = ref<CourseDetail | null>(null);
const changes = ref<ChangeEntry[]>([]);
const changesError = ref('');
const error = ref('');
const selectedYear = ref(String(route.query.year ?? ''));

const selected = computed(
  () => detail.value?.versions.find((v) => v.year === selectedYear.value) ?? detail.value?.versions.at(-1),
);
const title = computed(() => {
  const latest = detail.value?.versions.at(-1)?.course;
  return latest ? `${latest.courseID} · ${latest.name}` : 'Course';
});

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');
const blank = (v: number | '') => (v === '' ? '—' : v);
const offered = (o: { autumn: number; spring: number; summer: number; od: number }) =>
  [o.autumn && 'Autumn', o.spring && 'Spring', o.summer && 'Summer', o.od && 'On demand'].filter(Boolean).join(', ') || '—';

async function load() {
  error.value = '';
  changesError.value = '';
  try {
    detail.value = await catalogApi.course(props.id);
  } catch (err) {
    error.value = (err as Error).message;
  }
  try {
    changes.value = await adminApi.courseChanges(props.id);
  } catch (err) {
    changesError.value = (err as Error).message;
  }
}

function pick(year: string) {
  selectedYear.value = year;
  router.replace({ query: { year } });
}

watch(() => props.id, load, { immediate: true });
</script>

<template>
  <section>
    <p><RouterLink :to="{ path: '/catalog', query: { year: selectedYear || undefined } }">← Catalog</RouterLink></p>
    <h1>{{ title }}</h1>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="detail">
      <p>
        <small>Internal id <code>{{ detail.courseId }}</code></small>
        <span v-for="i in detail.identifiers" :key="i.system + i.value" class="tag">{{ i.system }}: {{ i.value }}</span>
      </p>

      <h2>Catalog years</h2>
      <div class="years">
        <button
          v-for="v in detail.versions"
          :key="v.year"
          :class="{ active: v.year === selected?.year }"
          @click="pick(v.year)"
        >
          <strong>{{ v.year }}</strong>
          <small>{{ v.yearStatus === 'OPEN' ? 'open' : 'complete' }}</small>
          <small v-if="v.changedFromPrevious === null">first year</small>
          <small v-else-if="v.changedFromPrevious.length === 0">unchanged</small>
          <small v-else class="changed">{{ v.changedFromPrevious.length }} changed</small>
        </button>
      </div>

      <template v-if="selected">
        <p v-if="selected.changedFromPrevious?.length">
          <small>Changed from the previous year: {{ selected.changedFromPrevious.join(', ') }}</small>
        </p>
        <table class="fields">
          <tbody>
            <tr><th>Course</th><td>{{ selected.course.courseID }} ({{ selected.course.type }} {{ selected.course.code }})</td></tr>
            <tr><th>Name</th><td>{{ selected.course.name }}</td></tr>
            <tr><th>Description</th><td>{{ selected.course.description }}</td></tr>
            <tr><th>Credits</th><td>{{ selected.course.creditsMin }}<template v-if="selected.course.creditsMax !== ''"> – {{ selected.course.creditsMax }}</template></td></tr>
            <tr><th>Status</th><td>{{ selected.course.status }}</td></tr>
            <tr><th>Offered</th><td>{{ offered(selected.course.offered) }}</td></tr>
            <tr>
              <th>Prerequisites</th>
              <td>{{ selected.course.requisites.pre.map((r) => r.course).join(', ') || '—' }}</td>
            </tr>
            <tr>
              <th>Corequisites</th>
              <td>{{ selected.course.requisites.co.map((r) => r.course).join(', ') || '—' }}</td>
            </tr>
            <tr>
              <th>Fees</th>
              <td>dept {{ blank(selected.course.fees.deptFee) }} · tech {{ blank(selected.course.fees.techFee) }} · total {{ blank(selected.course.fees.totalFee) }}</td>
            </tr>
            <tr><th>Begin date</th><td>{{ selected.course.beginDate }}</td></tr>
            <tr>
              <th>Syllabus</th>
              <td>
                <template v-if="selected.course.syllabus?.attachments.length">
                  <div v-for="a in selected.course.syllabus.attachments" :key="a.id">
                    <a :href="a.downloadUrl" target="_blank" rel="noopener">{{ a.fileName }}</a>
                  </div>
                </template>
                <template v-else>—</template>
              </td>
            </tr>
            <tr>
              <th>Source</th>
              <td>
                <span class="tag">{{ selected.provenance.origin.toLowerCase() }}</span>
                {{ selected.provenance.sourceId }}
                <small>· updated {{ formatDate(selected.provenance.updatedAt) }}</small>
              </td>
            </tr>
          </tbody>
        </table>
        <details>
          <summary>Raw JSON ({{ selected.year }})</summary>
          <pre>{{ JSON.stringify(selected.course, null, 2) }}</pre>
        </details>
      </template>

      <h2>Change history</h2>
      <p v-if="changesError" class="error">{{ changesError }}</p>
      <p v-else-if="!changes.length"><small>No changes recorded.</small></p>
      <table v-else>
        <thead>
          <tr><th>When</th><th>Year</th><th>Action</th><th>Fields</th><th>By</th></tr>
        </thead>
        <tbody>
          <tr v-for="c in changes" :key="c.id">
            <td><small>{{ formatDate(c.createdAt) }}</small></td>
            <td>{{ c.year }}</td>
            <td><span class="tag">{{ c.action }}</span></td>
            <td>
              <template v-if="c.changedFields.length">
                <details>
                  <summary>{{ c.changedFields.join(', ') }}</summary>
                  <div class="diff">
                    <div v-for="f in c.changedFields" :key="f">
                      <strong>{{ f }}</strong>
                      <pre class="before">{{ JSON.stringify((c.before as Record<string, unknown> | null)?.[f], null, 2) }}</pre>
                      <pre class="after">{{ JSON.stringify((c.after as Record<string, unknown> | null)?.[f], null, 2) }}</pre>
                    </div>
                  </div>
                </details>
              </template>
              <small v-else>—</small>
            </td>
            <td><span class="tag">{{ c.origin.toLowerCase() }}</span> <small>{{ c.actor }}</small></td>
          </tr>
        </tbody>
      </table>
    </template>
  </section>
</template>

<style scoped>
h2 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; }
a { color: var(--accent); text-decoration: none; }
.tag { margin-left: 6px; }
.years { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.years button { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 110px; }
.years button.active { border-color: var(--accent); }
.changed { color: var(--warn); }
.fields th { width: 140px; color: var(--muted); font-weight: 500; }
.diff { display: grid; gap: 8px; margin-top: 6px; }
.diff pre { margin: 2px 0; max-height: 200px; }
.diff .before { border-left: 3px solid var(--bad); }
.diff .after { border-left: 3px solid var(--ok); }
</style>
