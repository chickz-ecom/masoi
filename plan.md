# PROJECT: WEREWOLF ONLINE — Multiplayer Web Game

Bạn là Senior Full-stack Engineer, Game Systems Architect và UI/UX Designer.

Tôi muốn xây dựng một ứng dụng web chơi **Ma Sói (Werewolf)** multiplayer theo thời gian thực, có thể triển khai production trên VPS và cho nhiều nhóm người chơi cùng lúc.

## 1. Mục tiêu sản phẩm

Xây dựng một trò chơi Ma Sói trực tuyến có hai chế độ:

**Mode A — Automatic Moderator (Không cần quản trò)**

- Tất cả người tham gia đều được chơi.
- Hệ thống đóng vai trò quản trò tự động.
- Tự động chia vai ngẫu nhiên, bí mật.
- Tự động điều khiển các giai đoạn ngày và đêm.
- Điều phối lượt sử dụng kỹ năng.
- Tự động tổng hợp hành động, xử lý hiệu ứng và thông báo kết quả.
- Tự động xử lý bỏ phiếu, loại người chơi và kiểm tra điều kiện thắng.
- Có lời dẫn bằng văn bản và giọng đọc tiếng Việt (nếu được hỗ trợ).
- Không yêu cầu bất cứ người chơi nào phải biết tất cả vai trò.

**Mode B — Human Moderator (Có quản trò)**

- Một người làm quản trò và không tham gia phe chơi.
- Quản trò có dashboard riêng.
- Quản trò có thể xem toàn bộ vai trò và trạng thái trận đấu.
- Điều khiển chuyển ngày/đêm, thời gian thảo luận và bỏ phiếu.
- Xem trạng thái hoàn thành kỹ năng, quản lý lượt hành động.
- Có thể xác nhận hoặc điều chỉnh kết quả trước khi công bố.
- Có quyền tạm dừng, tiếp tục, xử lý ngoại lệ và kết thúc trận.
- Hệ thống vẫn tự tính toán logic để giảm công việc thủ công của quản trò.

**Yêu cầu kiến trúc:** Hai chế độ dùng chung Game Engine, Role Engine và Rule Engine. Chỉ khác ở quyền điều khiển và chính sách chuyển trạng thái.

## 2. Technology Stack

Ưu tiên:

- Next.js (App Router)
- TypeScript strict mode
- React
- Tailwind CSS
- shadcn/ui
- Motion / Framer Motion
- Node.js
- Socket.IO
- PostgreSQL
- Prisma ORM
- Redis
- Zod
- Docker / Docker Compose
- Nginx

Có thể dùng backend Socket.IO chạy thành service riêng để hỗ trợ realtime ổn định.

Kiến trúc phải dễ deploy lên VPS, hỗ trợ nhiều room độc lập và có thể scale trong tương lai.

Không sử dụng dữ liệu lưu trong bộ nhớ process làm nguồn sự thật duy nhất.

## 3. Luồng tham gia phòng

### Tạo phòng

Người chơi vào trang chủ và chọn "Tạo phòng".

Các lựa chọn:

- Chế độ: Không quản trò / Có quản trò.
- Tên phòng.
- Số lượng người chơi tối đa.
- Bộ vai trò.
- Thiết lập thời gian các giai đoạn.
- Cấu hình luật chơi.
- Có/không công khai vai khi chết.
- Có/không cho người xem.
- Có/không cho người chết quan sát.
- Có/không cho phép vào lại phòng.

Sau khi tạo:

- Tạo room code ngẫu nhiên, khó đoán.
- Tạo link mời.
- Tạo QR code.
- Chủ phòng có quyền cấu hình trước khi bắt đầu.

### Tham gia phòng

Người chơi:

1. Mở link hoặc nhập room code.
2. Nhập nickname.
3. Nhận player identity/session token.
4. Vào lobby.
5. Nhìn thấy danh sách người chơi.
6. Đánh dấu Ready.
7. Chờ bắt đầu.

Không bắt buộc đăng ký tài khoản.

