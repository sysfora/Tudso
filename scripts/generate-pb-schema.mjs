import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function emailBody(name) {
  return readFileSync(join(root, 'EmailStructures', name), 'utf8').trim()
}

const idField = {
  autogeneratePattern: '[a-z0-9]{15}',
  hidden: false,
  id: 'text3208210256',
  max: 15,
  min: 15,
  name: 'id',
  pattern: '^[a-z0-9]+$',
  presentable: false,
  primaryKey: true,
  required: true,
  system: true,
  type: 'text',
}

const createdField = {
  hidden: false,
  id: 'autodate2990389176',
  name: 'created',
  onCreate: true,
  onUpdate: false,
  presentable: false,
  system: false,
  type: 'autodate',
}

const updatedField = {
  hidden: false,
  id: 'autodate3332085495',
  name: 'updated',
  onCreate: true,
  onUpdate: true,
  presentable: false,
  system: false,
  type: 'autodate',
}

let fieldSeq = 4100000000
function nextId(prefix) {
  fieldSeq += 1
  return `${prefix}${fieldSeq}`
}

function text(name, extra = {}) {
  return {
    autogeneratePattern: '',
    hidden: false,
    id: nextId('text'),
    max: 0,
    min: 0,
    name,
    pattern: '',
    presentable: false,
    primaryKey: false,
    required: false,
    system: false,
    type: 'text',
    ...extra,
  }
}

function bool(name, extra = {}) {
  return {
    hidden: false,
    id: nextId('bool'),
    name,
    presentable: false,
    required: false,
    system: false,
    type: 'bool',
    ...extra,
  }
}

function json(name, extra = {}) {
  return {
    hidden: false,
    id: nextId('json'),
    maxSize: 2000000,
    name,
    presentable: false,
    required: false,
    system: false,
    type: 'json',
    ...extra,
  }
}

function number(name, extra = {}) {
  return {
    hidden: false,
    id: nextId('number'),
    max: null,
    min: 0,
    name,
    onlyInt: false,
    presentable: false,
    required: false,
    system: false,
    type: 'number',
    ...extra,
  }
}

function date(name, extra = {}) {
  return {
    hidden: false,
    id: nextId('date'),
    max: '',
    min: '',
    name,
    presentable: false,
    required: false,
    system: false,
    type: 'date',
    ...extra,
  }
}

function select(name, values, extra = {}) {
  return {
    hidden: false,
    id: nextId('select'),
    maxSelect: 1,
    name,
    presentable: false,
    required: false,
    system: false,
    type: 'select',
    values,
    ...extra,
  }
}

function relation(name, collectionId, extra = {}) {
  return {
    cascadeDelete: false,
    collectionId,
    hidden: false,
    id: nextId('relation'),
    maxSelect: 1,
    minSelect: 0,
    name,
    presentable: false,
    required: true,
    system: false,
    type: 'relation',
    ...extra,
  }
}

function file(name, extra = {}) {
  return {
    hidden: false,
    id: nextId('file'),
    maxSelect: 1,
    maxSize: 10485760,
    mimeTypes: [],
    name,
    presentable: false,
    protected: false,
    required: false,
    system: false,
    thumbs: null,
    type: 'file',
    ...extra,
  }
}

function ownerRules() {
  return {
    listRule: 'user = @request.auth.id',
    viewRule: 'user = @request.auth.id',
    createRule: '@request.auth.id != "" && user = @request.auth.id',
    updateRule: 'user = @request.auth.id',
    deleteRule: 'user = @request.auth.id',
  }
}

function ownerReadAdminWrite() {
  return {
    listRule: 'user = @request.auth.id',
    viewRule: 'user = @request.auth.id',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  }
}

function adminOnly() {
  return {
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
  }
}

function collection(id, name, fields, extra = {}) {
  return {
    id,
    ...ownerRules(),
    name,
    type: 'base',
    fields: [idField, ...fields, createdField, updatedField],
    indexes: [],
    system: false,
    ...extra,
  }
}

const USERS = '_pb_users_auth_'
const RESUMES = 'pbc_1000000002'
const SUBSCRIPTIONS = 'pbc_1000000005'
const ENTITLEMENTS = 'pbc_1000000006'
const USAGE = 'pbc_1000000007'
const DEVICES = 'pbc_1000000008'
const DESKTOP_SESSIONS = 'pbc_1000000009'

