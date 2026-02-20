type UploadTextLike = {
  text?: () => Promise<string>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
  stream?: () => ReadableStream<Uint8Array>;
};

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}

export async function readUploadedText(
  value: UploadTextLike | Blob
): Promise<string> {
  if (typeof value.text === 'function') {
    return value.text();
  }

  if (typeof value.arrayBuffer === 'function') {
    return new TextDecoder().decode(await value.arrayBuffer());
  }

  if (
    typeof FileReader !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    isBlob(value)
  ) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () =>
        reject(reader.error ?? new Error('Unable to read uploaded file'));
      reader.readAsText(value);
    });
  }

  if (typeof value.stream === 'function') {
    return new Response(value.stream()).text();
  }

  if (isBlob(value)) {
    return new Response(value).text();
  }

  throw new Error('Unable to read uploaded file');
}
