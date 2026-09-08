import { PreferencesForm } from "./PreferencesForm";

export default function PreferencesPage({ searchParams }: { searchParams: { token?: string } }) {
  if (!searchParams.token) return <p>Eksik bağlantı.</p>;
  return (
    <main>
      <h1>Tercihlerini Güncelle</h1>
      <PreferencesForm token={searchParams.token} />
    </main>
  );
}
