# Kế hoạch Visual Assets — Ma Sói Online

> **Step 1 — Asset Planning** theo mục 10.1.E của `plan.md`.
> Prompt tạo ảnh cho từng asset: [`docs/chatgpt-image-prompts.md`](./chatgpt-image-prompts.md).
> Phiên bản tài liệu: 1.0 — 2026-11-07.

## Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Chiến lược kích thước](#2-chiến-lược-kích-thước)
3. [Safe area — vùng an toàn cho UI](#3-safe-area--vùng-an-toàn-cho-ui)
4. [Quy ước chung](#4-quy-ước-chung)
5. [Pipeline trong repo](#5-pipeline-trong-repo)
6. [Danh sách asset theo thư mục](#6-danh-sách-asset-theo-thư-mục)
7. [Thứ tự sản xuất đề xuất](#7-thứ-tự-sản-xuất-đề-xuất)
8. [Checklist bàn giao](#8-checklist-bàn-giao)
9. [Checklist Visual QA](#9-checklist-visual-qa)
10. [Giả định và điểm cần xác nhận](#10-giả-định-và-điểm-cần-xác-nhận)

---

## 1. Tổng quan

**Phân công**

| Bên | Trách nhiệm |
|---|---|
| ChatGPT (công cụ tạo ảnh) | Tạo toàn bộ artwork: thẻ nhân vật, mặt sau thẻ, background, icon, hiệu ứng, emblem logo. |
| Người dùng | Gửi prompt sang ChatGPT, duyệt ảnh, tải về, đổi tên đúng quy ước, đặt vào thư mục. |
| Claude Code | Cấu trúc thư mục, manifest, script kiểm tra/tối ưu, tích hợp vào React component, animation, hiệu năng, Visual QA. |

Claude Code **không** có tích hợp trực tiếp với ChatGPT (trừ khi có phiên trình duyệt được kết nối và người dùng cho phép). Không dùng ảnh stock, ảnh Internet hay emoji thay cho artwork chính thức.

**Phong cách:** Dark Fantasy Medieval Werewolf — Premium Card Game, semi-realistic fantasy illustration (không hoạt hình, không chibi, không anime). Bảng màu: xanh đen, tím than, đỏ rượu/đỏ máu, vàng đồng cổ. Ánh trăng, sương mù, ánh sáng cinematic.

**Số lượng:** 57 asset hình ảnh (P0: 29 · P1: 20 · P2: 8). Âm thanh nằm ngoài phạm vi tạo ảnh.

| Thư mục | Số file | P0 | P1 | P2 |
|---|---:|---:|---:|---:|
| `cards/` | 9 | 6 | 0 | 3 |
| `card-backs/` | 1 | 1 | 0 | 0 |
| `backgrounds/` | 22 | 12 | 9 | 1 |
| `icons/` | 12 | 8 | 0 | 4 |
| `effects/` | 12 | 1 | 11 | 0 |
| `logos/` | 1 | 1 | 0 | 0 |
| **Tổng** | **57** | **29** | **20** | **8** |

**Nguyên tắc bất biến**

1. **Không có chữ, số, logo, watermark, chữ ký** trong bất kỳ artwork nào. Tên vai, mô tả kỹ năng và wordmark "Ma Sói" đều render bằng HTML/CSS để hỗ trợ đa ngôn ngữ.
2. **Không vẽ sẵn khung/viền/panel UI** vào artwork thẻ hay background. Khung thẻ theo phe làm bằng CSS/SVG. (Ngoại lệ có chủ đích: `effects/border-ornament.png` chính là khung trang trí, và họa tiết trang trí bên trong mặt sau thẻ.)
3. **Mọi đường dẫn asset đi qua manifest** `apps/web/src/lib/assets.ts`. Không hardcode `/assets/...` trong component.
4. **Thiếu artwork không được chặn Game Engine.** Trong lúc phát triển dùng placeholder kỹ thuật (gradient + nhãn tên asset) do manifest trả về khi file chưa có. Placeholder không bao giờ dùng cho production.
5. Ưu tiên chất lượng hình ảnh hơn số lượng hiệu ứng; giao diện không rối mắt.

---

## 2. Chiến lược kích thước

### 2.1. Vì sao chọn các kích thước master này

Công cụ tạo ảnh của ChatGPT chỉ xuất **3 kích thước**:

| Kích thước | Tỷ lệ | Dùng cho |
|---|---|---|
| 1024×1536 (dọc) | 2:3 | Thẻ bài, mặt sau thẻ, background mobile |
| 1536×1024 (ngang) | 3:2 | Background desktop, transition, border, fog |
| 1024×1024 (vuông) | 1:1 | Icon, hiệu ứng, emblem logo (nền trong suốt) |

Không thể yêu cầu trực tiếp 1920×1080 hay 1080×1920. Vì vậy:

- **Master = đúng kích thước gốc ChatGPT xuất ra.** Không kéo giãn, không upscale thủ công trước khi đưa vào repo.
- Phần chênh lệch tỷ lệ được xử lý bằng CSS `object-fit: cover` + `object-position` (focal point lưu trong manifest).
- Nếu ChatGPT trả sai kích thước (ví dụ 1024×1024 cho một thẻ bài): **tạo lại**, không tự cắt/kéo.

### 2.2. Bảng chiến lược theo nhóm

| Nhóm | Master | Tỷ lệ master | Tỷ lệ hiển thị | Cách hiển thị | Phần có thể bị cắt |
|---|---|---|---|---|---|
| Thẻ bài (`cards/`, `card-backs/`) | 1024×1536 | 2:3 | 2:3 | `aspect-ratio: 2/3; object-fit: cover` | Không bị cắt (đúng tỷ lệ) |
| Background desktop | 1536×1024 | 3:2 | 16:9 (chuẩn) | full-screen, `object-fit: cover` | Trên + dưới ~8% mỗi bên ở 16:9 |
| Background mobile (`-mobile`) | 1024×1536 | 2:3 | ~9:16 | full-screen, `object-fit: cover` | Trái + phải ~7–8% mỗi bên ở 9:16 (tới ~15% trên điện thoại rất dài) |
| Icon, hiệu ứng vuông, emblem | 1024×1024 | 1:1 | 1:1 | `object-fit: contain` | Không bị cắt |
| Hiệu ứng ngang (`transition-*`, `border-ornament`, `fog-overlay`) | 1536×1024 | 3:2 | full-screen / khung | `cover` / 9-slice / lặp ngang | Như background desktop |

### 2.3. Phép tính crop (tham khảo khi bố cục)

**Background desktop 1536×1024:**

| Viewport | Vùng nhìn thấy trên master | Bị cắt |
|---|---|---|
| 16:9 (1920×1080, 1366×768) | 1536×864 | 80px trên + 80px dưới (~7,8% mỗi bên) |
| 16:10 (MacBook) | 1536×960 | 32px trên + 32px dưới (~3%) |
| 21:9 (ultrawide) | 1536×~658 | ~183px trên + dưới (~18%) → dùng `object-position` theo focal point |
| 4:3 (tablet ngang) | ~1365×1024 | ~85px trái + phải (~5,6%) |

→ **Dải 16:9 trung tâm** (y = 80 → 944px) là vùng chắc chắn được thấy trên desktop. Mọi chi tiết quan trọng phải nằm trong dải này.

**Background mobile 1024×1536:**

| Viewport | Vùng nhìn thấy trên master | Bị cắt |
|---|---|---|
| 9:16 | 864×1536 | 80px trái + 80px phải (~7,8% mỗi bên) |
| 19,5:9 (iPhone/Android hiện đại) | ~709×1536 | ~157px trái + phải (~15% mỗi bên) |
| 3:4 (tablet dọc) | 1024×~1365 | ~85px trên + dưới (~5,6%) |

→ Chi tiết quan trọng của bản mobile nằm trong **70% chiều rộng ở giữa**.

**Quy tắc chọn bản:** viewport dọc (`max-aspect-ratio: 1/1`) dùng `<name>-mobile.png`; viewport ngang dùng `<name>.png`. Thực hiện bằng `<picture>`/`media` hoặc logic trong component `PhaseBackground`, nguồn đường dẫn lấy từ manifest.

**Màn hình rộng hơn 1536px:** ảnh desktop bị phóng nhẹ (×1,25 ở 1920px, ×1,67 ở 2560px). Với tranh painterly có lớp scrim/vignette CSS, mức này chấp nhận được. Nếu Visual QA thấy mờ, có thể bổ sung bước upscale trong pipeline (P2) — master trong repo vẫn giữ 1536×1024.

---

## 3. Safe area — vùng an toàn cho UI

### 3.1. Thẻ nhân vật (1024×1536)

```
 0% ┌───────────────────────────┐
    │ ~5% lề: khung CSS theo phe │
    │                           │
    │      ĐẦU / KHUÔN MẶT      │  mắt ở ~28–32% từ trên
    │   (toàn bộ đầu trong 0–55%)│
 55%│      THÂN / ĐẠO CỤ CHÍNH  │  đèn lồng, quả cầu, bình thuốc… ở 40–65%
 70%├───────────────────────────┤
    │  PANEL TÊN VAI + KỸ NĂNG  │  HTML phủ lên, có gradient tối
    │  → artwork êm, tối, không │
    │    có chi tiết quan trọng  │
100%└───────────────────────────┘
```

- Khung CSS/SVG theo phe chiếm ~4–5% mỗi cạnh (≈40–50px trên master): không đặt chi tiết quan trọng sát mép.
- **30% dưới cùng** bị panel tên + kỹ năng che → chỉ có vải áo tối, sương, mặt đất; không có tay, mặt, đạo cụ chính.
- Thẻ mini/thumbnail (< 120px rộng): ẩn panel, crop vuông quanh mặt bằng `object-position: 50% 28%` (focal point lưu trong manifest).
- Màu khung theo phe (CSS): Làng = vàng cổ, Sói = đỏ máu, Đặc biệt = tím/bạc.

### 3.2. Background desktop (1536×1024)

```
   0 ┌──────────────────────────────────────────┐
     │  có thể bị cắt ở 16:9 (~8%) — chỉ bầu trời │
  80 ├──────────────────────────────────────────┤
     │ Điểm nhấn (trăng, lâu đài, mái nhà, đuốc) │
     │ đặt ở 1/3 trái/phải và dải trên (8–35%)   │
     │          ┌────────────────────┐          │
     │          │  VÙNG UI ~60% GIỮA │          │
     │          │  (20–80% ngang/dọc)│          │
     │          │  êm, tương phản    │          │
     │          │  thấp, ít chi tiết │          │
     │          └────────────────────┘          │
 944 ├──────────────────────────────────────────┤
     │  có thể bị cắt ở 16:9 (~8%) — mặt đất/sương│
1024 └──────────────────────────────────────────┘
```

- **60% ở giữa** (từ 20% đến 80% theo cả hai chiều) là nơi đặt panel UI (danh sách người chơi, đồng hồ, nút hành động, thẻ bài) → giữ êm, tối vừa, ít chi tiết, không có điểm sáng gắt.
- Không có nhân vật làm trọng tâm trong background (trừ khi prompt ghi rõ là bóng/silhouette nhỏ ở rìa).
- Code sẽ thêm lớp scrim (gradient tối) để chữ đạt tương phản; artwork nên có độ sáng tổng thể trung bình–thấp.

### 3.3. Background mobile (1024×1536)

```
  0% ┌────────────────────────┐
     │░│ header / status bar │░│  0–10%: chỉ bầu trời
 10% │░│ ĐIỂM NHẤN: trăng,   │░│  10–40%: dải tiêu điểm
     │░│ lâu đài, mái nhà    │░│
 40% │░├─────────────────────┤░│
     │░│ UI: lưới người chơi │░│  40–100%: tối, êm,
     │░│ panel hành động,    │░│  sương, mặt đất, bóng tối
     │░│ nút bấm             │░│
100% └────────────────────────┘
      ░ = 15% mỗi bên có thể bị cắt trên điện thoại dài
```

---

## 4. Quy ước chung

- **Định dạng master:** PNG, sRGB, 8-bit/kênh.
  - *Opaque* (thẻ, background, transition): PNG không cần alpha.
  - *Transparent* (icon, hiệu ứng vuông, emblem, border, fog): PNG có **alpha thật** — không phải nền caro vẽ giả.
- **Ứng dụng tự chuyển** master sang WebP/AVIF + biến thể responsive (xem §5). Không commit WebP thủ công.
- **Tên file:** chữ thường, kebab-case, đuôi `.png`, đúng y như bảng §6. Không dấu, không khoảng trắng, không hậu tố `-final`, `-v2`, `(1)`. **Không đổi tên** — code phụ thuộc vào các tên này.
- **Thay ảnh:** ghi đè cùng tên file, tăng `version` của asset trong manifest để bust cache.
- **Mức ưu tiên:**
  - **P0** — cần cho MVP chơi được với diện mạo hoàn chỉnh (6 vai cơ bản, các phase chính, logo, mặt sau thẻ).
  - **P1** — cần trước khi phát hành công khai; trong lúc chờ có fallback (dùng lại asset P0 hoặc hiệu ứng CSS).
  - **P2** — vai nâng cao (Cupid, Già Làng, Sói Trắng — chỉ bật khi `enableAdvancedRoles`, Milestone 5) hoặc biến thể phụ.

---

## 5. Pipeline trong repo

### 5.1. Cấu trúc thư mục

```
apps/web/public/assets/
├── cards/          # 9 thẻ vai, 1024×1536
├── card-backs/     # mặt sau thẻ, 1024×1536
├── backgrounds/    # 11 cảnh × (desktop 1536×1024 + mobile 1024×1536)
├── characters/     # dự phòng — chưa có asset trong đợt này
├── icons/          # icon vai + icon phe, 1024×1024 trong suốt
├── effects/        # trăng, bình thuốc, token, khung, sương, transition
├── logos/          # emblem logo (không chữ)
└── audio/          # tương lai — không tạo bằng ChatGPT
```

### 5.2. Quy trình đưa ảnh vào project

1. Tạo ảnh bằng prompt trong `docs/chatgpt-image-prompts.md`.
2. Tải về, đổi tên **đúng** tên file trong §6, đặt vào `apps/web/public/assets/<folder>/`.
3. Chạy `npm run assets:check` — kiểm tra mọi file trong manifest **tồn tại** và **đúng kích thước pixel**. Đề xuất hành vi: sai kích thước → lỗi; thiếu file P0 → cảnh báo nổi bật (app vẫn chạy bằng placeholder kỹ thuật).
4. Chạy `npm run assets:optimize` — sinh WebP (và AVIF cho background khi có lợi) + các biến thể responsive.
5. Component chỉ lấy asset qua manifest `apps/web/src/lib/assets.ts`.

### 5.3. Manifest `apps/web/src/lib/assets.ts` (đề xuất trường dữ liệu)

| Trường | Ý nghĩa |
|---|---|
| `key` | Khóa ổn định, ví dụ `cards.villager`, `backgrounds.night`, `icons.role-seer`. Role id `white_wolf` trong engine map sang file `white-wolf.png`. |
| `src` | Đường dẫn master dưới `/assets/...` |
| `width`, `height` | Kích thước pixel master — dùng cho `assets:check` và để tránh layout shift |
| `aspectRatio` | `2/3`, `3/2`, `1/1` |
| `alpha` | `true` với asset nền trong suốt |
| `priority` | `P0` / `P1` / `P2` |
| `version` | Tăng khi thay ảnh để bust cache |
| `focal` | Focal point cho `object-position` (ví dụ mặt nhân vật `50% 28%`) |
| `mobileSrc` | Với background: đường dẫn bản `-mobile` |
| `fallbackKey` | Asset dùng tạm khi file chưa có (xem cột Fallback ở §6) |
| `alt` | Alt text tiếng Việt (thẻ: "Thẻ vai Dân Làng"); background trang trí dùng `alt=""` / `aria-hidden` |

### 5.4. Biến thể responsive đề xuất

| Nhóm | Chiều rộng biến thể | Ghi chú |
|---|---|---|
| Thẻ bài | 256, 384, 512, 768, 1024 | Thẻ role reveal ~280–400 CSS px × DPR 2–3 |
| Background desktop | 768, 1280, 1536 | WebP + AVIF |
| Background mobile | 512, 768, 1024 | WebP + AVIF |
| Icon | 64, 128, 256 | Hiển thị 16–96 CSS px |
| Hiệu ứng vuông, emblem | 256, 512, 1024 | Giữ alpha |
| Hiệu ứng ngang | 768, 1536 | Giữ alpha với border/fog |

Mục tiêu dung lượng (tham khảo): thẻ 512w ≤ 80 KB, background desktop 1536w ≤ 300 KB, icon 128w ≤ 15 KB.

### 5.5. Tải ảnh và hiệu năng

- Luôn đặt `width`/`height` (hoặc `aspect-ratio`) từ manifest → không layout shift.
- **Preload:** logo + background landing; khi vào lobby preload `card-back` + `role-reveal`; trong mỗi phase preload background + transition của phase kế tiếp; preload thẻ vai của chính người chơi ngay khi nhận `ROLE_ASSIGNED`.
- **Lazy load:** thẻ trong role guide, victory/defeat, moderator, asset P2.
- `prefers-reduced-motion`: thay transition/fog động bằng crossfade đơn giản hoặc ảnh tĩnh.

---

## 6. Danh sách asset theo thư mục

Đường dẫn trong bảng tính từ `apps/web/public/assets/`. Tên component là **tên dự kiến**, có thể đổi khi implement.

### 6.1. `cards/` — Thẻ nhân vật

Chung cho cả nhóm: **1024×1536 · 2:3 · PNG opaque (không alpha)**. Safe area theo §3.1. Dùng tại: Role reveal (lật bài, `RoleCard` + `CardFlip`), Rules & role guide, thẻ mini "vai của tôi" trong header, Game over (danh sách vai thật), Moderator dashboard (role overview), Lobby (bộ vai host chọn — bản thumbnail).

| File | Vai (phe) | Ưu tiên | Khung CSS | Hiển thị & safe area riêng |
|---|---|---|---|---|
| `cards/villager.png` | Dân Làng (Làng) | P0 | Vàng cổ | Nông dân giơ đèn lồng; đèn ở 40–55%, mặt ~30% từ trên; chân + nền đá ở 30% dưới, tối. |
| `cards/werewolf.png` | Ma Sói (Sói) | P0 | Đỏ máu | Sói bán nhân dưới trăng; mắt + mõm trong 0–45%; trăng phía sau đầu làm rim light; vuốt ở 45–65%, không máu. |
| `cards/seer.png` | Tiên Tri (Làng) | P0 | Vàng cổ | Phụ nữ trùm mũ, quả cầu pha lê ở 40–55% chiếu sáng mặt từ dưới. |
| `cards/witch.png` | Phù Thủy (Làng) | P0 | Vàng cổ | Bà lang thảo dược cầm 2 bình (xanh vàng = cứu, tím = độc) ở 40–60%, hai bình tách biệt rõ trái/phải. |
| `cards/guardian.png` | Bảo Vệ (Làng) | P0 | Vàng cổ | Hiệp sĩ không đội mũ (thấy mặt), khiên tháp nghiêng bên hông, sigil trên khiên ở 45–60%; phần dưới khiên chìm vào bóng tối. |
| `cards/hunter.png` | Thợ Săn (Làng) | P0 | Vàng cổ | Kiểm lâm cầm nỏ chéo trước ngực (40–60%), không chĩa thẳng vào người xem. |
| `cards/cupid.png` | Cupid (Làng; có thể tạo phe Cặp Đôi) | P2 | Vàng cổ (viền phụ hồng vàng) | Cung thủ đeo mặt nạ, cung hồng vàng; mặt nạ + mắt ở 25–35%. Không phải em bé có cánh. |
| `cards/elder.png` | Già Làng (Làng) | P2 | Vàng cổ | Trưởng làng già chống gậy; đầu gậy hình trăng lưỡi liềm ngang tầm vai (25–40%). |
| `cards/white-wolf.png` | Sói Trắng (Đặc biệt) | P2 | Tím/bạc | Sói alpha lông trắng, mắt xanh băng; đầu trong 0–45%; tương phản rõ với thẻ Ma Sói (sáng/lạnh vs tối/đỏ). |

Fallback khi thiếu: placeholder kỹ thuật (gradient màu phe + nhãn tên vai bằng HTML).

### 6.2. `card-backs/` — Mặt sau thẻ

| File | Mục đích / Nơi dùng | Master | Tỷ lệ | Định dạng | Ưu tiên | Hiển thị & safe area |
|---|---|---|---|---|---|---|
| `card-backs/card-back.png` | Mặt sau mọi thẻ: animation lật bài ở Role reveal, thẻ úp của người chơi khác (Game over trước khi lật, Lobby minh họa) | 1024×1536 | 2:3 | PNG opaque | P0 | Sigil đầu sói + trăng lưỡi liềm ở **chính giữa** (50%/50%), đối xứng trái–phải. Không có panel chữ. Chừa ~5% mép trơn cho khung CSS. Đối xứng giúp lật bài 3D trông đúng ở cả hai chiều. |

### 6.3. `backgrounds/` — Background theo màn hình

Chung cho cả nhóm:

- Desktop `<name>.png`: **1536×1024 · tạo 3:2 · hiển thị 16:9 · PNG opaque**. Safe area theo §3.2 (giữ dải 16:9 trung tâm, giữ 60% ở giữa êm).
- Mobile `<name>-mobile.png`: **1024×1536 · tạo 2:3 · hiển thị ~9:16 · PNG opaque**. Safe area theo §3.3 (giữa 70% chiều rộng, điểm nhấn ở 10–40% chiều cao, nửa dưới tối và êm).
- Hiển thị qua component `PhaseBackground` (full-screen, `object-fit: cover`, lớp scrim CSS phía trên).

| File | Cảnh | Màn hình sử dụng | Ưu tiên | Fallback | Ghi chú bố cục / safe area riêng |
|---|---|---|---|---|---|
| `backgrounds/landing.png` | Ngôi làng dưới trăng tròn, nhìn từ đồi | Landing page; dùng lại cho Create room, Join room | P0 | — | Hero (emblem + wordmark HTML + nút "Tạo phòng"/"Tham gia") ở giữa → giữa là bầu trời đêm + sương. Trăng ở 1/3 trên trái, lâu đài 1/3 phải, mái nhà ở dải 65–90%. |
| `backgrounds/landing-mobile.png` | Như trên, bố cục dọc | Landing, Create/Join room (mobile) | P0 | — | Trăng ở 10–25%, lâu đài nhỏ góc trên phải; làng ở 40–60%; nửa dưới là sương tối cho nút bấm. |
| `backgrounds/lobby.png` | Quán trọ cổ, ánh nến | Lobby, Room settings, Rules & role guide | P0 | — | Lò sưởi ở 1/3 trái, cửa sổ có trăng 1/3 phải; giữa là tường gỗ tối với bokeh nến (danh sách người chơi + mã phòng nằm đây). |
| `backgrounds/lobby-mobile.png` | Như trên, dọc | Lobby, Room settings (mobile) | P0 | — | Xà gỗ + đèn chùm nến ở 10–35%; nửa dưới là mặt bàn gỗ tối, êm. |
| `backgrounds/role-reveal.png` | Căn phòng đá huyền bí, cột ánh trăng | Role reveal (lật bài) | P0 | — | Thẻ bài lớn đặt chính giữa → giữa chỉ có quầng sáng mềm (không vật thể) để thẻ nổi bật; vòng hoa văn sàn (không ký tự) ở 1/3 dưới. |
| `backgrounds/role-reveal-mobile.png` | Như trên, dọc | Role reveal (mobile) | P0 | — | Cột ánh trăng từ trên rọi xuống giữa; thẻ chiếm ~25–75% chiều cao → vùng này chỉ có quầng sáng mềm. |
| `backgrounds/night.png` | Rừng già tối dưới ánh trăng | Night phase, Role action ban đêm (Sói, Tiên Tri, Bảo Vệ, Phù Thủy, Cupid) | P0 | — | Thân cây hai bên làm khung tự nhiên; trăng xuyên tán ở dải trên; giữa là khoảng trống sương. Có thể có vài đốm mắt phát sáng rất nhỏ ở rìa. |
| `backgrounds/night-mobile.png` | Như trên, dọc | Night phase (mobile) | P0 | — | Trăng ở 10–25% giữa tán cây; nửa dưới là sương và rễ cây tối. |
| `backgrounds/day.png` | Quảng trường làng lúc bình minh | Dawn (công bố kết quả đêm), bắt đầu ban ngày | P0 | — | Panel thông báo ở giữa → giữa là quảng trường lát đá êm; giếng đá 1/3 trái, nắng sớm từ 1/3 phải. Vẫn giữ tông trầm, không chói. |
| `backgrounds/day-mobile.png` | Như trên, dọc | Dawn / ban ngày (mobile) | P0 | — | Bầu trời bình minh + mái nhà ở 10–40%; nửa dưới là nền đá trong bóng râm. |
| `backgrounds/discussion.png` | Hội trường làng, bàn tròn hội đồng | Day discussion (lưới người chơi + đếm ngược) | P1 | `day` | Bàn tròn ở 1/3 dưới, ghế trống; giữa là tường đá tối với cửa sổ ánh ngày dịu. Không người. |
| `backgrounds/discussion-mobile.png` | Như trên, dọc | Day discussion (mobile) | P1 | `day-mobile` | Cửa sổ cao + ánh sáng ở 10–40%; nửa dưới là mặt bàn gỗ tối. |
| `backgrounds/voting.png` | Pháp đình cổ bằng đá | Voting | P0 | — | UI dày đặc (danh sách + nút phiếu) → giữa rất êm. Ghế phán xử trống ở 1/3 phải, cân công lý đồng ở 1/3 trái, đuốc và rèm đỏ rượu ở rìa. |
| `backgrounds/voting-mobile.png` | Như trên, dọc | Voting (mobile) | P0 | — | Ghế phán xử + cân ở 10–40%; nửa dưới là bậc đá tối. |
| `backgrounds/elimination.png` | Cổng làng lúc chạng vạng, u tối, kịch tính | Elimination result | P1 | `voting` | Kết quả loại ở giữa → giữa là con đường sương dẫn vào rừng; đuốc của đám đông vô hình ở rìa trái/phải, quạ trên cổng. Không thi thể, không máu. |
| `backgrounds/elimination-mobile.png` | Như trên, dọc | Elimination result (mobile) | P1 | `voting-mobile` | Cổng + mây giông ở 10–40%; nửa dưới là đường sương tối. |
| `backgrounds/victory-village.png` | Ngôi làng đón bình minh | Game over — Làng thắng (tạm dùng cho phe Cặp Đôi thắng) | P1 | `day` | Panel tổng kết + timeline cuộn ở giữa → giữa là bầu trời bình minh dịu; mặt trời mọc 1/3 phải, cờ có sigil ở rìa. |
| `backgrounds/victory-village-mobile.png` | Như trên, dọc | Game over — Làng thắng (mobile) | P1 | `day-mobile` | Mặt trời + mái nhà ở 10–40%; nửa dưới là thung lũng phủ sương vàng nhạt nhưng vẫn đủ tối. |
| `backgrounds/victory-werewolf.png` | Ngôi làng dưới trăng máu | Game over — Sói thắng (tạm dùng cho Sói Trắng thắng) | P1 | `night` | Cùng góc nhìn với `landing` nhưng trăng đỏ máu; bóng sói tru nhỏ trên sườn đồi ở rìa; giữa là bầu trời + sương đỏ sẫm, êm. |
| `backgrounds/victory-werewolf-mobile.png` | Như trên, dọc | Game over — Sói thắng (mobile) | P1 | `night-mobile` | Trăng máu ở 10–25%; nửa dưới là làng tối + sương đỏ sẫm. |
| `backgrounds/moderator.png` | Bàn làm việc gỗ sồi với sách cổ, bản đồ, nến | Moderator dashboard | P1 | `lobby` | Dashboard phủ gần hết → vật thể chỉ nằm ở rìa (nến, sách, đồng hồ cát, la bàn); giữa là mặt da thuộc tối của bàn. Bản đồ không có chữ. |
| `backgrounds/moderator-mobile.png` | Như trên, dọc | Moderator dashboard (mobile/tablet dọc) | P2 | `lobby-mobile` | Nến + sách ở 0–25%; còn lại là mặt bàn tối. |

### 6.4. `icons/` — Icon vai và icon phe

Chung cho cả nhóm: **1024×1024 · 1:1 · PNG trong suốt (alpha)** · emblem chiếm ~80% canvas, padding ~10% mỗi cạnh · phải đọc được ở 24–32px · cùng một "họ" icon (kim loại vàng cổ chạm nổi, men màu nhấn theo vai).

| File | Mục đích | Nơi dùng | Ưu tiên | Hiển thị |
|---|---|---|---|---|
| `icons/role-villager.png` | Icon Dân Làng (đèn lồng) | Lobby (bộ vai host chọn), Rules & role guide, Moderator role overview, Game over, badge trên thẻ mini | P0 | 24–64px, `RoleIcon` |
| `icons/role-werewolf.png` | Icon Ma Sói (đầu sói nhìn nghiêng, mắt đỏ) | Như trên + danh sách đồng đội Sói ban đêm | P0 | 24–64px |
| `icons/role-seer.png` | Icon Tiên Tri (quả cầu pha lê) | Như trên + panel kết quả soi | P0 | 24–64px |
| `icons/role-witch.png` | Icon Phù Thủy (hai bình bắt chéo) | Như trên | P0 | 24–64px |
| `icons/role-guardian.png` | Icon Bảo Vệ (khiên tháp) | Như trên | P0 | 24–64px |
| `icons/role-hunter.png` | Icon Thợ Săn (nỏ) | Như trên + màn Thợ Săn bắn | P0 | 24–64px |
| `icons/role-cupid.png` | Icon Cupid (cung hồng vàng + mũi tên hoa hồng) | Như trên + đánh dấu cặp đôi | P2 | 24–64px |
| `icons/role-elder.png` | Icon Già Làng (gậy đầu trăng lưỡi liềm) | Như trên | P2 | 24–64px |
| `icons/role-white-wolf.png` | Icon Sói Trắng (đầu sói trắng nhìn thẳng, mắt xanh băng) | Như trên | P2 | 24–64px |
| `icons/team-village.png` | Huy hiệu phe Làng (khiên huy hiệu: nhà + mặt trời mọc) | Góc khung thẻ, Game over (đội thắng), Moderator, Rules | P0 | 20–48px, `TeamBadge` |
| `icons/team-werewolf.png` | Huy hiệu phe Sói (khiên huy hiệu: dấu chân sói + trăng tròn) | Như trên | P0 | 20–48px |
| `icons/team-special.png` | Huy hiệu phe Đặc biệt (khiên huy hiệu: nhật/nguyệt thực) — Sói Trắng, Cặp Đôi | Như trên | P2 | 20–48px |

Phân biệt phe **không chỉ bằng màu**: mỗi icon phe có hình biểu tượng khác nhau (nhà/mặt trời, dấu chân sói, nguyệt thực) để hỗ trợ người mù màu.

### 6.5. `effects/` — Hiệu ứng, vật phẩm, trang trí

| File | Mục đích / Nơi dùng | Master | Tỷ lệ | Định dạng | Ưu tiên | Fallback | Hiển thị & safe area |
|---|---|---|---|---|---|---|---|
| `effects/moon-full.png` | Trăng tròn: lớp trời động ở Night phase (`MoonIndicator`, trăng mọc), đếm số đêm | 1024×1024 | 1:1 | PNG alpha | P0 | — | Đĩa trăng ~70% canvas, căn giữa; quầng sáng tạo bằng CSS (`drop-shadow`/radial gradient), không vẽ quầng lớn trong ảnh. |
| `effects/moon-blood.png` | Trăng máu: màn hành động của Sói, overlay Sói thắng | 1024×1024 | 1:1 | PNG alpha | P1 | `moon-full` + CSS tint | Cùng hình dạng, vị trí, kích thước với `moon-full` để crossfade khớp tuyệt đối. |
| `effects/transition-dusk.png` | Chuyển ngày → đêm (`PhaseTransition`), có dòng chữ HTML "Đêm thứ N" ở giữa | 1536×1024 | 3:2 | PNG opaque | P1 | Gradient CSS | Toàn màn hình, wipe/crossfade. Chân trời + mái nhà silhouette ở 20% dưới; giữa là bầu trời chuyển màu trơn cho chữ. |
| `effects/transition-dawn.png` | Chuyển đêm → ngày, chữ HTML "Bình minh ngày N" | 1536×1024 | 3:2 | PNG opaque | P1 | Gradient CSS | Cùng đường chân trời với `transition-dusk` để hai ảnh nối tiếp mượt. |
| `effects/potion-heal.png` | Bình cứu: panel hành động Phù Thủy, tóm tắt đêm của quản trò, timeline Game over | 1024×1024 | 1:1 | PNG alpha | P1 | `role-witch` | 48–160px. Bình tròn, chất lỏng vàng–xanh lục phát sáng. |
| `effects/potion-poison.png` | Bình độc: như trên | 1024×1024 | 1:1 | PNG alpha | P1 | `role-witch` | 48–160px. Bình góc cạnh (silhouette khác bình cứu), chất lỏng tím. |
| `effects/vote-token.png` | Token phiếu bầu: đếm phiếu cạnh avatar (Voting), bảng kiểm phiếu (Elimination) | 1024×1024 | 1:1 | PNG alpha | P1 | Chấm CSS + số | 20–48px, xếp chồng; đồng xu nhìn thẳng, đọc được ở 20px. |
| `effects/shield.png` | Lá chắn ánh sáng: đánh dấu người được bảo vệ (giao diện Bảo Vệ, quản trò) | 1024×1024 | 1:1 | PNG alpha | P1 | `role-guardian` | Phủ lên avatar 48–96px; bán trong suốt, khác hẳn icon khiên kim loại. |
| `effects/victory-emblem.png` | Emblem chiến thắng cá nhân ở Game over | 1024×1024 | 1:1 | PNG alpha | P1 | Icon phe | 160–320px, phía trên tiêu đề HTML. |
| `effects/defeat-emblem.png` | Emblem thất bại cá nhân ở Game over | 1024×1024 | 1:1 | PNG alpha | P1 | Icon phe (grayscale) | 160–320px. |
| `effects/border-ornament.png` | Khung trang trí cho panel/modal (`OrnateFrame`, CSS `border-image` 9-slice) | 1536×1024 | 3:2 | PNG alpha | P1 | Viền CSS | Góc hoa văn nằm trong ô ~15% mỗi góc; cạnh là đường kép mảnh, đồng đều để kéo giãn; **giữa trong suốt 100%**. |
| `effects/fog-overlay.png` | Lớp sương trôi ngang (`FogLayer`) trên Landing, Night, Role reveal, Elimination | 1536×1024 | 3:2 | PNG alpha (bán trong suốt) | P1 | Không có / gradient CSS | Lặp ngang (`repeat-x`, trôi chậm) → **mép trái và phải phải khớp nhau**. Sương dày ở 40% dưới, mờ dần lên trên. Opacity trong app 30–60%. |

### 6.6. `logos/`

| File | Mục đích / Nơi dùng | Master | Tỷ lệ | Định dạng | Ưu tiên | Hiển thị & safe area |
|---|---|---|---|---|---|---|
| `logos/logo-emblem.png` | Emblem của game (`BrandLogo`): hero Landing, header, màn loading, nguồn cho favicon/app icon và ảnh chia sẻ (OG) | 1024×1024 | 1:1 | PNG alpha | P0 | **Chỉ emblem, KHÔNG có chữ.** Wordmark "Ma Sói" render bằng HTML/CSS cạnh/bên dưới emblem. Đối xứng, padding ~8%, phải đọc được ở 32px (favicon có thể cần bản đơn giản hóa sau). |

### 6.7. `characters/` — dự phòng

Thư mục có trong cấu trúc của `plan.md` (§10.1.F) nhưng **không có asset trong đợt này** — artwork nhân vật nằm trong `cards/`. Có thể dùng sau cho bản cắt nền trong suốt của nhân vật (ví dụ minh họa trong role guide). `assets:check` bỏ qua thư mục này.

### 6.8. `audio/` — tương lai, ngoài phạm vi tạo ảnh

Không tạo bằng ChatGPT. Dự kiến (chưa chốt tên file): âm báo chuyển đêm, âm báo bình minh, tiếng tích tắc sắp hết giờ, âm khóa phiếu, âm loại người chơi, nhạc nền rừng đêm, nhạc chiến thắng Làng/Sói. Sẽ lập kế hoạch riêng ở Milestone 5 (Sounds).

---

## 7. Thứ tự sản xuất đề xuất

Tạo theo lô để khóa phong cách sớm và có diện mạo MVP nhanh nhất:

| Lô | Nội dung | Mục đích |
|---|---|---|
| 1 — Khóa phong cách | Master prompt → `cards/villager.png` → duyệt kỹ | Thẻ Dân Làng là **ảnh tham chiếu phong cách** cho mọi ảnh sau |
| 2 — Thẻ P0 | `werewolf`, `seer`, `witch`, `guardian`, `hunter`, `card-back`, `logo-emblem` | Đủ để lật bài và nhận diện thương hiệu |
| 3 — Background P0 | `landing`, `lobby`, `role-reveal`, `night`, `day`, `voting` (desktop + mobile) | Đủ màn hình cho một trận MVP |
| 4 — Icon P0 + trăng | 6 icon vai cơ bản, `team-village`, `team-werewolf`, `moon-full` | Lobby, role guide, night |
| 5 — P1 | 5 cảnh còn lại (trừ `moderator-mobile`), toàn bộ `effects/` còn lại | Hoàn thiện trước phát hành |
| 6 — P2 | `cupid`, `elder`, `white-wolf` (thẻ + icon), `team-special`, `moderator-mobile` | Vai nâng cao, Milestone 5 |

---

## 8. Checklist bàn giao

Trước khi báo Claude Code tích hợp một lô ảnh:

- [ ] Tên file đúng tuyệt đối như §6 (chữ thường, kebab-case, `.png`).
- [ ] Đặt đúng thư mục `apps/web/public/assets/<folder>/`.
- [ ] Đúng kích thước pixel (1024×1536 / 1536×1024 / 1024×1024). Kiểm tra nhanh trên macOS: `sips -g pixelWidth -g pixelHeight <file>`.
- [ ] Là PNG thật. Nếu ChatGPT tải về `.webp`/`.jpg`: mở bằng Preview → File → Export → PNG (không chỉ đổi đuôi).
- [ ] Asset yêu cầu trong suốt có **alpha thật** (`sips -g hasAlpha <file>` trả về `yes`; mở trên nền tối không thấy ô caro hay nền trắng).
- [ ] Không có chữ, số, ký tự giả, logo, watermark, chữ ký (phóng to 200% kiểm tra các góc).
- [ ] Không có khung/viền/panel vẽ sẵn (trừ `border-ornament` và họa tiết bên trong `card-back`).
- [ ] Safe area: mặt nhân vật trong 55% trên; 30% dưới của thẻ tối và êm; 60% giữa của background êm; chi tiết quan trọng nằm trong dải 16:9 (desktop) / 70% giữa (mobile).
- [ ] Không bạo lực máu me, không nhạy cảm, nhân vật đều là người lớn.
- [ ] Đã chạy `npm run assets:check` (không lỗi kích thước) và `npm run assets:optimize`.
- [ ] Nếu thay ảnh cũ: đã tăng `version` trong manifest.

## 9. Checklist Visual QA

Theo Step 5 của `plan.md`, kiểm tra sau khi tích hợp:

- [ ] **Card không bị kéo giãn**: mọi thẻ hiển thị đúng 2:3 (`aspect-ratio` + `object-fit: cover`) ở mọi kích thước.
- [ ] **Nhân vật không bị crop mất mặt**: kiểm tra thẻ lớn (role reveal), thẻ trung bình (role guide), thẻ mini (header) và thumbnail vuông.
- [ ] **Background không che nội dung**: panel UI đọc rõ, không có điểm sáng gắt hay chi tiết rối ngay sau chữ.
- [ ] **Text trên nền đủ tương phản**: tối thiểu WCAG AA (4,5:1 chữ thường, 3:1 chữ lớn) — kiểm tra trên vùng sáng nhất của từng background, có scrim khi cần.
- [ ] **Phong cách nhất quán giữa các vai**: xếp 9 thẻ cạnh nhau — cùng góc máy, cùng hướng ánh sáng (trăng trên trái), cùng mức chi tiết, cùng bảng màu; icon cùng một họ.
- [ ] **Mobile và desktop đều đẹp**: thử 360×800, 390×844, 430×932, 768×1024, 1366×768, 1440×900, 1920×1080, 2560×1080; dọc và ngang.
- [ ] **Hiệu ứng chuyển phase mượt**: không nháy trắng, không giật; ảnh phase kế tiếp đã preload; `prefers-reduced-motion` chỉ crossfade.
- [ ] Không layout shift (CLS ≈ 0) khi ảnh tải.
- [ ] Icon đọc được ở 24px và 32px; phân biệt phe không chỉ dựa vào màu.
- [ ] `fog-overlay` lặp ngang không lộ đường nối; `moon-full` và `moon-blood` crossfade khớp vị trí.
- [ ] `border-ornament` kéo giãn 9-slice không méo góc.
- [ ] Logo emblem rõ ở 32px và 512px, wordmark HTML căn đúng.
- [ ] Ảnh lazy load không làm trống màn hình quan trọng; ảnh P0 của phase hiện tại đã có trước khi phase bắt đầu.

---

## 10. Giả định và điểm cần xác nhận

1. **Ưu tiên:** Cupid, Già Làng, Sói Trắng xếp P2 vì `RULES.md` chỉ bật khi `enableAdvancedRoles` (mặc định tắt). Background `discussion`, `elimination`, `victory-*`, `moderator` xếp P1 vì có fallback dùng lại cảnh P0.
2. **Phe Đặc biệt / Cặp Đôi thắng:** chưa có background riêng. Tạm thời Sói Trắng thắng dùng `victory-werewolf`, Cặp Đôi thắng dùng `victory-village` kèm tint CSS + `team-special`. Có thể bổ sung asset riêng sau (cần thêm vào manifest và tài liệu này trước).
3. **Role id `white_wolf`** trong engine ánh xạ sang file `white-wolf.png` / `role-white-wolf.png` qua manifest.
4. **Transition dusk/dawn là ảnh opaque** toàn khung (không alpha); hiệu ứng wipe/mask làm bằng CSS.
5. **Sương và quầng sáng bán trong suốt** khó tạo chuẩn bằng ChatGPT. Nếu `fog-overlay.png` không có alpha mềm đạt yêu cầu, phương án dự phòng: tạo sương trắng trên nền đen tuyền và để pipeline chuyển độ sáng thành alpha (hoặc dùng `mix-blend-mode: screen`). Cần thống nhất với người viết `assets:optimize` nếu dùng phương án này.
6. **Favicon/app icon/OG image** được dẫn xuất từ `logo-emblem.png` bởi pipeline; nếu emblem quá chi tiết ở 16–32px sẽ cần một bản đơn giản hóa (chưa có trong danh sách).
7. Màn hình **Rules & role guide** dùng lại background `lobby`; **Create room / Join room** dùng lại `landing`.
