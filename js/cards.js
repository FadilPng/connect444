"use strict";
const CARDS = [
  { id:"purge", name:"Purge", weight:1, category:"offense", duration:"INSTANT", desc:"Hapus satu koin di mana saja, milikmu atau lawan. Koin ber-Shield tidak bisa dihapus." },
  { id:"magnetic", name:"Magnetic Pull", weight:2, category:"offense", duration:"INSTANT", desc:"Hapus koin yang paling dekat dengan koin terakhir yang dijatuhkan. Jika jaraknya sama, pilih salah satunya." },
  { id:"heavy", name:"Heavy Coin", weight:4, category:"offense", duration:"INSTANT", desc:"Jatuhkan koin berat, lalu hapus semua koin lain pada baris tempatnya mendarat. Hanya saat gravitasi ke bawah." },
  { id:"bomb", name:"Bomb Coin", weight:4, category:"offense", duration:"INSTANT", desc:"Jatuhkan bom yang langsung meledak dalam area 3 x 3, termasuk koin bomnya. Hanya saat gravitasi ke bawah." },
  { id:"gravity", name:"Gravity Shift", weight:2, category:"control", duration:"2 RONDE / 4 GILIRAN", desc:"Geser gravitasi ke kiri atau kanan selama 4 giliran berikutnya. Klik baris untuk drop dari arah berlawanan. Saat habis, gravitasi kembali ke bawah." },
  { id:"flip", name:"Flip the Board", weight:4, category:"control", duration:"SAMPAI DROP BERIKUTNYA", desc:"Papan tidak berputar dan gravitasi tetap ke bawah. Di setiap kolom, koin paling atas bertukar posisi dengan koin paling bawah: yang di atas menjadi di bawah, dan sebaliknya. Tumpukan koin tetap rapi di dasar kolom." },
  { id:"bottom", name:"Bottom Eradication", weight:4, category:"offense", duration:"INSTANT", desc:"Hapus semua koin di baris paling bawah, apa pun arah gravitasi saat ini." },
  { id:"void", name:"Gravity Void", weight:5, category:"offense", duration:"INSTANT", desc:"Pilih satu kolom fisik, lalu hapus semua koin di dalamnya. Tetap memilih kolom meskipun gravitasi menyamping." },
  { id:"superbomb", name:"Super Bomb", weight:5, category:"offense", duration:"INSTANT", desc:"Jatuhkan bom besar yang langsung menghapus area 5 x 5. Koin ber-Shield bertahan. Hanya saat gravitasi ke bawah." },
  { id:"ouroboros", name:"Ouroboros", weight:2, category:"control", duration:"2 RONDE / 4 GILIRAN", desc:"Tukar kolom paling kiri dan paling kanan selama 4 giliran berikutnya. Kolom yang sama dipulihkan saat habis, termasuk setelah Expansion. Pemakaian ulang memperbarui durasi." },
  { id:"expansion", name:"Expansion", weight:3, category:"control", duration:"PERMANEN / MAKS. 2", desc:"Tambah satu kolom di kanan atau satu baris di atas. Maksimal dua perluasan per match. Row Lock mengikuti baris fisiknya." },
  { id:"forced", name:"Forced Action", weight:2, category:"control", duration:"GILIRAN LAWAN BERIKUTNYA", desc:"Tentukan apakah lawan wajib drop atau memakai kartu sekali pada giliran berikutnya. Batasan dilepas jika aksi tidak tersedia; aksi ekstra Overload tetap berlaku." },
  { id:"threshold", name:"Threshold Shift", weight:5, category:"control", duration:"2 RONDE / 4 GILIRAN", desc:"Ubah target menjadi Connect 3 atau Connect 5 selama 4 giliran berikutnya. Garis yang sudah ada langsung dihitung untuk kedua pemain. Setelah habis, target kembali ke 4." },
  { id:"colorblind", name:"Colorblind", weight:4, category:"control", duration:"1 RONDE / 2 GILIRAN", desc:"Sembunyikan pemilik semua koin selama 2 giliran berikutnya. Tidak ada kemenangan selama efek aktif. Warna dan pemeriksaan kemenangan kembali saat habis." },
  { id:"colorblindplus", name:"Colorblind+", weight:5, category:"control", duration:"2 RONDE / 4 GILIRAN", desc:"Versi lanjutan Colorblind: semua warna disembunyikan dan kemenangan ditunda selama 4 giliran berikutnya." },
  { id:"recycle", name:"Recycle", weight:1, category:"support", duration:"DROP PENGGANTI", desc:"Gunakan kartu ini untuk mengganti aksi kartu dengan satu drop biasa. Drop pengganti tetap dihitung sebagai aksi kartu untuk Overload." },
  { id:"demotion", name:"Demotion", weight:5, category:"offense", duration:"SEPANJANG MATCH", desc:"Hapus satu kartu acak dari loadout lawan selama sisa match. Kartu yang dihapus tidak akan muncul dalam penawaran lagi." },
  { id:"mimic", name:"Mimic", weight:3, category:"support", duration:"MENGIKUTI KARTU ASAL", desc:"Salin efek kartu terakhir yang selesai dimainkan, termasuk pilihan target dan durasinya. Hanya ditawarkan jika efek tersebut masih bisa digunakan." },
  { id:"shield", name:"Shield", weight:1, category:"support", duration:"2 RONDE / 4 GILIRAN", desc:"Lindungi satu koin milikmu dari seluruh penghapusan selama 4 giliran berikutnya. Shield tidak habis karena satu serangan." },
  { id:"overload", name:"Overload", weight:5, category:"support", duration:"GILIRANMU BERIKUTNYA", desc:"Pada giliranmu berikutnya, lakukan satu drop dan satu aksi kartu, dalam urutan bebas. Aksi yang tidak mungkin dilakukan dilewati." },
  { id:"lock", name:"Column Lock", weight:2, category:"control", duration:"1 RONDE / 2 GILIRAN", desc:"Kunci satu jalur drop selama 2 giliran berikutnya: kolom untuk gravitasi vertikal, baris untuk gravitasi menyamping. Kunci tetap pada jalur fisik yang sama." },
  { id:"reposition", name:"Reposition", weight:3, category:"control", duration:"INSTANT", desc:"Pilih dua koin untuk menukar posisi keduanya. Setelah pertukaran, gravitasi berlaku dan koin turun ke tempatnya masing-masing." },
  { id:"decoy", name:"Decoy", weight:1, category:"support", duration:"SAMPAI DIHAPUS", desc:"Jatuhkan koin netral yang mengisi ruang tetapi tidak pernah dihitung sebagai koneksi kemenangan." }
];
const CARD_BY_ID = Object.fromEntries(CARDS.map(card => [card.id, card]));
const CATEGORY_COLOR = { offense:"#e99b77", control:"#d9ed7b", support:"#82cbd9" };