const emailTemplate = (subject, body) => ({ subject, body })

function usersCollection() {
  const owner = 'id = @request.auth.id'
  return {
    id: USERS,
    listRule: owner,
    viewRule: owner,
    createRule: '',
    updateRule: 'id = @request.auth.id && @request.body.plan:isset = false && @request.body.planStatus:isset = false && @request.body.freeAccess:isset = false && @request.body.stripeCustomerId:isset = false && @request.body.stripeSubscriptionId:isset = false && @request.body.expiresAt:isset = false',
    deleteRule: owner,
    name: 'users',
    type: 'auth',
    system: false,
    fields: [
      {
        ...idField,
        autogeneratePattern: '[a-z0-9]{15}',
      },
      {
        cost: 0,
        hidden: true,
        id: 'password901924565',
        max: 0,
        min: 8,
        name: 'password',
        pattern: '',
        presentable: false,
        required: true,
        system: true,
        type: 'password',
      },
      {
        autogeneratePattern: '[a-zA-Z0-9]{50}',
        hidden: true,
        id: 'text2504183744',
        max: 60,
        min: 30,
        name: 'tokenKey',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: true,
        system: true,
        type: 'text',
      },
      {
        exceptDomains: null,
        hidden: false,
        id: 'email3885137012',
        name: 'email',
        onlyDomains: null,
        presentable: false,
        required: true,
        system: true,
        type: 'email',
      },
      {
        hidden: false,
        id: 'bool1547992806',
        name: 'emailVisibility',
        presentable: false,
        required: false,
        system: true,
        type: 'bool',
      },
      {
        hidden: false,
        id: 'bool256245529',
        name: 'verified',
        presentable: false,
        required: false,
        system: true,
        type: 'bool',
      },
      {
        autogeneratePattern: '',
        hidden: false,
        id: 'text1579384326',
        max: 255,
        min: 0,
        name: 'name',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      },
      {
        hidden: false,
        id: 'file376926767',
        maxSelect: 1,
        maxSize: 0,
        mimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/gif', 'image/webp'],
        name: 'avatar',
        presentable: false,
        protected: false,
        required: false,
        system: false,
        thumbs: null,
        type: 'file',
      },
      {
        hidden: false,
        id: 'select4100000901',
        maxSelect: 1,
        name: 'plan',
        presentable: true,
        required: false,
        system: false,
        type: 'select',
        values: ['free', 'pro', 'premium'],
      },
      {
        hidden: false,
        id: 'select4100000902',
        maxSelect: 1,
        name: 'planStatus',
        presentable: false,
        required: false,
        system: false,
        type: 'select',
        values: ['active', 'trialing', 'past_due', 'canceled', 'unpaid'],
      },
      {
        hidden: false,
        id: 'select4100000912',
        maxSelect: 1,
        name: 'freeAccess',
        presentable: true,
        required: false,
        system: false,
        type: 'select',
        values: ['pro', 'premium'],
      },
      {
        autogeneratePattern: '',
        hidden: true,
        id: 'text4100000903',
        max: 255,
        min: 0,
        name: 'stripeCustomerId',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      },
      {
        autogeneratePattern: '',
        hidden: true,
        id: 'text4100000904',
        max: 255,
        min: 0,
        name: 'stripeSubscriptionId',
        pattern: '',
        presentable: false,
        primaryKey: false,
        required: false,
        system: false,
        type: 'text',
      },
      {
        hidden: false,
        id: 'date4100000910',
        max: '',
        min: '',
        name: 'expiresAt',
        presentable: false,
        required: false,
        system: false,
        type: 'date',
      },
      createdField,
      updatedField,
    ],
    indexes: [
      'CREATE UNIQUE INDEX `idx_tokenKey__pb_users_auth_` ON `users` (`tokenKey`)',
      "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `users` (`email`) WHERE `email` != ''",
    ],
    authRule: '',
    manageRule: null,
    authAlert: {
      enabled: true,
      emailTemplate: emailTemplate('Login from a new location', emailBody('auth-alert.html')),
    },
    oauth2: {
      enabled: false,
      mappedFields: {
        id: '',
        name: 'name',
        username: '',
        avatarURL: 'avatar',
      },
      providers: [],
    },
    passwordAuth: {
      enabled: true,
      identityFields: ['email'],
    },
    mfa: {
      enabled: false,
      duration: 1800,
      rule: '',
    },
    otp: {
      enabled: false,
      duration: 180,
      length: 8,
      emailTemplate: emailTemplate('OTP for {APP_NAME}', emailBody('otp.html')),
    },
    authToken: { duration: 604800 },
    passwordResetToken: { duration: 1800 },
    emailChangeToken: { duration: 1800 },
    verificationToken: { duration: 259200 },
    fileToken: { duration: 180 },
    verificationTemplate: emailTemplate('Verify your {APP_NAME} email', emailBody('verification.html')),
    resetPasswordTemplate: emailTemplate('Reset your {APP_NAME} password', emailBody('reset-password.html')),
    confirmEmailChangeTemplate: emailTemplate('Confirm your {APP_NAME} new email address', emailBody('confirm-email-change.html')),
  }
}

