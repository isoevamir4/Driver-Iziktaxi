// firebase-messaging-sw.js
// Handles background push notifications when driver app is closed/backgrounded

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDyfq2Cmj9LmMpY3FIJ8TuLHiQ7PYBQTys",
  authDomain: "izik-taxi-service.firebaseapp.com",
  databaseURL: "https://izik-taxi-service-default-rtdb.firebaseio.com",
  projectId: "izik-taxi-service",
  storageBucket: "izik-taxi-service.firebasestorage.app",
  messagingSenderId: "835965697791",
  appId: "1:835965697791:web:fa2830a4b400c0803656ca"
});

const messaging = firebase.messaging();

// Background message handler — fires when app is not in foreground
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Background message received:', payload);

  const type = payload.data && payload.data.type;
  const notifTitle = payload.notification
    ? payload.notification.title
    : (type === 'new_job' ? '⚡ New Job' : type === 'scheduled_job' ? '🕐 Scheduled Job' : '📲 Izik Taxi');
  const notifBody = payload.notification
    ? payload.notification.body
    : 'Open the app to view';

  // Play sound by sending message to all open windows
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(function(clients) {
    clients.forEach(function(client) {
      client.postMessage({ type: 'PUSH_RECEIVED', data: payload.data });
    });
  });

  return self.registration.showNotification(notifTitle, {
    body: notifBody,
    icon: '/icon-driver.png',
    badge: '/icon-driver.png',
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: type === 'new_job' || type === 'scheduled_job',
    tag: 'izik-' + (type || 'msg'),
    data: payload.data,
    actions: [
      { action: 'open', title: 'Open App' }
    ]
  });
});

// Notification click — open/focus the driver app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = 'https://driver.iziktaxi.com';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.includes('driver.iziktaxi.com') && 'focus' in clients[i]) {
          return clients[i].focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
