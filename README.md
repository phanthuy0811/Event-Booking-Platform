# 🎟️ Event Booking Platform

Hệ thống đặt vé sự kiện trực tuyến được xây dựng bằng **NestJS**, giải quyết bài toán **concurrency** (nhiều người cùng đặt vé một lúc) thông qua **Redis Distributed Lock** và **BullMQ Queue**.

---

## 🏗️ Kiến trúc tổng thể

```
Client
  │
  ▼
NestJS REST API (Port 3000)
  │
  ├── PostgreSQL (Prisma ORM) ─── Lưu trữ dữ liệu chính
  ├── Redis ────────────────────── Distributed Lock + BullMQ Queue
  └── BullMQ Workers ──────────── Xử lý job bất đồng bộ
        ├── ReservationExpireWorker  (tự động hủy giữ chỗ hết hạn)
        └── MockPaymentWorker        (giả lập webhook cổng thanh toán)
```

---

## 🛠️ Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Framework | NestJS 11 |
| Ngôn ngữ | TypeScript |
| ORM | Prisma 6 |
| Database | PostgreSQL 16 |
| Cache / Lock | Redis 7 (ioredis) |
| Queue / Worker | BullMQ |
| Authentication | JWT (Passport.js) |
| Validation | class-validator + class-transformer |
| Mật khẩu | bcrypt |
| QR Code | qrcode |

---

## 📦 Cấu trúc Module

```
src/
├── auth/           # Đăng ký, đăng nhập, JWT strategy
├── users/          # Quản lý người dùng
├── events/         # Quản lý sự kiện (CRUD, duyệt sự kiện)
├── ticket-type/    # Quản lý loại vé của sự kiện
├── reservations/   # 🔑 Giữ chỗ tạm thời (HOLDING → CONFIRMED/EXPIRED/CANCELLED)
├── orders/         # Quản lý đơn hàng
├── payments/       # Xử lý thanh toán + Mock webhook
├── queue/          # Cấu hình BullMQ Queue
├── redis/          # Cấu hình Redis + Distributed Lock Service
├── prisma/         # PrismaService
└── common/         # Guards, Decorators, Filters, Interceptors, Middlewares
```

---

## 🔄 Luồng đặt vé (Core Business Flow)

```
1. [POST /reservations]
   User chọn vé → Redis Lock đảm bảo chỉ 1 request ghi DB tại một thời điểm
   → Trừ remainingQuantity → Tạo Reservation (HOLDING)
   → Đặt job tự hủy sau 10 phút vào BullMQ

2. [POST /orders]
   User xác nhận muốn mua → Tạo Order (PENDING) từ Reservation đang HOLDING

3. [POST /payments]
   User bấm "Thanh toán" → Tạo Payment (PENDING)
   → Đẩy job giả lập webhook vào BullMQ (delay 5s)

4. [BullMQ Worker chạy ngầm sau 5s]
   Giả lập cổng thanh toán gọi webhook → handleWebhook()
   → Nếu PAID: Order → PAID, Reservation → CONFIRMED, xóa job hết hạn
   → Nếu FAILED: Order → CANCELLED, Reservation → CANCELLED, hoàn lại số lượng vé

5. [Nếu không thanh toán trong 10 phút]
   BullMQ Expire Job chạy → Reservation → EXPIRED → Hoàn lại remainingQuantity
```

---

## 🔐 Xử lý Concurrency

Khi nhiều người cùng bấm đặt vé **một loại vé chỉ còn 1 chỗ**:

```
10 request đồng thời
        ↓
Redis Lock (lock:ticket-type:<id>) — chỉ cho 1 request vào mỗi lần
        ↓
Request nào lấy được lock → Kiểm tra & trừ remainingQuantity trong DB Transaction
        ↓
Request đầu thành công → 9 request còn lại thấy remaining = 0 → Báo lỗi "hết vé"
```

**Hai lớp bảo vệ:**
1. **Redis Distributed Lock** — ngăn race condition ở tầng ứng dụng
2. **Prisma DB Transaction** — đảm bảo tính toàn vẹn dữ liệu ở tầng DB

---

## ⚙️ Cài đặt & Chạy

### Yêu cầu
- Node.js >= 18
- Docker & Docker Compose

### Bước 1: Clone và cài dependencies

```bash
npm install
```

### Bước 2: Tạo file môi trường

```bash
cp .env.example .env  # hoặc tạo thủ công file .env
```

Nội dung file `.env`:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/event_booking?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=1d

# App
PORT=3000

# Reservation (số phút giữ chỗ tối đa)
RESERVATION_HOLD_MINUTES=10

# Mock payment (thời gian delay giả lập webhook, tính bằng ms)
MOCK_PAYMENT_WEBHOOK_DELAY_MS=5000
```

### Bước 3: Khởi động hạ tầng (PostgreSQL + Redis)

```bash
docker-compose up -d
```

### Bước 4: Chạy migration database

```bash
npx prisma migrate dev
```

### Bước 5: Khởi động server

```bash
# Development (hot reload)
npm run start:dev

