# RULES.md — Ruleset `classic-v1` (MVP)

Tài liệu này là **nguồn chuẩn** cho luật chơi mà Game Engine (`packages/engine`) triển khai.
Mọi luật có nhiều biến thể đều được thể hiện bằng **tham số cấu hình** (`RuleConfig`) với giá trị mặc định ghi rõ bên dưới.
Không tự ý trộn biến thể: một trận chỉ chạy đúng một `RuleConfig` được chốt lúc bắt đầu (snapshot vào game state).

---

## 1. Thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| Người chơi (participant) | Người có vai trong trận. Quản trò (Mode B) và người xem **không** phải participant. |
| Phe Sói (wolf team) | Ma Sói + Sói Trắng. |
| Phe không phải Sói | Tất cả participant còn lại. |
| Đêm N / Ngày N | Trận bắt đầu bằng **Đêm 1**, sau đó Ngày 1, Đêm 2, Ngày 2… |
| Bộ vai (deck) | Danh sách vai host chọn ở lobby. **Bộ vai là thông tin công khai** (ai cũng biết có những vai nào trong trận), nhưng không biết ai giữ vai nào. |

## 2. Thiết lập trận

- Số người chơi: **4 – 20**.
- Tổng số lá vai phải **bằng đúng** số người chơi tại thời điểm bắt đầu.
- Phải có ít nhất **1 Sói**; số Sói phải **nhỏ hơn** số người không phải Sói (nếu không trận kết thúc ngay khi bắt đầu).
- Vai duy nhất (tối đa 1 lá): Tiên Tri, Bảo Vệ, Phù Thủy, Thợ Săn, Cupid, Già Làng, Sói Trắng.
- Vai được lặp: Dân Làng, Ma Sói.
- Vai nâng cao (Cupid, Già Làng, Sói Trắng) chỉ dùng được khi bật `enableAdvancedRoles` (mặc định **tắt**).
- Chia vai: server dùng `crypto.randomInt` (Fisher–Yates). Mỗi người chỉ nhận vai của chính mình.
- Sói biết danh sách đồng đội phe Sói (`wolvesKnowEachOther`, mặc định **bật**). Sói Trắng xuất hiện như một Sói bình thường với đồng đội.

## 3. Thứ tự đêm

### 3.1. Thứ tự **thu thập** hành động (các bước gọi dậy)

| # | Bước | Ai hành động | Điều kiện |
|---|---|---|---|
| 1 | `CUPID` | Cupid | Chỉ Đêm 1, khi bộ vai có Cupid |
| 2 | `GUARD` | Bảo Vệ | Khi bộ vai có Bảo Vệ |
| 3 | `WEREWOLVES` | Toàn bộ phe Sói còn sống | Luôn có |
| 4 | `WHITE_WOLF` | Sói Trắng | Các đêm chẵn (2, 4, …), khi bộ vai có Sói Trắng |
| 5 | `SEER` | Tiên Tri | Khi bộ vai có Tiên Tri |
| 6 | `WITCH` | Phù Thủy | Khi bộ vai có Phù Thủy |

- Bước của vai **không có trong bộ vai** bị bỏ qua hoàn toàn (không lộ thông tin vì bộ vai công khai).
- Bước của vai **có trong bộ vai nhưng người giữ vai đã chết / không còn gì để làm** (ví dụ Phù Thủy hết bình) vẫn diễn ra với thời lượng giả ngẫu nhiên `fakeStepSeconds` (mặc định 6–12 giây) ở Mode A để không lộ thông tin. Ở Mode B quản trò tự chuyển bước.
- Một bước kết thúc sớm khi **mọi** người đủ điều kiện ở bước đó đã hoàn tất (riêng bước Sói: khi tất cả Sói còn sống đã chọn **cùng một** lựa chọn).

### 3.2. Thứ tự **áp dụng** hiệu ứng (resolve lúc rạng sáng)