Guest session cần được lưu an toàn để refresh trang hoặc mất kết nối vẫn có thể quay lại đúng nhân vật.

Không dùng nickname làm định danh hoặc bằng chứng xác thực.

## 4. Hệ thống vai trò

Xây dựng Role Engine có thể mở rộng bằng module.

### Vai trò cơ bản

| Vai trò | Phe | Khả năng |
|---|---|---|
| Dân Làng | Village | Thảo luận và bỏ phiếu |
| Ma Sói | Werewolf | Phối hợp chọn mục tiêu vào ban đêm |
| Tiên Tri | Village | Kiểm tra một người mỗi đêm |
| Bảo Vệ | Village | Bảo vệ một người mỗi đêm |
| Phù Thủy | Village | Một bình cứu và một bình độc trong cả trận |
| Thợ Săn | Village | Có thể bắn một người khi kích hoạt điều kiện chết |
| Cupid | Configurable | Ghép hai người thành cặp ở đêm đầu |
| Già Làng | Village | Có cơ chế chống chịu theo luật cấu hình |
| Sói Trắng | Special | Có điều kiện thắng và kỹ năng riêng |

Mỗi role phải có:

- ID
- Name
- Description
- Team
- Ability configuration
- Action phase
- Action priority
- Target restrictions
- Usage limits
- State
- Visibility rules
- Win condition rules

Không hardcode logic xử lý kỹ năng trực tiếp trong React component.

### Bộ luật mặc định cho MVP

Triển khai trước một ruleset nhiều đêm, với các quy tắc sau:

- Sói thắng khi số Sói còn sống lớn hơn hoặc bằng tổng số người không thuộc phe Sói còn sống.
- Làng thắng khi tất cả Sói đã bị loại.
- Tiên Tri chỉ biết mục tiêu thuộc phe Sói hay không, không tự động biết vai cụ thể.
- Bảo Vệ chỉ chặn đòn tấn công của Sói; mặc định không được bảo vệ cùng một người hai đêm liên tiếp.
- Phù Thủy có một bình cứu và một bình độc, mỗi bình chỉ được dùng một lần.
- Bình độc bỏ qua bảo vệ thông thường.
- Không cho Phù Thủy dùng cả hai bình trong cùng một đêm ở ruleset mặc định.
- Thợ Săn được kích hoạt khi bị Sói tấn công hoặc bị bỏ phiếu loại, nhưng không được kích hoạt khi chết vì độc.
- Người đã chết không được sử dụng kỹ năng hay bỏ phiếu.
- Các hiệu ứng chết dây chuyền phải được giải quyết trước khi kiểm tra thắng thua cuối cùng.

Những luật có nhiều biến thể phải triển khai bằng cấu hình hoặc ruleset riêng, không tự ý trộn các phiên bản.

Cupid, Già Làng, Sói Trắng và các vai phức tạp chỉ được bật sau khi có định nghĩa luật rõ ràng và test đầy đủ.

## 5. Game Flow

### Phase 1 — Lobby

- Người chơi tham gia.
- Host thiết lập danh sách vai.
- Kiểm tra tổng số vai bằng số người chơi thực tế.
- Kiểm tra bộ vai hợp lệ.
- Người chơi Ready.
- Host bắt đầu.

### Phase 2 — Role Assignment

- Server thực hiện random bảo mật.
- Mỗi người nhận một vai bí mật.
- Chỉ người đó được xem vai của mình.
- Sói biết những đồng đội được phép biết theo luật.
- Quản trò có thể xem toàn bộ.

Hiển thị role card đẹp, có animation lật bài.

### Phase 3 — Night

Tất cả người chơi vào màn hình ban đêm.

Hệ thống lần lượt kích hoạt các kỹ năng theo thứ tự đã được định nghĩa.

Ví dụ:

1. Cupid ghép đôi (đêm đầu).
2. Bảo Vệ chọn mục tiêu.
3. Ma Sói chọn mục tiêu.
4. Tiên Tri kiểm tra.
5. Phù Thủy quyết định cứu/đầu độc.
6. Resolve toàn bộ hành động.