# Production
npm run start:prod
```

Server chạy tại `http://localhost:3000`

---

## 📡 API Endpoints

> Tất cả các API có dấu 🔒 đều yêu cầu Header: `Authorization: Bearer <JWT_TOKEN>`

### 🔑 Auth

| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/auth/register` | Đăng ký tài khoản |
| POST | `/auth/login` | Đăng nhập, nhận JWT token |
---

### 🎪 Events

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/events` | Lấy danh sách sự kiện đã published | |
| GET | `/events/:id` | Xem chi tiết sự kiện | |
| POST | `/events` | Tạo sự kiện mới | 🔒 ORGANIZER |
| PATCH | `/events/:id` | Cập nhật sự kiện | 🔒 ORGANIZER |
| DELETE | `/events/:id` | Xóa sự kiện | 🔒 ORGANIZER |

---

### 🎫 Ticket Types

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| GET | `/ticket-type/event/:eventId` | Lấy danh sách loại vé của sự kiện | |
| POST | `/ticket-type` | Tạo loại vé | 🔒 ORGANIZER |
| PATCH | `/ticket-type/:id` | Cập nhật loại vé | 🔒 ORGANIZER |

---

### 📌 Reservations (Giữ chỗ)

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| POST | `/reservations` | Giữ chỗ (bước 1 của luồng đặt vé) | 🔒 |
| GET | `/reservations/my` | Xem lịch sử giữ chỗ của tôi | 🔒 |
| PATCH | `/reservations/:id/cancel` | Hủy giữ chỗ | 🔒 |

---

### 🛒 Orders (Đơn hàng)

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| POST | `/orders` | Tạo đơn hàng từ giữ chỗ (bước 2) | 🔒 |
| GET | `/orders/my` | Xem danh sách đơn hàng của tôi | 🔒 |
| GET | `/orders/:id` | Xem chi tiết một đơn hàng | 🔒 |
| PATCH | `/orders/:id/cancel` | Hủy đơn hàng (khi chưa thanh toán) | 🔒 |

---

### 💳 Payments (Thanh toán)

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| POST | `/payments` | Khởi tạo thanh toán (bước 3) | 🔒 |
| GET | `/payments/order/:orderId` | Xem trạng thái thanh toán của đơn hàng | 🔒 |
| POST | `/payments/webhook` | Nhận callback từ cổng thanh toán | (Internal) |

---

## 🧪 Test Concurrency

Script test gửi 10 request đặt vé đồng thời để kiểm tra Redis Lock:

```bash
node test-lock.js
```

## 🗃️ Database Schema

```
User ──< Event ──< TicketType ──< Reservation ──── Order ──< OrderItem
                                                      │
                                                      └── Payment
                                                      └──< Ticket
                                                      └──< Notification (User)
```

**Trạng thái Reservation:**
```
HOLDING → CONFIRMED (thanh toán thành công)
        → EXPIRED   (hết 10 phút không thanh toán)
        → CANCELLED (người dùng tự hủy)
```

**Trạng thái Order:**
```
PENDING → PAID      (thanh toán thành công)
        → CANCELLED (hủy đơn / thanh toán thất bại)
        → REFUNDED  (hoàn tiền)
```

---

## 📁 Biến môi trường

| Biến | Mô tả | Mặc định |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | |
| `REDIS_HOST` | Host Redis | `localhost` |
| `REDIS_PORT` | Port Redis | `6379` |
| `JWT_SECRET` | Secret key để ký JWT | |
| `JWT_EXPIRES_IN` | Thời gian hết hạn JWT | `1d` |
| `PORT` | Port server lắng nghe | `3000` |
| `RESERVATION_HOLD_MINUTES` | Số phút giữ chỗ tối đa | `10` |
| `MOCK_PAYMENT_WEBHOOK_DELAY_MS` | Delay giả lập webhook thanh toán (ms) | `5000` |



## 1. Khởi tạo project
nest new event-booking-backend
cd event-booking-backend

## 2. Cài Prisma + các thư viện chính
npm install prisma @prisma/client
npm install @nestjs/passport passport passport-jwt @nestjs/jwt
npm install @nestjs/websockets @nestjs/platform-socket.io
npm install @nestjs/bullmq bullmq ioredis
npm install class-validator class-transformer joi
npm install @nestjs/swagger
npm install qrcode

npx prisma init

## 3. Chép 3 file mình vừa tạo vào đúng vị trí:
### prisma/schema.prisma
### docker-compose.yml (ở root)
### .env  (copy từ .env.example rồi điền)

## 4. Bật hạ tầng dev
docker compose up -d

## 5. Chạy migration đầu tiên
npx prisma migrate dev --name init