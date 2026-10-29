<script setup lang="ts">
import type { DatasetMeta, RunStatus, SourceInfo } from '@academia-nut/shared';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { adminApi, token } from '../api';

const POLL_MS = 1500;

const sources = ref<SourceInfo[]>([]);
const datasets = ref<Record<string, DatasetMeta>>({});
const error = ref('');
const timers = new Map<string, ReturnType<typeof setInterval>>();

async function load() {
  error.value = '';
  try {
    const [srcs, metas] = await Promise.all([adminApi.sources(), adminApi.datasets()]);
    sources.value = srcs;
    datasets.value = Object.fromEntries(metas.map((m) => [m.name, m]));
    srcs.filter((s) => s.lastRun?.state === 'running').forEach((s) => poll(s.lastRun!));
  } catch (err) {
    error.value = (err as Error).message;
  }
}

function setRun(run: RunStatus) {
  const source = sources.value.find((s) => s.id === run.sourceId);
  if (source) source.lastRun = run;
}

function poll(run: RunStatus) {
  if (timers.has(run.sourceId)) return;
  timers.set(run.sourceId, setInterval(async () => {
    const latest = await adminApi.getRun(run.id).catch(() => run);
    setRun(latest);
    if (latest.state !== 'running') {
      clearInterval(timers.get(run.sourceId));
      timers.delete(run.sourceId);
      load();
    }
  }, POLL_MS));
}

async function start(source: SourceInfo) {
  try {
    const run = await adminApi.run(source.id);
    setRun(run);
    poll(run);
  } catch (err) {
    error.value = (err as Error).message;
  }
}

const formatDate = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '—');

onMounted(load);
onUnmounted(() => timers.forEach(clearInterval));
watch(token, load);
</script>

<template>
  <section>
    <div class="row">
      <h1>Data sources</h1>
      <button @click="load">Refresh</button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <table v-if="sources.length">
      <thead>
        <tr>
          <th>Source</th>
          <th>Dataset</th>
          <th>Last updated</th>
          <th>Last run</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in sources" :key="s.id">
          <td>
            <div><strong>{{ s.id }}</strong> <span class="tag">{{ s.service }}</span></div>
            <small>{{ s.description }}</small>
          </td>
          <td>
            {{ s.dataset }}
            <small v-if="datasets[s.dataset]">({{ datasets[s.dataset]!.rowCount }} rows)</small>
          </td>
          <td>{{ formatDate(datasets[s.dataset]?.updatedAt) }}</td>
          <td>
            <template v-if="s.lastRun">
              <span :class="['state', s.lastRun.state]">{{ s.lastRun.state }}</span>
              <div><small>{{ s.lastRun.message }}</small></div>
              <details v-if="s.lastRun.warnings.length">
                <summary>{{ s.lastRun.warnings.length }} warnings</summary>
                <ul><li v-for="w in s.lastRun.warnings" :key="w">{{ w }}</li></ul>
              </details>
            </template>
            <small v-else>never (since server start)</small>
          </td>
          <td>
            <button :disabled="s.lastRun?.state === 'running'" @click="start(s)">Run pull</button>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
