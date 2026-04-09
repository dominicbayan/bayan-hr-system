const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const cron = require("node-cron");
const ZKLib = require("zkteco-js");
const admin = require("firebase-admin");

const ROOT_DIR = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT_DIR, ".env.local");

loadEnvFile(ENV_FILE);

const DEVICE_IP =
  process.env.ZKTECO_DEVICE_IP ||
  process.env.envZKTECO_DEVICE_IP ||
  "192.168.100.119";
const DEVICE_PORT = Number.parseInt(process.env.ZKTECO_DEVICE_PORT || "4370", 10);
const DEVICE_TIMEOUT = Number.parseInt(
  process.env.ZKTECO_DEVICE_TIMEOUT || "10000",
  10,
);

const DEVICE_ID = "zkteco_f18";
const SYNC_STATE_COLLECTION = "integrationSyncState";
const DEVICE_STATUS_COLLECTION = "deviceStatus";
const ALERTS_COLLECTION = "systemAlerts";
const ATTENDANCE_COLLECTION = "attendanceLogs";
const OFFLINE_ALERT_ID = `${DEVICE_ID}_offline`;
const CRON_EXPRESSION = "*/5 * * * *";

const firebaseApp = initializeFirebaseAdmin();
const db = admin.firestore(firebaseApp);
const device = new ZKLib(DEVICE_IP, DEVICE_PORT, DEVICE_TIMEOUT, DEVICE_TIMEOUT);

let isSyncRunning = false;
let scheduledTask = null;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = stripWrappingQuotes(rawValue);
    }
  }
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  const options = {};
  if (projectId) {
    options.projectId = projectId;
  }

  if (serviceAccountJson) {
    options.credential = admin.credential.cert(JSON.parse(serviceAccountJson));
  } else {
    options.credential = admin.credential.applicationDefault();
  }

  return admin.initializeApp(options);
}

function timestampedMessage(message) {
  return `[${new Date().toISOString()}] ${message}`;
}

function log(message, extra) {
  if (typeof extra === "undefined") {
    console.log(timestampedMessage(message));
    return;
  }

  console.log(timestampedMessage(message), extra);
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sanitizeValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry)]),
    );
  }

  return value ?? null;
}

function normalizeLog(record) {
  const attendanceDate = normalizeDate(
    record.attTime ||
      record.timestamp ||
      record.recordTime ||
      record.time ||
      record.punchTime,
  );

  const employeeCode = String(
    record.userId ||
      record.userid ||
      record.uid ||
      record.deviceUserId ||
      record.pin ||
      "",
  ).trim();

  if (!attendanceDate || !employeeCode) {
    return null;
  }

  return {
    employeeCode,
    attendanceAt: attendanceDate.toISOString(),
    punchState:
      record.status != null
        ? String(record.status)
        : record.state != null
          ? String(record.state)
          : record.punch != null
            ? String(record.punch)
            : "unknown",
    verification:
      record.verifyMode != null
        ? String(record.verifyMode)
        : record.verified != null
          ? String(record.verified)
          : null,
    raw: sanitizeValue(record),
  };
}

function makeAttendanceDocumentId(record) {
  return crypto
    .createHash("sha1")
    .update(
      [
        DEVICE_ID,
        record.employeeCode,
        record.attendanceAt,
        record.punchState,
      ].join("|"),
    )
    .digest("hex");
}

async function getSyncState() {
  const ref = db.collection(SYNC_STATE_COLLECTION).doc(DEVICE_ID);
  const snapshot = await ref.get();
  return {
    ref,
    data: snapshot.exists ? snapshot.data() : null,
  };
}

async function writeOfflineAlert(errorMessage) {
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.collection(DEVICE_STATUS_COLLECTION).doc(DEVICE_ID).set(
    {
      deviceId: DEVICE_ID,
      deviceIp: DEVICE_IP,
      port: DEVICE_PORT,
      timeout: DEVICE_TIMEOUT,
      status: "offline",
      lastError: errorMessage,
      updatedAt: now,
      lastSeenAt: now,
    },
    { merge: true },
  );

  await db.collection(ALERTS_COLLECTION).doc(OFFLINE_ALERT_ID).set(
    {
      active: true,
      type: "device_offline",
      severity: "high",
      source: DEVICE_ID,
      title: "Device Offline",
      message: `Unable to connect to ZKTeco F18 at ${DEVICE_IP}:${DEVICE_PORT}`,
      deviceIp: DEVICE_IP,
      updatedAt: now,
      triggeredAt: now,
      error: errorMessage,
    },
    { merge: true },
  );
}

