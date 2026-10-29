<script setup lang="ts">
import { ref } from 'vue';
import { saveToken, token } from './api';

const draft = ref(token.value);
</script>

<template>
  <header class="topbar">
    <strong>Academia Nut Admin</strong>
    <nav>
      <RouterLink to="/">Sources</RouterLink>
      <RouterLink to="/catalog">Catalog</RouterLink>
      <RouterLink to="/api-explorer">API Explorer</RouterLink>
    </nav>
    <form class="token" @submit.prevent="saveToken(draft)">
      <input v-model="draft" type="password" placeholder="Admin token" aria-label="Admin token" />
      <button type="submit">Save</button>
    </form>
  </header>
  <main>
    <RouterView />
  </main>
</template>
