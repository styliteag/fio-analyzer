/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  type EmptyProps = Record<string, never>;
  type EmptyEmits = Record<string, never>;
  const component: DefineComponent<EmptyProps, EmptyEmits, unknown>;
  export default component;
}


