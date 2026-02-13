import * as events from 'events'
import * as fs from 'fs'
import * as os from 'os'
import * as readline from 'readline'
import { HookData } from './interfaces'
import { Writable, WritableOptions } from 'stream'

export async function getInputFromStdin(): Promise<HookData> {
  let input = ''

  const rl = readline.createInterface({
    input: process.stdin
  })

  rl.on('line', line => {
    input = line
  })
  await events.default.once(rl, 'close')
  const inputJson = JSON.parse(input)
  return inputJson as HookData
}

export function writeToResponseFile(filePath: string, message: any): void {
  if (!filePath) {
    throw new Error(`Expected file path`)
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file at path: ${filePath}`)
  }

  fs.appendFileSync(filePath, `${toCommandValue(message)}${os.EOL}`, {
    encoding: 'utf8'
  })
}

function toCommandValue(input: any): string {
  if (input === null || input === undefined) {
    return ''
  } else if (typeof input === 'string' || input instanceof String) {
    return input as string
  }
  return JSON.stringify(input)
}

export interface WritableStreamBufferOpts extends WritableOptions {
  initialSize?: number
  incrementAmount?: number
}

export const DEFAULT_INITIAL_SIZE = 1024
export const DEFAULT_INCREMENT_AMOUNT = 1024

export class WritableStreamBuffer extends Writable {
  private buffer: Buffer
  private _size: number
  private readonly _initialSize: number
  private readonly _incrementAmount: number

  constructor(opts?: WritableStreamBufferOpts) {
    opts = opts || {}
    opts.decodeStrings = true

    super(opts)

    this._initialSize = opts.initialSize || DEFAULT_INITIAL_SIZE
    this._incrementAmount = opts.incrementAmount || DEFAULT_INCREMENT_AMOUNT

    this.buffer = Buffer.alloc(this._initialSize)
    this._size = 0
  }

  size(): number {
    return this._size
  }

  maxSize(): number {
    return this.buffer.length
  }

  getContents(length?: number): Buffer | boolean {
    if (!this._size) {
      return false
    }
    const data = Buffer.alloc(Math.min(length || this._size, this._size))
    this.buffer.copy(data, 0, 0, data.length)
    if (data.length < this._size) {
      this.buffer.copy(this.buffer, 0, data.length)
    }
    this._size -= data.length
    return data
  }

  getContentsAsString(
    encoding?: BufferEncoding,
    length?: number
  ): string | boolean {
    if (!this._size) {
      return false
    }
    const data = this.buffer.toString(
      encoding || 'utf8',
      0,
      Math.min(length || this._size, this._size)
    )
    if (Buffer.byteLength(data) < this._size) {
      this.buffer.copy(this.buffer, 0, Buffer.byteLength(data))
    }
    this._size -= Buffer.byteLength(data)
    return data
  }

  increaseBufferIfNecessary(incomingDataSize: number): void {
    if (this.buffer.length - this._size < incomingDataSize) {
      const factor = Math.ceil(
        (incomingDataSize - (this.buffer.length - this._size)) /
          this._incrementAmount
      )
      const newBuffer = Buffer.alloc(
        this.buffer.length + this._incrementAmount * factor
      )
      this.buffer.copy(newBuffer, 0, 0, this._size)
      this.buffer = newBuffer
    }
  }

  _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.increaseBufferIfNecessary(chunk.length)
    chunk.copy(this.buffer, this._size, 0)
    this._size += chunk.length
    callback()
  }
}
