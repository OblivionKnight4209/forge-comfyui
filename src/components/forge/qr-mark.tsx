import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrMark({ value }: { value: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, {
      type: "svg",
      margin: 1,
      color: { dark: "#09090b", light: "#f3f2ee" },
    }).then((s) => {
      if (alive) setSvg(s);
    });
    return () => {
      alive = false;
    };
  }, [value]);
  if (!svg) return <div className="size-32 rounded-lg bg-accent" />;
  return (
    <div
      className="size-32 overflow-hidden rounded-lg bg-accent p-1 [&>svg]:size-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
