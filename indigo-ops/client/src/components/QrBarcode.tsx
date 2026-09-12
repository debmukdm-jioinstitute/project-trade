export function QrImage({ payload, size = 120 }: { payload: string; size?: number }) {
  return (
    <img
      src={`/api/documents/qr?payload=${encodeURIComponent(payload)}`}
      width={size}
      height={size}
      alt="QR"
      className="bg-white p-1"
    />
  );
}

export function BarcodeImage({ payload, width = 240, height = 56 }: { payload: string; width?: number; height?: number }) {
  return (
    <img
      src={`/api/documents/barcode?payload=${encodeURIComponent(payload)}`}
      width={width}
      height={height}
      alt="Barcode"
    />
  );
}