1. Xác định mục tiêu của bầy Sói (`wolfTarget`).
2. Áp dụng bảo vệ của Bảo Vệ.
3. Áp dụng bình cứu của Phù Thủy (chỉ cứu được `wolfTarget`).
4. Tính đòn tấn công của bầy Sói: mục tiêu chết nếu không được Bảo Vệ và không được cứu (Già Làng: xem §5.8).
5. Đòn của Sói Trắng (nếu có).
6. Bình độc của Phù Thủy (bỏ qua bảo vệ).
7. Gom các cái chết; một người có thể có nhiều nguyên nhân.
8. Phản ứng dây chuyền: người yêu chết theo (Cupid), Thợ Săn được quyền bắn (nếu đủ điều kiện).
9. **Chỉ sau khi mọi phản ứng dây chuyền đã được giải quyết** mới kiểm tra điều kiện thắng.

## 4. Ban ngày

### 4.1. Rạng sáng (Dawn)

- Công bố danh sách người chết trong đêm, **sắp theo số ghế**, không công bố nguyên nhân, không công bố ai đã được bảo vệ/cứu.
- Nếu `revealRoleOnDeath` = bật (mặc định **bật**): công bố vai của người chết. Nếu tắt: chỉ công bố "đã chết".
- Nếu không ai chết: công bố "Đêm qua bình yên".

### 4.2. Thảo luận

- Thời gian mặc định 180 giây (host chỉnh trước trận).
- Thông báo khi còn 30 giây.
- **Bỏ qua thảo luận**: nếu `allowSkipDiscussion` (mặc định bật) và **tất cả** người còn sống bấm "Sẵn sàng bỏ phiếu", chuyển sang bỏ phiếu ngay.

### 4.3. Bỏ phiếu

- Mỗi người **còn sống** có 1 phiếu. Người chết, quản trò, người xem không được bỏ phiếu.
- Có thể chọn một người còn sống hoặc **bỏ phiếu trắng** (`targetId = null`).
- Tự bỏ phiếu cho mình: `allowSelfVote` (mặc định **tắt**).
- Đổi phiếu: `allowVoteChange` (mặc định **bật**) — người chơi đổi được cho đến khi bấm **Khóa phiếu** hoặc hết giờ. Nếu tắt, phiếu đầu tiên là phiếu cuối cùng.
- Vòng bỏ phiếu kết thúc sớm khi **mọi** người còn sống đã khóa phiếu.
- Hết giờ: người chưa bỏ phiếu được tính như **không bỏ phiếu** (không phải phiếu trắng hợp lệ — cả hai đều không được tính cho ai).
- Server tự tính kết quả; client không gửi kết quả.
- Phiếu bầu công khai **sau** khi vòng bỏ phiếu đóng (`revealVotes`, mặc định bật). Trong lúc bỏ phiếu chỉ công bố số người đã khóa.

### 4.4. Kiểm phiếu

1. Đếm phiếu hợp lệ (phiếu cho một ứng viên hợp lệ). Phiếu trắng không tính cho ai.
2. Nếu không có phiếu hợp lệ → **không ai bị loại**.
3. Nếu một người có số phiếu cao nhất duy nhất → người đó bị loại.
4. Nếu hòa cao nhất ở vòng 1 → **bỏ phiếu lại một lần** (vòng 2), chỉ được chọn giữa các ứng viên hòa (hoặc phiếu trắng). Mọi người còn sống (kể cả ứng viên) đều được bỏ phiếu.
5. Vòng 2 vẫn hòa hoặc không có phiếu hợp lệ → **không ai bị loại**.

### 4.5. Loại người chơi

- Người bị loại chết với nguyên nhân `VOTE`, kích hoạt phản ứng dây chuyền (§3.2 bước 8), rồi kiểm tra thắng thua, rồi sang đêm tiếp theo.

## 5. Vai trò

