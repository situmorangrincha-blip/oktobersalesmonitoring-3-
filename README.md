# TARGET QUEST — Sales Monitoring (retro dashboard)

Upload Excel monitoring harian → langsung jadi dashboard. Tema retro/game, ada SFX + backsound (bisa on/off),
transisi 3D, dan tombol **SNAP PNG** untuk screenshot siap share ke tim.

## Deploy (GitHub → Vercel)
1. Push folder ini ke repo GitHub baru.
2. Vercel → **Add New Project** → import repo (framework otomatis terdeteksi: Vite).
3. Di project Vercel: **Storage → Create → Blob**, lalu **Connect** ke project ini
   (otomatis menambah env `BLOB_READ_WRITE_TOKEN`).
4. **Settings → Environment Variables** → tambah `DASH_PASSWORD` (password buat buka web). Redeploy.
5. Buka web → masukkan password → **UPLOAD** → pilih file Excel. Selesai.

Tiap hari: buka web → UPLOAD → pilih file baru. Bulan berjalan otomatis diganti.
Centang "Pertahankan data Sep & L3M" supaya periode lain tidak berubah.

## Jalan lokal
```
npm install
npm run dev          # tanpa backend: data disimpan di browser (IndexedDB)
npm run test:parse   # tes parser ke file Excel asli
```

## Aturan hitung
- Timegone = hari kerja berjalan ÷ total hari kerja (Senin–Sabtu). Data H-1: hari berjalan dihitung sampai kemarin (WIB).
  Libur nasional bisa diatur manual di modal UPLOAD ("Atur hari kerja manual").
- Salesman: hanya nama yang ada di sheet (LOOK) RECAPT. Toko: JKS salesman tersebut.
- ACV = ACT ÷ TGT (Milestone atau BTI, ganti lewat tombol di halaman Performa).
- CA = ACT toko ≥ Rp1. CA Produktif = ACT ≥ Minimum CA Prod (kolom LAB; kalau kosong: retail 200rb, grosir 1jt).
- Pareto JKS / SAK: dibaca dari flag di sheet LAB.
- ACT per salesman (headline) dari pivot OLAP SALES (sama dengan RECAPT). Angka per toko dari pivot per outlet.
- Kategori / SKU per toko = Sub Brand dari OLAP FOCUS CATEGORY. L3M = rata-rata per bulan.

## Catatan keamanan
Data disimpan di Vercel Blob dengan nama acak dan hanya bisa diambil lewat API yang dikunci `DASH_PASSWORD`.
Batas ukuran data ±4 MB (file sekarang ±0,6 MB).
