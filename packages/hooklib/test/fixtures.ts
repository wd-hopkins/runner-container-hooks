import * as streamBuffer from '../src/utils'

export const simpleString = 'This is a String!'
export const unicodeString = '\u00bd + \u00bc = \u00be'
export let binaryData = Buffer.alloc(64)
for (let i = 0; i < binaryData.length; i++) {
  binaryData[i] = i
}

// Binary data larger than initial size of buffers.
export let largeBinaryData = Buffer.alloc(streamBuffer.DEFAULT_INITIAL_SIZE + 1)
for (let i = 0; i < largeBinaryData.length; i++) {
  largeBinaryData[i] = i % 256
}