### 5.1. Dân Làng (`villager`) — phe Làng
Không có kỹ năng đêm. Thảo luận và bỏ phiếu.

### 5.2. Ma Sói (`werewolf`) — phe Sói
- Mỗi đêm, mỗi Sói còn sống chọn một mục tiêu (hoặc "không giết"). Sói thấy lựa chọn hiện tại của đồng đội theo thời gian thực.
- Mục tiêu hợp lệ: người còn sống **không thuộc phe Sói** (`wolvesCanTargetWolves` mặc định tắt).
- Kết thúc sớm khi tất cả Sói còn sống chọn cùng một lựa chọn.
- Hết giờ: lấy lựa chọn có **nhiều phiếu nhất** trong các Sói (bỏ qua Sói không chọn).
  - Hòa: `wolfTiePolicy` = `random` (mặc định — server chọn ngẫu nhiên giữa các lựa chọn hòa) hoặc `no_kill`.
  - Không Sói nào chọn → không ai bị tấn công.
- Phù Thủy được biết `wolfTarget` (kể cả khi người đó được Bảo Vệ — Phù Thủy không biết điều đó).

### 5.3. Tiên Tri (`seer`) — phe Làng
- Mỗi đêm kiểm tra **một** người còn sống khác mình.
- Kết quả riêng tư, ngay lập tức: **"thuộc phe Sói"** hoặc **"không thuộc phe Sói"**. Không biết vai cụ thể. Sói Trắng hiện là "thuộc phe Sói".
- Kết quả được lưu trong lịch sử riêng của Tiên Tri.

### 5.4. Bảo Vệ (`guardian`) — phe Làng
- Mỗi đêm chọn một người còn sống để bảo vệ, hoặc bỏ qua.
- Tự bảo vệ: `guardCanSelfProtect` (mặc định **bật**).
- Không được bảo vệ **cùng một người hai đêm liên tiếp** (`guardSameTargetConsecutive` mặc định **tắt**). Nếu đêm trước bỏ qua thì đêm nay được chọn bất kỳ ai.
- Chỉ chặn đòn tấn công của **bầy Sói**. Không chặn độc, không chặn đòn Sói Trắng, không chặn phiếu bầu, không chặn phát bắn của Thợ Săn.
- Bảo Vệ và Phù Thủy cùng cứu một người: người đó **sống** (không có luật "cứu đôi thành chết" trong `classic-v1`).

### 5.5. Phù Thủy (`witch`) — phe Làng
- Có **1 bình cứu** và **1 bình độc** cho cả trận.
- Mỗi đêm Phù Thủy thấy người bị Sói tấn công (nếu có) và gửi **một** quyết định duy nhất: cứu / đầu độc một người / không làm gì.
- **Không được dùng cả hai bình trong cùng một đêm** (`witchBothPotionsSameNight` mặc định tắt).
- Tự cứu: `witchCanSelfHeal` (mặc định **bật**).
- Tự đầu độc: không được phép.
- Bình cứu chỉ dùng được khi đêm đó có người bị Sói tấn công.
- Bình độc **bỏ qua bảo vệ** thông thường.

### 5.6. Thợ Săn (`hunter`) — phe Làng
- Khi chết vì **Sói tấn công** (`WOLVES`) hoặc **bị bỏ phiếu loại** (`VOTE`): được bắn một người còn sống (hoặc từ chối bắn) trong pha `HUNTER_SHOT`.
- Chết vì **độc** (`POISON`) — kể cả khi cùng đêm cũng bị Sói tấn công — thì **không** được bắn.
- Chết vì người yêu (`HEARTBREAK`), phát bắn khác (`HUNTER`) hay đòn Sói Trắng: **không** được bắn.
- Hết giờ mà không chọn → không bắn (`hunterShootsOnTimeout` = tắt).
- Thợ Săn chết trong đêm: bắn **sau** khi công bố rạng sáng, trước khi thảo luận.
- Người bị bắn chết với nguyên nhân `HUNTER`, vai được công bố theo `revealRoleOnDeath`.

