export const NOTIFICATION_REMINDER_QUEUE = 'notification-reminder';
export const NOTIFICATION_REMINDER_JOB = 'send-event-reminder';

// Danh sách preset cố định (phút) - giống lựa chọn "nhắc trước" của Google Calendar.
// Dùng chung cho validation ở DTO và hiển thị dropdown bên FE.
export const REMINDER_PRESETS_MINUTES = [10, 60, 1440, 10080] as const; // 10p / 1h / 1 ngày / 1 tuần
export const DEFAULT_REMINDER_MINUTES = 1440;