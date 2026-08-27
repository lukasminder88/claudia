// Netlify Function: sicherer Proxy zur Moco-API.
//
// Der Moco-API-Schlüssel liegt ausschliesslich serverseitig als Umgebungs-
// variable vor und wird NIE an den Browser ausgeliefert. Die Function ist über
// ein Sync-Token abgesichert, damit die öffentliche URL nicht missbraucht wird.
//
// Erwartete Umgebungsvariablen (in Netlify → Site settings → Environment):
//   MOCO_DOMAIN      z. B. "meinefirma"  (bei meinefirma.mocoapp.com)
//   MOCO_API_KEY     dein persönlicher Moco-API-Schlüssel
//   APP_SYNC_TOKEN   frei wählbares Geheimnis; identisch in der App hinterlegen

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
})

function mocoBase() {
  const domain = process.env.MOCO_DOMAIN
  const key = process.env.MOCO_API_KEY
  if (!domain || !key) return null
  return {
    url: `https://${domain}.mocoapp.com/api/v1`,
    headers: {
      Authorization: `Token token=${key}`,
      'Content-Type': 'application/json',
    },
  }
}

/** Alle zugewiesenen Projekte (inkl. Tasks) holen – mit einfacher Pagination. */
async function fetchAssignedProjects(base) {
  const all = []
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(
      `${base.url}/projects/assigned?page=${page}`,
      { headers: base.headers },
    )
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Moco ${res.status}: ${text.slice(0, 200)}`)
    }
    const batch = await res.json()
    all.push(...batch)
    if (!Array.isArray(batch) || batch.length < 100) break
  }
  return all
}

/** Projekte in die von der App erwartete, schlanke Struktur überführen. */
function normalizeProjects(projects) {
  const clients = new Map()
  const outProjects = []
  const outTasks = []
  for (const p of projects) {
    if (p.customer && p.customer.id != null) {
      clients.set(String(p.customer.id), {
        externalId: String(p.customer.id),
        name: p.customer.name ?? 'Kunde',
      })
    }
    outProjects.push({
      externalId: String(p.id),
      name: p.name ?? 'Projekt',
      clientExternalId: p.customer?.id != null ? String(p.customer.id) : undefined,
      hourlyRate: typeof p.hourly_rate === 'number' && p.hourly_rate > 0
        ? p.hourly_rate
        : undefined,
      billable: p.billable !== false,
    })
    for (const t of p.tasks ?? []) {
      if (t.active === false) continue
      outTasks.push({
        externalId: String(t.id),
        name: t.name ?? 'Task',
        projectExternalId: String(p.id),
        billable: t.billable !== false,
      })
    }
  }
  return {
    clients: [...clients.values()],
    projects: outProjects,
    tasks: outTasks,
  }
}

export async function handler(event) {
  const base = mocoBase()

  // Zugriffsschutz: Sync-Token prüfen.
  const expected = process.env.APP_SYNC_TOKEN
  const provided =
    event.headers['x-app-token'] || event.headers['X-App-Token']
  if (!expected || provided !== expected) {
    return json(401, { error: 'Ungültiges oder fehlendes Sync-Token.' })
  }

  if (!base) {
    return json(500, {
      error:
        'Moco ist nicht konfiguriert. Bitte MOCO_DOMAIN und MOCO_API_KEY in Netlify setzen.',
    })
  }

  try {
    // GET: Status oder Projektbaum.
    if (event.httpMethod === 'GET') {
      const action = event.queryStringParameters?.action ?? 'status'
      if (action === 'status') {
        // Leichter Verbindungstest.
        const res = await fetch(`${base.url}/projects/assigned?page=1`, {
          headers: base.headers,
        })
        return json(200, { ok: res.ok, status: res.status })
      }
      if (action === 'projects') {
        const projects = await fetchAssignedProjects(base)
        return json(200, normalizeProjects(projects))
      }
      return json(400, { error: `Unbekannte Aktion: ${action}` })
    }

    // POST: Aktivität anlegen.
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      if (body.action === 'create_activity') {
        const payload = {
          date: body.date,
          project_id: Number(body.project_id),
          task_id: Number(body.task_id),
          seconds: Number(body.seconds),
          description: body.description || undefined,
          billable: body.billable !== false,
        }
        const res = await fetch(`${base.url}/activities`, {
          method: 'POST',
          headers: base.headers,
          body: JSON.stringify(payload),
        })
        const text = await res.text()
        if (!res.ok) {
          return json(res.status, {
            error: `Moco ${res.status}: ${text.slice(0, 300)}`,
          })
        }
        const created = JSON.parse(text)
        return json(200, { id: created.id })
      }
      if (body.action === 'delete_activity') {
        const res = await fetch(`${base.url}/activities/${body.id}`, {
          method: 'DELETE',
          headers: base.headers,
        })
        return json(res.ok ? 200 : res.status, { ok: res.ok })
      }
      return json(400, { error: `Unbekannte Aktion: ${body.action}` })
    }

    return json(405, { error: 'Methode nicht erlaubt.' })
  } catch (err) {
    return json(502, { error: String(err?.message ?? err) })
  }
}
