import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from './api';
import { localDatabase } from './local-db';

function fixture() {
  const DB = localDatabase(true);
  return async (path: string, data?: unknown, user?: string, cookie?: string) => {
    const headers: Record<string, string> = {};
    if (user) headers['oai-authenticated-user-id'] = user;
    if (cookie) { if (cookie.startsWith('mq_')) headers.cookie = cookie; else headers['x-quiz-host-password'] = cookie; }
    const response = await api(new Request(`https://quiz.test/api${path}`, {
      method: data === undefined ? 'GET' : 'POST', headers,
      body: data === undefined ? undefined : JSON.stringify(data),
    }), { DB, HOST_PASSWORD: '1234' });
    return { status: response.status, body: await response.json() as any, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
}

async function setup() {
  const call = fixture();
  const made = await call('/events', { title: '検証イベント' }, undefined, '1234');
  assert.equal(made.status, 201);
  const id = made.body.id;
  return { call, id, p: `/events/${id}`, hostCookie: '1234' };
}

test('host password works across browsers and protects event operations', async () => {
  const { call, p, hostCookie } = await setup();
  assert.equal((await call(p + '/host')).status, 401);
  assert.equal((await call(p + '/host', undefined, 'unrelated-user')).status, 401);
  assert.equal((await call(p + '/host', undefined, undefined, 'wrong')).status, 401);
  assert.equal((await call(p + '/host', undefined, undefined, hostCookie)).status, 200);
  assert.equal((await call(p + '/control', { command: 'start', current: 0 })).status, 401);
  assert.equal((await call('/events', undefined, undefined, hostCookie)).body.length, 1);
  assert.equal((await call('/events')).status, 401);
  const second = await call('/events', { title: '別端末のイベント' }, undefined, hostCookie);
  assert.equal(second.status, 201);
  assert.equal((await call('/events', undefined, undefined, hostCookie)).body.length, 2);
  const publicState = await call(p + '/state');
  assert.deepEqual(Object.keys(publicState.body).sort(), ['answer', 'event', 'group', 'question']);
  assert.equal(publicState.body.event.owner, undefined);
});

test('GitHub Pages origin can use password authentication through CORS', async () => {
  const DB = localDatabase(true), origin = 'https://nyancatnyo.github.io';
  const preflight = await api(new Request('https://quiz.test/api/events', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST' } }), { DB });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  const created = await api(new Request('https://quiz.test/api/events', { method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-quiz-host-password': '1234' }, body: JSON.stringify({ title: 'Pagesイベント' }) }), { DB, HOST_PASSWORD: '1234' });
  const event = await created.json() as any;
  assert.equal(event.hostToken, undefined);
  const host = await api(new Request(`https://quiz.test/api/events/${event.id}/host`, { headers: { origin, 'x-quiz-host-password': '1234' } }), { DB, HOST_PASSWORD: '1234' });
  assert.equal(host.status, 200);
  assert.equal(host.headers.get('access-control-allow-origin'), origin);
  const joined = await api(new Request(`https://quiz.test/api/events/${event.id}/join`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ name: '追手門チーム' }) }), { DB, HOST_PASSWORD: '1234' });
  const participant = await joined.json() as any;
  assert.ok(participant.groupToken);
  const state = await api(new Request(`https://quiz.test/api/events/${event.id}/state`, { headers: { origin, 'x-quiz-group-token': participant.groupToken } }), { DB, HOST_PASSWORD: '1234' });
  assert.equal((await state.json() as any).group.name, '追手門チーム');
});

test('unique normalized group names, existing cookie recovery, forged cookie rejected', async () => {
  const { call, p, id } = await setup();
  const first = await call(p + '/join', { name: 'チームＡ' });
  assert.equal(first.status, 201);
  assert.ok(first.cookie);
  assert.equal((await call(p + '/join', { name: 'チームA' })).status, 409);
  const repeated = await call(p + '/join', { name: '別名' }, undefined, first.cookie);
  assert.equal(repeated.body.group.id, first.body.group.id);
  assert.equal((await call(p + '/state', undefined, undefined, first.cookie)).body.group.name, 'チームA');
  assert.equal((await call(p + '/answer', { number: 1, choice: 'o' }, undefined, `mq_${id}=fake`)).status, 401);
});

test('ten questions, immutable answers, retries, closure, next question and finish', async () => {
  const { call, p, hostCookie } = await setup();
  const a = await call(p + '/join', { name: 'A' }), b = await call(p + '/join', { name: 'B' });
  assert.equal((await call(p + '/answer', { number: 1, choice: 'o' }, undefined, a.cookie)).status, 409);
  assert.equal((await call(p + '/control', { command: 'start', current: 0 }, undefined, hostCookie)).status, 200);
  assert.equal((await call(p + '/state')).body.question.number, 1);
  assert.equal((await call(p + '/state')).body.question.category, undefined);
  const hostQuestion = (await call(p + '/host', undefined, undefined, hostCookie)).body.questions[0];
  assert.equal(hostQuestion.body, undefined);
  assert.equal(hostQuestion.category, undefined);
  const results = await Promise.all(['o', 'x'].map(choice => call(p + '/answer', { number: 1, choice }, undefined, a.cookie)));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  const saved = (await call(p + '/state', undefined, undefined, a.cookie)).body.answer;
  assert.equal((await call(p + '/answer', { number: 1, choice: saved }, undefined, a.cookie)).status, 200);
  assert.equal((await call(p + '/control', { command: 'close', current: 1 }, undefined, hostCookie)).status, 200);
  assert.equal((await call(p + '/answer', { number: 1, choice: 'x' }, undefined, b.cookie)).status, 409);
  const stats = (await call(p + '/host', undefined, undefined, hostCookie)).body;
  assert.equal(stats.totals.o + stats.totals.x, 1);
  assert.equal(stats.totals.pending, 1);
  for (let current = 1; current < 10; current++) {
    assert.equal((await call(p + '/control', { command: 'next', current }, undefined, hostCookie)).status, 200);
    assert.equal((await call(p + '/answer', { number: current + 1, choice: 'x' }, undefined, a.cookie)).status, 200);
    assert.equal((await call(p + '/control', { command: 'close', current: current + 1 }, undefined, hostCookie)).status, 200);
  }
  assert.equal((await call(p + '/control', { command: 'finish', current: 10 }, undefined, hostCookie)).status, 200);
  assert.equal((await call(p + '/join', { name: 'C' })).status, 409);
});

test('participant credentials cannot control another event', async () => {
  const { call, p } = await setup();
  const participant = await call(p + '/join', { name: 'A' });
  const other = await call('/events', { title: '他のイベント' }, undefined, '1234');
  assert.equal((await call(`/events/${other.body.id}/host`, undefined, undefined, participant.cookie)).status, 401);
});

test('final scores remain host-only and use x x x x o o x x o x', async () => {
  const { call, p, hostCookie } = await setup();
  const perfect = await call(p + '/join', { name: '満点チーム' }), opposite = await call(p + '/join', { name: '反対チーム' });
  const correct = ['x', 'x', 'x', 'x', 'o', 'o', 'x', 'x', 'o', 'x'];
  assert.equal((await call(p + '/control', { command: 'start', current: 0 }, undefined, hostCookie)).status, 200);
  for (let number = 1; number <= 10; number++) {
    assert.equal((await call(p + '/answer', { number, choice: correct[number - 1] }, undefined, perfect.cookie)).status, 200);
    assert.equal((await call(p + '/answer', { number, choice: correct[number - 1] === 'o' ? 'x' : 'o' }, undefined, opposite.cookie)).status, 200);
    assert.equal((await call(p + '/host', undefined, undefined, hostCookie)).body.groups[0].correctCount, null);
    assert.equal((await call(p + '/control', { command: 'close', current: number }, undefined, hostCookie)).status, 200);
    if (number < 10) assert.equal((await call(p + '/control', { command: 'next', current: number }, undefined, hostCookie)).status, 200);
  }
  assert.equal((await call(p + '/control', { command: 'finish', current: 10 }, undefined, hostCookie)).status, 200);
  const final = (await call(p + '/host', undefined, undefined, hostCookie)).body;
  assert.deepEqual(final.groups.map((group: any) => [group.name, group.correctCount]), [['満点チーム', 10], ['反対チーム', 0]]);
  const participantState = (await call(p + '/state', undefined, undefined, perfect.cookie)).body;
  assert.equal(participantState.correctCount, undefined);
});