Lưu ý: thứ tự thu thập hành động và thứ tự áp dụng hiệu ứng phải được định nghĩa riêng, vì một số vai phụ thuộc kết quả của vai khác.

Mỗi vai chỉ thấy giao diện và thông tin được phép.

Ma Sói có màn hình chọn mục tiêu và cơ chế thống nhất phiếu nội bộ. Cần định nghĩa cách xử lý khi các Sói bất đồng hoặc không thực hiện hành động.

### Phase 4 — Dawn

Hệ thống xử lý:

- Mục tiêu bị Sói tấn công.
- Hiệu ứng Bảo Vệ.
- Hiệu ứng bình cứu.
- Hiệu ứng bình độc.
- Các phản ứng khi chết.
- Các hiệu ứng liên kết nếu được bật.
- Điều kiện thắng thua.

Chỉ công bố thông tin được phép công khai.

Không tiết lộ người dùng kỹ năng hoặc mục tiêu đã được bảo vệ nếu luật không cho phép.

### Phase 5 — Day Discussion

- Hiển thị người còn sống.
- Người chết được đánh dấu.
- Có countdown.
- Người chơi thảo luận.
- Cho phép host điều chỉnh timer trước trận.
- Hệ thống thông báo khi sắp hết giờ.

Chưa cần tích hợp voice/video call trong MVP. Người chơi có thể trao đổi trực tiếp hoặc dùng Discord.

### Phase 6 — Voting

- Mỗi người còn sống có một phiếu.
- Chỉ được chọn người hợp lệ.
- Cho phép đổi lựa chọn trước khi khóa phiếu nếu cấu hình bật.
- Có tùy chọn bỏ phiếu trắng.
- Server kiểm tra quyền bỏ phiếu.
- Server tính kết quả.

Quy tắc MVP:

- Người có nhiều phiếu hợp lệ nhất bị loại.
- Nếu hòa cao nhất, bỏ phiếu lại một lần giữa các ứng viên hòa.
- Nếu vẫn hòa, không ai bị loại.
- Nếu không có phiếu hợp lệ, không ai bị loại.

Không dựa vào kết quả tính toán phía client.

### Phase 7 — Elimination / Next Night

- Xử lý người bị loại.
- Kích hoạt hiệu ứng chết nếu có.
- Kiểm tra thắng thua.
- Nếu chưa có đội thắng thì chuyển sang đêm tiếp theo.

### Phase 8 — Game Over

Hiển thị:

- Đội chiến thắng.
- Danh sách vai thật.
- Danh sách người sống/chết.
- Số ngày đêm.
- Timeline các sự kiện.
- Các phiếu bầu.
- Tổng kết diễn biến trận.

Cho phép chơi lại cùng nhóm người, chia vai mới.

## 6. Automatic Moderator Mode

Đây là chế độ quan trọng nhất.

Xây dựng Auto Moderator Controller điều khiển toàn bộ trận.

Yêu cầu:

- Server-side timers.
- Tự động mở/đóng các phase.
- Tự động xử lý hành động hết giờ.
- Tự chuyển lượt.
- Có nút Skip nếu người chơi đủ điều kiện đã hoàn thành và luật cho phép.
- Có countdown đồng bộ với server.
- Có màn hình hướng dẫn từng giai đoạn.
- Có âm thanh thông báo chuyển ngày/đêm.
- Có tùy chọn narration tiếng Việt qua Speech Synthesis API và fallback văn bản.

Không phụ thuộc browser timer của host.

Nếu host rời phòng, trận vẫn tiếp tục.

Nếu tất cả người chơi mất kết nối, cần có chính sách pause hoặc kết thúc theo cấu hình; không được tự động làm sai trạng thái trận.

## 7. Human Moderator Mode

Xây dựng dashboard quản trò riêng.

Gồm:

- Player overview.
- Role overview.
- Alive / Dead status.
- Current phase.
- Action status.
- Night action summary.
- Timer controls.
- Vote management.
- Event timeline.