async function clearOfflineAlert(lastAttendanceAt) {
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.collection(DEVICE_STATUS_COLLECTION).doc(DEVICE_ID).set(
    {
      deviceId: DEVICE_ID,
      deviceIp: DEVICE_IP,
      port: DEVICE_PORT,
      timeout: DEVICE_TIMEOUT,
      status: "online",
      lastError: admin.firestore.FieldValue.delete(),
      updatedAt: now,
      lastSeenAt: now,
      lastSuccessfulSyncAt: now,
      lastAttendanceAt: lastAttendanceAt || null,
    },
    { merge: true },
  );

  await db.collection(ALERTS_COLLECTION).doc(OFFLINE_ALERT_ID).set(
    {
      active: false,
      resolvedAt: now,
      updatedAt: now,
      source: DEVICE_ID,
      type: "device_offline",
      message: `Connection restored for ZKTeco F18 at ${DEVICE_IP}:${DEVICE_PORT}`,
    },
    { merge: true },
  );
}

async function saveAttendanceRecords(records, lastAttendanceAt, totalSeen, previousState) {
  let batch = db.batch();
  let operationCount = 0;

  for (const record of records) {
    const docRef = db
      .collection(ATTENDANCE_COLLECTION)
      .doc(makeAttendanceDocumentId(record));

    batch.set(
      docRef,
      {
        source: DEVICE_ID,
        deviceIp: DEVICE_IP,
        employeeCode: record.employeeCode,
        attendanceAt: record.attendanceAt,
        punchState: record.punchState,
        verification: record.verification,
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        raw: record.raw,
      },
      { merge: true },
    );

    operationCount += 1;
    if (operationCount === 400) {
      await batch.commit();
      batch = db.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  await db.collection(SYNC_STATE_COLLECTION).doc(DEVICE_ID).set(
    {
      source: DEVICE_ID,
      deviceIp: DEVICE_IP,
      port: DEVICE_PORT,
      timeout: DEVICE_TIMEOUT,
      lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAttendanceAt: lastAttendanceAt || previousState?.lastAttendanceAt || null,
      lastRecordCountSeen: totalSeen,
      lastSyncedCount: records.length,
      status: "success",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function getAttendanceArray(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  if (Array.isArray(result?.attendances)) {
    return result.attendances;
  }

  return [];
}

async function syncAttendance() {
  if (isSyncRunning) {
    log("Sync skipped because a previous run is still in progress.");
    return;
  }

  isSyncRunning = true;
  const { data: previousState } = await getSyncState();
  const lastAttendanceAt = previousState?.lastAttendanceAt || null;

  try {
    log(`Connecting to ZKTeco F18 at ${DEVICE_IP}:${DEVICE_PORT}...`);
    await device.createSocket();

    const rawLogs = await device.getAttendances();
    const normalizedLogs = getAttendanceArray(rawLogs)
      .map((record) => normalizeLog(record))
      .filter(Boolean)
      .sort((left, right) => left.attendanceAt.localeCompare(right.attendanceAt));

    const newRecords = normalizedLogs.filter(
      (record) => !lastAttendanceAt || record.attendanceAt > lastAttendanceAt,
    );

    const newestAttendanceAt =
      normalizedLogs.length > 0
        ? normalizedLogs[normalizedLogs.length - 1].attendanceAt
        : lastAttendanceAt;

    await saveAttendanceRecords(
      newRecords,
      newestAttendanceAt,
      normalizedLogs.length,
      previousState,
    );
    await clearOfflineAlert(newestAttendanceAt);

    log(
      `Sync complete. ${newRecords.length} new attendance records pushed to Firestore.`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown ZKTeco sync error.";
    await writeOfflineAlert(message);
    await db.collection(SYNC_STATE_COLLECTION).doc(DEVICE_ID).set(
      {
        source: DEVICE_ID,
        status: "error",
        error: message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSyncAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    log("Sync failed. Device will retry automatically on the next schedule.", message);
  } finally {
    try {
      await device.disconnect();
    } catch (disconnectError) {
      const message =
        disconnectError instanceof Error
          ? disconnectError.message
          : "Unknown disconnect error.";
      log("Device disconnect warning.", message);
    }

    isSyncRunning = false;
  }
}

function startScheduler() {
  log(`Starting local sync worker. Schedule: ${CRON_EXPRESSION}`);
  log(
    `Configured device target: ${DEVICE_IP}:${DEVICE_PORT} (timeout ${DEVICE_TIMEOUT}ms)`,
  );

  scheduledTask = cron.schedule(CRON_EXPRESSION, async () => {
    await syncAttendance();
  });

  void syncAttendance();
}

async function shutdown(signal) {
  log(`Received ${signal}. Stopping local sync worker...`);

  if (scheduledTask) {
    scheduledTask.stop();
  }

  try {
    await device.disconnect();
  } catch (error) {
    // Ignore disconnect errors during shutdown.
  }

  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

startScheduler();
