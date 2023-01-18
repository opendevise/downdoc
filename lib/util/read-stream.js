'use strict'

module.exports = function readStream (stream, encoding) {
  return new Promise((resolve, reject, buffer = '', chunk) => {
    return stream
      .setEncoding(encoding)
      .on('readable', () => {
        while ((chunk = stream.read()) !== null) buffer += chunk
      })
      .on('error', reject)
      .on('end', () => resolve(buffer.trimRight()))
  })
}