Quản trò có thể:

- Start / Pause / Resume.
- Next phase.
- Close voting.
- Lock actions.
- Confirm results.
- Override elimination.
- Reopen action khi an toàn.
- End game.

Mọi override phải được kiểm tra hợp lệ, lưu audit log và không tạo ra game state mâu thuẫn.

Quản trò có thể xem hành động bí mật nhưng thông tin đó tuyệt đối không được phát ra cho người chơi khác.

## 8. Multiplayer Realtime

Dùng Socket.IO.

Thiết kế event contract có typing rõ ràng.

Các loại event:

- ROOM_CREATED
- PLAYER_JOINED
- PLAYER_LEFT
- PLAYER_RECONNECTED
- PLAYER_READY
- GAME_STARTED
- ROLE_ASSIGNED
- PHASE_CHANGED
- ROLE_ACTION_REQUESTED
- ROLE_ACTION_SUBMITTED
- VOTE_SUBMITTED
- VOTING_ENDED
- PLAYER_ELIMINATED
- GAME_ENDED
- GAME_STATE_SYNC

Phân quyền event theo recipient.

Phải có:

- Authoritative server state.
- Private events.
- Server validation.
- Room isolation.
- Reconnect support.
- Idempotent action handling.
- Race condition protection.
- State synchronization.
- Redis adapter nếu có nhiều backend instances.

Không broadcast toàn bộ state rồi chỉ ẩn các trường nhạy cảm bằng CSS hoặc JavaScript client.

## 9. Database Design

Thiết kế schema cho các entity:

- Room
- RoomSettings
- Player
- PlayerSession
- Game
- GameParticipant
- RoleDefinition
- GameRoleAssignment
- GamePhase
- GameAction
- Vote
- GameEvent
- GameResult
- ModeratorAuditLog

Phân biệt room, game instance và player session.

Game state phải có cơ chế versioning và transaction/locking để tránh xử lý hai hành động xung đột.

Các dữ liệu bí mật cần có access policy rõ ràng.

Lưu game history để có thể xem lại sau trận.

## 10. UI/UX Design

Thiết kế theo phong cách:

**Dark Fantasy / Medieval Werewolf / Premium Card Game**

- Nền xanh đen, tím than.
- Accent đỏ máu, vàng cổ.
- Ánh trăng và sương mù.
- Các thẻ vai fantasy.
- Hiệu ứng lật bài.
- Animation chuyển ngày/đêm.
- Không khí bí ẩn nhưng không quá rối mắt.
- Typography tiếng Việt dễ đọc.

Mobile-first.

Các trang cần thiết:

1. Landing page.
2. Create room.
3. Join room.
4. Lobby.
5. Room settings.
6. Role reveal.
7. Night phase.
8. Role action.
9. Day discussion.
10. Voting.
11. Elimination result.
12. Game over.
13. Moderator dashboard.
14. Rules and role guide.

Mỗi phase phải có trạng thái UI cho waiting, submitting, submitted, timeout, reconnecting và error.

Accessibility: hỗ trợ reduced motion, keyboard focus, tương phản văn bản và không dựa hoàn toàn vào màu sắc để truyền tải trạng thái.
## 10.1. Game Visual Assets — Kết hợp ChatGPT để tạo hình ảnh

Tôi muốn toàn bộ hình ảnh của game Ma Sói được thiết kế đồng bộ, có phong cách riêng và chất lượng cao.

**Phân chia trách nhiệm:**

- **ChatGPT:** Thiết kế và tạo hình ảnh bằng công cụ tạo ảnh, bao gồm thẻ nhân vật, background, hình ảnh các phase, vật phẩm và các hình ảnh trang trí.
- **Claude Code:** Xây dựng giao diện, animation, tích hợp hình ảnh vào game, quản lý asset và tối ưu hiệu năng.

Claude không được tự sử dụng ảnh stock, ảnh ngẫu nhiên từ Internet hoặc emoji để thay thế hình ảnh chính thức của game.

### A. Art Direction

