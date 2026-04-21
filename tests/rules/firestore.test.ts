import fs from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

/**
 * Firestore rules tests. Relies on `firebase emulators:exec` to bring up a
 * local Firestore emulator on port 8080 before this suite runs. The suite
 * reloads fresh rules from firestore.rules each `describe` block so edits
 * to the rules file flow through without restarting the emulator.
 */

const PROJECT_ID = 'fk-dunav-rules-test';
let env: RulesTestEnvironment;

beforeAll(async () => {
  const rules = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'firestore.rules'),
    'utf8',
  );
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

// Helpers ---------------------------------------------------------------------

function anon() {
  return env.unauthenticatedContext().firestore();
}

function user(uid: string, email?: string) {
  return env
    .authenticatedContext(uid, email ? { email } : undefined)
    .firestore();
}

async function seedAdmin(uid: string, email: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'adminEmails', email), { email });
    await setDoc(doc(db, 'admins', uid), { email, promotedAt: serverTimestamp() });
  });
}

async function seedActiveTournament(tid: string) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'tournaments', tid), {
      status: 'active',
      name: 'Test Turnir',
    });
  });
}

// Tests -----------------------------------------------------------------------

describe('/adminEmails', () => {
  it('is readable by any signed-in user', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'adminEmails', 'stefan@example.com'), {
        email: 'stefan@example.com',
      });
    });
    await assertSucceeds(
      getDoc(doc(user('u1', 'anyone@example.com'), 'adminEmails', 'stefan@example.com')),
    );
  });

  it('is not readable by anonymous visitors', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'adminEmails', 'stefan@example.com'), {
        email: 'stefan@example.com',
      });
    });
    await assertFails(
      getDoc(doc(anon(), 'adminEmails', 'stefan@example.com')),
    );
  });

  it('is never writable from clients', async () => {
    await assertFails(
      setDoc(doc(user('u1'), 'adminEmails', 'u1@example.com'), {
        email: 'u1@example.com',
      }),
    );
  });
});

describe('/admins', () => {
  it('allows self-promotion when email is in /adminEmails', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'adminEmails', 'stefan@example.com'), {
        email: 'stefan@example.com',
      });
    });
    await assertSucceeds(
      setDoc(doc(user('u1', 'stefan@example.com'), 'admins', 'u1'), {
        email: 'stefan@example.com',
      }),
    );
  });

  it('rejects promotion when email is NOT in /adminEmails', async () => {
    await assertFails(
      setDoc(doc(user('u1', 'someone@example.com'), 'admins', 'u1'), {
        email: 'someone@example.com',
      }),
    );
  });

  it('rejects promotion of a different uid', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'adminEmails', 'stefan@example.com'), {
        email: 'stefan@example.com',
      });
    });
    await assertFails(
      setDoc(doc(user('u1', 'stefan@example.com'), 'admins', 'u2'), {
        email: 'stefan@example.com',
      }),
    );
  });

  it('is not update-able once created', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins', 'u1'), {
        email: 'stefan@example.com',
      });
    });
    await assertFails(
      setDoc(
        doc(user('u1', 'stefan@example.com'), 'admins', 'u1'),
        { email: 'stefan@example.com', extra: 'x' },
        { merge: true },
      ),
    );
  });
});

describe('/tournaments', () => {
  it('draft doc is not readable by anonymous visitors', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'tournaments', 't1'), {
        status: 'draft',
      });
    });
    await assertFails(getDoc(doc(anon(), 'tournaments', 't1')));
  });

  it('active doc is readable by anyone', async () => {
    await seedActiveTournament('t1');
    await assertSucceeds(getDoc(doc(anon(), 'tournaments', 't1')));
  });

  it('admin can create a tournament', async () => {
    await seedAdmin('uAdmin', 'stefan@example.com');
    await assertSucceeds(
      setDoc(doc(user('uAdmin', 'stefan@example.com'), 'tournaments', 't1'), {
        status: 'draft',
        name: 'New',
      }),
    );
  });

  it('non-admin cannot create a tournament', async () => {
    await assertFails(
      setDoc(doc(user('uRando', 'r@example.com'), 'tournaments', 't1'), {
        status: 'draft',
        name: 'New',
      }),
    );
  });
});

describe('/tournaments/{tid}/lottery + lotteryParticipants', () => {
  it('lottery prizes are publicly readable', async () => {
    await seedActiveTournament('t1');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'tournaments/t1/lottery/p1'), {
        label: '1. nagrada',
        order: 0,
      });
    });
    await assertSucceeds(getDoc(doc(anon(), 'tournaments/t1/lottery/p1')));
  });

  it('only admins can write prizes', async () => {
    await seedActiveTournament('t1');
    await seedAdmin('uAdmin', 'stefan@example.com');
    await assertFails(
      setDoc(doc(user('uRando'), 'tournaments/t1/lottery/p1'), {
        label: 'X',
        order: 0,
      }),
    );
    await assertSucceeds(
      setDoc(doc(user('uAdmin', 'stefan@example.com'), 'tournaments/t1/lottery/p1'), {
        label: 'X',
        order: 0,
      }),
    );
  });

  it('participants are publicly readable, admin-only writable', async () => {
    await seedActiveTournament('t1');
    await seedAdmin('uAdmin', 'stefan@example.com');
    await assertFails(
      setDoc(doc(user('uRando'), 'tournaments/t1/lotteryParticipants/x'), {
        name: 'Pera',
      }),
    );
    await assertSucceeds(
      setDoc(
        doc(user('uAdmin', 'stefan@example.com'), 'tournaments/t1/lotteryParticipants/x'),
        { name: 'Pera' },
      ),
    );
  });
});

describe('/champions', () => {
  it('is publicly readable', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'champions', '2025'), {
        year: 2025,
        championTeamName: 'FK Dunav',
      });
    });
    await assertSucceeds(getDoc(doc(anon(), 'champions', '2025')));
  });

  it('only admin can write', async () => {
    await seedAdmin('uAdmin', 'stefan@example.com');
    await assertFails(
      setDoc(doc(user('uRando'), 'champions', '2025'), {
        year: 2025,
        championTeamName: 'X',
      }),
    );
    await assertSucceeds(
      setDoc(doc(user('uAdmin', 'stefan@example.com'), 'champions', '2025'), {
        year: 2025,
        championTeamName: 'X',
      }),
    );
  });
});

describe('/photoRateLimits', () => {
  it('is closed to all client access', async () => {
    await assertFails(
      setDoc(doc(user('uAdmin', 'stefan@example.com'), 'photoRateLimits', 'abc'), {
        recent: [],
      }),
    );
    await assertFails(getDoc(doc(user('uRando'), 'photoRateLimits', 'abc')));
  });
});
