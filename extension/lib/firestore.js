import { FIREBASE_CONFIG } from "./firebase-config.js";

const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: toFirestoreFields(value) } };
  }
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

function fromFirestoreValue(value) {
  if (!value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return parseInt(value.integerValue, 10);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(fromFirestoreValue);
  }
  if ("mapValue" in value) {
    return fromFirestoreFields(value.mapValue.fields || {});
  }
  return null;
}

export function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    fields[key] = toFirestoreValue(val);
  }
  return fields;
}

export function fromFirestoreFields(fields) {
  const obj = {};
  for (const [key, val] of Object.entries(fields)) {
    obj[key] = fromFirestoreValue(val);
  }
  return obj;
}

// Firestore's REST API returns each document's full resource name, e.g.
// "projects/p/databases/(default)/documents/users/u/applications/AbC123".
// We only ever want the last segment as the usable document ID.
function idFromDocName(name) {
  return name.split("/").pop();
}

async function firestoreFetch(path, { method = "GET", body, idToken, query = "" }) {
  const res = await fetch(`${BASE}${path}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore ${method} ${path} failed: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  // Firestore's DELETE response is a 200 with an empty (or "{}") body —
  // guard against res.json() throwing on truly empty content rather than
  // assuming every non-204 response has a parseable body.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function getUserDoc(uid, idToken) {
  try {
    const doc = await firestoreFetch(`/users/${uid}`, { idToken });
    return fromFirestoreFields(doc.fields || {});
  } catch (err) {
    if (String(err.message).includes("404")) return null;
    throw err;
  }
}

export async function setUserDoc(uid, idToken, data) {
  const fieldPaths = Object.keys(data).join(",updateMask.fieldPaths=");
  const query = `?updateMask.fieldPaths=${fieldPaths}`;
  await firestoreFetch(`/users/${uid}`, {
    method: "PATCH",
    idToken,
    query,
    body: { fields: toFirestoreFields(data) },
  });
}

export async function addApplication(uid, idToken, application) {
  const doc = await firestoreFetch(`/users/${uid}/applications`, {
    method: "POST",
    idToken,
    body: { fields: toFirestoreFields(application) },
  });
  return { id: idFromDocName(doc.name), ...application };
}

export async function updateApplication(uid, idToken, applicationId, patch) {
  const fieldPaths = Object.keys(patch).join(",updateMask.fieldPaths=");
  const query = `?updateMask.fieldPaths=${fieldPaths}`;
  await firestoreFetch(`/users/${uid}/applications/${applicationId}`, {
    method: "PATCH",
    idToken,
    query,
    body: { fields: toFirestoreFields(patch) },
  });
}

export async function deleteApplication(uid, idToken, applicationId) {
  await firestoreFetch(`/users/${uid}/applications/${applicationId}`, {
    method: "DELETE",
    idToken,
  });
}

export async function listRecentApplications(uid, idToken, limit = 10) {
  const doc = await firestoreFetch(`/users/${uid}/applications`, {
    idToken,
    query: `?pageSize=${limit}&orderBy=appliedAt%20desc`,
  });
  return (doc.documents || []).map((d) => ({
    id: idFromDocName(d.name),
    ...fromFirestoreFields(d.fields || {}),
  }));
}
