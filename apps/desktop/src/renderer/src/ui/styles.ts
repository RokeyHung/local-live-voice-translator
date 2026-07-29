// Class Tailwind dùng lại giữa các màn.
//
// Chỉ gom những tổ hợp lặp ở nhiều nơi; tổ hợp dùng một lần thì viết thẳng vào
// className tại chỗ cho dễ đọc. Giá trị TÍNH LÚC CHẠY (màu theo khâu pipeline,
// chiều rộng thanh mức…) vẫn đi qua `style` — Tailwind không sinh class động được.

/** Tấm kính mờ — `panel` là utility tự định nghĩa trong assets/main.css. */
export const PANEL = 'panel'

/** Ô nhập liệu chuẩn. */
export const INPUT =
  'h-9.5 w-full rounded-md border border-line-strong bg-inset px-3.5 text-base text-fg outline-none placeholder:text-fg-5'

/**
 * <select> bỏ mũi tên mặc định của hệ điều hành và vẽ lại bằng data-URI, để
 * giao diện đồng nhất giữa macOS và Windows. Nền phải viết inline vì là ảnh nền.
 */
export const SELECT =
  'h-8 cursor-pointer appearance-none rounded-sm border border-line-strong bg-inset pl-2.5 pr-7 text-sm font-semibold text-fg outline-none disabled:cursor-not-allowed disabled:opacity-50'

export const SELECT_ARROW: React.CSSProperties = {
  background:
    "var(--inset) url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%2394a3b8' stroke-width='2'><path d='M2 4l4 4 4-4'/></svg>\") no-repeat right 9px center"
}

export const GHOST_BUTTON =
  'inline-flex h-8.5 cursor-pointer items-center gap-1.75 rounded-[9px] border border-line-strong bg-line-soft px-3.5 text-base font-semibold text-fg-2 transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-45'

export const PRIMARY_BUTTON =
  'inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border-none bg-linear-[135deg,#22d3ee,#3b82f6] px-4.5 text-base font-bold text-[#04121a] shadow-[0_4px_14px_rgba(34,211,238,.28)] disabled:cursor-not-allowed disabled:opacity-50'

export const DANGER_BUTTON =
  'h-8.5 cursor-pointer rounded-[9px] border border-[rgba(239,68,68,.22)] bg-[rgba(239,68,68,.1)] px-3.5 text-base font-semibold text-[#f87171] disabled:cursor-not-allowed disabled:opacity-45'

/** Nút icon vuông nhỏ trong danh sách (đổi tên, xoá…). */
export const ICON_BUTTON =
  'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-xs border-none bg-transparent text-fg-4 transition-colors'

/** Khối nội dung của một màn: padding + xếp dọc. */
export const SCREEN = 'flex flex-col gap-4 px-6.5 py-5.5'
