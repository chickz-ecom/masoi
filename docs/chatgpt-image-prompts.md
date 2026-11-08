# Prompt tạo hình ảnh bằng ChatGPT — Ma Sói Online

> **Step 2 — ChatGPT Image Prompts** theo mục 10.1.E của `plan.md`.
> Danh sách asset, kích thước, safe area và mức ưu tiên: [`docs/visual-assets-plan.md`](./visual-assets-plan.md).
> Phiên bản tài liệu: 1.0 — 2026-11-07.

## Mục lục

0. [Cách sử dụng](#0-cách-sử-dụng)
1. [Master Art Direction Prompt](#1-master-art-direction-prompt)
2. [Thẻ nhân vật — `cards/`](#2-thẻ-nhân-vật--cards)
3. [Mặt sau thẻ — `card-backs/`](#3-mặt-sau-thẻ--card-backs)
4. [Backgrounds — `backgrounds/`](#4-backgrounds--backgrounds)
5. [Icons — `icons/`](#5-icons--icons)
6. [Effects — `effects/`](#6-effects--effects)
7. [Logo — `logos/`](#7-logo--logos)
8. [Audio — không áp dụng](#8-audio--không-áp-dụng)
9. [Quy trình kiểm tra sau khi tạo](#9-quy-trình-kiểm-tra-sau-khi-tạo)
10. [Bảng ánh xạ prompt → tên file](#10-bảng-ánh-xạ-prompt--tên-file)

---

## 0. Cách sử dụng

**Quy trình cơ bản**

1. Mở **một cuộc trò chuyện mới** trong ChatGPT (dùng model có công cụ tạo ảnh).
2. Dán **Master Art Direction Prompt** (mục 1.1). ChatGPT chỉ trả lời "Ready", chưa tạo ảnh.
3. Dán **lần lượt từng prompt asset**, mỗi lần một prompt, **trong cùng cuộc trò chuyện đó** để ChatGPT giữ phong cách nhất quán.
4. Xem ảnh. Nếu chưa đạt, dùng các **prompt sửa nhanh** ở mục 1.3 thay vì viết lại từ đầu.
5. Tải ảnh về, đổi tên **đúng** tên file ghi ở tiêu đề của prompt (ví dụ `cards/villager.png` → file `villager.png` trong thư mục `cards/`).
6. Đặt vào `apps/web/public/assets/<folder>/`.
7. Chạy `npm run assets:check` rồi `npm run assets:optimize`. Đánh dấu ☐ → ☑ trong bảng mục 10.

**Về việc Claude và ChatGPT**

- Claude Code **không có tích hợp trực tiếp với ChatGPT**. Claude chỉ có thể thao tác ChatGPT nếu có một phiên trình duyệt được kết nối (ví dụ tiện ích Claude in Chrome) và bạn đã đăng nhập, cho phép — ngay cả khi đó, bạn vẫn là người duyệt từng ảnh.
- Cách mặc định: **bạn tự chạy các prompt này thủ công** rồi đưa ảnh vào project; Claude Code lo phần kiểm tra, tối ưu và tích hợp.

**Mẹo giữ phong cách nhất quán**

- Tạo `cards/villager.png` **đầu tiên** và duyệt kỹ. Ảnh này là **ảnh tham chiếu phong cách** cho cả bộ.
- Cuộc trò chuyện quá dài dễ làm phong cách bị "trôi". Nên tách mỗi nhóm (thẻ · background · icon + effects + logo) thành một cuộc trò chuyện riêng; mỗi lần: dán Master prompt trước, rồi **đính kèm 1–2 ảnh đã duyệt** (ví dụ `villager.png`, `landing.png`) và nói: *"Use the attached approved images as the style reference for everything in this conversation."*
- Bản **mobile** của mỗi background nên được tạo **ngay sau** bản desktop trong cùng cuộc trò chuyện (ChatGPT sẽ bám theo cảnh vừa tạo).
- Tạo theo thứ tự ưu tiên P0 → P1 → P2 (xem `visual-assets-plan.md` §7). ChatGPT có giới hạn số ảnh theo thời gian; nếu bị giới hạn, chờ rồi tiếp tục trong cùng cuộc trò chuyện.

**Kích thước**

- ChatGPT chỉ tạo **1024×1024**, **1536×1024** (ngang) hoặc **1024×1536** (dọc). Mỗi prompt đã ghi rõ kích thước.
- Sai kích thước → yêu cầu tạo lại (prompt sửa nhanh F). Không tự kéo giãn hay cắt.

**Nền trong suốt**

- Prompt của icon, hiệu ứng, emblem đều yêu cầu *transparent background*. Kiểm tra kỹ: đôi khi ChatGPT **vẽ ô caro giả** thay vì alpha thật. Dùng prompt sửa nhanh C, hoặc kiểm tra bằng `sips -g hasAlpha <file>` trên macOS.

---

## 1. Master Art Direction Prompt

### 1.1. Master prompt — dán đầu tiên trong mọi cuộc trò chuyện

```text
You are the lead concept artist for "Ma Sói", an original dark-fantasy werewolf social-deduction card game. For the rest of this conversation, every image you create must follow this art direction exactly. Do NOT generate an image for this message — just reply "Ready" and wait for my asset briefs.

GENRE & MOOD
Dark Fantasy Medieval Werewolf, premium collectible card game. Mysterious, tense, beautiful, cinematic — never chaotic or cluttered. Dread is implied through shadow, mist and silhouette, not shown through gore.

WORLD (reuse these landmarks everywhere)
- An original late-medieval European village in a valley: timber-framed houses with dark slate roofs, small warm-lit windows, cobblestone streets, a stone well, a small stone chapel with a spire, a wooden watchtower, a wooden palisade gate.
- An ancient forest of massive pines and gnarled oaks surrounding the valley, with low rolling mist.
- An old ruined castle on a rocky hill above the village.
- One large, pale silver-blue full moon (it becomes blood-red only when a brief says so).
- Rustic and lived-in. Not steampunk, not modern, not Asian, not sci-fi.

STYLE
- Semi-realistic fantasy illustration, premium card-game quality, painterly digital painting with fine detail and controlled visible brushwork.
- Characters are adults with believable anatomy, dignified and mysterious expressions, layered costumes of worn wool, linen, leather and metal.
- NOT cartoon, NOT chibi, NOT anime/manga, NOT children's-book style, NOT 3D render or plastic look, NOT photograph, NOT pixel art.

PALETTE (strict)
- Base: deep navy and blue-black (around #0B1020–#141B33), dark indigo-violet shadows (around #2A1F4A).
- Accents: wine / blood red (around #7A1020–#A3192B) and antique gold / bronze (around #B8893B, #8C6A2F).
- Moonlight: cool silver-blue. Warm practical light (candles, lanterns, torches, fire): amber-gold, used sparingly as accents.
- Overall low saturation and low-to-mid key; highest contrast only at the focal point.

LIGHTING & CAMERA
- Cinematic lighting: cool moonlight as rim/back light from the upper left, a warm secondary light from a practical source, deep realistic shadows, volumetric mist and light shafts.
- Character cards (all identical camera language): portrait 2:3, three-quarter body from head to mid-thigh, eye-level camera, ~50mm lens feel, character centered, body turned slightly, face toward the viewer, head in the upper half, bottom 30% darker and calm.
- Backgrounds: wide cinematic establishing shots, eye-level, atmospheric perspective, calm low-detail center (UI is placed there), no people as focal point unless stated.

RECURRING MOTIF — THE "MA SÓI SIGIL"
A silver-gold crescent moon cradling a stylized forward-facing wolf head. It appears subtly on objects (a clasp, a brooch, a shield boss, a medallion, a banner, an engraving) — always as a symbol, never with letters.

HARD RULES FOR EVERY IMAGE
1. Absolutely NO text: no letters, words, numbers, runes, glyphs, inscriptions, captions or titles anywhere — not on books, signs, banners, maps or labels.
2. NO logos, watermarks, signatures or artist marks.
3. NO frames, borders, card templates, panels, buttons or UI elements baked into the artwork — the game adds frames with CSS. Opaque images are full-bleed, edge to edge.
4. Original designs only: do not imitate or copy the artwork, characters, card layouts or logos of any existing commercial werewolf or social-deduction game, film or artist.
5. Adults only. PG-13: no gore, no blood splatter, no wounds, no corpses, no sexualization, no revealing clothing.
6. Clean, readable compositions that still read at small sizes.
7. Output exactly the requested size: portrait 1024x1536, landscape 1536x1024, or square 1024x1024. When a transparent background is requested, use a real alpha channel (PNG) — never a painted checkerboard or a solid color.
```

### 1.2. Câu nhắc lại (re-anchor) — dùng khi phong cách bắt đầu trôi

```text
Reminder before the next image: strictly follow the Ma Sói Master Art Direction from the start of this conversation — semi-realistic painterly fantasy, navy / blue-black / indigo base with wine-red and antique-gold accents, cool moonlight from the upper left, cinematic shadows, no text, no frames, no logos, full-bleed. Match the rendering, detail level and lighting of the approved Villager card.
```

### 1.3. Prompt sửa nhanh

**A — Xóa chữ/ký tự lạ**
```text
Regenerate the same image with the identical composition, lighting and colors, but remove every letter, number, rune, inscription, signature and watermark. Symbols are allowed only as the crescent-and-wolf sigil.
```

**B — Xóa khung/viền**
```text
Regenerate the same image without any frame, border, card template or vignette box. The artwork must be full-bleed, edge to edge.
```

**C — Nền trong suốt thật**
```text
Recreate exactly the same object with a real transparent background (alpha channel, PNG). No checkerboard pattern, no white, black or colored background, no ground shadow.
```

**D — Sửa bố cục thẻ (mặt bị thấp hoặc panel dưới bị rối)**
```text
Keep the same character, outfit, lighting and style, but reframe: move the character up so the whole head is inside the upper 55% of the canvas (eyes about 30% from the top), and make the bottom 30% darker, calmer and low-detail — only shadowed clothing, mist and ground. Portrait 1024x1536.
```

**E — Sửa background (giữa quá rối)**
```text
Keep the same scene, landmarks and lighting, but make the central 60% of the frame calm, low-contrast and low-detail (soft mist, sky or dark empty surfaces), and move the focal elements to the left and right thirds and the upper band. Keep the same size.
```

**F — Sai kích thước**
```text
Regenerate this exact image at the correct size: [portrait 1024x1536 | landscape 1536x1024 | square 1024x1024].
```

**G — Phong cách bị trôi (quá hoạt hình / quá sáng / quá bão hòa)**
```text
This drifted from the art direction. Regenerate it as a semi-realistic painterly fantasy illustration (not cartoon, not anime, not 3D render), lower the saturation, darken the overall key, use the navy / indigo / wine-red / antique-gold palette and cinematic moonlight from the upper left. Match the attached approved images.
```

---

## 2. Thẻ nhân vật — `cards/`

Chung cho cả nhóm: **portrait 1024×1536 (2:3), PNG opaque, full-bleed**. Đầu nhân vật trong 55% phía trên, 30% dưới cùng tối và êm (panel tên + kỹ năng HTML sẽ phủ lên), lề ~5% mỗi cạnh cho khung CSS.

### 2.1. `cards/villager.png` — Dân Làng · [P0] · **tạo đầu tiên (ảnh tham chiếu phong cách)**

```text
Generate the role card artwork for the VILLAGER, following the Ma Sói Master Art Direction.

Subject: A weathered village farmer in his late 40s, broad-shouldered, short greying beard, tired but resolute eyes. Rough undyed linen shirt, patched brown wool vest, heavy dark hooded cloak pushed back from the head, leather belt with a small sickle. He holds an old iron lantern raised at chest height in his right hand; its warm flame lights his face from below and to the side.
Setting: A narrow cobbled street of the Ma Sói village at night — timber-framed houses with dark slate roofs, a few warm windows, low mist on the ground; far behind him, softly out of focus, the large pale full moon and the silhouette of the ruined castle on its hill.
Composition: Portrait card art, full-bleed, no frame. Character centered, three-quarter body from head to mid-thigh, eye-level camera, body turned slightly, face toward the viewer. The whole head sits in the upper 55% of the canvas, eyes about 30% from the top. The lantern sits at about 45–55% of the height. The bottom 30% is calm and darker — shadowed clothing, mist and cobblestones only, no important detail — because a text panel will cover it. Keep a ~5% margin on every edge free of important details.
Style: Semi-realistic painterly fantasy illustration, premium card-game quality, fine detail on face, hands and fabric textures.
Palette: Deep navy and blue-black night, indigo shadows; warm amber-gold lantern light as the main accent; touches of antique bronze on the lantern metal.
Lighting: Cool silver-blue moonlight rim light from the upper left; warm lantern key light on the face; deep realistic shadows; soft volumetric mist.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536.
Negative: No text, letters, numbers, runes or inscriptions; no logo, watermark or signature; no frame, border or card template; no UI; no cartoon, anime, chibi or 3D-render look; no pitchfork mob; no gore; no modern objects; no extra fingers or distorted hands; head not cropped.
Consistency anchors: Master Art Direction palette and lighting; the standard role-card camera framing; the same village architecture, moon and ruined castle; a tiny crescent-and-wolf sigil pierced into the lantern's iron cap.
```

### 2.2. `cards/werewolf.png` — Ma Sói · [P0]

```text
Generate the role card artwork for the WEREWOLF, following the Ma Sói Master Art Direction and matching the approved Villager card's framing and rendering.

Subject: A menacing semi-human werewolf standing upright on two legs: wolf head with a long muzzle, bared fangs (clean, no blood), glowing amber-red eyes, ears pinned back; a lean, powerful humanoid body covered in dark charcoal-grey fur; long clawed hands. A tattered, hooded wine-red cloak, torn at the hem, drapes over its shoulders, fastened by a tarnished metal clasp. Slightly hunched, one clawed hand raised at chest height — predatory and intelligent, not a mindless beast.
Setting: The edge of the ancient forest just outside the Ma Sói village: gnarled pine trunks, low mist, a few distant village roofs with warm windows far behind. A huge pale full moon directly behind the werewolf's head and shoulders.
Composition: Portrait card art, full-bleed, no frame. Figure centered, three-quarter body from head to mid-thigh, eye-level camera. The head sits in the upper 45% of the canvas, eyes about 27% from the top, framed by the moon behind it. The raised claw sits at about 40–55% of the height. The bottom 30% is calm and dark — cloak, mist and forest floor only — because a text panel will cover it. Keep a ~5% margin on every edge free of important details.
Style: Semi-realistic painterly fantasy illustration, premium card-game quality, detailed fur, fabric and claw textures; menacing but elegant.
Palette: Blue-black and navy night, dark indigo shadows, wine-red cloak, amber-red eyes as the brightest accent, silver moonlight.
Lighting: Strong silver-blue moonlight backlight creating a rim light around fur and cloak; face partly in shadow with glowing eyes; deep realistic shadows; mist catching the moonlight.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536.
Negative: No text, letters, numbers, runes or inscriptions; no logo, watermark or signature; no frame or border; no blood, gore, prey or corpses; no ordinary animal wolf on four legs; no cute or cartoon wolf; no exaggerated bodybuilder anatomy; no anime look; head not cropped.
Consistency anchors: Same camera framing and rendering as the Villager card; the same moon, forest and village; the cloak clasp is shaped like the crescent-and-wolf sigil.
```

### 2.3. `cards/seer.png` — Tiên Tri · [P0]

```text
Generate the role card artwork for the SEER, following the Ma Sói Master Art Direction and matching the approved Villager card's framing and rendering.

Subject: A hooded woman in her early 30s with calm, knowing eyes and a faint enigmatic expression. A deep indigo velvet hooded mantle with fine antique-gold embroidery along the hood edge, a dark layered dress, a few silver rings. She holds a clear crystal orb in both hands at chest height; inside the orb swirls soft silver-violet mist with a faint glimmer of moonlight.
Setting: A small candlelit chamber at the top of a stone tower in the village. Behind her, an arched window shows the full moon and the ruined castle on its hill; shelves with glass bottles and dried herbs, and the silhouette of a brass astrolabe, softly out of focus.
Composition: Portrait card art, full-bleed, no frame. Character centered, three-quarter body from head to mid-thigh, eye-level camera, face toward the viewer. The whole head sits in the upper 55% of the canvas, eyes about 30% from the top. The orb sits at about 42–55% of the height and lights her face from below. The bottom 30% is calm and dark — folds of the mantle and shadow only — because a text panel will cover it. Keep a ~5% margin on every edge free of important details.
Style: Semi-realistic painterly fantasy illustration, premium card-game quality, delicate detail on face, hands, velvet and glass.
Palette: Indigo-violet dominant with navy and blue-black; silver-violet orb glow; antique-gold embroidery; small warm candle accents.
Lighting: The orb's glow is the key light from below on her face and hands; cool moonlight rim light from the window at the upper left; faint warm candle fill; deep shadows.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536.
Negative: No text, letters, numbers, runes or inscriptions; no books with visible writing; no tarot cards; no carnival fortune-teller costume; no third eye or glowing face tattoos; no logo, watermark or frame; no cartoon or anime look; head not cropped.
Consistency anchors: Same camera framing and rendering as the Villager card; the same moon and ruined castle through the window; her hood brooch is the crescent-and-wolf sigil.
```

### 2.4. `cards/witch.png` — Phù Thủy · [P0]

```text
Generate the role card artwork for the WITCH, following the Ma Sói Master Art Direction and matching the approved Villager card's framing and rendering.

Subject: An elderly herbalist woman around 65, weathered face, sharp intelligent eyes and a hint of a wry smile, long silver-grey hair in a loose braid. Layered robes of dark moss-green and wine-red wool, a leather apron, a belt with herb pouches, small knives and dried roots. She holds two potions at chest height, clearly separated on either side of her body: on the viewer's left, a round-bellied glass flask with glowing golden-green healing liquid; on the viewer's right, an angular faceted dark glass bottle with glowing violet poison liquid, wrapped by a thin thorny vine.
Setting: The cluttered interior of her cottage at the forest edge: bundles of dried herbs hanging from dark beams, shelves of jars, a small cauldron with dim embers in the background, a small window with moonlight.
Composition: Portrait card art, full-bleed, no frame. Character centered, three-quarter body from head to mid-thigh, eye-level camera, face toward the viewer. The whole head sits in the upper 55% of the canvas, eyes about 30% from the top. The two potions sit at about 40–60% of the height. The bottom 30% is calm and dark — robes, apron and shadow only — because a text panel will cover it. Keep a ~5% margin on every edge free of important details.
Style: Semi-realistic painterly fantasy illustration, premium card-game quality; wise and ambiguous, neither good nor evil.
Palette: Navy-black interior, moss green and wine-red clothing, golden-green and violet potion glows, antique bronze jar lids.
Lighting: The two potions act as dual colored key lights on her face (golden-green from one side, violet from the other); cool moonlight rim light from the upper left; faint warm ember glow.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536.
Negative: No text, letters, numbers or labels on bottles or jars; no pointy hat; no broomstick; no green skin; no hag caricature; no skulls; no logo, watermark or frame; no cartoon or anime look; head not cropped.
Consistency anchors: Same camera framing and rendering as the Villager card; the potion shapes (round heal flask, angular thorn-wrapped poison bottle) must match the potion effect icons; a carved wooden amulet with the crescent-and-wolf sigil hangs at her neck.
```

### 2.5. `cards/guardian.png` — Bảo Vệ · [P0]

```text
Generate the role card artwork for the GUARDIAN, following the Ma Sói Master Art Direction and matching the approved Villager card's framing and rendering.

Subject: A stoic adult knight in his 30s, bare-headed (no helmet) with short dark hair and a short beard, steady protective gaze. Weathered steel plate armor with antique-gold trims over chainmail, a dark navy tabard. He holds a large tower shield of dark steel and oak upright at his side (on the viewer's right), angled slightly toward the viewer; an embossed antique-gold crescent-and-wolf sigil sits in the center of the shield. His other hand rests on a sheathed sword hilt.
Setting: The wooden palisade gate of the Ma Sói village at night, a watchtower with a burning torch, low mist, the full moon in the upper left.
Composition: Portrait card art, full-bleed, no frame. Character centered, three-quarter body from head to mid-thigh, eye-level camera, face toward the viewer. The whole head sits in the upper 55% of the canvas, eyes about 30% from the top. The shield's sigil sits at about 45–60% of the height. The lower part of the shield and the legs fade into shadow and mist in the bottom 30%, which stays calm because a text panel will cover it. Keep a ~5% margin on every edge free of important details.
Style: Semi-realistic painterly fantasy illustration, premium card-game quality, worn metal and fabric detail.
Palette: Steel grey-blue, navy tabard, antique-gold trims and sigil, warm torch accents, blue-black night.
Lighting: Cool moonlight rim light from the upper left on the armor edges; warm torchlight from the side; worn metal reflections; deep shadows.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536.
Negative: No helmet, visor or mask covering the face; no crusader cross or religious symbols; no heraldic text or letters; no blood; no logo, watermark or frame; no cartoon or anime look; head not cropped.
Consistency anchors: Same camera framing and rendering as the Villager card; the same village gate and moon; the shield sigil is the canonical crescent-and-wolf sigil.
```

### 2.6. `cards/hunter.png` — Thợ Săn · [P0]

```text
Generate the role card artwork for the HUNTER, following the Ma Sói Master Art Direction and matching the approved Villager card's framing and rendering.

Subject: A lean, alert ranger in his late 30s, sharp watchful eyes, stubble. A hooded dark green-brown leather coat, a fur mantle on the shoulders, leather bracers, a quiver of crossbow bolts on his back. He holds a heavy wooden crossbow diagonally across his chest, loaded, pointing to the side and downward — never at the viewer.
Setting: The misty forest edge near the village at night: tall pines, silver moonbeams through the branches, the faint warm glow of a distant village window.
Composition: Portrait card art, full-bleed, no frame. Character centered, three-quarter body from head to mid-thigh, eye-level camera, face toward the viewer, eyes glancing slightly to the side as if hearing something. The whole head sits in the upper 55% of the canvas, eyes about 30% from the top. The crossbow sits at about 40–60% of the height. The bottom 30% is calm and dark — coat, mist and forest floor only — because a text panel will cover it. Keep a ~5% margin on every edge free of important details.
Style: Semi-realistic painterly fantasy illustration, premium card-game quality, detailed leather, fur and wood textures.
Palette: Desaturated forest greens sinking into navy-black, brown leather, antique-bronze crossbow fittings, silver moonlight.
Lighting: Moonbeams from the upper left, rim light on the hood and crossbow; deep forest shadows; subtle mist.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536.
Negative: No weapon pointed at the viewer; no blood or dead animals; no firearms; no text, letters or numbers; no logo, watermark or frame; no cartoon or anime look; head not cropped.
Consistency anchors: Same camera framing and rendering as the Villager card; the same forest; the quiver buckle is shaped like the crescent-and-wolf sigil.
```

### 2.7. `cards/cupid.png` — Cupid · [P2]

```text
Generate the role card artwork for CUPID, following the Ma Sói Master Art Direction and matching the approved Villager card's framing and rendering.

Subject: A mysterious, elegant adult archer of ambiguous gender, slender, wearing an ornate rose-gold Venetian-style half mask over the eyes and upper face (eyes visible through the mask). A dark wine-red hooded cloak with rose-gold embroidery of vines and roses, a fitted dark doublet, leather gloves. Holds a graceful rose-gold recurve bow in one hand and, lowered in the other, an arrow with a rose-gold head and dark red fletching. A single dark red rose is tucked into the belt.
Setting: An overgrown moonlit rose garden behind the village chapel: climbing roses on a stone arch, drifting rose petals, low mist.
Composition: Portrait card art, full-bleed, no frame. Character centered, three-quarter body from head to mid-thigh, eye-level camera, face toward the viewer. The whole head sits in the upper 55% of the canvas; the mask and eyes at about 25–35% from the top. The bow sits at about 40–60% of the height. The bottom 30% is calm and dark — cloak, petals and shadow only — because a text panel will cover it. Keep a ~5% margin on every edge free of important details.
Style: Semi-realistic painterly fantasy illustration, premium card-game quality; romantic yet unsettling.
Palette: Wine red and deep rose, rose-gold accents, navy night, silver moonlight.
Lighting: Cool moonlight rim light from the upper left; warm rose-gold sheen on the mask and bow; petals catching the light; deep shadows.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536.
Negative: NOT a baby, NOT a cherub, NO wings, no halo, no heart symbols, no pink candy colors, no nudity or revealing clothing; no text, letters or numbers; no logo, watermark or frame; no cartoon or anime look; head not cropped.
Consistency anchors: Same camera framing and rendering as the Villager card; the same chapel and moon; a tiny crescent-and-wolf sigil engraved on the mask's forehead.
```

### 2.8. `cards/elder.png` — Già Làng · [P2]

```text
Generate the role card artwork for the ELDER, following the Ma Sói Master Art Direction and matching the approved Villager card's framing and rendering.

Subject: An old village chief around 75, long white beard, deep-set wise eyes, a weathered and dignified face, a little weary. A heavy dark navy wool robe with a fur-trimmed collar, an antique-gold chain of office with a round medallion. He leans on a tall gnarled wooden staff topped with an antique-gold crescent finial, held so the finial is beside his head at shoulder height.
Setting: The stone steps of the village hall at night: two iron braziers with low fire, heavy carved wooden doors (plain carvings, no inscriptions), low mist, the full moon in the upper left.
Composition: Portrait card art, full-bleed, no frame. Character centered, three-quarter body from head to mid-thigh, eye-level camera, face toward the viewer. The whole head sits in the upper 55% of the canvas, eyes about 30% from the top. The crescent finial sits at about 25–40% of the height; the medallion at about 45–55%. The bottom 30% is calm and dark — robe folds and steps in shadow only — because a text panel will cover it. Keep a ~5% margin on every edge free of important details.
Style: Semi-realistic painterly fantasy illustration, premium card-game quality, detailed wrinkles, beard, wool and fur.
Palette: Navy and indigo robes, white and grey beard, antique-gold chain and finial, warm brazier glow.
Lighting: Warm brazier light from one side; cool moonlight rim light from the upper left; deep shadows.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536.
Negative: No wizard hat, no magic spell effects, no crown; no text, letters, numbers or inscriptions on doors or medallion; no logo, watermark or frame; no cartoon or anime look; head not cropped.
Consistency anchors: Same camera framing and rendering as the Villager card; the same village architecture and moon; the medallion bears the crescent-and-wolf sigil.
```

### 2.9. `cards/white-wolf.png` — Sói Trắng · [P2]

```text
Generate the role card artwork for the WHITE WOLF, following the Ma Sói Master Art Direction and matching the approved Villager and Werewolf cards' framing and rendering.

Subject: A pale white-furred alpha werewolf standing upright, larger and more regal than the common werewolf, with a thick mane of silver-white fur dusted with frost crystals, piercing icy pale-blue glowing eyes, a dark crescent-shaped mark in the fur on its brow, long fangs (clean, no blood) and clawed hands. A torn pale-grey mantle across one shoulder, fastened with a silver clasp. Calm, cold, dominant expression — the apex predator, clearly distinct from the dark common werewolf.
Setting: A frosty rocky outcrop on the hill above the forest; the Ma Sói village tiny and far below in the valley; the ruined castle on the next hill; a cold full moon behind; light snow flurries and mist.
Composition: Portrait card art, full-bleed, no frame. Figure centered, three-quarter body from head to mid-thigh, eye-level camera. The head sits in the upper 45% of the canvas, eyes about 27% from the top, framed by the moon. The bottom 30% is calm and dark — fur, mantle, rock and mist only — because a text panel will cover it. Keep a ~5% margin on every edge free of important details.
Style: Semi-realistic painterly fantasy illustration, premium card-game quality, detailed frosted fur.
Palette: Silver-white, icy pale blue, cold navy and indigo; one small wine-red accent (a red thread on the clasp) linking it to the wolves.
Lighting: Cold moonlight backlight with a strong silver rim; icy blue glow from the eyes; frost sparkles; deep cold shadows.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536.
Negative: No ordinary animal wolf on four legs; not a recolored copy of the dark werewolf (different silhouette with a mane and frost); no blood or gore; no text, letters or numbers; no logo, watermark or frame; no cartoon or anime look; head not cropped.
Consistency anchors: Same camera framing and rendering as the other role cards; the same moon, castle and village; the silver clasp is shaped like the crescent-and-wolf sigil.
```

---

## 3. Mặt sau thẻ — `card-backs/`

### 3.1. `card-backs/card-back.png` — Mặt sau thẻ · [P0]

```text
Generate the BACK of the Ma Sói playing card, following the Ma Sói Master Art Direction.

Subject: A central symmetrical emblem — the Ma Sói sigil: a stylized forward-facing wolf head cradled within a large crescent moon, rendered in engraved antique gold with silver highlights and a tiny wine-red gem below the wolf's chin. Around it, concentric rings of fine gold filigree with small stars and moon-phase discs (no numbers), and symmetrical scrollwork reaching toward the four corners.
Setting: No scene. A deep navy to blue-black velvet-like surface with a very subtle tone-on-tone damask pattern and a faint indigo glow behind the emblem.
Composition: Flat front view, no perspective. The central emblem is mirror-symmetric left-to-right and centered exactly at 50% width and 50% height, about 55% of the canvas width. The surrounding filigree pattern is symmetric both left-right and top-bottom. Keep a ~5% plain dark margin on every edge with no outer border line (the game adds the frame in CSS). No text area is needed.
Style: Premium collectible card back, intricate but clean, painterly metallic rendering.
Palette: Deep navy, blue-black, dark indigo, antique gold and bronze, silver highlights, one small wine-red gem.
Lighting: Soft even lighting with a subtle metallic sheen on the gold and a gentle glow at the center.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536.
Negative: No text, letters, numbers, roman numerals or runes; no playing-card suits, indices or corner numbers; no outer rectangular border or frame line; no 3D perspective or tilted card; no hands; no photo look.
Consistency anchors: The canonical crescent-and-wolf sigil used on the character cards and the logo emblem; the same antique gold and navy materials.
```

---

## 4. Backgrounds — `backgrounds/`

Chung cho cả nhóm:

- **Desktop** `<name>.png`: landscape 1536×1024, hiển thị cắt về 16:9 (trên/dưới ~8% có thể mất). 60% ở giữa phải êm.
- **Mobile** `<name>-mobile.png`: portrait 1024×1536, hiển thị ~9:16 (trái/phải 8–15% có thể mất). Điểm nhấn ở 10–40% chiều cao, 60% dưới tối và êm.
- Tạo bản mobile **ngay sau** bản desktop trong cùng cuộc trò chuyện.

### 4.1. Landing — ngôi làng dưới trăng tròn

#### `backgrounds/landing.png` · [P0]

```text
Generate the LANDING PAGE background (desktop), following the Ma Sói Master Art Direction.

Subject: The Ma Sói village under the full moon — the establishing shot of the game world. No characters.
Setting: Seen from a forested hillside above: a valley village of timber-framed houses with dark slate roofs and a few warm amber windows, a small stone chapel with a spire, a wooden watchtower, a stone bridge over a stream; the ancient pine forest wraps around the valley; the ruined castle on a rocky hill in the right third; a huge pale full moon in the upper-left third; layers of mist drifting through the valley.
Composition: Wide cinematic landscape, eye-level from the hillside. Keep the central 60% of the frame (20–80% horizontally and vertically) calm, low-contrast and low-detail — open night sky and soft mist — because a logo and buttons will be placed there. The moon sits about 20–30% from the left and 15–30% from the top; the castle in the right third; the village rooftops in a band at 65–90% of the height, small in scale. Keep everything important inside the central 16:9 band: the top and bottom ~8% (about 80px each) may be cropped.
Style: Cinematic matte painting, semi-realistic painterly fantasy, strong atmospheric perspective.
Palette: Navy and blue-black, indigo-violet sky gradient, silver moonlight, small warm amber windows, tiny antique-gold highlights.
Lighting: Moonlight from the upper left, volumetric mist glowing under the moon, warm windows as small accents; overall low key.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024 (will be displayed cropped to 16:9).
Negative: No text, letters, numbers or signs; no logo, watermark or frame; no people or werewolves in focus; no bright daylight; no busy detail in the center; no cartoon or anime look; no modern objects.
Consistency anchors: This is the canonical view of the village, the moon and the ruined castle — the victory backgrounds and phase transitions reuse this vantage and these landmarks.
```

#### `backgrounds/landing-mobile.png` · [P0]

```text
Generate the MOBILE (portrait) version of the LANDING PAGE background, following the Ma Sói Master Art Direction. If the landscape landing background was generated earlier in this conversation, keep the same location, landmarks, lighting and mood — recompose it for a tall phone screen, do not just crop it.

Subject: The Ma Sói village under the full moon, seen from the forested hillside above. No characters.
Setting: Timber-framed houses with dark slate roofs and a few warm windows, the chapel spire, the watchtower, the ancient pine forest around the valley, the ruined castle on its rocky hill, a huge pale full moon, layers of mist.
Composition: Tall portrait composition. Top 10%: sky only. The moon sits at 10–25% of the height, slightly left of center; the castle small in the upper right; the village in a band at 40–60% of the height. The lower 40% is dark, calm and low-detail — mist and forest shadow — because buttons will sit there. The left and right ~15% may be cropped on tall phones: keep important elements inside the central 70% of the width.
Style: Cinematic matte painting, semi-realistic painterly fantasy.
Palette: Navy and blue-black, indigo-violet sky, silver moonlight, small warm amber windows.
Lighting: Moonlight from the upper left, glowing mist, warm windows as small accents; low key.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536 (will be displayed around 9:16).
Negative: No text, letters, numbers or signs; no logo, watermark or frame; no people in focus; no busy detail in the lower half; no cartoon or anime look.
Consistency anchors: Same village, moon and castle as the desktop landing background.
```

### 4.2. Lobby — quán trọ cổ với ánh nến

#### `backgrounds/lobby.png` · [P0]

```text
Generate the LOBBY background (desktop), following the Ma Sói Master Art Direction.

Subject: The interior of the village's old tavern — the gathering place before the game. No people.
Setting: A low ceiling with heavy dark oak beams; a large stone fireplace with a low crackling fire in the left third; many candles on iron holders and on tables; long wooden tables with empty tankards and benches; a leaded-glass window in the right third showing the full moon over the misty village; bundles of dried herbs hanging from the beams; wine-red cloth on a table.
Composition: Wide interior shot, eye-level. Keep the central 60% of the frame (20–80% horizontally and vertically) calm and low-detail — a dim back wall of dark wood with soft, out-of-focus candle bokeh — because the player list and room panel will sit there. Fireplace in the left third, moonlit window in the right third. Keep everything important inside the central 16:9 band: the top and bottom ~8% may be cropped.
Style: Cinematic painterly interior, semi-realistic fantasy, shallow depth of field.
Palette: Warm amber candle and fire glow balanced against navy and indigo shadows; wine-red cloth; antique-bronze candleholders.
Lighting: Warm firelight from the left, cool moonlight through the window from the right; cozy but mysterious; low key.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024 (will be displayed cropped to 16:9).
Negative: No people; no signs, chalkboards, menus or papers with writing; no text, letters or numbers; no logo, watermark or frame; no bright evenly lit room; no cartoon look.
Consistency anchors: The same village visible through the window and the same moon; timber construction matching the village architecture.
```

#### `backgrounds/lobby-mobile.png` · [P0]

```text
Generate the MOBILE (portrait) version of the LOBBY background, following the Ma Sói Master Art Direction. If the landscape lobby background was generated earlier in this conversation, keep the same tavern, lighting and mood — recompose it for a tall phone screen, do not just crop it.

Subject: The interior of the village's old tavern. No people.
Setting: Dark oak beams, an iron candle chandelier, a stone fireplace glow at one side, a leaded-glass window with the moon, hanging herbs, a long wooden table.
Composition: Tall portrait composition. The beams, the candle chandelier and a glimpse of the moonlit window sit in the 10–35% band. The lower 60% is calm and dark — the top of a long dark wooden table receding into shadow with soft candle bokeh — because the player list will sit there. Keep important elements inside the central 70% of the width (the sides may be cropped).
Style: Cinematic painterly interior, semi-realistic fantasy, shallow depth of field.
Palette: Warm amber candlelight against navy and indigo shadows, antique bronze, small wine-red accents.
Lighting: Warm candle and fire glow, a cool moonlight touch from the window; low key.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536 (will be displayed around 9:16).
Negative: No people; no writing anywhere; no text, letters or numbers; no logo, watermark or frame; no busy lower half; no cartoon look.
Consistency anchors: Same tavern as the desktop lobby background.
```

### 4.3. Role reveal — không gian huyền bí để lật thẻ

#### `backgrounds/role-reveal.png` · [P0]

```text
Generate the ROLE REVEAL background (desktop), following the Ma Sói Master Art Direction.

Subject: A mystical ritual chamber where each player's fate is revealed. No people.
Setting: An ancient circular stone chamber beneath the ruined castle; tall dark stone pillars at the left and right edges; a single shaft of silver moonlight falling from an opening in the ceiling onto the center of the floor; floating dust motes and faint violet sparks; a circular pattern engraved in the stone floor made of moon phases and abstract geometric lines (no letters, no runes); faint mist pooling on the floor.
Composition: Wide symmetrical interior, eye-level. The center of the frame holds only a soft radial glow of moonlight and floating dust — completely empty of objects — because a large card will appear exactly there. The engraved floor circle sits in the lower third in perspective; pillars frame the left and right edges. Keep the central 60% calm and low-detail. Keep everything important inside the central 16:9 band: the top and bottom ~8% may be cropped.
Style: Cinematic painterly fantasy, semi-realistic, mysterious and reverent.
Palette: Deep indigo-violet and navy, silver-blue moonlight, antique-gold engraved lines in the floor, tiny wine-red sparks.
Lighting: One top-down moonlight shaft as the key light; everything else falls off into darkness; volumetric light.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024 (will be displayed cropped to 16:9).
Negative: No objects, altar items or cards in the center; no letters, runes or glyphs in the floor pattern; no text or numbers; no logo, watermark or frame; no people; no cartoon look.
Consistency anchors: Same moon light quality and indigo/gold palette as the other scenes; the floor circle may echo the crescent-and-wolf sigil at its very center, subtly.
```

#### `backgrounds/role-reveal-mobile.png` · [P0]

```text
Generate the MOBILE (portrait) version of the ROLE REVEAL background, following the Ma Sói Master Art Direction. If the landscape role-reveal background was generated earlier in this conversation, keep the same chamber, lighting and mood — recompose it for a tall phone screen.

Subject: The mystical stone ritual chamber beneath the ruined castle. No people.
Setting: Dark stone pillars at the sides, an opening in the ceiling with a shaft of silver moonlight falling to the floor, dust motes, faint violet sparks, an engraved floor circle of moon phases and geometric lines, low mist.
Composition: Tall portrait composition. The ceiling opening sits at 5–15% of the height; the moonlight shaft falls vertically through the center. The area from 25% to 75% of the height is only a soft glow with floating dust — no objects — because a large card will appear there. The engraved floor circle sits in the lowest 20%, dark and subtle. Keep important elements inside the central 70% of the width.
Style: Cinematic painterly fantasy, semi-realistic.
Palette: Indigo-violet and navy, silver-blue moonlight, faint antique-gold engraving, tiny wine-red sparks.
Lighting: Top-down moonlight shaft as the key light, strong falloff into darkness, volumetric light.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536 (will be displayed around 9:16).
Negative: No objects in the center; no letters, runes or glyphs; no text or numbers; no logo, watermark or frame; no people; no cartoon look.
Consistency anchors: Same chamber as the desktop role-reveal background.
```

### 4.4. Night — khu rừng tối dưới ánh trăng

#### `backgrounds/night.png` · [P0]

```text
Generate the NIGHT PHASE background (desktop), following the Ma Sói Master Art Direction.

Subject: Deep night in the ancient forest — the hour of the werewolves. No visible figures.
Setting: An ancient forest of massive pines and gnarled oaks; thick trunks frame the left and right edges; the full moon visible through a gap in the canopy in the upper area; silver moonbeams cutting through layered mist; a faint path leading into darkness; two or three pairs of tiny glowing amber eyes deep among the trees near the edges (very subtle); the faint warm glow of the village far away through the trees at the left.
Composition: Wide cinematic shot, eye-level. Keep the central 60% of the frame calm, dark and low-detail — a misty clearing — because the night action panel will sit there. The moon sits in the upper band (12–30% from the top), left of center; trunks frame the outer edges. Keep everything important inside the central 16:9 band: the top and bottom ~8% may be cropped.
Style: Cinematic matte painting, semi-realistic painterly fantasy, eerie and quiet.
Palette: Blue-black and navy, cold silver moonlight, indigo shadows, tiny amber eye accents.
Lighting: Moonlight from above through the canopy, volumetric beams, deep shadows; very low key.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024 (will be displayed cropped to 16:9).
Negative: No visible werewolf body, no people, no animals in focus; no blood; no text, letters or numbers; no logo, watermark or frame; no bright areas in the center; no cartoon look.
Consistency anchors: The same moon and forest as the other scenes and the Werewolf and Hunter cards.
```

#### `backgrounds/night-mobile.png` · [P0]

```text
Generate the MOBILE (portrait) version of the NIGHT PHASE background, following the Ma Sói Master Art Direction. If the landscape night background was generated earlier in this conversation, keep the same forest, lighting and mood — recompose it for a tall phone screen.

Subject: Deep night in the ancient forest. No visible figures.
Setting: Tall pine and oak trunks at the sides, the full moon through a gap in the canopy, silver moonbeams through mist, one or two pairs of tiny glowing amber eyes far in the dark near a side edge.
Composition: Tall portrait composition. Top 10%: dark canopy. The moon sits at 10–25% of the height, centered between the treetops; moonbeams fall diagonally. The lower 60% is calm and very dark — mist, roots and forest floor — because the player list and action panel will sit there. Keep important elements inside the central 70% of the width.
Style: Cinematic matte painting, semi-realistic painterly fantasy.
Palette: Blue-black, navy, cold silver moonlight, indigo shadows, tiny amber eye accents.
Lighting: Moonlight from above, volumetric beams, very low key.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536 (will be displayed around 9:16).
Negative: No visible werewolf, people or animals in focus; no blood; no text, letters or numbers; no logo, watermark or frame; no cartoon look.
Consistency anchors: Same forest and moon as the desktop night background.
```

### 4.5. Day — quảng trường làng lúc bình minh

#### `backgrounds/day.png` · [P0]

```text
Generate the DAY / DAWN background (desktop), following the Ma Sói Master Art Direction.

Subject: The village square at dawn — the morning after a night of fear. No people.
Setting: A cobblestone square surrounded by timber-framed houses with closed shutters; a stone well in the left third; a plain wooden post with nothing pinned to it; a few market stalls covered with cloth; the chapel spire in the background; the first golden sunlight breaking over the rooftops from the right third; low mist on the cobblestones; long shadows; a few crows on a roof ridge.
Composition: Wide cinematic shot, eye-level. Keep the central 60% of the frame calm and low-detail — the open, quiet square in soft shadow — because the dawn announcement panel will sit there. Well in the left third, sunrise glow in the right third. Keep everything important inside the central 16:9 band: the top and bottom ~8% may be cropped.
Style: Cinematic matte painting, semi-realistic painterly fantasy, tense calm.
Palette: Still muted — slate blue and navy shadows, warm antique-gold dawn light, a pale rose sky near the horizon, small wine-red cloth accents. Mid-to-low key, not bright, not saturated.
Lighting: Low warm sun from the right, long shadows, lingering cool blue shadow tones from the night, mist glowing gold.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024 (will be displayed cropped to 16:9).
Negative: No people; no notices, papers or signs with writing; no text, letters or numbers; no logo, watermark or frame; no bright noon daylight; no oversaturated colors; no blood; no cartoon look.
Consistency anchors: The same village architecture, chapel and well seen in the other scenes.
```

#### `backgrounds/day-mobile.png` · [P0]

```text
Generate the MOBILE (portrait) version of the DAY / DAWN background, following the Ma Sói Master Art Direction. If the landscape day background was generated earlier in this conversation, keep the same square, lighting and mood — recompose it for a tall phone screen.

Subject: The village square at dawn. No people.
Setting: Timber-framed houses with closed shutters, the chapel spire, a stone well, cobblestones with low mist, first golden sunlight over the rooftops, a few crows.
Composition: Tall portrait composition. The dawn sky, rooftops and chapel spire sit in the 10–40% band, with the sunrise glow on the right. The lower 60% is the cobblestone square in soft cool shadow — calm and low-detail — because the announcement and player list will sit there. Keep important elements inside the central 70% of the width.
Style: Cinematic matte painting, semi-realistic painterly fantasy.
Palette: Slate blue and navy shadows, warm antique-gold dawn light, pale rose sky; muted, mid-to-low key.
Lighting: Low warm sun from the right, long shadows, gold-lit mist.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536 (will be displayed around 9:16).
Negative: No people; no writing anywhere; no text, letters or numbers; no logo, watermark or frame; no bright noon light; no cartoon look.
Consistency anchors: Same square as the desktop day background.
```

### 4.6. Discussion — hội trường, bàn tròn hội đồng

#### `backgrounds/discussion.png` · [P1]

```text
Generate the DAY DISCUSSION background (desktop), following the Ma Sói Master Art Direction.

Subject: The village council hall, where villagers debate who among them is a wolf. No people.
Setting: The interior of a stone-and-timber council hall; a large round oak table in the lower third, surrounded by empty high-backed wooden chairs; tall arched windows on the right letting in soft daylight; dark wine-red banners bearing only the crescent-and-wolf sigil hanging between stone pillars; an iron chandelier with unlit candles; dust floating in the light beams.
Composition: Slightly elevated eye-level camera. The table occupies the lower third and is kept dim. Keep the central 60% of the frame calm and low-detail — a dark stone wall and open space between the banners — because the player grid and timer will sit there. Keep everything important inside the central 16:9 band: the top and bottom ~8% may be cropped.
Style: Cinematic painterly interior, semi-realistic fantasy, calm but tense.
Palette: Navy-grey stone, dark oak, wine-red banners, antique-gold sigils, soft pale daylight.
Lighting: Soft diffuse daylight from the windows on the right, cool shadows, gentle light shafts.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024 (will be displayed cropped to 16:9).
Negative: No people; no papers, maps or books with writing; no text, letters or numbers; no logo other than the sigil on the banners; no watermark or frame; no cartoon look.
Consistency anchors: The canonical crescent-and-wolf sigil on the banners; the same timber-and-stone village architecture.
```

#### `backgrounds/discussion-mobile.png` · [P1]

```text
Generate the MOBILE (portrait) version of the DAY DISCUSSION background, following the Ma Sói Master Art Direction. If the landscape discussion background was generated earlier in this conversation, keep the same council hall, lighting and mood — recompose it for a tall phone screen.

Subject: The village council hall. No people.
Setting: Tall arched windows with soft daylight, wine-red banners with the crescent-and-wolf sigil, stone pillars, the edge of a large round oak table with empty chairs.
Composition: Tall portrait composition. A tall arched window and one banner sit in the 10–40% band. The lower 60% is the dark top of the round table and the shadowed floor — calm and low-detail — because the player grid will sit there. Keep important elements inside the central 70% of the width.
Style: Cinematic painterly interior, semi-realistic fantasy.
Palette: Navy-grey stone, dark oak, wine-red banners, antique gold, soft pale daylight.
Lighting: Soft daylight from the window, cool shadows.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536 (will be displayed around 9:16).
Negative: No people; no writing anywhere; no text, letters or numbers; no watermark or frame; no cartoon look.
Consistency anchors: Same council hall as the desktop discussion background.
```

### 4.7. Voting — nơi xét xử cổ

#### `backgrounds/voting.png` · [P0]

```text
Generate the VOTING background (desktop), following the Ma Sói Master Art Direction.

Subject: The ancient tribunal, where the village passes judgment. No people.
Setting: The interior of an old stone tribunal hall: semicircular tiers of worn stone benches; an elevated judge's seat with an empty high-backed chair in the right third; a large antique-bronze scale of justice on a stone pedestal in the left third; torches in iron sconces; heavy wine-red drapes at the edges; a round stone floor in the lower area; high narrow windows with moonlight.
Composition: Wide interior shot, eye-level. The UI here is dense, so keep the central 60% of the frame especially calm, dark and low-detail. Scale in the left third, judge's seat in the right third, drapes and torches at the outer edges. Keep everything important inside the central 16:9 band: the top and bottom ~8% may be cropped.
Style: Cinematic painterly interior, semi-realistic fantasy, solemn and dramatic.
Palette: Navy-grey stone, wine-red drapes, antique-bronze scale, warm torchlight, indigo shadows.
Lighting: Warm torches at the edges, cool moonlight from high windows; dramatic chiaroscuro at the sides with a calm, low-contrast center.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024 (will be displayed cropped to 16:9).
Negative: No gallows, noose, executioner or weapons on display; no people; no blood; no text, letters, numbers or inscriptions; no logo, watermark or frame; no cartoon look.
Consistency anchors: The same stone-and-timber medieval architecture and palette; a small crescent-and-wolf sigil may be carved above the judge's seat.
```

#### `backgrounds/voting-mobile.png` · [P0]

```text
Generate the MOBILE (portrait) version of the VOTING background, following the Ma Sói Master Art Direction. If the landscape voting background was generated earlier in this conversation, keep the same tribunal, lighting and mood — recompose it for a tall phone screen.

Subject: The ancient stone tribunal. No people.
Setting: An elevated judge's seat with an empty high-backed chair, an antique-bronze scale of justice, torches, wine-red drapes, worn stone benches.
Composition: Tall portrait composition. The judge's seat and the scale sit together in the 10–40% band. The lower 60% is dark stone steps and floor — calm and low-detail — because the vote list and buttons will sit there. Keep important elements inside the central 70% of the width.
Style: Cinematic painterly interior, semi-realistic fantasy.
Palette: Navy-grey stone, wine-red drapes, antique bronze, warm torchlight, indigo shadows.
Lighting: Warm torches at the sides, cool moonlight from above; calm lower half.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536 (will be displayed around 9:16).
Negative: No gallows, noose or executioner; no people; no blood; no text, letters or numbers; no logo, watermark or frame; no cartoon look.
Consistency anchors: Same tribunal as the desktop voting background.
```

### 4.8. Elimination — khung cảnh u tối, kịch tính

#### `backgrounds/elimination.png` · [P1]

```text
Generate the ELIMINATION RESULT background (desktop), following the Ma Sói Master Art Direction.

Subject: The moment someone is cast out of the village — somber and dramatic, with no violence shown. No people in focus.
Setting: The village's wooden palisade gate at dusk, its doors wide open toward a misty path that disappears into the dark forest; storm clouds with a faint wine-red underglow; crows perched on top of the gate; at the far left and right edges, out-of-focus torch flames held up by an unseen crowd (only the flames visible); a single extinguished lantern lying on the path with a thin wisp of smoke.
Composition: Wide cinematic shot, eye-level, symmetrical. The gate posts frame the center as dark, low-detail silhouettes; through the open gate, the center of the frame is calm grey-blue fog — low detail — because the elimination result will be shown there. Torches only at the outer edges. Keep everything important inside the central 16:9 band: the top and bottom ~8% may be cropped.
Style: Cinematic matte painting, semi-realistic painterly fantasy, heavy and melancholic.
Palette: Dark slate, navy, desaturated wine red in the clouds, warm torch flames at the edges.
Lighting: Dim dusk light, fog backlit through the gate, torch flames as small warm accents.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024 (will be displayed cropped to 16:9).
Negative: No bodies, no blood, no gallows, no execution, no weapons raised; no people in focus; no text, letters or numbers; no logo, watermark or frame; no cartoon look.
Consistency anchors: The same palisade gate as the Guardian card and the same forest as the night background.
```

#### `backgrounds/elimination-mobile.png` · [P1]

```text
Generate the MOBILE (portrait) version of the ELIMINATION RESULT background, following the Ma Sói Master Art Direction. If the landscape elimination background was generated earlier in this conversation, keep the same gate, lighting and mood — recompose it for a tall phone screen.

Subject: The open village gate at dusk leading into fog. No people in focus.
Setting: The wooden palisade gate with crows on top, storm clouds with a faint wine-red underglow, a misty path into the dark forest, an extinguished lantern on the path, distant torch flames at the side edges.
Composition: Tall portrait composition. The top of the gate, the crows and the storm clouds sit in the 10–40% band. The lower 60% is the misty path and dark ground — calm and low-detail — because the result panel will sit there. Keep important elements inside the central 70% of the width.
Style: Cinematic matte painting, semi-realistic painterly fantasy.
Palette: Dark slate, navy, desaturated wine red, small warm torch accents.
Lighting: Dim dusk light, fog backlit through the gate.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536 (will be displayed around 9:16).
Negative: No bodies, blood, gallows or execution; no people in focus; no text, letters or numbers; no logo, watermark or frame; no cartoon look.
Consistency anchors: Same gate as the desktop elimination background.
```

### 4.9. Victory — Làng thắng (ngôi làng đón bình minh)

#### `backgrounds/victory-village.png` · [P1]

```text
Generate the VILLAGE VICTORY background (desktop), following the Ma Sói Master Art Direction.

Subject: The village greets the dawn — the werewolves are defeated. No people in focus.
Setting: The same valley village and landmarks as the landing view, now at sunrise: the sun rising behind the hills in the right third; golden light spilling over the rooftops and the chapel; mist dissolving in the valley; a few banners with the crescent-and-wolf sigil fluttering from the watchtower; the ruined castle catching the first light; birds in the sky.
Composition: Wide cinematic landscape from the same hillside vantage as the landing background. Keep the central 60% of the frame calm and low-detail — soft dawn sky and dissolving mist — because the game summary will sit there. Sun in the right third, village in the lower band. Keep everything important inside the central 16:9 band: the top and bottom ~8% may be cropped.
Style: Cinematic matte painting, semi-realistic painterly fantasy, hopeful and triumphant but restrained.
Palette: Antique gold and warm amber dominant, soft rose sky, navy and indigo lingering in the shadows and at the top of the sky. Painterly, not oversaturated.
Lighting: Warm low sunrise backlight, god rays, long shadows.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024 (will be displayed cropped to 16:9).
Negative: No people in focus; no text, letters or numbers; no logo other than the sigil on the banners; no watermark or frame; no bright cartoon colors; no rainbow.
Consistency anchors: Same vantage, village, chapel, watchtower and castle as the landing background; the canonical sigil on the banners.
```

#### `backgrounds/victory-village-mobile.png` · [P1]

```text
Generate the MOBILE (portrait) version of the VILLAGE VICTORY background, following the Ma Sói Master Art Direction. If the landscape village-victory background was generated earlier in this conversation, keep the same view, lighting and mood — recompose it for a tall phone screen.

Subject: The village at sunrise after the werewolves are defeated. No people in focus.
Setting: The sun rising behind the hills, golden light over the rooftops and chapel spire, banners with the crescent-and-wolf sigil on the watchtower, the ruined castle catching first light, dissolving mist.
Composition: Tall portrait composition. The rising sun, the castle and the rooftops sit in the 10–40% band. The lower 60% is the misty valley in soft gold-tinted shadow — calm, low-detail and still dark enough for white text — because the summary will sit there. Keep important elements inside the central 70% of the width.
Style: Cinematic matte painting, semi-realistic painterly fantasy.
Palette: Antique gold, warm amber, soft rose, lingering navy and indigo.
Lighting: Warm sunrise backlight, god rays.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536 (will be displayed around 9:16).
Negative: No people in focus; no text, letters or numbers; no watermark or frame; no oversaturated colors.
Consistency anchors: Same village and castle as the desktop village-victory and landing backgrounds.
```

### 4.10. Victory — Sói thắng (ngôi làng dưới trăng đỏ)

#### `backgrounds/victory-werewolf.png` · [P1]

```text
Generate the WEREWOLF VICTORY background (desktop), following the Ma Sói Master Art Direction.

Subject: The village under the blood moon — the werewolves have won. No gore.
Setting: The same vantage and landmarks as the landing view, but: a huge blood-red moon in the upper-left third; red-tinted mist creeping through empty streets; every window dark, shutters closed; a broken fence; on the ridge in the right third, small silhouettes of three or four werewolves howling at the moon.
Composition: Wide cinematic landscape from the same hillside vantage as the landing background. Keep the central 60% of the frame calm and low-detail — dark red-tinted sky and mist — because the game summary will sit there. Moon in the upper-left third, wolf silhouettes small on the right ridge, village in the lower band. Keep everything important inside the central 16:9 band: the top and bottom ~8% may be cropped.
Style: Cinematic matte painting, semi-realistic painterly fantasy, ominous and grand.
Palette: Blood-red and wine-red moonlight, blue-black and indigo shadows; no warm windows.
Lighting: Crimson moonlight from the upper left, red rim light on rooftops, heavy shadows.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024 (will be displayed cropped to 16:9).
Negative: No blood, bodies or gore; no burning village; no people in focus; no text, letters or numbers; no logo, watermark or frame; no cartoon look.
Consistency anchors: Same vantage, village and castle as the landing background; the same moon shape, now blood-red (matching the blood moon effect).
```

#### `backgrounds/victory-werewolf-mobile.png` · [P1]

```text
Generate the MOBILE (portrait) version of the WEREWOLF VICTORY background, following the Ma Sói Master Art Direction. If the landscape werewolf-victory background was generated earlier in this conversation, keep the same view, lighting and mood — recompose it for a tall phone screen.

Subject: The village under the blood moon. No gore.
Setting: A huge blood-red moon, the dark silent village with closed shutters, red-tinted mist, small silhouettes of howling werewolves on a ridge, the ruined castle.
Composition: Tall portrait composition. The blood moon sits at 10–25% of the height; the wolf silhouettes and castle small in the 20–40% band. The lower 60% is the dark village and red-tinted mist — calm and low-detail — because the summary will sit there. Keep important elements inside the central 70% of the width.
Style: Cinematic matte painting, semi-realistic painterly fantasy.
Palette: Blood-red and wine-red moonlight, blue-black and indigo shadows.
Lighting: Crimson moonlight from above, heavy shadows.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536 (will be displayed around 9:16).
Negative: No blood, bodies or gore; no people in focus; no text, letters or numbers; no logo, watermark or frame; no cartoon look.
Consistency anchors: Same village, castle and blood moon as the desktop werewolf-victory background.
```

### 4.11. Moderator — bàn làm việc của quản trò

#### `backgrounds/moderator.png` · [P1]

```text
Generate the MODERATOR DASHBOARD background (desktop), following the Ma Sói Master Art Direction.

Subject: The game master's desk — the moderator's private workspace. No people, no hands.
Setting: A slightly top-down view of a heavy dark oak desk. Around the outer edges only: ancient leather-bound closed books, a rolled-up parchment map tied with a cord, brass candleholders with burning candles, an hourglass, a brass astrolabe, an inkwell with a quill, a small open pouch of antique-gold tokens, a wax seal stamp with wine-red wax. The central area of the desk is an empty, dark, worn leather desk pad.
Composition: Objects only in the outer ~20% border of the frame; the central 60% is the empty dark leather pad — calm and low-detail — because the dashboard will cover it. Keep everything important inside the central 16:9 band: the top and bottom ~8% may be cropped.
Style: Cinematic painterly still life, semi-realistic fantasy, rich textures.
Palette: Dark oak and navy-black shadows, warm amber candlelight, antique gold and bronze objects, wine-red wax.
Lighting: Warm candlelight from the corners, deep falloff toward the center; focused and calm.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024 (will be displayed cropped to 16:9).
Negative: No handwriting, no open pages, no writing on parchment, no letters on book spines; no tarot or playing cards; no people or hands; no text, letters or numbers; no logo, watermark or frame; no cartoon look.
Consistency anchors: Antique gold and bronze materials matching the card back and icons; the wax seal stamp bears the crescent-and-wolf sigil.
```

#### `backgrounds/moderator-mobile.png` · [P2]

```text
Generate the MOBILE (portrait) version of the MODERATOR DASHBOARD background, following the Ma Sói Master Art Direction. If the landscape moderator background was generated earlier in this conversation, keep the same desk, objects, lighting and mood — recompose it for a tall phone screen.

Subject: The game master's dark oak desk. No people, no hands.
Setting: Candles, an hourglass, closed leather books, a rolled parchment map, a brass astrolabe, a quill and inkwell.
Composition: Tall portrait, slightly top-down. The candles, hourglass and books are arranged only along the top 25% of the frame. The rest (25–100%) is the empty, dark, worn leather desk pad — calm and low-detail — because the dashboard will cover it. Keep important elements inside the central 70% of the width.
Style: Cinematic painterly still life, semi-realistic fantasy.
Palette: Dark oak, navy-black shadows, warm amber candlelight, antique gold and bronze.
Lighting: Warm candlelight from the top, falloff toward the bottom.
Aspect ratio & size: Portrait 2:3, exactly 1024x1536 (will be displayed around 9:16).
Negative: No writing anywhere; no people or hands; no text, letters or numbers; no logo, watermark or frame; no cartoon look.
Consistency anchors: Same desk and objects as the desktop moderator background.
```

---

## 5. Icons — `icons/`

Chung cho cả nhóm: **square 1024×1024, nền trong suốt (alpha thật)**, emblem chiếm ~80% canvas, đọc được ở 24–32px. Nên tạo toàn bộ icon trong **một** cuộc trò chuyện: Master prompt → Icon family brief (5.0) → từng icon.

### 5.0. Icon family brief — dán một lần trước khi tạo icon

```text
Next I will ask for a family of game icons. Do NOT generate an image for this message — reply "Ready". Every icon in this family must share exactly this style:
- An engraved antique-gold and bronze metal emblem with embossed relief, subtle dark navy enamel inlays, and one small accent color specified per icon.
- Front-facing, flat orthographic view, centered, symmetric when possible.
- A bold, simple silhouette that stays readable at 32x32 pixels; no thin fiddly details or small clutter.
- A thin dark outline around the whole emblem for legibility on both dark and light UI.
- Lit from the upper left, soft specular highlights, no cast shadow, no glow halo outside the shape.
- The emblem fills about 80% of the canvas with about 10% empty padding on every side.
- Square 1024x1024 with a fully transparent background (real alpha channel, PNG). No background color, no checkerboard, no circle or badge behind the emblem unless the brief asks for a crest.
- No text, no letters, no numbers, no runes.
```

### 5.1. `icons/role-villager.png` — Dân Làng · [P0]

```text
Generate the role icon for the VILLAGER in the Ma Sói icon family style.

Subject: An old iron-and-gold hanging lantern with a small ring handle on top and a warm flame inside.
Setting: None — isolated object.
Composition: Centered, front view, the lantern fills about 80% of the canvas height with ~10% padding; bold silhouette readable at 32px.
Style: Engraved antique-gold and bronze metal emblem with embossed relief and navy enamel inlays, thin dark outline.
Palette: Antique gold, bronze, navy enamel; accent color: warm amber flame.
Lighting: Upper-left light, soft specular highlights, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No background, no checkerboard, no badge or circle behind; no text, letters or numbers; no pitchfork; no cartoon style; no thin clutter.
Consistency anchors: Same icon family as all role icons; the lantern matches the one held on the Villager card.
```

### 5.2. `icons/role-werewolf.png` — Ma Sói · [P0]

```text
Generate the role icon for the WEREWOLF in the Ma Sói icon family style.

Subject: A snarling wolf head in side profile facing left, ears back, fangs bared (no blood), one glowing blood-red enamel eye.
Setting: None — isolated emblem.
Composition: Centered, the head fills about 80% of the canvas with ~10% padding; bold, aggressive silhouette readable at 32px.
Style: Engraved antique-gold and bronze metal emblem, dark navy enamel in the fur areas, thin dark outline.
Palette: Antique gold, bronze, dark navy enamel; accent color: blood red (the eye).
Lighting: Upper-left light, soft specular highlights, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No background, no checkerboard, no circle behind; no blood; no text, letters or numbers; no cartoon or cute wolf; no full body.
Consistency anchors: Same icon family as all role icons; clearly different from the White Wolf icon (profile view and dark enamel versus front view and silver).
```

### 5.3. `icons/role-seer.png` — Tiên Tri · [P0]

```text
Generate the role icon for the SEER in the Ma Sói icon family style.

Subject: A crystal orb resting on a small three-claw antique-gold stand; the orb is filled with violet enamel and a white crescent-moon glint.
Setting: None — isolated object.
Composition: Centered, symmetric, the orb and stand fill about 80% of the canvas with ~10% padding; readable at 32px.
Style: Engraved antique-gold and bronze metal emblem with polished enamel orb, thin dark outline.
Palette: Antique gold, bronze, navy enamel; accent color: violet (orb) with a silver-white glint.
Lighting: Upper-left light, specular highlight on the orb, no cast shadow, no glow outside the shape.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No background, no checkerboard, no circle behind; no eye symbol; no text, letters or numbers; no cartoon style.
Consistency anchors: Same icon family as all role icons; matches the orb on the Seer card.
```

### 5.4. `icons/role-witch.png` — Phù Thủy · [P0]

```text
Generate the role icon for the WITCH in the Ma Sói icon family style.

Subject: Two potion bottles crossed in an X: a round-bellied flask with golden-green enamel liquid (heal) and an angular faceted bottle with violet enamel liquid wrapped by a thin thorn vine (poison).
Setting: None — isolated emblem.
Composition: Centered, symmetric X arrangement filling about 80% of the canvas with ~10% padding; the two bottle silhouettes must stay distinct at 32px.
Style: Engraved antique-gold and bronze metal emblem with enamel liquids, thin dark outline.
Palette: Antique gold, bronze, navy enamel; accent colors: golden-green and violet.
Lighting: Upper-left light, soft specular highlights on the glass, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No background, no checkerboard, no circle behind; no labels; no skull; no text, letters or numbers; no cartoon style.
Consistency anchors: Same icon family as all role icons; the bottle shapes match the Witch card and the potion effects.
```

### 5.5. `icons/role-guardian.png` — Bảo Vệ · [P0]

```text
Generate the role icon for the GUARDIAN in the Ma Sói icon family style.

Subject: A tall tower shield seen from the front: navy enamel field, a raised antique-gold rim and a small raised crescent boss in the center.
Setting: None — isolated object.
Composition: Centered, symmetric, the shield fills about 80% of the canvas height with ~10% padding; readable at 32px.
Style: Engraved antique-gold and bronze metal emblem with navy enamel, thin dark outline.
Palette: Antique gold, bronze, navy enamel; accent color: steel blue-grey highlights.
Lighting: Upper-left light, soft specular highlights, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No background, no checkerboard, no circle behind; no cross or religious symbols; no text, letters or numbers; no cartoon style.
Consistency anchors: Same icon family as all role icons; matches the Guardian card's shield.
```

### 5.6. `icons/role-hunter.png` — Thợ Săn · [P0]

```text
Generate the role icon for the HUNTER in the Ma Sói icon family style.

Subject: A crossbow with a loaded bolt, placed diagonally from bottom-left to top-right, bow arms clearly visible; dark wood inlay and bronze fittings.
Setting: None — isolated object.
Composition: Centered diagonal, filling about 80% of the canvas with ~10% padding; bold silhouette readable at 32px.
Style: Engraved antique-gold and bronze metal emblem with dark wood-tone enamel, thin dark outline.
Palette: Antique gold, bronze, navy enamel; accent color: dark forest green on the stock.
Lighting: Upper-left light, soft specular highlights, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No background, no checkerboard, no circle behind; no firearms; no blood; no text, letters or numbers; no cartoon style.
Consistency anchors: Same icon family as all role icons; matches the Hunter card's crossbow.
```

### 5.7. `icons/role-cupid.png` — Cupid · [P2]

```text
Generate the role icon for CUPID in the Ma Sói icon family style.

Subject: A graceful rose-gold recurve bow with an arrow nocked, the arrowhead shaped like a closed rose bud.
Setting: None — isolated emblem.
Composition: Centered, the bow vertical and the arrow horizontal, filling about 80% of the canvas with ~10% padding; readable at 32px.
Style: Engraved rose-gold and antique-gold metal emblem with deep rose enamel accents, thin dark outline.
Palette: Rose gold, antique gold, navy enamel; accent color: deep rose / wine red.
Lighting: Upper-left light, soft specular highlights, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No background, no checkerboard, no circle behind; no heart symbols; no wings; no baby cherub; no text, letters or numbers; no cartoon style.
Consistency anchors: Same icon family as all role icons; matches the Cupid card's bow.
```

### 5.8. `icons/role-elder.png` — Già Làng · [P2]

```text
Generate the role icon for the ELDER in the Ma Sói icon family style.

Subject: A gnarled wooden staff standing vertically, topped with an antique-gold crescent finial, with a small sprig of oak leaves crossing it diagonally.
Setting: None — isolated emblem.
Composition: Centered, the staff fills about 80% of the canvas height with ~10% padding; bold silhouette readable at 32px.
Style: Engraved antique-gold and bronze metal emblem with dark wood-tone enamel, thin dark outline.
Palette: Antique gold, bronze, navy enamel; accent color: muted oak green on the leaves.
Lighting: Upper-left light, soft specular highlights, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No background, no checkerboard, no circle behind; no crown; no text, letters or numbers; no cartoon style.
Consistency anchors: Same icon family as all role icons; matches the Elder card's staff.
```

### 5.9. `icons/role-white-wolf.png` — Sói Trắng · [P2]

```text
Generate the role icon for the WHITE WOLF in the Ma Sói icon family style.

Subject: A wolf head facing straight forward with a thick mane, rendered in silver-white metal instead of gold, with icy pale-blue enamel eyes and a small dark crescent mark on the brow.
Setting: None — isolated emblem.
Composition: Centered, symmetric, the head fills about 80% of the canvas with ~10% padding; readable at 32px.
Style: Engraved silver and pale-gold metal emblem with frost-like engraved fur, thin dark outline.
Palette: Silver-white, pale gold, navy enamel; accent color: icy pale blue (eyes).
Lighting: Upper-left light, cool specular highlights, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No background, no checkerboard, no circle behind; no blood; no text, letters or numbers; no cartoon style; must not look like the Werewolf icon (that one is a dark profile).
Consistency anchors: Same icon family as all role icons; matches the White Wolf card.
```

### 5.10. `icons/team-village.png` — Phe Làng · [P0]

```text
Generate the team crest for the VILLAGE TEAM in the Ma Sói icon family style.

Subject: A heraldic heater-shaped shield crest with a navy enamel field and a raised antique-gold rim; inside, a simple timber house with a peaked roof beneath a half rising sun with short rays.
Setting: None — isolated crest.
Composition: Centered, symmetric, the crest fills about 80% of the canvas with ~10% padding; the house-and-sun symbol must read clearly at 24px.
Style: Engraved antique-gold and bronze metal crest with navy enamel, thin dark outline.
Palette: Navy enamel, antique gold; accent color: warm amber sun.
Lighting: Upper-left light, soft specular highlights, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No background outside the crest, no checkerboard; no ribbon or banner; no text, letters or numbers; no cartoon style.
Consistency anchors: Same crest shape and metal style as the Werewolf and Special team crests; the three crests differ by symbol, not only by color.
```

### 5.11. `icons/team-werewolf.png` — Phe Sói · [P0]

```text
Generate the team crest for the WEREWOLF TEAM in the Ma Sói icon family style.

Subject: A heraldic heater-shaped shield crest with a deep blood-red enamel field and a raised antique-gold rim; inside, a single wolf paw print beneath a full moon disc.
Setting: None — isolated crest.
Composition: Centered, symmetric, the crest fills about 80% of the canvas with ~10% padding; the paw-and-moon symbol must read clearly at 24px.
Style: Engraved antique-gold and bronze metal crest with blood-red enamel, thin dark outline.
Palette: Blood-red enamel, antique gold; accent color: pale silver moon.
Lighting: Upper-left light, soft specular highlights, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No background outside the crest, no checkerboard; no blood drips; no ribbon or banner; no text, letters or numbers; no cartoon style.
Consistency anchors: Same crest shape and metal style as the Village and Special team crests.
```

### 5.12. `icons/team-special.png` — Phe Đặc biệt · [P2]

```text
Generate the team crest for the SPECIAL / SOLO TEAM (White Wolf, Lovers) in the Ma Sói icon family style.

Subject: A heraldic heater-shaped shield crest with a dark violet enamel field and a raised silver rim; inside, an eclipse — a crescent overlapping a full moon — with a single small four-pointed star.
Setting: None — isolated crest.
Composition: Centered, symmetric, the crest fills about 80% of the canvas with ~10% padding; the eclipse symbol must read clearly at 24px.
Style: Engraved silver and pale-gold metal crest with violet enamel, thin dark outline.
Palette: Violet enamel, silver, pale gold; accent color: icy pale blue on the star.
Lighting: Upper-left light, cool specular highlights, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No background outside the crest, no checkerboard; no ribbon or banner; no text, letters or numbers; no cartoon style.
Consistency anchors: Same crest shape and metal style as the Village and Werewolf team crests.
```

---

## 6. Effects — `effects/`

Chung: hiệu ứng vuông **1024×1024 nền trong suốt**; `transition-dusk`, `transition-dawn` là **1536×1024 opaque**; `border-ornament`, `fog-overlay` là **1536×1024 nền trong suốt**.

### 6.1. `effects/moon-full.png` — Trăng tròn · [P0]

```text
Generate the FULL MOON effect asset, following the Ma Sói Master Art Direction.

Subject: A large full moon disc with realistic, subtle crater and maria details.
Setting: None — isolated object.
Composition: Perfectly centered circle, diameter about 70% of the canvas. Clean edge with only a very slight soft falloff; no large halo (the glow is added in CSS).
Style: Semi-realistic painterly rendering, matching the moon in the Ma Sói backgrounds.
Palette: Cool silver-blue with soft ivory highlights and blue-grey shadows.
Lighting: Evenly lit full disc, slightly brighter toward the upper left.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No stars, no clouds, no sky, no background color, no checkerboard; no big glow halo; no face in the moon; no text or numbers.
Consistency anchors: The canonical Ma Sói moon used in all backgrounds; the blood moon effect must match its shape and craters exactly.
```

### 6.2. `effects/moon-blood.png` — Trăng máu · [P1]

```text
Generate the BLOOD MOON effect asset, following the Ma Sói Master Art Direction. If the full moon effect was generated earlier in this conversation (or is attached), recreate exactly the same moon — same size, position and craters — only recolored.

Subject: The same large full moon disc, now a deep blood-red moon.
Setting: None — isolated object.
Composition: Perfectly centered circle, diameter about 70% of the canvas, identical to the full moon asset so the two can crossfade perfectly. Clean edge, very slight soft falloff, no large halo.
Style: Semi-realistic painterly rendering.
Palette: Deep blood red and wine red, darker crimson in the craters, faint dusky orange highlight at the upper left.
Lighting: Evenly lit disc, slightly brighter toward the upper left.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No stars, clouds or sky; no background color, no checkerboard; no dripping blood; no big glow halo; no text or numbers.
Consistency anchors: Identical geometry to moon-full; the same blood moon as in the werewolf-victory background.
```

### 6.3. `effects/transition-dusk.png` — Chuyển ngày → đêm · [P1]

```text
Generate the DUSK TRANSITION panorama (day turning into night), following the Ma Sói Master Art Direction.

Subject: A wide sky at the moment day becomes night above the Ma Sói village.
Setting: The upper 60% is a sky gradient from deep navy with the first faint stars at the top, through violet, down to a thin band of fading wine-red and amber sunset at the horizon. Along the bottom 20%, the solid dark silhouette of village rooftops, the chapel spire and, in the right third, the ruined castle on its hill. A pale moon rising in the upper-left third.
Composition: Wide horizontal bands. The center region (25–75% horizontally, 30–65% vertically) is a smooth, uncluttered sky gradient because a title will be overlaid there. Horizon line at about 80% of the height. Keep everything important inside the central 16:9 band: the top and bottom ~8% may be cropped.
Style: Cinematic matte painting, semi-realistic painterly, minimal and elegant.
Palette: Navy, indigo-violet, wine red, a thin warm amber glow at the horizon, black silhouettes.
Lighting: Last light of the sunset at the horizon, the cool moon rising.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024, opaque (no transparency).
Negative: No people, no werewolves, no clouds in the center; no text, letters or numbers; no logo, watermark or frame; no cartoon look.
Consistency anchors: Same village silhouette and castle as the landing background; the dawn transition must use the identical horizon silhouette.
```

### 6.4. `effects/transition-dawn.png` — Chuyển đêm → ngày · [P1]

```text
Generate the DAWN TRANSITION panorama (night turning into day), following the Ma Sói Master Art Direction. If the dusk transition was generated earlier in this conversation, reuse its exact horizon silhouette and layout.

Subject: A wide sky at the moment night becomes day above the Ma Sói village.
Setting: The upper 60% is a sky gradient from deep navy with fading stars at the top, through soft rose, down to warm antique-gold dawn light at the horizon. Along the bottom 20%, the same solid dark silhouette of village rooftops, the chapel spire and the ruined castle in the right third; the sun just rising behind the castle hill. A pale setting moon in the upper-left third.
Composition: Wide horizontal bands. The center region (25–75% horizontally, 30–65% vertically) is a smooth, uncluttered sky gradient because a title will be overlaid there. Horizon line at about 80% of the height. Keep everything important inside the central 16:9 band: the top and bottom ~8% may be cropped.
Style: Cinematic matte painting, semi-realistic painterly, minimal and elegant.
Palette: Navy fading to soft rose and antique gold, black silhouettes.
Lighting: First warm sunlight at the horizon with gentle rays, the cool moon fading.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024, opaque (no transparency).
Negative: No people, no clouds in the center; no text, letters or numbers; no logo, watermark or frame; no oversaturated colors; no cartoon look.
Consistency anchors: Identical horizon silhouette to the dusk transition; the same village and castle as the landing background.
```

### 6.5. `effects/potion-heal.png` — Bình cứu · [P1]

```text
Generate the HEALING POTION effect asset, following the Ma Sói Master Art Direction.

Subject: A round-bellied glass flask with a long neck, a cork stopper wrapped in antique-gold wire, filled with glowing golden-green liquid with tiny floating light motes; a small leaf charm tied to the neck with twine.
Setting: None — isolated object.
Composition: Centered, upright, front view, filling about 80% of the canvas height with ~10% padding; clear silhouette readable at 48px.
Style: Semi-realistic painterly rendering of glass and liquid, premium card-game item art.
Palette: Golden-green glow, antique gold wire, warm amber cork, subtle navy reflections in the glass.
Lighting: Inner glow from the liquid plus upper-left highlights on the glass; no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No paper label, no text, letters or numbers; no background color, no checkerboard; no table or surface; no big glow halo; no cartoon style.
Consistency anchors: Exactly the round heal flask held by the Witch on her card and shown in the Witch role icon.
```

### 6.6. `effects/potion-poison.png` — Bình độc · [P1]

```text
Generate the POISON POTION effect asset, following the Ma Sói Master Art Direction.

Subject: An angular, faceted dark glass bottle with a tall narrow neck and a dark wax-sealed stopper, filled with glowing violet liquid with faint swirls; a thin black thorny vine with tiny dark nightshade berries wrapping around the bottle.
Setting: None — isolated object.
Composition: Centered, upright, front view, filling about 80% of the canvas height with ~10% padding; its silhouette must look clearly different from the round healing flask at 48px.
Style: Semi-realistic painterly rendering of glass and liquid, premium card-game item art.
Palette: Violet glow, dark smoky glass, black vine, a touch of wine red in the wax.
Lighting: Inner violet glow plus upper-left highlights on the facets; no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No skull, no label, no text, letters or numbers; no background color, no checkerboard; no table or surface; no big glow halo; no cartoon style.
Consistency anchors: Exactly the angular poison bottle held by the Witch on her card and shown in the Witch role icon.
```

### 6.7. `effects/vote-token.png` — Token phiếu bầu · [P1]

```text
Generate the VOTE TOKEN effect asset, following the Ma Sói Master Art Direction.

Subject: A thick round antique-gold coin token, front view, with the crescent-and-wolf sigil embossed in the center, a wine-red enamel ring around the rim and a beaded outer edge; slight wear on the high points.
Setting: None — isolated object.
Composition: Perfectly centered, flat front view (no tilt), the coin fills about 80% of the canvas with ~10% padding; very simple and bold so it reads at 20px.
Style: Engraved metal with enamel, matching the Ma Sói icon family.
Palette: Antique gold, bronze, wine-red enamel, a touch of navy in the recesses.
Lighting: Upper-left light, soft specular highlights, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No numbers, no letters, no text around the rim; no background color, no checkerboard; no stack of coins; no perspective tilt; no cartoon style.
Consistency anchors: The canonical crescent-and-wolf sigil; the same metal-and-enamel style as the icons.
```

### 6.8. `effects/shield.png` — Lá chắn bảo vệ · [P1]

```text
Generate the PROTECTION WARD effect asset, following the Ma Sói Master Art Direction.

Subject: A magical protective ward shaped like a tower shield made of soft, translucent silver-gold light, with faint filigree lines and a glowing crescent sigil inside; its edges dissolve into small drifting light particles.
Setting: None — isolated effect.
Composition: Centered, front view, filling about 80% of the canvas height with ~10% padding; it will be overlaid on a player avatar, so the interior is semi-transparent.
Style: Ethereal painterly light effect, consistent with the semi-realistic Ma Sói art.
Palette: Silver-white and pale antique gold light, a faint cool blue tint.
Lighting: Self-luminous, soft glow contained within the shape.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG, with semi-transparent interior).
Negative: No solid metal shield, no knight, no background color, no checkerboard; no text, letters or numbers; no cartoon style.
Consistency anchors: Same tower-shield outline as the Guardian icon, but made of light instead of metal.
```

### 6.9. `effects/victory-emblem.png` — Emblem chiến thắng · [P1]

```text
Generate the VICTORY EMBLEM effect asset, following the Ma Sói Master Art Direction.

Subject: A triumphant emblem: a radiant antique-gold sunburst behind the crescent-and-wolf sigil, encircled by a gold laurel wreath, with three small wine-red gems at the base of the wreath.
Setting: None — isolated emblem.
Composition: Centered, symmetric, filling about 80% of the canvas with ~10% padding.
Style: Engraved antique-gold metal with polished highlights, premium game reward emblem, matching the icon family.
Palette: Antique gold, warm amber light rays, wine-red gems, navy enamel in the recesses.
Lighting: Bright upper-left highlights, rays contained within the emblem, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No ribbon or banner, no text, letters or numbers, no trophy cup; no background color, no checkerboard; no cartoon style.
Consistency anchors: The canonical crescent-and-wolf sigil; the defeat emblem is the same composition in a broken, tarnished state.
```

### 6.10. `effects/defeat-emblem.png` — Emblem thất bại · [P1]

```text
Generate the DEFEAT EMBLEM effect asset, following the Ma Sói Master Art Direction. If the victory emblem was generated earlier in this conversation, mirror its composition.

Subject: The same crescent-and-wolf sigil, now cast in dull tarnished bronze and cracked through the middle with a dark split, encircled by a wilted wreath of dark iron leaves, with a few ash flakes drifting around it.
Setting: None — isolated emblem.
Composition: Centered, symmetric, filling about 80% of the canvas with ~10% padding; same size and placement as the victory emblem.
Style: Engraved aged metal, somber and desaturated, matching the icon family.
Palette: Tarnished bronze, dark iron grey, a faint dull wine red in the crack, navy shadows.
Lighting: Dim upper-left light, weak highlights, no cast shadow.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No skull, no blood, no text, letters or numbers; no background color, no checkerboard; no cartoon style.
Consistency anchors: Same composition and sigil as the victory emblem, in a broken state.
```

### 6.11. `effects/border-ornament.png` — Khung trang trí · [P1]

```text
Generate a DECORATIVE FRAME ORNAMENT asset for UI panels, following the Ma Sói Master Art Direction.

Subject: An ornate rectangular frame of antique-gold filigree with four elaborate corner ornaments made of scrollwork, small crescent moons and leaf motifs.
Setting: None — the frame only.
Composition: The frame lines run about 3% inside the canvas edges. Each corner ornament fits inside a square region about 15% of the canvas height from its corner. The straight edges between the corners are a thin, uniform double line with constant thickness along their whole length and NO ornaments in the middle of any edge, so the frame can be stretched as a 9-slice border. The interior is 100% transparent: no fill, no texture, no shadow.
Style: Engraved antique-gold metal filigree, crisp and elegant, matching the icon family.
Palette: Antique gold and bronze with tiny navy enamel accents.
Lighting: Upper-left light, soft specular highlights, no cast shadow.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024, transparent background (real alpha, PNG).
Negative: No filled center, no parchment, no background, no checkerboard; no ornaments at edge midpoints; no text, letters or numbers; no wolf heads at the edges; no cartoon style.
Consistency anchors: Same antique gold filigree as the card back and the logo emblem.
```

### 6.12. `effects/fog-overlay.png` — Lớp sương · [P1]

```text
Generate a FOG OVERLAY asset, following the Ma Sói Master Art Direction.

Subject: Soft drifting mist and fog wisps.
Setting: None — fog only, no landscape.
Composition: Fog is densest along the bottom 40% of the canvas and fades smoothly to fully transparent at the top. No hard edges anywhere. Seamless horizontal tile: the left and right edges must match exactly so the image can repeat horizontally without a visible seam.
Style: Soft painterly volumetric mist, consistent with the Ma Sói backgrounds.
Palette: White with a slight cool silver-blue tint.
Lighting: Soft, diffuse, as if lit by moonlight from above.
Aspect ratio & size: Landscape 3:2, exactly 1536x1024, transparent background (real alpha, PNG, semi-transparent fog).
Negative: No ground, trees, buildings, moon or objects; no solid background color, no checkerboard; no hard-edged clouds; no text, letters or numbers.
Consistency anchors: The same mist quality as in the night and landing backgrounds.
```

> **Phương án dự phòng cho `fog-overlay`:** nếu ChatGPT không tạo được alpha bán trong suốt đạt yêu cầu, dùng prompt sau và báo lại cho Claude Code để pipeline chuyển độ sáng thành alpha (hoặc dùng `mix-blend-mode: screen`):
>
> ```text
> Generate the same seamless horizontal fog layer, but as white-blue soft fog on a pure solid black (#000000) background, landscape 1536x1024. Fog densest along the bottom 40%, fading to pure black at the top; left and right edges must match for seamless horizontal tiling. No objects, no text.
> ```

---

## 7. Logo — `logos/`

### 7.1. `logos/logo-emblem.png` — Emblem logo (không chữ) · [P0]

```text
Generate the GAME LOGO EMBLEM for "Ma Sói", following the Ma Sói Master Art Direction. The emblem must contain NO text at all — the wordmark will be added separately in HTML.

Subject: The canonical Ma Sói sigil as a bold emblem: a stylized forward-facing wolf head cradled within a large crescent moon, enclosed by a thin antique-gold ring with fine filigree; a small wine-red gem at the bottom of the ring; dark navy enamel filling the space inside the ring behind the wolf.
Setting: None — isolated emblem.
Composition: Centered, mirror-symmetric left to right, filling about 84% of the canvas with ~8% padding on every side. Strong, simple silhouette that stays recognizable at 32px and looks rich at 512px.
Style: Engraved antique-gold and silver metal with enamel, premium game crest, matching the icon family and the card back.
Palette: Antique gold, silver highlights, deep navy enamel, one wine-red gem.
Lighting: Upper-left light, polished specular highlights, no cast shadow, no glow outside the shape.
Aspect ratio & size: Square 1024x1024, transparent background (real alpha, PNG).
Negative: No text, no letters, no initials, no "MS" monogram, no numbers; no ribbon or banner; no background color, no checkerboard; no drop-shadow box; no cartoon style; no resemblance to any existing game's logo.
Consistency anchors: The same sigil as the card back, the vote token and the clasps, brooches and medallions on the character cards.
```

---

## 8. Audio — không áp dụng

Thư mục `apps/web/public/assets/audio/` dành cho âm thanh trong tương lai (Milestone 5). **Không tạo bằng ChatGPT** và không có prompt trong tài liệu này.

---

## 9. Quy trình kiểm tra sau khi tạo

**Ngay trong ChatGPT, trước khi tải về**

1. Phóng to ảnh, quét các góc và vùng tối: không có chữ, số, ký tự giả, chữ ký, watermark.
2. Không có khung/viền vẽ sẵn (trừ `border-ornament` và hoa văn bên trong `card-back`).
3. Thẻ: mặt nằm trong 55% phía trên, 30% dưới tối và êm. Background: 60% giữa êm, điểm nhấn ở rìa/dải trên.
4. Phong cách khớp với `villager.png` đã duyệt: semi-realistic painterly, đúng bảng màu, trăng chiếu từ trên trái.
5. Không máu me, không gợi cảm, nhân vật đều là người lớn.
6. Chưa đạt → dùng prompt sửa nhanh (mục 1.3) trong cùng cuộc trò chuyện.

**Sau khi tải về**

1. Đổi tên đúng tên file trong bảng mục 10 (chữ thường, kebab-case, `.png`).
2. Nếu file là `.webp`/`.jpg`: mở bằng Preview → File → Export → PNG.
3. Kiểm tra kích thước: `sips -g pixelWidth -g pixelHeight <file>`.
4. Asset trong suốt: `sips -g hasAlpha <file>` phải là `yes`; mở trên nền tối để chắc không có ô caro/nền trắng.
5. Đặt vào `apps/web/public/assets/<folder>/`.
6. Chạy `npm run assets:check` → sửa mọi lỗi kích thước/thiếu file.
7. Chạy `npm run assets:optimize` để sinh WebP/AVIF và biến thể responsive.
8. Mở app, kiểm tra theo **Checklist Visual QA** trong `docs/visual-assets-plan.md` §9 (card không kéo giãn, không mất mặt, nền không che nội dung, tương phản chữ, nhất quán phong cách, mobile/desktop, chuyển phase mượt).
9. Đánh dấu ☑ trong bảng dưới.

---

## 10. Bảng ánh xạ prompt → tên file

Đường dẫn tính từ `apps/web/public/assets/`. "Alpha" = cần nền trong suốt.

| # | Prompt | Tên file | Kích thước | Alpha | Ưu tiên | Trạng thái |
|---:|---|---|---|:---:|:---:|:---:|
| 1 | 2.1 Villager | `cards/villager.png` | 1024×1536 | — | P0 | ☐ |
| 2 | 2.2 Werewolf | `cards/werewolf.png` | 1024×1536 | — | P0 | ☐ |
| 3 | 2.3 Seer | `cards/seer.png` | 1024×1536 | — | P0 | ☐ |
| 4 | 2.4 Witch | `cards/witch.png` | 1024×1536 | — | P0 | ☐ |
| 5 | 2.5 Guardian | `cards/guardian.png` | 1024×1536 | — | P0 | ☐ |
| 6 | 2.6 Hunter | `cards/hunter.png` | 1024×1536 | — | P0 | ☐ |
| 7 | 2.7 Cupid | `cards/cupid.png` | 1024×1536 | — | P2 | ☐ |
| 8 | 2.8 Elder | `cards/elder.png` | 1024×1536 | — | P2 | ☐ |
| 9 | 2.9 White Wolf | `cards/white-wolf.png` | 1024×1536 | — | P2 | ☐ |
| 10 | 3.1 Card back | `card-backs/card-back.png` | 1024×1536 | — | P0 | ☐ |
| 11 | 4.1 Landing (desktop) | `backgrounds/landing.png` | 1536×1024 | — | P0 | ☐ |
| 12 | 4.1 Landing (mobile) | `backgrounds/landing-mobile.png` | 1024×1536 | — | P0 | ☐ |
| 13 | 4.2 Lobby (desktop) | `backgrounds/lobby.png` | 1536×1024 | — | P0 | ☐ |
| 14 | 4.2 Lobby (mobile) | `backgrounds/lobby-mobile.png` | 1024×1536 | — | P0 | ☐ |
| 15 | 4.3 Role reveal (desktop) | `backgrounds/role-reveal.png` | 1536×1024 | — | P0 | ☐ |
| 16 | 4.3 Role reveal (mobile) | `backgrounds/role-reveal-mobile.png` | 1024×1536 | — | P0 | ☐ |
| 17 | 4.4 Night (desktop) | `backgrounds/night.png` | 1536×1024 | — | P0 | ☐ |
| 18 | 4.4 Night (mobile) | `backgrounds/night-mobile.png` | 1024×1536 | — | P0 | ☐ |
| 19 | 4.5 Day (desktop) | `backgrounds/day.png` | 1536×1024 | — | P0 | ☐ |
| 20 | 4.5 Day (mobile) | `backgrounds/day-mobile.png` | 1024×1536 | — | P0 | ☐ |
| 21 | 4.6 Discussion (desktop) | `backgrounds/discussion.png` | 1536×1024 | — | P1 | ☐ |
| 22 | 4.6 Discussion (mobile) | `backgrounds/discussion-mobile.png` | 1024×1536 | — | P1 | ☐ |
| 23 | 4.7 Voting (desktop) | `backgrounds/voting.png` | 1536×1024 | — | P0 | ☐ |
| 24 | 4.7 Voting (mobile) | `backgrounds/voting-mobile.png` | 1024×1536 | — | P0 | ☐ |
| 25 | 4.8 Elimination (desktop) | `backgrounds/elimination.png` | 1536×1024 | — | P1 | ☐ |
| 26 | 4.8 Elimination (mobile) | `backgrounds/elimination-mobile.png` | 1024×1536 | — | P1 | ☐ |
| 27 | 4.9 Village victory (desktop) | `backgrounds/victory-village.png` | 1536×1024 | — | P1 | ☐ |
| 28 | 4.9 Village victory (mobile) | `backgrounds/victory-village-mobile.png` | 1024×1536 | — | P1 | ☐ |
| 29 | 4.10 Werewolf victory (desktop) | `backgrounds/victory-werewolf.png` | 1536×1024 | — | P1 | ☐ |
| 30 | 4.10 Werewolf victory (mobile) | `backgrounds/victory-werewolf-mobile.png` | 1024×1536 | — | P1 | ☐ |
| 31 | 4.11 Moderator (desktop) | `backgrounds/moderator.png` | 1536×1024 | — | P1 | ☐ |
| 32 | 4.11 Moderator (mobile) | `backgrounds/moderator-mobile.png` | 1024×1536 | — | P2 | ☐ |
| 33 | 5.1 Role icon Villager | `icons/role-villager.png` | 1024×1024 | ✓ | P0 | ☐ |
| 34 | 5.2 Role icon Werewolf | `icons/role-werewolf.png` | 1024×1024 | ✓ | P0 | ☐ |
| 35 | 5.3 Role icon Seer | `icons/role-seer.png` | 1024×1024 | ✓ | P0 | ☐ |
| 36 | 5.4 Role icon Witch | `icons/role-witch.png` | 1024×1024 | ✓ | P0 | ☐ |
| 37 | 5.5 Role icon Guardian | `icons/role-guardian.png` | 1024×1024 | ✓ | P0 | ☐ |
| 38 | 5.6 Role icon Hunter | `icons/role-hunter.png` | 1024×1024 | ✓ | P0 | ☐ |
| 39 | 5.7 Role icon Cupid | `icons/role-cupid.png` | 1024×1024 | ✓ | P2 | ☐ |
| 40 | 5.8 Role icon Elder | `icons/role-elder.png` | 1024×1024 | ✓ | P2 | ☐ |
| 41 | 5.9 Role icon White Wolf | `icons/role-white-wolf.png` | 1024×1024 | ✓ | P2 | ☐ |
| 42 | 5.10 Team crest Village | `icons/team-village.png` | 1024×1024 | ✓ | P0 | ☐ |
| 43 | 5.11 Team crest Werewolf | `icons/team-werewolf.png` | 1024×1024 | ✓ | P0 | ☐ |
| 44 | 5.12 Team crest Special | `icons/team-special.png` | 1024×1024 | ✓ | P2 | ☐ |
| 45 | 6.1 Full moon | `effects/moon-full.png` | 1024×1024 | ✓ | P0 | ☐ |
| 46 | 6.2 Blood moon | `effects/moon-blood.png` | 1024×1024 | ✓ | P1 | ☐ |
| 47 | 6.3 Dusk transition | `effects/transition-dusk.png` | 1536×1024 | — | P1 | ☐ |
| 48 | 6.4 Dawn transition | `effects/transition-dawn.png` | 1536×1024 | — | P1 | ☐ |
| 49 | 6.5 Healing potion | `effects/potion-heal.png` | 1024×1024 | ✓ | P1 | ☐ |
| 50 | 6.6 Poison potion | `effects/potion-poison.png` | 1024×1024 | ✓ | P1 | ☐ |
| 51 | 6.7 Vote token | `effects/vote-token.png` | 1024×1024 | ✓ | P1 | ☐ |
| 52 | 6.8 Protection ward | `effects/shield.png` | 1024×1024 | ✓ | P1 | ☐ |
| 53 | 6.9 Victory emblem | `effects/victory-emblem.png` | 1024×1024 | ✓ | P1 | ☐ |
| 54 | 6.10 Defeat emblem | `effects/defeat-emblem.png` | 1024×1024 | ✓ | P1 | ☐ |
| 55 | 6.11 Border ornament | `effects/border-ornament.png` | 1536×1024 | ✓ | P1 | ☐ |
| 56 | 6.12 Fog overlay | `effects/fog-overlay.png` | 1536×1024 | ✓ | P1 | ☐ |
| 57 | 7.1 Logo emblem | `logos/logo-emblem.png` | 1024×1024 | ✓ | P0 | ☐ |

**Tổng:** 57 asset · P0: 29 · P1: 20 · P2: 8.