Phong cách chủ đạo: **Dark Fantasy Medieval Werewolf — Premium Card Game**.

Định hướng:

- Bối cảnh ngôi làng châu Âu thời Trung Cổ.
- Rừng già, sương mù, lâu đài cổ và ánh trăng.
- Màu sắc chủ đạo: xanh đen, tím than, đỏ rượu, vàng đồng.
- Nhân vật có chiều sâu, tạo hình huyền bí.
- Ánh sáng cinematic, đổ bóng chân thực.
- Hình ảnh đẹp, chuyên nghiệp, thống nhất giữa các thẻ bài.
- Không sao chép trực tiếp artwork từ những game Ma Sói thương mại.

Ưu tiên phong cách semi-realistic fantasy illustration, không sử dụng phong cách hoạt hình trẻ em.

### B. Character Cards

Mỗi vai trò cần có hình ảnh riêng:

1. Dân Làng — Villager.
2. Ma Sói — Werewolf.
3. Tiên Tri — Seer.
4. Phù Thủy — Witch.
5. Bảo Vệ — Guardian.
6. Thợ Săn — Hunter.
7. Cupid.
8. Già Làng — Elder.
9. Sói Trắng — White Wolf.

Mỗi card cần:

- Artwork riêng của nhân vật.
- Bố cục và góc máy thống nhất.
- Nhân vật là trọng tâm.
- Có khoảng trống phù hợp để UI hiển thị tên và kỹ năng.
- Không chứa chữ, số hoặc logo được vẽ trực tiếp trong artwork.
- Có thể bổ sung khung thẻ bằng CSS/SVG để thể hiện phe.
- Thiết kế phù hợp cả màn hình điện thoại và desktop.

Ảnh card nên có tỷ lệ 2:3, độ phân giải mục tiêu 1024×1536 hoặc tương đương.

Tạo cả mặt sau thẻ bài với họa tiết Ma Sói riêng của game.

### C. Background Assets

Thiết kế các background riêng cho:

- Landing page: ngôi làng dưới trăng tròn.
- Lobby: quán trọ cổ với ánh nến.
- Role reveal: không gian huyền bí để lật thẻ.
- Night phase: khu rừng tối dưới ánh trăng.
- Day phase: quảng trường làng lúc bình minh.
- Discussion: quảng trường hoặc bàn tròn hội đồng.
- Voting: nơi xét xử cổ.
- Elimination: khung cảnh u tối, kịch tính.
- Village victory: ngôi làng đón bình minh.
- Werewolf victory: ngôi làng dưới trăng đỏ.
- Moderator dashboard: bàn làm việc với sách cổ, bản đồ và nến.

Background ưu tiên tỷ lệ 16:9 cho desktop, đồng thời có phiên bản phù hợp mobile.

Không được đặt thông tin quan trọng ở những khu vực dễ bị che bởi UI.

### D. Other Visual Assets

Ngoài nhân vật và background, cần có:

- Game logo.
- Card back.
- Role icons.
- Team icons.
- Moon phase illustration.
- Day/night transition graphics.
- Potion illustrations.
- Voting tokens.
- Victory/defeat illustrations.
- Decorative medieval borders.

Các hình ảnh có nền trong suốt cần được xuất PNG hoặc WebP có alpha.

### E. Workflow phối hợp Claude Code và ChatGPT

Claude Code không được giả định có thể trực tiếp gọi ChatGPT hoặc tự động tạo hình ảnh nếu chưa có integration thực tế.

Thực hiện theo quy trình:

**Step 1 — Asset Planning**

Claude tạo file:

`docs/visual-assets-plan.md`

Nội dung gồm:

- Danh sách toàn bộ asset cần thiết.
- Tên file.
- Vai trò sử dụng.
- Kích thước.
- Aspect ratio.
- Định dạng.
- Mức độ ưu tiên.
- Vị trí hiển thị.

**Step 2 — ChatGPT Image Prompts**

Claude tạo:

`docs/chatgpt-image-prompts.md`

Trong đó viết prompt tạo ảnh chi tiết cho từng asset để tôi có thể gửi sang ChatGPT.

