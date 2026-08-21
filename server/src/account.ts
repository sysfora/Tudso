import { createUserPb, getAdminPb } from './pocketbase.js'

export type AccountIdentity = {
  userId: string
  email: string
  name: string
  avatar: string | null
  updated: string
}

export type PublicAccount = {
  userId: string
  email: string
  name: string
  avatarUrl: string | null
}

export function publicAccount(identity: AccountIdentity): PublicAccount {
  return {
    userId: identity.userId,
    email: identity.email,
    name: identity.name,
    avatarUrl: identity.avatar ? `/me/avatar?v=${encodeURIComponent(identity.updated)}` : null,
  }
}

function identityFromRecord(record: { id: string; email?: string; name?: unknown; avatar?: unknown; updated?: string }): AccountIdentity {
  return {
    userId: record.id,
    email: typeof record.email === 'string' ? record.email : '',
    name: typeof record.name === 'string' ? record.name : '',
    avatar: typeof record.avatar === 'string' && record.avatar ? record.avatar : null,
    updated: typeof record.updated === 'string' ? record.updated : '',
  }
}

export async function getAccountIdentity(userId: string): Promise<AccountIdentity> {
  const pb = await getAdminPb()
  const record = await pb.collection('users').getOne(userId)
  return identityFromRecord(record)
}

export async function updateAccountName(userId: string, name: string): Promise<AccountIdentity> {
  const pb = await getAdminPb()
  const record = await pb.collection('users').update(userId, { name })
  return identityFromRecord(record)
}

export async function changeAccountPassword(email: string, currentPassword: string, password: string): Promise<void> {
  const pb = createUserPb()
  let userId: string
  try {
    const result = await pb.collection('users').authWithPassword(email, currentPassword)
    userId = result.record.id
  } catch {
    throw new Error('Current password is incorrect.')
  }
  try {
    await pb.collection('users').update(userId, {
      oldPassword: currentPassword,
      password,
      passwordConfirm: password,
    })
  } catch {
    throw new Error('Could not update the password. Use at least 8 characters.')
  }
}

export async function updateAccountAvatar(
  userId: string,
  file: { buffer: Buffer; mime: string; filename: string } | null,
): Promise<AccountIdentity> {
  const pb = await getAdminPb()
  if (!file) {
    const record = await pb.collection('users').update(userId, { avatar: null })
    return identityFromRecord(record)
  }
  const form = new FormData()
  form.append('avatar', new Blob([new Uint8Array(file.buffer)], { type: file.mime }), file.filename)
  const record = await pb.collection('users').update(userId, form)
  return identityFromRecord(record)
}

export async function getAccountAvatar(userId: string): Promise<{ body: Buffer; contentType: string } | null> {
  const pb = await getAdminPb()
  const record = await pb.collection('users').getOne(userId)
  const filename = typeof record.avatar === 'string' ? record.avatar : ''
  if (!filename) return null
  const url = pb.files.getURL(record, filename)
  const response = await fetch(url)
  if (!response.ok) return null
  const contentType = response.headers.get('content-type') || 'image/jpeg'
  return { body: Buffer.from(await response.arrayBuffer()), contentType }
}
