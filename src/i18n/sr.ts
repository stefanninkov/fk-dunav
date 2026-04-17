/**
 * Serbian Latin UI strings. Single source of truth — never inline Serbian
 * text in components. Add new keys here and reference via `sr.path.to.key`.
 */
export const sr = {
  common: {
    loading: 'Učitavanje…',
    save: 'Sačuvaj',
    cancel: 'Otkaži',
    delete: 'Obriši',
    edit: 'Izmeni',
    close: 'Zatvori',
    back: 'Nazad',
    next: 'Dalje',
    confirm: 'Potvrdi',
    yes: 'Da',
    no: 'Ne',
    required: 'Obavezno polje',
    offline: 'Nema interneta — promene se čuvaju lokalno i sinhronizuju po povezivanju.',
  },

  brand: {
    name: 'FK Dunav Ostrovo',
    tournament: 'Turnir u malom fudbalu na travi',
    tagline: 'Pokaži lali umeće na travi',
  },

  nav: {
    home: 'Početna',
    groups: 'Grupe',
    schedule: 'Raspored',
    results: 'Rezultati',
    live: 'Uživo',
    knockout: 'Nokaut',
    statistics: 'Statistika',
    gallery: 'Galerija',
    teams: 'Timovi',
    sponsors: 'Sponzori',
    rules: 'Pravilnik',
    about: 'O turniru',
    champions: 'Šampioni',
  },

  admin: {
    login: {
      title: 'Prijava',
      emailLabel: 'Email adresa',
      emailPlaceholder: 'ime@primer.rs',
      submit: 'Pošalji link za prijavu',
      sent: 'Link za prijavu je poslat. Proveri mejl.',
      noAccess: 'Ovaj email nema pristup. Obrati se administratoru.',
      invalidLink: 'Link nije ispravan ili je istekao.',
      emailMismatch: 'Unesi email na koji je link poslat.',
      finishing: 'Završavanje prijave…',
    },
    nav: {
      dashboard: 'Pregled',
      matches: 'Utakmice',
      teams: 'Timovi',
      players: 'Igrači',
      schedule: 'Raspored',
      bracket: 'Nokaut',
      gallery: 'Galerija',
      announcements: 'Obaveštenja',
      sponsors: 'Sponzori',
      kupSanka: 'Kup Šanka',
      crossbar: 'Prečka',
      awards: 'Nagrade',
      tournament: 'Turnir',
      users: 'Korisnici',
      voting: 'Glasanje',
      champions: 'Šampioni',
    },
    logout: 'Odjava',
  },

  match: {
    status: {
      scheduled: 'Zakazana',
      live: 'Uživo',
      finished: 'Završena',
      abandoned: 'Prekinuta',
    },
    actions: {
      start: 'Počni utakmicu',
      end: 'Završi utakmicu',
      addGoal: 'Dodaj gol',
      addCard: 'Dodaj karton',
      pause: 'Pauziraj',
      resume: 'Nastavi',
      halftime: 'Poluvreme',
      requestEdit: 'Zatraži izmenu',
    },
  },

  side: {
    lottery: {
      title: 'Lutrija',
      subtitle: 'Dobitnici nagradne igre',
      empty: 'Dobitnici će biti objavljeni nakon izvlačenja.',
      admin: {
        title: 'Lutrija — unos dobitnika',
        addPrize: 'Dodaj dobitnika',
        labelPlaceholder: 'npr. 1. nagrada: TV',
        winnerPlaceholder: 'Ime i prezime dobitnika',
        photoOptional: 'Fotografija (opciono)',
      },
    },
    crossbar: {
      title: 'Takmičenje u gađanju prečke bosom nogom',
      short: 'Prečka',
    },
  },
} as const;

export type SerbianStrings = typeof sr;
