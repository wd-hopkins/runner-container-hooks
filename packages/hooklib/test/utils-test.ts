import * as fixtures from './fixtures'
import * as streamBuffer from '../src/utils'

describe('WritableStreamBuffer with defaults', () => {
  let buffer: streamBuffer.WritableStreamBuffer

  beforeEach(() => {
    buffer = new streamBuffer.WritableStreamBuffer()
  })

  it('returns false on call to getContents() when empty', () => {
    expect(buffer.getContents()).toBe(false)
  })

  it('returns false on call to getContentsAsString() when empty', () => {
    expect(buffer.getContentsAsString()).toBe(false)
  })

  it('backing buffer should be default size', () => {
    expect(buffer.maxSize()).toBe(streamBuffer.DEFAULT_INITIAL_SIZE)
  })

  describe('when writing a simple string', () => {
    beforeEach(() => {
      buffer.write(fixtures.simpleString)
    })

    it('should have a backing buffer of correct length', () => {
      expect(buffer.size()).toBe(fixtures.simpleString.length)
    })

    it('should have a default max size', () => {
      expect(buffer.maxSize()).toBe(streamBuffer.DEFAULT_INITIAL_SIZE)
    })

    it('contents should be correct', () => {
      expect(buffer.getContentsAsString()).toBe(fixtures.simpleString)
    })

    it('returns partial contents correctly', () => {
      const firstPart = buffer.getContents(
        Math.floor(Buffer.byteLength(fixtures.simpleString) / 2)
      )
      const secondPart = buffer.getContents()
      expect(firstPart).not.toBe(false)
      expect(secondPart).not.toBe(false)
      const buf = Buffer.concat([firstPart as Buffer, secondPart as Buffer])
      expect(buf.toString()).toBe(fixtures.simpleString)
    })
  })

  describe('when writing a large binary blob', () => {
    beforeEach(() => {
      buffer.write(fixtures.largeBinaryData)
    })

    it('should have a backing buffer of correct length', () => {
      expect(buffer.size()).toBe(fixtures.largeBinaryData.length)
    })

    it('should have a larger backing buffer max size', () => {
      expect(buffer.maxSize()).toBe(
        streamBuffer.DEFAULT_INITIAL_SIZE +
          streamBuffer.DEFAULT_INCREMENT_AMOUNT
      )
    })

    it('contents are valid', () => {
      expect(buffer.getContents()).toEqual(fixtures.largeBinaryData)
    })
  })

  describe('when writing some simple data to the stream', () => {
    let firstStr: string | boolean
    let secondStr: string | boolean

    beforeEach(() => {
      buffer = new streamBuffer.WritableStreamBuffer()
      buffer.write(fixtures.simpleString)
    })

    describe('and retrieving half of it', () => {
      beforeEach(() => {
        firstStr = buffer.getContentsAsString(
          'utf8',
          Math.floor(fixtures.simpleString.length / 2)
        )
      })

      it('returns correct data', () => {
        expect(firstStr).toBe(
          fixtures.simpleString.substring(
            0,
            Math.floor(fixtures.simpleString.length / 2)
          )
        )
      })

      it('leaves correct amount of data remaining in buffer', () => {
        expect(buffer.size()).toBe(Math.ceil(fixtures.simpleString.length / 2))
      })

      describe('and then retrieving the other half of it', () => {
        beforeEach(() => {
          secondStr = buffer.getContentsAsString(
            'utf8',
            Math.ceil(fixtures.simpleString.length / 2)
          )
        })

        it('returns correct data', () => {
          expect(secondStr).toBe(
            fixtures.simpleString.substring(
              Math.floor(fixtures.simpleString.length / 2)
            )
          )
        })

        it('results in an empty buffer', () => {
          expect(buffer.size()).toBe(0)
        })
      })
    })
  })
})

describe('WritableStreamBuffer with a different initial size and increment amount', () => {
  let buffer: streamBuffer.WritableStreamBuffer

  beforeEach(() => {
    buffer = new streamBuffer.WritableStreamBuffer({
      initialSize: 62,
      incrementAmount: 321
    })
  })

  it('has the correct initial size', () => {
    expect(buffer.maxSize()).toBe(62)
  })

  describe('after data is written', () => {
    beforeEach(() => {
      buffer.write(fixtures.binaryData)
    })

    it('has correct initial size + custom increment amount', () => {
      expect(buffer.maxSize()).toBe(321 + 62)
    })
  })
})

describe('When WritableStreamBuffer is written in two chunks', () => {
  let buffer: streamBuffer.WritableStreamBuffer

  beforeEach(() => {
    buffer = new streamBuffer.WritableStreamBuffer()
    buffer.write(fixtures.simpleString)
    buffer.write(fixtures.simpleString)
  })

  it('buffer contents are correct', () => {
    expect(buffer.getContentsAsString()).toBe(
      fixtures.simpleString + fixtures.simpleString
    )
  })
})
