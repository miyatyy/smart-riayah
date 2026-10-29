import Redis from 'ioredis';
import { EventEmitter } from 'events';

/**
 * ============================================================================
 * SMART RI'AYAH - REDIS MESSAGE BROKER CLIENT (MODULAR)
 * Mengelola koneksi ke Redis untuk pub/sub event WhatsApp Gateway & Soketi.
 * Dilengkapi graceful fallback (Mock Emitter) jika Redis offline.
 * ============================================================================
 */

class MockRedisBroker extends EventEmitter {
  constructor() {
    super();
    this.status = 'mock_fallback';
  }
  async publish(channel, message) {
    this.emit('message', channel, message);
    return 1;
  }
  async ping() {
    return 'PONG (Mock Broker - In-Memory)';
  }
  async disconnect() {}
}

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT, 10) || 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

let redisPublisher = null;
let redisSubscriber = null;
let isRedisConnected = false;

try {
  redisPublisher = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    maxRetriesPerRequest: 2,
    retryStrategy(times) {
      if (times > 3) {
        // Berhenti retry jika Redis tidak aktif agar tidak membanjiri log
        return null;
      }
      return Math.min(times * 1000, 3000);
    },
    lazyConnect: true
  });

  redisSubscriber = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    maxRetriesPerRequest: 2,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 1000, 3000);
    },
    lazyConnect: true
  });

  redisPublisher.on('connect', () => {
    isRedisConnected = true;
    console.log(`🟢 [Redis] Publisher terhubung ke ${redisHost}:${redisPort}`);
  });

  redisPublisher.on('error', (err) => {
    isRedisConnected = false;
    // Log informasi terisolasi
    console.warn(`ℹ️ [Redis] Publisher offline (${err.code || err.message}). Menggunakan In-Memory Mock Broker.`);
  });

  redisSubscriber.on('connect', () => {
    console.log(`🟢 [Redis] Subscriber terhubung ke ${redisHost}:${redisPort}`);
  });

  redisSubscriber.on('error', (err) => {
    console.warn(`ℹ️ [Redis] Subscriber offline (${err.code || err.message}).`);
  });

  // Hubungkan secara asynchronous
  redisPublisher.connect().catch(() => {});
  redisSubscriber.connect().catch(() => {});
} catch (e) {
  console.warn('ℹ️ [Redis] Gagal inisialisasi Redis client. Menggunakan Mock fallback:', e.message);
  redisPublisher = new MockRedisBroker();
  redisSubscriber = new MockRedisBroker();
}

export { redisPublisher, redisSubscriber, isRedisConnected };

export async function checkRedisStatus() {
  if (!redisPublisher) {
    return { status: 'offline', host: redisHost, port: redisPort };
  }
  try {
    if (typeof redisPublisher.ping === 'function') {
      const pong = await redisPublisher.ping();
      return { status: 'connected', response: pong, host: redisHost, port: redisPort };
    }
    return { status: 'mock_active', host: redisHost, port: redisPort };
  } catch (err) {
    return { status: 'disconnected', error: err.message, host: redisHost, port: redisPort };
  }
}

