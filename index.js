const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// ── Send push notification when a new job is dispatched to a driver ──
exports.sendJobNotification = functions.database
  .ref('/jobs/{driverUid}')
  .onCreate(async (snapshot, context) => {
    const job = snapshot.val();
    const driverUid = context.params.driverUid;

    if (!job || job.status !== 'pending') return null;

    // Get driver's FCM push token
    const tokenSnap = await admin.database()
      .ref(`drivers/${driverUid}/fcmToken`).get();
    const token = tokenSnap.val();

    if (!token) {
      console.log('No FCM token for driver:', driverUid);
      return null;
    }

    const pickup = job.pickup || '—';
    const fare = job.fare ? ' · $' + job.fare : '';

    const message = {
      token: token,
      notification: {
        title: '⚡ New Job',
        body: 'Pickup: ' + pickup + fare,
      },
      data: {
        type: 'new_job',
        driverUid: driverUid,
        phone: String(job.phone || ''),
        pickup: String(job.pickup || ''),
        fare: String(job.fare || ''),
        notes: String(job.notes || ''),
      },
      webpush: {
        notification: {
          icon: '/icon-driver.png',
          badge: '/icon-driver.png',
          vibrate: [300, 100, 300, 100, 300],
          requireInteraction: true,
          tag: 'new-job-' + driverUid,
        },
        fcmOptions: {
          link: 'https://driver.iziktaxi.com'
        }
      }
    };

    try {
      const response = await admin.messaging().send(message);
      console.log('Job notification sent:', response);
    } catch (err) {
      console.error('Error sending job notification:', err);
      // Token may be stale — remove it
      if (err.code === 'messaging/registration-token-not-registered') {
        await admin.database()
          .ref(`drivers/${driverUid}/fcmToken`).remove();
      }
    }

    return null;
  });

// ── Send push when a job is cancelled ──
exports.sendCancelNotification = functions.database
  .ref('/jobs/{driverUid}/status')
  .onUpdate(async (change, context) => {
    const newStatus = change.after.val();
    const driverUid = context.params.driverUid;

    if (newStatus !== 'cancelled' && newStatus !== 'reassigned') return null;

    const tokenSnap = await admin.database()
      .ref(`drivers/${driverUid}/fcmToken`).get();
    const token = tokenSnap.val();
    if (!token) return null;

    const title = newStatus === 'reassigned' ? '🔄 Job Reassigned' : '❌ Job Cancelled';
    const body = newStatus === 'reassigned'
      ? 'Your job was reassigned to another driver'
      : 'Your job was cancelled by dispatch';

    const message = {
      token: token,
      notification: { title, body },
      data: { type: newStatus },
      webpush: {
        notification: {
          icon: '/icon-driver.png',
          vibrate: [200, 100, 200],
          requireInteraction: false,
          tag: 'job-status-' + driverUid,
        },
        fcmOptions: { link: 'https://driver.iziktaxi.com' }
      }
    };

    try {
      await admin.messaging().send(message);
    } catch (err) {
      console.error('Error sending cancel notification:', err);
    }

    return null;
  });

// ── Send push for scheduled job assignment ──
exports.sendScheduledJobNotification = functions.database
  .ref('/upcoming_jobs/{driverUid}/{jobKey}')
  .onCreate(async (snapshot, context) => {
    const job = snapshot.val();
    const driverUid = context.params.driverUid;

    if (!job || job.status !== 'pending') return null;

    const tokenSnap = await admin.database()
      .ref(`drivers/${driverUid}/fcmToken`).get();
    const token = tokenSnap.val();
    if (!token) return null;

    const timeStr = job.time || '';
    const dateStr = job.date || '';
    const when = dateStr && timeStr ? dateStr + ' at ' + timeStr : 'Upcoming';

    const message = {
      token: token,
      notification: {
        title: '🕐 Scheduled Job',
        body: when + ' · ' + (job.pickup || '—'),
      },
      data: {
        type: 'scheduled_job',
        driverUid: driverUid,
        jobKey: context.params.jobKey,
      },
      webpush: {
        notification: {
          icon: '/icon-driver.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
          tag: 'scheduled-' + driverUid,
        },
        fcmOptions: { link: 'https://driver.iziktaxi.com' }
      }
    };

    try {
      await admin.messaging().send(message);
    } catch (err) {
      console.error('Error sending scheduled notification:', err);
    }

    return null;
  });
