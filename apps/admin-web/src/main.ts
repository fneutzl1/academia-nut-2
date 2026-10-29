import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import ApiExplorerView from './views/ApiExplorerView.vue';
import CatalogView from './views/CatalogView.vue';
import CourseView from './views/CourseView.vue';
import SourcesView from './views/SourcesView.vue';
import './style.css';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: SourcesView },
    { path: '/catalog', component: CatalogView },
    { path: '/catalog/courses/:id', component: CourseView, props: true },
    { path: '/api-explorer', component: ApiExplorerView },
  ],
});

createApp(App).use(router).mount('#app');
