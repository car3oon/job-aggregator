import { cookies } from "next/headers";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.has("job_auth");

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-6">
          Wersja zapoznawcza 1.0
        </div>
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-8">
          Twoje oferty pracy, <br />
          <span className="text-primary">w jednym miejscu.</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed">
          Job Aggregator automatycznie zbiera, filtruje i kategoryzuje
          ogłoszenia z popularnych portali, tworząc Twój spersonalizowany kokpit
          ofert.
        </p>
        <Link href="/login">
          <Button
            size="lg"
            className="text-lg px-8 h-14 rounded-xl shadow-lg hover:shadow-primary/25 transition-all"
          >
            Przejdź do Panelu
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <div className="bg-card border rounded-xl p-12 text-center shadow-sm">
        <h3 className="text-xl font-semibold mb-2">Pusto tutaj!</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Jesteś poprawnie zalogowany. Wkrótce w tym miejscu pojawią się
          wszystkie oferty pracy, które system pobierze dla Twoich tagów.
        </p>
        <Link href="/settings">
          <Button variant="outline">Zarządzaj Kategoriami</Button>
        </Link>
      </div>
    </div>
  );
}
