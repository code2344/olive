export async function registerServiceWorker(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, prompt user to refresh
              showUpdateAvailableNotification();
            }
          });
        }
      });
      
      console.log('✅ Service Worker registered');
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  }
}

function showUpdateAvailableNotification(): void {
  // Create a simple notification for app updates
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--color-accent);
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: var(--shadow-lg);
      z-index: 10000;
      max-width: 300px;
    ">
      <h4 style="margin: 0 0 8px 0;">Update Available</h4>
      <p style="margin: 0 0 12px 0; font-size: 14px;">
        A new version of Olive is ready to install.
      </p>
      <button onclick="window.location.reload()" style="
        background: white;
        color: var(--color-accent);
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        margin-right: 8px;
      ">
        Update Now
      </button>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: transparent;
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
      ">
        Later
      </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 10000);
}