### 5.7. Cupid (`cupid`) — phe Làng *(nâng cao)*
- Đêm 1 chọn **hai người khác nhau** (có thể gồm chính mình) làm cặp đôi. Hai người được thông báo riêng về nhau (biết tên và vai của nhau).
- Khi một người trong cặp chết, người kia chết ngay theo (`HEARTBREAK`), trong cùng chuỗi giải quyết.
- Nếu cặp đôi gồm một Sói và một người không phải Sói, họ thành **phe Cặp Đôi**: thắng khi **chỉ còn đúng hai người họ** sống sót. Cặp đôi cùng phe thì thắng theo phe gốc.
- Hết giờ mà Cupid chưa chọn: không ghép đôi.

### 5.8. Già Làng (`elder`) — phe Làng *(nâng cao)*
- Sống sót qua **lần đầu tiên** bị bầy Sói tấn công thành công (đòn tấn công bị "hấp thụ", Già Làng không chết, không ai được báo).
- Chết bình thường khi bị Sói tấn công lần hai, bị độc, bị bỏ phiếu, bị bắn, hoặc chết theo người yêu.
- Biến thể "Già Làng bị dân treo thì dân mất kỹ năng" **không** có trong `classic-v1`.

### 5.9. Sói Trắng (`white_wolf`) — phe Đặc biệt *(nâng cao)*
- Đi săn cùng bầy Sói mỗi đêm và được tính là Sói khi đếm điều kiện thắng của phe Sói (với đồng đội, Sói Trắng là một Sói bình thường).
- Các đêm chẵn có bước riêng `WHITE_WOLF`: có thể giết **một Sói khác** còn sống (hoặc bỏ qua). Đòn này không bị Bảo Vệ chặn và Phù Thủy không được biết.
- Thắng **một mình** khi là người duy nhất còn sống.
- Nếu phe Sói đạt điều kiện thắng (§6) khi Sói Trắng còn sống nhưng chưa phải người sống sót duy nhất, trận **vẫn kết thúc** với phe Sói thắng và Sói Trắng được tính thắng cùng phe Sói (tránh trận kéo dài vô hạn). Điều kiện "người sống sót duy nhất" chỉ là cách thắng riêng bổ sung của Sói Trắng.

## 6. Điều kiện thắng

Kiểm tra **sau khi** mọi cái chết và phản ứng dây chuyền đã được giải quyết, theo thứ tự ưu tiên:

1. Không còn ai sống → **Hòa** (`DRAW`).
2. *(Nâng cao)* Chỉ còn đúng 2 người sống và đó là cặp đôi khác phe → **Cặp Đôi thắng** (`LOVERS`).
3. *(Nâng cao)* Chỉ còn Sói Trắng sống → **Sói Trắng thắng** (`WHITE_WOLF`).
4. Không còn Sói (phe Sói) nào sống → **Làng thắng** (`VILLAGE`).
5. Số Sói còn sống **≥** số người không phải Sói còn sống → **Sói thắng** (`WEREWOLF`).
6. Ngược lại trận tiếp tục.

## 7. Quyền và hạn chế chung

- Người chết không dùng kỹ năng, không bỏ phiếu, không bấm bỏ qua thảo luận (ngoại lệ duy nhất: Thợ Săn bắn trong pha `HUNTER_SHOT` của chính mình).
- Mọi hành động phải gửi kèm `phaseId` hiện tại; hành động mang `phaseId` cũ bị từ chối (`STALE_PHASE`).
- Mọi hành động có `clientActionId` để xử lý idempotent: gửi lại cùng `clientActionId` trả về cùng kết quả, không áp dụng hai lần.
- Hành động ngoài pha / sai vai / mục tiêu không hợp lệ / đã dùng hết lượt đều bị server từ chối với mã lỗi cụ thể.

## 8. Quan sát

