import type { PropsWithChildren } from "react";

export function SectionCard(props: PropsWithChildren<{ title: string }>) {
  return (
    <section
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        background: "#fff"
      }}
    >
      <h2 style={{ marginTop: 0 }}>{props.title}</h2>
      {props.children}
    </section>
  );
}
