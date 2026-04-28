'use client';
import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function Scanner({ onResult }: { onResult: (text: string) => void }) {
    useEffect(() => {
        const scanner = new Html5QrcodeScanner(
            "reader",
            {
                fps: 10,
                qrbox: 250,
                // Tambahan buat HP:
                rememberLastUsedCamera: true,
                supportedScanTypes: [0] // 0 artinya cuma pake kamera
            },
            false
        );

        scanner.render(onResult, (err) => { });

        return () => {
            scanner.clear().catch(e => console.error("Gagal stop scanner", e));
        };
    }, [onResult]);

    return (
        <div className="fixed inset-0 bg-white z-[9999] flex flex-col p-4">
            <h2 className="text-center font-bold mb-4">Arahkan Kamera ke Barcode</h2>
            <div id="reader" className="w-full"></div>
            <button
                onClick={() => window.location.reload()}
                className="mt-6 p-4 bg-red-500 text-white rounded-xl font-bold"
            >
                TUTUP KAMERA
            </button>
        </div>
    );
}