import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "豆格 BeadGrid｜图片转拼豆图纸",
  description: "免费把照片转换成带网格、色号和用量统计的拼豆图纸，所有处理均在浏览器本地完成。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
