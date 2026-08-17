import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

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
const PROFILES = 'pbc_1000000001'
const RESUMES = 'pbc_1000000002'
const CONVERSATIONS = 'pbc_1000000003'
const MESSAGES = 'pbc_1000000004'
const SUBSCRIPTIONS = 'pbc_1000000005'
const ENTITLEMENTS = 'pbc_1000000006'
const USAGE = 'pbc_1000000007'
const DEVICES = 'pbc_1000000008'
const DESKTOP_SESSIONS = 'pbc_1000000009'
const USER_CONTEXT = 'pbc_1000000010'
const ONBOARDING = 'pbc_1000000011'

const emailTemplate = (subject, body) => ({ subject, body })

function usersCollection() {
  const owner = 'id = @request.auth.id'
  return {
    id: USERS,
    listRule: owner,
    viewRule: owner,
    createRule: '',
    updateRule: 'id = @request.auth.id && @request.body.plan:isset = false && @request.body.planStatus:isset = false && @request.body.stripeCustomerId:isset = false && @request.body.stripeSubscriptionId:isset = false && @request.body.aiAccess:isset = false && @request.body.realtimeAccess:isset = false && @request.body.screenAnalysis:isset = false && @request.body.audioAccess:isset = false && @request.body.usageLimits:isset = false && @request.body.expiresAt:isset = false',
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
        id: 'bool4100000905',
        name: 'aiAccess',
        presentable: false,
        required: false,
        system: false,
        type: 'bool',
      },
      {
        hidden: false,
        id: 'bool4100000906',
        name: 'realtimeAccess',
        presentable: false,
        required: false,
        system: false,
        type: 'bool',
      },
      {
        hidden: false,
        id: 'bool4100000907',
        name: 'screenAnalysis',
        presentable: false,
        required: false,
        system: false,
        type: 'bool',
      },
      {
        hidden: false,
        id: 'bool4100000908',
        name: 'audioAccess',
        presentable: false,
        required: false,
        system: false,
        type: 'bool',
      },
      {
        hidden: false,
        id: 'json4100000909',
        maxSize: 2000000,
        name: 'usageLimits',
        presentable: false,
        required: false,
        system: false,
        type: 'json',
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
      {
        hidden: false,
        id: 'bool4100000911',
        name: 'onboardingComplete',
        presentable: false,
        required: false,
        system: false,
        type: 'bool',
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
      emailTemplate: emailTemplate(
        'Login from a new location',
        '<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new location:</p>\n<p><em>{ALERT_INFO}</em></p>\n<p><strong>If this wasn\'t you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>\n<p>If this was you, you may disregard this email.</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>',
      ),
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
      emailTemplate: emailTemplate(
        'OTP for {APP_NAME}',
        '<p>Hello,</p>\n<p>Your one-time password is: <strong>{OTP}</strong></p>\n<p><i>If you didn\'t ask for the one-time password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>',
      ),
    },
    authToken: { duration: 604800 },
    passwordResetToken: { duration: 1800 },
    emailChangeToken: { duration: 1800 },
    verificationToken: { duration: 259200 },
    fileToken: { duration: 180 },
    verificationTemplate: emailTemplate(
      'Verify your {APP_NAME} email',
      '<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-verification/{TOKEN}" target="_blank" rel="noopener">Verify</a>\n</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>',
    ),
    resetPasswordTemplate: emailTemplate(
      'Reset your {APP_NAME} password',
      '<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}" target="_blank" rel="noopener">Reset password</a>\n</p>\n<p><i>If you didn\'t ask to reset your password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>',
    ),
    confirmEmailChangeTemplate: emailTemplate(
      'Confirm your {APP_NAME} new email address',
      '<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}" target="_blank" rel="noopener">Confirm new email</a>\n</p>\n<p><i>If you didn\'t ask to change your email address, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>',
    ),
  }
}

const collections = [
  usersCollection(),
  collection(PROFILES, 'profiles', [
    relation('user', USERS, { cascadeDelete: true }),
    text('preferredName', { max: 120 }),
    text('profession', { max: 160 }),
    text('role', { max: 160 }),
    text('industry', { max: 160 }),
    text('education'),
    json('skills'),
    json('goals'),
    select('communicationStyle', ['concise', 'balanced', 'detailed']),
    select('technicalLevel', ['beginner', 'intermediate', 'advanced']),
    bool('formal'),
    bool('stepByStep'),
    bool('examples'),
    bool('explainTerms'),
    text('customContext'),
  ], {
    indexes: ['CREATE UNIQUE INDEX `idx_profiles_user` ON `profiles` (`user`)'],
  }),
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
  collection(CONVERSATIONS, 'conversations', [
    relation('user', USERS, { cascadeDelete: true }),
    text('title', { required: true, max: 255 }),
  ], {
    indexes: ['CREATE INDEX `idx_conversations_user` ON `conversations` (`user`)'],
  }),
  collection(MESSAGES, 'messages', [
    relation('user', USERS, { cascadeDelete: true }),
    relation('conversation', CONVERSATIONS, { cascadeDelete: true }),
    select('role', ['user', 'assistant', 'system'], { required: true }),
    text('content', { required: true, max: 100000 }),
    json('metadata'),
  ], {
    indexes: [
      'CREATE INDEX `idx_messages_conversation` ON `messages` (`conversation`)',
      'CREATE INDEX `idx_messages_user` ON `messages` (`user`)',
    ],
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
    bool('aiAccess'),
    bool('realtimeAccess'),
    bool('screenAnalysis'),
    bool('audioAccess'),
    json('usageLimits'),
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
  ], {
    ...adminOnly(),
    indexes: ['CREATE UNIQUE INDEX `idx_desktop_sessions_token` ON `desktop_sessions` (`token`)'],
  }),
  collection(USER_CONTEXT, 'user_context', [
    relation('user', USERS, { cascadeDelete: true }),
    json('entries'),
  ], {
    indexes: ['CREATE UNIQUE INDEX `idx_user_context_user` ON `user_context` (`user`)'],
  }),
  collection(ONBOARDING, 'onboarding', [
    relation('user', USERS, { cascadeDelete: true }),
    bool('complete'),
    text('step', { max: 64 }),
  ], {
    indexes: ['CREATE UNIQUE INDEX `idx_onboarding_user` ON `onboarding` (`user`)'],
  }),
]

const outPath = join(root, 'pb_schema.json')
writeFileSync(outPath, `${JSON.stringify(collections, null, 2)}\n`)
console.log(`Wrote ${collections.length} collections to ${outPath}`)
