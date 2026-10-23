import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App.tsx';
import { Splash } from './ui/Splash.tsx';
import './styles.css';

// Service Worker кэширует оболочку приложения для работы без сети.
// Браузеры регистрируют его только на HTTPS или localhost.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Splash />
  </StrictMode>,
);
