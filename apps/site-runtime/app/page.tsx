const projects = [
  { name: "Зимний 54", price: "2 768 000", details: "2 спальни, 54 м²" },
  { name: "Север 87", price: "4 210 000", details: "3 спальни, 87 м²" }
];

export default function PartnerSiteHomePage() {
  return (
    <main style={{ fontFamily: "Arial, sans-serif", padding: 32, maxWidth: 1100, margin: "0 auto" }}>
      <header>
        <h1>Сайт партнёра</h1>
        <p>Публичная витрина партнёра на общем движке с отдельной конфигурацией и CRM-интеграцией.</p>
      </header>

      <section style={{ marginTop: 32 }}>
        <h2>Каталог проектов</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {projects.map((project) => (
            <article
              key={project.name}
              style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, background: "#fff" }}
            >
              <h3>{project.name}</h3>
              <p>{project.details}</p>
              <p>{project.price}</p>
              <button style={{ padding: "10px 14px", borderRadius: 8, border: "none", cursor: "pointer" }}>
                Запросить цену
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
