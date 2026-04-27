/**
 * In-app reporter quick-start. Mirrors docs/REPORTER-GUIDE.md so a
 * reporter can pull it up on their phone during the match without
 * needing the printed copy.
 */
export function HelpPage() {
  return (
    <article className="prose prose-invert mx-auto max-w-[720px]">
      <h1 className="font-display text-2xl font-700">
        Vodič za zapisničare
      </h1>
      <p className="text-sm text-ink-tertiary">
        Brzo uputstvo za turnir 27–28. juna 2026.
      </p>

      <Section title="Pre utakmice">
        <ol>
          <li>Tab <strong>Utakmice</strong> → izaberi sledeću utakmicu po vremenu.</li>
          <li>
            Otvara se editor utakmice. Proveri timove. Ako su pogrešni — javi
            Stefan-u, ne diraj sam.
          </li>
          <li>
            Slab internet je u redu — aplikacija radi i bez veze. Narandžasta
            traka na vrhu te obaveštava da si offline; sve operacije se sačuvaju
            i sinhronizuju kad se vratiš online.
          </li>
        </ol>
      </Section>

      <Section title="Tok utakmice">
        <h3>Početak</h3>
        <ol>
          <li><strong>"Počni utakmicu"</strong> — sat startuje automatski.</li>
        </ol>

        <h3>Gol</h3>
        <ol>
          <li><strong>"Dodaj gol"</strong> ispod tablice rezultata.</li>
          <li>Tim → strelac → asistent (opciono).</li>
          <li>Sačuvaj.</li>
        </ol>
        <p>
          Pogrešio si? Klikni gol u listi događaja → <strong>"Obriši"</strong>.
          Sat ne mora da se pomera.
        </p>

        <h3>Karton</h3>
        <ol>
          <li><strong>"Dodaj karton"</strong>.</li>
          <li>Žuti / drugi žuti / crveni → tim → igrač → sačuvaj.</li>
        </ol>

        <h3>Poluvreme i kraj</h3>
        <ul>
          <li>Sat sam pita da pauzira po podešavanju turnira.</li>
          <li>
            Klikni <strong>"Nastavi"</strong> kad počne drugo poluvreme ako sat
            ne uradi to sam.
          </li>
          <li>
            <strong>"Završi utakmicu"</strong> → potvrdi rezultat — dvaput
            proveri tablicu pre potvrde.
          </li>
        </ul>
      </Section>

      <Section title="Penali">
        <p>
          Ako utakmica ide u nokaut fazi a nerešeno je posle redovnog vremena
          → <strong>"Penali"</strong>. Klikni A ili B posle svakog šuta.
          Pobednik se automatski upisuje u sledeće kolo.
        </p>
      </Section>

      <Section title="Šta ako…">
        <ul>
          <li>
            <strong>Telefon mi je crko</strong> — uloguj se ponovo. Sve što si
            uneo je sačuvano lokalno. Sinhronizuje se kad se vratiš online.
          </li>
          <li>
            <strong>Pogrešan strelac</strong> — klikni gol u listi → Obriši →
            unesi pravog.
          </li>
          <li>
            <strong>"Nemaš pristup"</strong> — javi Stefan-u. Možda neki tab nije u tvojim dozvolama.
          </li>
          <li>
            <strong>Sat kasni / žuri</strong> — Stefan može ručno da zapiše
            tačnu minutu. Ne brini.
          </li>
          <li>
            <strong>Sve je belo / aplikacija puca</strong> — slika ekrana → pošalji
            Stefan-u. Pribeleži rezultat na papir u međuvremenu.
          </li>
        </ul>
      </Section>

      <Section title="Krizna pravila">
        <ul>
          <li><strong>Stefan-ov broj</strong> je u opisu mejla. Zovi bez ustručavanja.</li>
          <li>
            <strong>Ako sumnjaš — ne brisi.</strong> Bolje sumnjiv događaj nego
            sam "popravljen". Stefan ima alat za reviziju.
          </li>
          <li>
            <strong>Papir je rezervna kopija.</strong> Ako aplikacija puca — papir
            pa fotografija na kraju utakmice.
          </li>
        </ul>
      </Section>

      <Section title="Šta NE TREBA da diraš">
        <ul>
          <li>Druge utakmice koje nisu tvoje.</li>
          <li>Postavke turnira, timova, igrača — samo Stefan.</li>
          <li>Pozivnice / korisnike.</li>
          <li>Galeriju (fotografije moderira Stefan).</li>
        </ul>
        <p>
          Tabovi koje ne vidiš nisu za tebe. Ako vidiš tabove koje ne treba da
          diraš — javi Stefan-u, dozvole su pogrešno postavljene.
        </p>
      </Section>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 flex flex-col gap-2">
      <h2 className="font-display text-lg font-700 text-ink-primary">{title}</h2>
      <div className="text-sm leading-relaxed text-ink-secondary [&_h3]:mt-3 [&_h3]:font-display [&_h3]:text-base [&_h3]:font-600 [&_h3]:text-ink-primary [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:text-ink-primary [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
    </section>
  );
}
