import { renderIcon } from "@/lib/icon/renderIcon";

export function GET() {
  return renderIcon(512, { maskable: true });
}