const collections = [
  usersCollection(),
  collection(RESUMES, 'resumes', [
    relation('user', USERS, { cascadeDelete: true }),
    file('file', {
      mimeTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ],
      protected: true,
    }),
    text('extractedText', { max: 100000 }),
    text('filePath', { max: 500 }),
    select('storage', ['r2', 'local']),
    json('parsedData'),
  ], {
    indexes: ['CREATE UNIQUE INDEX `idx_resumes_user` ON `resumes` (`user`)'],
  }),
  collection(SUBSCRIPTIONS, 'subscriptions', [
    relation('user', USERS, { cascadeDelete: true }),
    text('stripeCustomerId', { max: 255 }),
    text('stripeSubscriptionId', { max: 255 }),
    text('priceId', { max: 255 }),
    select('status', [
      'active',
      'trialing',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
    ]),
    date('currentPeriodStart'),
    date('currentPeriodEnd'),
    bool('cancelAtPeriodEnd'),
  ], {
    ...ownerReadAdminWrite(),
    indexes: [
      'CREATE UNIQUE INDEX `idx_subscriptions_user` ON `subscriptions` (`user`)',
      'CREATE UNIQUE INDEX `idx_subscriptions_stripe` ON `subscriptions` (`stripeSubscriptionId`) WHERE `stripeSubscriptionId` != \'\'',
    ],
  }),
  collection(ENTITLEMENTS, 'entitlements', [
    relation('user', USERS, { cascadeDelete: true }),
    select('plan', ['free', 'pro', 'premium'], { required: true }),
    select('status', ['active', 'trialing', 'past_due', 'canceled', 'unpaid']),
    date('expiresAt'),
  ], {
    ...ownerReadAdminWrite(),
    indexes: ['CREATE UNIQUE INDEX `idx_entitlements_user` ON `entitlements` (`user`)'],
  }),
  collection(USAGE, 'usage', [
    relation('user', USERS, { cascadeDelete: true }),
    date('date', { required: true }),
    number('requests', { onlyInt: true }),
    number('tokens', { onlyInt: true }),
    number('screenAnalyses', { onlyInt: true }),
    number('realtimeMinutes'),
    number('audioMinutes'),
    number('sessions', { onlyInt: true }),
  ], {
    ...ownerReadAdminWrite(),
    indexes: ['CREATE UNIQUE INDEX `idx_usage_user_date` ON `usage` (`user`, `date`)'],
  }),
  collection(DEVICES, 'devices', [
    relation('user', USERS, { cascadeDelete: true }),
    text('deviceId', { required: true, max: 255 }),
    text('platform', { max: 64 }),
    text('appVersion', { max: 64 }),
    date('lastSeen'),
  ], {
    indexes: ['CREATE UNIQUE INDEX `idx_devices_user_device` ON `devices` (`user`, `deviceId`)'],
  }),
  collection(DESKTOP_SESSIONS, 'desktop_sessions', [
    relation('user', USERS, { cascadeDelete: true }),
    text('token', { required: true, hidden: true, max: 512 }),
    date('expiresAt', { required: true }),
    text('deviceId', { max: 255 }),
  ], {
    ...adminOnly(),
    indexes: [
      'CREATE UNIQUE INDEX `idx_desktop_sessions_token` ON `desktop_sessions` (`token`)',
      'CREATE INDEX `idx_desktop_sessions_user_device` ON `desktop_sessions` (`user`, `deviceId`)',
    ],
  }),
]

const outPath = join(root, 'pb_schema.json')
writeFileSync(outPath, `${JSON.stringify(collections, null, 2)}\n`)
console.log(`Wrote ${collections.length} collections to ${outPath}`)
