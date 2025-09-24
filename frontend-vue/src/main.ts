import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import './styles.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia).use(router);

// Enable Vue DevTools in development
if (import.meta.env.DEV) {
  // Enable dev tools overlay/panel
  app.config.devtools = true;

  // Add global properties for dev tools
  app.config.globalProperties.$log = console.log;
}

app.mount('#app');


