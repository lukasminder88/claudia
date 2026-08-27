// Netlify Function: serverseitiger Speicher für den App-Zustand (Geräte-Sync).
//
// Speichert den kompletten App-Zustand als JSON in Netlify Blobs, damit PC und
// Laptop denselben Stand teilen. Abgesichert über dasselbe Sync-Token
// (APP_SYNC_TOKEN) wie die Moco-Function.

import { getStore } from '@netlify/blobs'

const KEY = 'state'

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
})

export async function handler(event) {
  const expected = process.env.APP_SYNC_TOKEN
  const provided = event.headers['x-app-token'] || event.headers['X-App-Token']
  if (!expected || provided !== expected) {
    return json(401, { error: 'Ungültiges oder fehlendes Sync-Token.' })
  }

  let store
  try {
    store = getStore('zeitraum')
  } catch (err) {
    return json(500, { error: `Blob-Store nicht verfügbar: ${String(err)}` })
  }

  try {
    if (event.httpMethod === 'GET') {
      const data = await store.get(KEY, { type: 'json' })
      return json(200, {
        state: data?.state ?? null,
        updatedAt: data?.updatedAt ?? 0,
      })
    }

    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}')
      if (!body.state || typeof body.updatedAt !== 'number') {
        return json(400, { error: 'state und updatedAt erforderlich.' })
      }
      await store.setJSON(KEY, {
        state: body.state,
        updatedAt: body.updatedAt,
      })
      return json(200, { ok: true, updatedAt: body.updatedAt })
    }

    return json(405, { error: 'Methode nicht erlaubt.' })
  } catch (err) {
    return json(502, { error: String(err?.message ?? err) })
  }
}