Mỗi prompt phải mô tả:

- Chủ thể.
- Bối cảnh.
- Bố cục.
- Phong cách.
- Bảng màu.
- Ánh sáng.
- Tỷ lệ khung hình.
- Những yếu tố không được xuất hiện.
- Các điểm neo phong cách để duy trì tính nhất quán.

Tạo một Master Art Direction Prompt dùng chung cho toàn bộ hình ảnh.

**Step 3 — Asset Generation**

Tôi sẽ gửi các prompt này cho ChatGPT để tạo hình ảnh.

Claude cần chuẩn bị sẵn cấu trúc thư mục và cho phép tôi bổ sung các hình ảnh được tạo vào project.

Nếu có công cụ hoặc API tích hợp tạo ảnh được cấu hình hợp lệ, Claude có thể đề xuất workflow tự động. Không tự nhận rằng đã kết nối ChatGPT khi chưa có quyền truy cập thực tế.

**Step 4 — Asset Integration**

Sau khi ảnh được cung cấp, Claude thực hiện:

- Kiểm tra file và kích thước.
- Tối ưu dung lượng.
- Chuyển sang WebP/AVIF nếu phù hợp.
- Tạo responsive variants.
- Tích hợp vào React components.
- Thiết kế animation.
- Đảm bảo không gây layout shift.
- Lazy load hình ảnh không quan trọng.
- Preload những hình ảnh cần thiết ở phase hiện tại.

**Step 5 — Visual QA**

Kiểm tra:

- Card không bị kéo giãn.
- Nhân vật không bị crop mất mặt.
- Background không che nội dung.
- Text trên nền có độ tương phản tốt.
- Hình ảnh giữa các vai có phong cách nhất quán.
- Giao diện mobile và desktop đều đẹp.
- Hiệu ứng chuyển phase mượt mà.

### F. Asset Management

Đề xuất cấu trúc:

public/assets/
- cards/
- card-backs/
- backgrounds/
- characters/
- icons/
- effects/
- logos/
- audio/

Tạo asset manifest để quản lý đường dẫn, tỷ lệ và phiên bản.

Không hardcode asset path rải rác trong nhiều components.

### G. Yêu cầu quan trọng

- Hình ảnh là một phần quan trọng của trải nghiệm game.
- Ưu tiên chất lượng hình ảnh hơn số lượng hiệu ứng.
- Không làm giao diện rối mắt.
- Không dùng AI để tạo chữ trực tiếp trên thẻ bài; tên vai, mô tả và kỹ năng phải được render bằng HTML/CSS để hỗ trợ đa ngôn ngữ.
- Không để việc thiếu artwork chặn quá trình phát triển Game Engine.
- Có thể dùng placeholder kỹ thuật tạm thời trong quá trình lập trình, nhưng không sử dụng làm hình ảnh production cuối cùng.

**Kết quả mong muốn:** Một game Ma Sói có bộ nhận diện hình ảnh riêng, thẻ bài đẹp, background cinematic, và toàn bộ giao diện thống nhất như một sản phẩm game thương mại chuyên nghiệp.
## 11. Security & Anti-cheat

- Server là nguồn sự thật duy nhất.
- Không gửi role của người khác về client.
- Không tin tưởng input từ browser.
- Session token không dễ đoán.
- Chặn người chơi submit action nhiều lần.
- Chặn người chết vote.
- Chặn hành động sai phase.
- Chặn target không hợp lệ.
- Chặn người dùng giả danh quản trò.
- Không cho client tự sửa trạng thái hoặc kết quả.
- Rate limiting.
- Validate payload bằng Zod.
- Escape/sanitize nickname.
- Chặn truy cập private state qua API, WebSocket và log.

Không thiết kế bảo mật chỉ dựa trên việc ẩn nút trên giao diện.

## 12. Reliability / Edge Cases

Cần xử lý rõ:

