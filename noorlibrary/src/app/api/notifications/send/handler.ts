// src/app/api/notifications/send/handler.ts
// Push Notification & In-App Broadcast Engine for Noor Library
// Dispatches native Expo Push Notifications to mobile lock screens and records in Firestore.

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, getAuthToken } from '../../../../lib/firebase-admin';

export async function GET(request: NextRequest) {
  // Return audience reach stats and recent broadcast history
  try {
    const token = getAuthToken(request);
    let isAuthorized = false;

    if (token) {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
        if (userDoc.exists && userDoc.data()?.role === 'admin') {
          isAuthorized = true;
        }
      } catch {
        // Token invalid
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized to view broadcast stats' }, { status: 401 });
    }

    // 1. Fetch push tokens
    const tokensSnap = await adminDb.collection('push_tokens').get();
    let totalTokens = tokensSnap.size;
    let androidCount = 0;
    let iosCount = 0;
    let webCount = 0;

    tokensSnap.docs.forEach((doc) => {
      const d = doc.data();
      const p = (d.platform || '').toLowerCase();
      if (p === 'android') androidCount++;
      else if (p === 'ios') iosCount++;
      else webCount++;
    });

    // 2. Fetch total registered users and prepare picker list
    const usersSnap = await adminDb.collection('users').get();
    const totalUsers = usersSnap.size;
    const usersList = usersSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          email: data.email || 'No email',
          displayName: data.displayName || data.name || data.email || d.id,
        };
      })
      .slice(0, 100);

    // Prune stale push tokens older than 90 days (B6 hygiene)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    tokensSnap.docs.forEach((doc) => {
      const d = doc.data();
      if (d.updatedAt && d.updatedAt < ninetyDaysAgo) {
        adminDb.collection('push_tokens').doc(doc.id).delete().catch(() => null);
      }
    });

    // 3. Fetch recent broadcast notifications
    const notifsSnap = await adminDb
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get()
      .catch(async () => {
        // Fallback without index
        return await adminDb.collection('notifications').get();
      });

    const recentBroadcasts: any[] = [];
    notifsSnap.docs.forEach((doc) => {
      const data = doc.data();
      recentBroadcasts.push({
        id: doc.id,
        ...data,
      });
    });

    // Sort descending by createdAt
    recentBroadcasts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({
      stats: {
        totalTokens,
        androidCount,
        iosCount,
        webCount,
        totalUsers,
      },
      usersList,
      recentBroadcasts: recentBroadcasts.slice(0, 15),
    });
  } catch (err: any) {
    console.error('Error fetching broadcast stats:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch broadcast stats' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const cronSecret = process.env.CRON_SECRET || 'noor-cron-secret-2026';

    let isAuthorized = false;
    let adminUid = 'admin';
    let adminName = 'Noor Admin';

    // Allow CRON_SECRET for automated triggers
    if (
      authHeader === `Bearer ${cronSecret}` ||
      request.headers.get('x-cron-secret') === cronSecret
    ) {
      isAuthorized = true;
    } else {
      const token = getAuthToken(request);
      if (token) {
        try {
          const decoded = await adminAuth.verifyIdToken(token);
          const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
          if (userDoc.exists && userDoc.data()?.role === 'admin') {
            isAuthorized = true;
            adminUid = decoded.uid;
            adminName = userDoc.data()?.displayName || 'Noor Admin';
          }
        } catch {
          // Token invalid
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized to broadcast notifications' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      message,
      body: bodyParam,
      targetType = 'all', // 'all' | 'creators' | 'societies' | 'specific'
      targetUid,
      deepLink,
      data = {},
      sendPush = true,
      saveInApp = true,
      testPushToken,
    } = body;

    const messageContent = message || bodyParam;
    if (!title || !messageContent) {
      return NextResponse.json({ error: 'Missing notification title or message' }, { status: 400 });
    }

    // Rate limit: Enforce at least 10 minutes between global announcement broadcasts
    if (targetType === 'all') {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      const recentGlobalSnap = await adminDb
        .collection('notifications')
        .where('audience', '==', 'all')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()
        .catch(async () => {
          // Fallback if composite index is pending
          return await adminDb
            .collection('notifications')
            .where('targetId', '==', 'global')
            .limit(1)
            .get();
        });

      if (recentGlobalSnap && !recentGlobalSnap.empty) {
        const lastCreated = recentGlobalSnap.docs[0].data()?.createdAt || 0;
        if (lastCreated > tenMinutesAgo) {
          const waitMins = Math.ceil((lastCreated + 10 * 60 * 1000 - Date.now()) / 60000);
          return NextResponse.json(
            { error: `Rate limited: A global announcement was sent recently. Please wait ${waitMins} minute(s) before broadcasting again.` },
            { status: 429 }
          );
        }
      }
    }

    // 1. Record in Firestore Notifications Collection (In-App Alert Center)
    let inAppDocId: string | null = null;
    if (saveInApp) {
      const notifRef = adminDb.collection('notifications').doc();
      inAppDocId = notifRef.id;

      const audienceVal = targetType === 'all' ? 'all' : targetType === 'specific' ? 'user' : targetType;
      const targetIdVal = targetType === 'specific' ? targetUid : targetType === 'all' ? 'global' : targetType;

      await notifRef.set({
        id: notifRef.id,
        senderId: adminUid,
        senderName: adminName,
        title: title.trim(),
        message: messageContent.trim(),
        body: messageContent.trim(),
        type: targetType === 'all' ? 'announcement' : targetType === 'specific' ? 'direct' : targetType,
        audience: audienceVal,
        targetId: targetIdVal,
        deepLink: deepLink || null,
        url: deepLink || data.url || null,
        data: {
          ...data,
          url: deepLink || data.url || null,
        },
        createdAt: Date.now(),
      });
    }

    // 2. Dispatch Native Expo Push Notifications
    let sentCount = 0;
    let targetTokens: string[] = [];

    if (sendPush) {
      const tokenSet = new Set<string>();

      if (testPushToken) {
        // Direct test push to a specific token
        if (testPushToken.startsWith('ExponentPushToken') || testPushToken.startsWith('ExpoPushToken')) {
          tokenSet.add(testPushToken);
        }
      } else if (targetType === 'specific' && targetUid) {
        // Targeted push to a specific user
        const userDoc = await adminDb.collection('users').doc(targetUid).get();
        if (userDoc.exists && userDoc.data()?.pushToken) {
          tokenSet.add(userDoc.data()!.pushToken);
        }

        // Also check push_tokens collection for tokens linked to this user
        const userTokensSnap = await adminDb
          .collection('push_tokens')
          .where('userId', '==', targetUid)
          .get()
          .catch(() => null);

        if (userTokensSnap) {
          userTokensSnap.docs.forEach((d) => {
            const t = d.data()?.token;
            if (t) tokenSet.add(t);
          });
        }
      } else if (targetType === 'creators' || targetType === 'societies') {
        const role = targetType === 'creators' ? 'creator' : 'society';
        const roleUsersSnap = await adminDb.collection('users').where('role', '==', role).get();
        const uids = roleUsersSnap.docs.map((d) => d.id);

        roleUsersSnap.docs.forEach((d) => {
          if (d.data()?.pushToken) tokenSet.add(d.data()!.pushToken);
        });

        const allTokensSnap = await adminDb.collection('push_tokens').get();
        allTokensSnap.docs.forEach((d) => {
          const tData = d.data();
          if (tData?.token && tData?.userId && uids.includes(tData.userId)) {
            tokenSet.add(tData.token);
          }
        });
      } else {
        // Global Broadcast to all registered devices
        const tokensSnap = await adminDb.collection('push_tokens').get();
        tokensSnap.docs.forEach((doc) => {
          const t = doc.data()?.token;
          if (t && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'))) {
            tokenSet.add(t);
          }
        });

        // Also harvest tokens stored directly in users collection
        const usersSnap = await adminDb.collection('users').get();
        usersSnap.docs.forEach((doc) => {
          const t = doc.data()?.pushToken;
          if (t && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'))) {
            tokenSet.add(t);
          }
        });
      }

      targetTokens = Array.from(tokenSet);

      if (targetTokens.length > 0) {
        // Prepare Expo Push Notification payloads (uses dedicated 'announcements' channel)
        const messages = targetTokens.map((to) => ({
          to,
          sound: 'default',
          title: title.trim(),
          body: messageContent.trim(),
          channelId: 'announcements',
          priority: 'high',
          data: {
            ...data,
            url: deepLink || null,
            notifId: inAppDocId,
            timestamp: Date.now(),
          },
        }));

        // Send to Expo Push Service in batches of 100
        const chunkSize = 100;
        for (let i = 0; i < messages.length; i += chunkSize) {
          const chunk = messages.slice(i, i + chunkSize);
          try {
            const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(chunk),
            });

            if (expoRes.ok) {
              const resJson = await expoRes.json();
              if (Array.isArray(resJson.data)) {
                resJson.data.forEach((ticket: any, idx: number) => {
                  const targetToken = chunk[idx]?.to;
                  if (ticket.status === 'ok') {
                    sentCount++;
                    // Record lastSeenAt on active token
                    if (targetToken) {
                      adminDb.collection('push_tokens').doc(targetToken).set({
                        lastSeenAt: Date.now(),
                        updatedAt: new Date().toISOString(),
                      }, { merge: true }).catch(() => null);
                    }
                  } else if (ticket.status === 'error') {
                    console.warn(`Expo ticket error for token ${targetToken}:`, ticket.message, ticket.details);
                    // B6: Delete dead tokens that return DeviceNotRegistered
                    if (ticket.details?.error === 'DeviceNotRegistered' && targetToken) {
                      console.log(`Pruning unregistered push token: ${targetToken}`);
                      adminDb.collection('push_tokens').doc(targetToken).delete().catch(() => null);
                    }
                  }
                });
              } else {
                sentCount += chunk.length;
              }
            } else {
              console.error('Expo push dispatch failed with HTTP', expoRes.status);
            }
          } catch (chunkErr) {
            console.error('Failed to dispatch chunk to Expo:', chunkErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      inAppDocId,
      inAppSaved: Boolean(inAppDocId),
      pushDispatched: sendPush,
      sentCount,
      totalDevicesFound: targetTokens.length,
      message: `Broadcast processed successfully. In-app: ${saveInApp ? 'yes' : 'no'}, Push sent to ${sentCount}/${targetTokens.length} devices.`,
    });
  } catch (err: any) {
    console.error('Error broadcasting notification:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
