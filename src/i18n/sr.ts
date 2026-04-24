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
    create: 'Kreiraj',
    close: 'Zatvori',
    back: 'Nazad',
    next: 'Dalje',
    confirm: 'Potvrdi',
    yes: 'Da',
    no: 'Ne',
    required: 'Obavezno polje',
    offline: 'Nema interneta — promene se čuvaju lokalno i sinhronizuju po povezivanju.',
    empty: 'Nema unosa.',
    errorGeneric: 'Došlo je do greške. Pokušaj ponovo.',
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
    awards: 'Nagrade',
    lottery: 'Lutrija',
    kupSanka: 'Kup Šanka',
    crossbar: 'Prečka',
    gallery: 'Galerija',
    teams: 'Timovi',
    sponsors: 'Sponzori',
    rules: 'Pravilnik',
    about: 'O turniru',
    champions: 'Šampioni',
    more: 'Više',
    /** Group labels shown on the dropdown parent in the header. */
    group: {
      results: 'Rezultati',
      awards: 'Nagrade',
    },
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

    home: {
      signedInAs: 'Prijavljen',
      activeCard: 'Aktivan turnir',
      configure: 'Podesi',
      liveCard: 'Utakmice uživo',
      liveNone: 'Nema utakmica u toku.',
      liveCount: (n: number) => (n === 1 ? '1 utakmica uživo' : `${n} utakmica uživo`),
      openLive: 'Otvori',
      photosCard: 'Fotografije na čekanju',
      photosNone: 'Sve obrađeno.',
      photosCount: (n: number) =>
        n === 1 ? '1 fotografija čeka pregled' : `${n} fotografija čeka pregled`,
      openModeration: 'Pregledaj',
    },

    tournament: {
      title: 'Turniri',
      newButton: 'Kreiraj turnir',
      noActive: 'Nema aktivnog turnira. Kreiraj novi ili aktiviraj postojeći.',
      activeBadge: 'Aktivan',
      draftBadge: 'Draft',
      archivedBadge: 'Arhiviran',
      activate: 'Aktiviraj',
      archive: 'Arhiviraj',
      form: {
        name: 'Naziv turnira',
        slug: 'URL oznaka (slug)',
        subtitle: 'Podnaslov',
        edition: 'Izdanje',
        year: 'Godina',
        startDate: 'Datum početka',
        endDate: 'Datum završetka',
        locationName: 'Lokacija',
        fieldsLabel: 'Tereni (zarezom razdvojeno)',
        qualifiersPerGroup: 'Prolaze iz grupe',
        halves: 'Poluvremena',
        halfMinutes: 'Trajanje poluvremena (min)',
      },
      activationNotice:
        'Aktiviranjem ovog turnira prethodno aktivni turnir se arhivira.',
    },

    teams: {
      title: 'Timovi',
      newButton: 'Dodaj tim',
      empty: 'Još nema timova. Dodaj prvi.',
      rosterTitle: 'Igrači',
      addPlayer: 'Dodaj igrača',
      rosterEmpty: 'Još nema igrača u ekipi.',
      form: {
        name: 'Naziv tima',
        shortName: 'Skraćenica (za nokaut)',
        group: 'Grupa',
        color: 'Boja (hex, opciono)',
        captainName: 'Kapiten',
        firstName: 'Ime',
        lastName: 'Prezime',
        photoUrl: 'URL fotografije (opciono)',
      },
    },

    groups: {
      title: 'Grupe',
      newPlaceholder: 'npr. Grupa A',
      addButton: 'Dodaj',
      empty: 'Nema grupa — dodaj prvu iznad.',
    },

    announcements: {
      title: 'Obaveštenja',
      newButton: 'Novo obaveštenje',
      empty: 'Nema obaveštenja.',
      severity: {
        info: 'Info',
        warning: 'Upozorenje',
        urgent: 'Hitno',
      },
      form: {
        title: 'Naslov',
        body: 'Tekst (do 280 karaktera)',
        severity: 'Nivo važnosti',
        expiresAt: 'Ističe (opciono)',
      },
    },

    sponsors: {
      title: 'Sponzori',
      newButton: 'Dodaj sponzora',
      empty: 'Još nema sponzora.',
      form: {
        name: 'Naziv',
        logoUrl: 'URL grba (opciono)',
        link: 'Link (opciono)',
        tier: 'Kategorija',
        order: 'Redosled',
        thanksText: 'Poruka zahvalnosti (opciono)',
        active: 'Aktivan',
      },
      tier: {
        gold: 'Zlatni',
        silver: 'Srebrni',
        bronze: 'Bronzani',
        friend: 'Prijatelj',
      },
    },

    kupSanka: {
      title: 'Kup Šanka',
      empty: 'Još nema učesnika.',
      newButton: 'Dodaj učesnika',
      namePlaceholder: 'Ime učesnika / tima',
      notePlaceholder: 'Napomena (opciono)',
      bokala: 'bokala',
      confirmDelete: 'Obrisati učesnika?',
    },

    crossbar: {
      title: 'Takmi\u010Denje u ga\u0111anju pre\u010Dke bosom nogom',
      short: 'Pre\u010Dka',
      newButton: 'Dodaj u\u010Desnika',
      empty: 'Nema u\u010Desnika.',
      form: {
        name: 'Ime u\u010Desnika',
        teamName: 'Tim (opciono)',
        qualifyingScore: 'Pogo\u0111enih pre\u010Daka',
        finalRank: 'Pozicija (1 = pobednik)',
      },
    },

    champions: {
      title: 'Šampioni',
      newButton: 'Dodaj izdanje',
      empty: 'Još nema unetih izdanja.',
      form: {
        year: 'Godina',
        edition: 'Izdanje (broj)',
        tournamentName: 'Naziv turnira (opciono)',
        championTeamName: 'Šampion',
        championLogoUrl: 'URL grba šampiona (opciono)',
        runnerUpTeamName: 'Vicešampion',
        thirdPlaceTeamName: '3. mesto',
        mvpPlayerName: 'MVP',
        topScorerName: 'Najbolji strelac',
        notes: 'Napomena (opciono)',
      },
    },

    lottery: {
      drumOn: 'Bubanj je uključen',
      drumOff: 'Bubanj je isključen',
      drumHelp:
        'Kada uključiš bubanj, na javnoj strani /lutrija pojaviće se veliki rotirajući bubanj sa učesnicima — spreman za izvlačenje.',
      showDrum: 'Pokaži bubanj',
      hideDrum: 'Sakrij bubanj',
    },

    awards: {
      title: 'Nagrade',
      saved: 'Sa\u010Duvano.',
      ids: {
        champion: '\u0160ampion',
        runnerUp: 'Vice\u0161ampion',
        thirdPlace: '3. mesto',
        mvp: 'MVP turnira',
        topScorer: 'Najbolji strelac',
        teamOfTournament: 'Tim turnira',
        crossbarWinner: 'Pobednik pre\u010Dke',
      },
    },
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
      subtitle: 'Nagradno izvlačenje',
      empty: 'Dobitnici će biti objavljeni tokom izvlačenja.',
      pending: 'Čeka se izvlačenje',
      drawing: 'Izvlačenje u toku…',
      admin: {
        title: 'Lutrija',
        countTitle: 'Broj učesnika',
        countHelp:
          'Unesi ukupan broj prodatih listića. Izvlačenje bira nasumičan broj iz opsega 1..N i preskače već izvučene.',
        countPlaceholder: 'npr. 150',
        countInvalid: 'Unesi pozitivan ceo broj.',
        prizesTitle: 'Nagrade',
        prizesHelp: 'Dodaj nagrade redom kojim će se izvlačiti.',
        addPrize: 'Dodaj nagradu',
        labelPlaceholder: 'npr. 1. nagrada: TV',
        draw: 'Izvuci',
        drawn: 'Izvučeno',
        winningNumber: 'Dobitni broj',
        undraw: 'Poništi izvlačenje',
        openBigScreen: 'Otvori veliki ekran',
        poolSummary: (remaining: number, total: number) =>
          `U bubnju: ${remaining} / ${total} brojeva`,
        noPool: 'Prvo unesi broj učesnika (veći od izvučenih).',
        confirmUndraw: 'Poništiti izvlačenje za ovu nagradu?',
      },
    },
    crossbar: {
      title: 'Takmičenje u gađanju prečke bosom nogom',
      short: 'Prečka',
    },
  },
} as const;

export type SerbianStrings = typeof sr;
