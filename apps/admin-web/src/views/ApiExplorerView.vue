<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { adminApi } from '../api';

const PRESETS = [
  '/health',
  '/api/datasets',
  '/api/datasets/courses',
  '/api/courses/ASC-1190',
  '/api/datasets/departments',
  '/api/catalog/years',
  '/api/catalog/years/2025-2026/courses',
  '/api/catalog/years/2025-2026/courses/ASC-1190',
  '/api/catalog/years/2026-2027/departments',
];
const PREVIEW_CHARS = 200_000;

const baseUrl = ref('');
const path = ref('/api/datasets');
const status = ref('');
const body = ref('');
const loading = ref(false);

const fullUrl = computed(() => `${baseUrl.value.replace(/\/$/, '')}${path.value}`);

onMounted(async () => {
  // Empty in dev: the Vite proxy forwards /api to the local api app
  baseUrl.value = (await adminApi.config().catch(() => ({ publicApiUrl: '' }))).publicApiUrl;
});

async function send() {
  loading.value = true;
  const started = performance.now();
  try {
    const res = await fetch(fullUrl.value);
    const text = await res.text();
    const ms = Math.round(performance.now() - started);
    status.value = `${res.status} ${res.statusText} · ${ms} ms · ${(text.length / 1024).toFixed(1)} KB`;
    let pretty = text;
    try {
      pretty = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // not JSON — show as-is
    }
    body.value = pretty.length > PREVIEW_CHARS ? `${pretty.slice(0, PREVIEW_CHARS)}\n… truncated` : pretty;
  } catch (err) {
    status.value = `Request failed: ${(err as Error).message}`;
    body.value = '';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section>
    <h1>API explorer</h1>
    <p><small>Sends GET requests to the public data API{{ baseUrl ? ` at ${baseUrl}` : ' (local, via dev proxy)' }}.</small></p>

    <form class="row" @submit.prevent="send">
      <input v-model="path" class="grow" aria-label="Request path" />
      <button type="submit" :disabled="loading">{{ loading ? 'Sending…' : 'GET' }}</button>
    </form>
    <div class="presets">
      <button v-for="p in PRESETS" :key="p" class="link" @click="path = p; send()">{{ p }}</button>
    </div>

    <p v-if="status"><strong>{{ status }}</strong></p>
    <pre v-if="body">{{ body }}</pre>
  </section>
</template>