| Thiết lập | Mặc định | Ý nghĩa |
|---|---|---|
| `allowSpectators` | tắt | Cho phép người ngoài vào xem. Người xem chỉ thấy thông tin công khai. |
| `deadCanSpectate` | bật | Người chết tiếp tục xem diễn biến **công khai**. Nếu tắt, người chết chỉ thấy màn hình "Bạn đã chết" cho đến khi trận kết thúc. |
| `deadSeeAllRoles` | tắt | Người chết được xem vai của tất cả mọi người (chỉ nên bật khi chơi trực tiếp, không voice chung với người sống). |

## 9. Ngắt kết nối và tạm dừng

- Người chơi mất kết nối: nhân vật vẫn tồn tại; hành động không gửi trước hết giờ được xử lý như "không hành động" theo từng vai (Sói: §5.2, Bảo Vệ/Tiên Tri/Phù Thủy/Cupid: không dùng kỹ năng, Thợ Săn: không bắn, bỏ phiếu: không tính).
- Mode A: host rời phòng không ảnh hưởng trận. Nếu **tất cả** participant mất kết nối: `onAllDisconnected` = `pause` (mặc định) → trận tạm dừng, tự tiếp tục khi có người quay lại; quá `abandonAfterMinutes` (mặc định 10) → trận bị hủy (`ABORTED`, không có đội thắng). Hoặc `end` → hủy ngay.
- Mode B: mọi chuyển pha do quản trò điều khiển; nếu quản trò mất kết nối, trận đứng yên (timer hết thì chỉ khóa hành động) cho đến khi quản trò quay lại; quá `abandonAfterMinutes` mà quản trò không quay lại → hủy.
- `allowRejoin` (mặc định bật): người chơi **chủ động rời** phòng giữa trận có thể quay lại bằng session cũ. Nếu tắt, rời chủ động sẽ thu hồi session. Mất kết nối / refresh luôn được phép quay lại.

## 10. Thời lượng mặc định (giây)

| Pha / bước | Mặc định | Khoảng cho phép |
|---|---|---|
| Xem vai (`ROLE_REVEAL`) | 15 | 5–60 |
| Cupid | 30 | 10–120 |
| Bảo Vệ | 25 | 10–120 |
| Bầy Sói | 45 | 15–180 |
| Sói Trắng | 25 | 10–120 |
| Tiên Tri | 25 | 10–120 |
| Phù Thủy | 30 | 10–120 |
| Bước giả (`fakeStep`) | 6–12 ngẫu nhiên | — |
| Rạng sáng (`DAWN`) | 8 | 3–30 |
| Thợ Săn | 25 | 10–120 |
| Thảo luận | 180 | 30–900 |
| Bỏ phiếu | 60 | 15–300 |
| Bỏ phiếu lại | 45 | 15–300 |
| Kết quả bỏ phiếu | 8 | 3–30 |

## 11. Những điểm mơ hồ đã được chốt

| Câu hỏi | Quyết định trong `classic-v1` |
|---|---|
| Trận bắt đầu bằng ngày hay đêm? | Đêm 1. |
| Sói bất đồng? | Đa số; hòa → ngẫu nhiên (cấu hình được). |
| Sói không hành động? | Không ai bị tấn công. |
| Phù Thủy biết ai bị tấn công khi Bảo Vệ đã che? | Có biết (không biết về bảo vệ). |
| Bảo Vệ + bình cứu cùng một người? | Sống. |
| Thợ Săn bị Sói cắn và bị độc cùng đêm? | Không được bắn. |
| Hòa phiếu? | Bỏ lại 1 lần giữa các ứng viên hòa; vẫn hòa → không ai chết. |
| Công bố nguyên nhân chết? | Không. |
| Công bố vai khi chết? | Theo `revealRoleOnDeath` (mặc định có). |
| Kiểm tra thắng khi Thợ Săn chưa bắn? | Không — đợi phát bắn được giải quyết. |
