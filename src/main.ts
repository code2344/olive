import './style.css';
import { OliveApp } from './core/OliveApp';
import { registerServiceWorker } from './utils/serviceWorker';

// Register service worker for PWA functionality
registerServiceWorker();

// Initialize the application
const app = new OliveApp();

// Hide loading screen once app is ready
app.onReady(() => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.opacity = '0';
    loadingScreen.style.transition = 'opacity 0.5s ease-out';
    setTimeout(() => {
      loadingScreen.remove();
    }, 500);
  }
});

// Start the application
app.start();