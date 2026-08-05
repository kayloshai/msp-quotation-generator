import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const plainDbPath = path.resolve(rootDir, process.env.SQLITE_DB_PATH || './server/data.sqlite')
const encryptedDbPath = `${plainDbPath}.enc`
const magic = Buffer.from('MSPDB1', 'utf8')
const version = 1

const getKeyMaterial = () => {
  const secret = process.env.DB_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('DB_ENCRYPTION_KEY is not set. Add it to .env.local before running db pack/unpack.')
  }

  return secret
}

const deriveKey = (secret, salt) => crypto.scryptSync(secret, salt, 32)

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const encryptBuffer = (buffer, secret) => {
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12)
  const key = deriveKey(secret, salt)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()])
  const tag = cipher.getAuthTag()

  return Buffer.concat([
    magic,
    Buffer.from([version]),
    salt,
    iv,
    tag,
    ciphertext
  ])
}

const decryptBuffer = (buffer, secret) => {
  const headerLength = magic.length + 1 + 16 + 12 + 16
  if (buffer.length < headerLength) {
    throw new Error('Encrypted file is too short or invalid.')
  }

  const fileMagic = buffer.subarray(0, magic.length)
  if (!fileMagic.equals(magic)) {
    throw new Error('Encrypted file magic header mismatch.')
  }

  const fileVersion = buffer.readUInt8(magic.length)
  if (fileVersion !== version) {
    throw new Error(`Unsupported encrypted DB version: ${fileVersion}`)
  }

  let offset = magic.length + 1
  const salt = buffer.subarray(offset, offset + 16)
  offset += 16
  const iv = buffer.subarray(offset, offset + 12)
  offset += 12
  const tag = buffer.subarray(offset, offset + 16)
  offset += 16
  const ciphertext = buffer.subarray(offset)

  const key = deriveKey(secret, salt)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

const pack = async () => {
  const secret = getKeyMaterial()
  const plainExists = await fileExists(plainDbPath)
  if (!plainExists) {
    throw new Error(`Plain database not found at ${plainDbPath}`)
  }

  const plainDb = await fs.readFile(plainDbPath)
  const encrypted = encryptBuffer(plainDb, secret)
  await fs.writeFile(encryptedDbPath, encrypted)
  console.log(`Encrypted database written to ${encryptedDbPath}`)
}

const unpack = async () => {
  const secret = getKeyMaterial()
  const encryptedExists = await fileExists(encryptedDbPath)
  if (!encryptedExists) {
    throw new Error(`Encrypted database not found at ${encryptedDbPath}`)
  }

  const encryptedDb = await fs.readFile(encryptedDbPath)
  const plainDb = decryptBuffer(encryptedDb, secret)
  await fs.mkdir(path.dirname(plainDbPath), { recursive: true })
  await fs.writeFile(plainDbPath, plainDb)
  console.log(`Decrypted database written to ${plainDbPath}`)
}

const unpackIfNeeded = async () => {
  const plainExists = await fileExists(plainDbPath)
  if (plainExists) {
    console.log('Plain database already exists. Skipping decrypt step.')
    return
  }

  const encryptedExists = await fileExists(encryptedDbPath)
  if (!encryptedExists) {
    console.log('No encrypted database found. Continuing with normal startup flow.')
    return
  }

  await unpack()
}

const command = process.argv[2]

const run = async () => {
  switch (command) {
    case 'pack':
      await pack()
      return
    case 'unpack':
      await unpack()
      return
    case 'unpack-if-needed':
      await unpackIfNeeded()
      return
    default:
      throw new Error('Usage: node server/db-crypto.mjs [pack|unpack|unpack-if-needed]')
  }
}

run().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
