/** Magic header to identify encrypted data in bytestream format.
 * @internal */
export const header = new Uint8Array([0x43, 0x52, 0x59]); // CRY

/** Version of the encryption algorithm.
 * @internal */
export const version = new Uint8Array([0x01]); // 1