- Người chơi refresh trang.
- Người chơi mất mạng rồi kết nối lại.
- Host rời phòng.
- Quản trò rời phòng.
- Người chơi không hành động trước timeout.
- Sói không thống nhất mục tiêu.
- Vote hòa.
- Nhiều người chết cùng lúc.
- Thợ Săn kích hoạt bắn.
- Phù Thủy không sử dụng bình.
- Game server restart.
- Redis reconnect.
- PostgreSQL reconnect.
- Hai event được gửi đồng thời.
- Reconnect đúng thời điểm chuyển phase.
- Hành động cũ gửi đến sau khi phase đã kết thúc.

Với các tình huống ảnh hưởng kết quả trận, server phải có chính sách xác định, có thể test được và không tiết lộ thông tin bí mật.

## 13. Deployment

Tạo Docker Compose cho:

- web
- game-server
- postgres
- redis

Có:

- Dockerfiles tối ưu production.
- Environment variables.
- Healthchecks.
- Persistent volumes.
- Database migration.
- Graceful shutdown.
- Nginx reverse proxy.
- HTTPS/WSS setup guidance.
- Logging.
- Backup database.
- README hướng dẫn deploy VPS Ubuntu.

Không hardcode credential.

Có thể cấu hình domain tùy ý.

## 14. Testing

Viết unit test và integration test cho:

- Role assignment.
- Phase transitions.
- Night action resolution.
- Vote tally.
- Tie breaking.
- Elimination.
- Hunter reaction.
- Witch healing/poison.
- Guardian protection.
- Win conditions.
- Reconnect.
- Permission checks.
- Concurrent actions.

Ưu tiên test Game Engine độc lập với UI.

Có E2E test mô phỏng nhiều người chơi và ít nhất một trận từ lobby đến game over cho cả hai mode.

## 15. Development Phases

Triển khai theo thứ tự:

**Milestone 1 — Project Foundation**
- Khởi tạo project.
- Database schema.
- Authentication guest.
- Create/join room.
- Socket.IO.
- Lobby.

**Milestone 2 — Core Game Engine**
- Role definitions.
- Rule Engine.
- Secret role assignment.
- Phase state machine.
- Night/day progression.
- Voting.
- Win conditions.

**Milestone 3 — Automatic Moderator**
- Automated phase controller.
- Timers.
- Night actions.
- Results.
- Narration UI.

**Milestone 4 — Human Moderator**
- Dashboard.
- Manual controls.
- Override.
- Audit log.

**Milestone 5 — Enhanced Roles & UX**
- Advanced roles.
- Animations.
- Sounds.
- Game history.
- Replay/restart.

**Milestone 6 — Production**
- Security hardening.
- Load testing.
- Docker deployment.
- Monitoring.
- Documentation.

MVP phải chơi hoàn chỉnh với các vai cơ bản trước khi mở rộng vai phức tạp.

## 16. Cách làm việc

Trước khi viết code:

1. Phân tích yêu cầu.
2. Đề xuất kiến trúc phù hợp.
3. Xác định các luật chơi còn mơ hồ.
4. Tạo tài liệu RULES.md với ruleset MVP cụ thể.
5. Thiết kế database.
6. Thiết kế state machine.
7. Thiết kế Socket.IO event contracts.
8. Lập implementation plan và chia milestone.

Sau đó triển khai từng milestone trực tiếp trong repository.

Không chỉ viết pseudo-code hoặc mock UI.

Code cần chạy được, có validation, error handling và test.

Nếu repo đã tồn tại, trước tiên inspect cấu trúc hiện tại và tái sử dụng thành phần phù hợp. Không tự ý xóa hoặc thay đổi những tính năng không liên quan.

Sau mỗi milestone:

- Chạy typecheck, lint và test.
- Tổng kết phần đã hoàn thành.
- Chỉ rõ tính năng chưa hoàn thành.
- Cập nhật README và tài liệu cần thiết.
- Tiếp tục milestone tiếp theo nếu không có blocker thực sự.

**Bắt đầu bằng architecture, MVP ruleset, game state machine, database design và implementation plan, sau đó tiến hành triển khai Milestone 1.**