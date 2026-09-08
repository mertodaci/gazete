import { SubscribeForm } from "./SubscribeForm";

export default function HomePage() {
  return (
    <main>
      <h1>Gazete</h1>
      <p>Seçtiğin kategorilerden, yapay zekâ ile özetlenmiş günlük Türkçe haber bülteni.</p>
      <SubscribeForm />
    </main>
  );
}
