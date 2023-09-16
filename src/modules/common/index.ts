import crypto from 'node:crypto';

export default {
  Md5: (data: string) =>
    crypto.createHash('md5')
      .update(data)
      .digest('hex')
}