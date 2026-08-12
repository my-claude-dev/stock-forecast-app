import { renderIcon } from "@/lib/icon/renderIcon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // Apple touch icons are not masked by the OS, so use the full-bleed glyph.
  return renderIcon(180);
}
