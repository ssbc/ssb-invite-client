// WARNING: this test currently only passes
// if the computer has a network.
const ssbKeys = require('ssb-keys');
const tape = require('tape');
const pull = require('pull-stream');
const ssbClient = require('ssb-client');
const ref = require('ssb-ref');
const SecretStack = require('secret-stack');
const crypto = require('crypto');

const caps = {shs: crypto.randomBytes(32).toString('base64')};

// var createSsbServer = require('ssb-server')
//   .use(require('ssb-invite'))
//   .use(require('ssb-replicate'))
//   .use(require('ssb-friends'))
//   .use(require('ssb-ws'));

const createSsbServer = SecretStack({caps})
  .use(require('ssb-db'))
  .use(require('ssb-ws'))
  .use(require('ssb-invite'))
  .use(require('ssb-friends'))
  .use(require('ssb-ebt'))
  .use(require('ssb-replication-scheduler'));

// var createSsbClient = require('ssb-server')
//   .use(require('../lib'))
//   .use(require('ssb-replicate'))
//   .use(require('ssb-friends'))
//   .use(require('ssb-ws'));

const createSsbClient = SecretStack({caps})
  .use(require('ssb-db2'))
  .use(require('ssb-db2/compat'))
  .use(require('ssb-ws'))
  .use(require('ssb-conn'))
  .use(require('ssb-friends'))
  .use(require('ssb-ebt'))
  .use(require('ssb-replication-scheduler'))
  // .use(require('ssb-invite'));
  .use(require('../lib'));

function all(stream, cb) {
  return pull(stream, pull.collect(cb));
}

function messagesByType(sbot, typeStr) {
  const {where, type, toPullStream} = sbot.db.operators;
  return sbot.db.query(where(type(typeStr)), toPullStream());
}

const wsConnections = {
  incoming: {
    net: [{scope: ['local', 'device'], transform: 'shs', host: '0.0.0.0'}],
    ws: [{scope: ['local', 'device'], transform: 'shs', host: '0.0.0.0'}],
  },
  outgoing: {
    net: [{transform: 'shs'}],
    ws: [{transform: 'shs'}],
  },
};

tape('test invite.accept api', (t) => {
  const alice = createSsbServer({
    temp: 'test-invite-alice2',
    timeout: 100,
    allowPrivate: true,
    keys: ssbKeys.generate(),
    caps: caps,
  });

  const bob = createSsbClient({
    temp: 'test-invite-bob2',
    timeout: 100,
    keys: ssbKeys.generate(),
    caps: caps,
  });

  const carol = createSsbClient({
    temp: 'test-invite-carol2',
    timeout: 100,
    keys: ssbKeys.generate(),
    caps: caps,
  });

  if (!alice.getAddress('device'))
    return t.fail(new Error('alice must have device address'));
  if (!alice.getAddress('local'))
    return t.fail(new Error('alice must have local address'));

  //request a secret that with particular permissions.

  alice.invite.create(1, (err, invite) => {
    t.error(err, 'no error');
    //test that invite is accepted with quotes around it.
    bob.invite.accept(JSON.stringify(invite), (err) => {
      t.error(err, 'no error');
      alice.friends.hops({source: alice.id, dest: bob.id}, (err, hops) => {
        t.error(err, 'no error');
        t.equal(hops[bob.id], 1, 'alice follows bob');
        carol.invite.accept(invite, (err) => {
          alice.friends.hops({source: alice.id, dest: bob.id}, (err, hops) => {
            t.equal(hops[carol.id], undefined, 'alice hops has no carol');
            alice.close(true);
            bob.close(true);
            carol.close(true);
            t.end();
          });
        });
      });
    });
  });
});

tape('test invite.accept api using non default app key', (t) => {
  const appkey = crypto.randomBytes(32).toString('base64');

  const alice = createSsbServer({
    temp: 'test-invite-alice2.2',
    timeout: 100,
    allowPrivate: true,
    keys: ssbKeys.generate(),
    //    caps: caps,
    caps: {shs: appkey},
  });

  const bob = createSsbClient({
    temp: 'test-invite-bob2.2',
    timeout: 100,
    keys: ssbKeys.generate(),
    caps: {shs: appkey},
  });

  const carol = createSsbClient({
    temp: 'test-invite-carol2.2',
    timeout: 100,
    keys: ssbKeys.generate(),
    caps: {shs: appkey},
  });

  if (!alice.getAddress('device'))
    return t.fail(new Error('alice must have device address'));
  if (!alice.getAddress('local'))
    return t.fail(new Error('alice must have local address'));

  // request a secret that with particular permissions.

  alice.invite.create(1, (err, invite) => {
    t.error(err, 'no error');
    //test that invite is accepted with quotes around it.
    bob.invite.accept(JSON.stringify(invite), (err) => {
      t.error(err, 'no error');
      alice.friends.hops({source: alice.id, dest: bob.id}, (err, hops) => {
        t.error(err, 'no error');
        t.equal(hops[bob.id], 1, 'alice follows bob');
        carol.invite.accept(invite, (err) => {
          alice.friends.hops({source: alice.id, dest: bob.id}, (err, hops) => {
            t.equal(hops[carol.id], undefined, 'alice hops has no carol');
            alice.close(true);
            bob.close(true);
            carol.close(true);
            t.end();
          });
        });
      });
    });
  });
});

tape('test invite.accept doesnt follow if already followed', (t) => {
  const alice = createSsbServer({
    temp: 'test-invite-alice3',
    timeout: 100,
    allowPrivate: true,
    keys: ssbKeys.generate(),
    caps: caps,
  });

  const bob = createSsbClient({
    temp: 'test-invite-bob3',
    timeout: 100,
    keys: ssbKeys.generate(),
    caps: caps,
  });

  //request a secret that with particular permissions.

  alice.invite.create(2, (err, invite) => {
    t.error(err, 'no error');
    bob.invite.accept(invite, (err) => {
      t.error(err, 'no error');
      alice.friends.hops(alice.id, (err, hops) => {
        t.error(err, 'no error');
        t.equal(hops[bob.id], 1, 'alice follows bob');
        all(messagesByType(bob, 'pub'), (err, ary) => {
          t.error(err, 'no error');
          t.equal(ary.length, 1, 'bob has 1 "pub" message');

          //it's rare, but some times, someone's home computer has a public address.
          //this makes the tests fail unless we get the address the same way as invite code.
          const expected =
            alice.address('public') ||
            alice.address('local') ||
            alice.address('device');
          const expectedParsed = ref.parseAddress(expected.split(';').shift());

          t.equals(ary[0].value.content.type, 'pub', 'pub message');
          t.equals(
            ary[0].value.content.address.host,
            expectedParsed.host,
            'pub message has correct host',
          );
          t.equals(
            ary[0].value.content.address.port,
            expectedParsed.port,
            'pub message has correct port',
          );
          t.equals(
            ary[0].value.content.address.key,
            expectedParsed.key,
            'pub message has correct key',
          );

          all(messagesByType(bob, 'contact'), (err, ary) => {
            t.error(err, 'no error');

            t.equal(ary.length, 1, 'bob has 1 "contact" message');

            t.deepEqual(
              ary[0].value.content,
              {
                type: 'contact',
                contact: alice.id,
                autofollow: true,
                following: true,
              },
              'contact message',
            );

            bob.invite.accept(invite, (err) => {
              t.ok(err, 'bob invite.accept returns error');
              alice.friends.hops(alice.id, (err, hops) => {
                t.equal(hops[bob.id], 1, 'alice follows bob');
                alice.close(true);
                bob.close(true);
                t.end();
              });
            });
          });
        });
      });
    });
  });
});

if (process.env.TRAVIS === 'true') {
  console.warn('IPv6 is unsupported under Travis CI, test skipped');
  var skipIPv6 = true;
}

tape('test invite.accept api with ipv6', {skip: skipIPv6}, (t) => {
  const alice = createSsbServer({
    temp: 'test-invite-alice4',
    timeout: 100,
    allowPrivate: true,
    keys: ssbKeys.generate(),
    caps: caps,
  });

  const bob = createSsbClient({
    temp: 'test-invite-bob4',
    timeout: 100,
    keys: ssbKeys.generate(),
    caps: caps,
  });

  alice.invite.create(1, (err, invite) => {
    t.error(err, 'no error');

    // use a local ipv6 address in the invite
    // let inviteV6 = invite.replace(/localhost|([0-9.]*)/, '::1');
    //    var parts = invite.split(':')
    //    parts[0].split(':').pop()
    //    console.log(inviteV6, invite)
    const parts = invite.split('~');

    const addr = ref.parseAddress(parts[0]);

    addr.host = '::1';

    const inviteV6 =
      addr.host + ':' + addr.port + ':' + addr.key + '~' + parts[1];

    bob.invite.accept(inviteV6, (err, msg) => {
      t.error(err, 'no error');
      alice.friends.hops({source: alice.id, dest: bob.id}, (err, hops) => {
        t.error(err, 'no error');
        t.equal(hops[bob.id], 1, 'alice follows bob');
        alice.close(true);
        bob.close(true);
        t.end();
      });
    });
  });
});

// TODO: I don't know what's going on with modern and ws,
// but this test isn't passing. Maybe it's something to do with ssb-invite's
//
tape.skip('test invite.create with modern', (t) => {
  const alice = createSsbServer({
    temp: 'test-invite-alice5',
    timeout: 100,
    allowPrivate: true,
    keys: ssbKeys.generate(),
    connections: wsConnections,
    caps: caps,
  });

  const bob = createSsbClient({
    temp: 'test-invite-bob5',
    timeout: 100,
    keys: ssbKeys.generate(),
    connections: wsConnections,
    caps: caps,
  });

  const carol = createSsbClient({
    temp: 'test-invite-carol5',
    timeout: 100,
    keys: ssbKeys.generate(),
    connections: wsConnections,
    caps: caps,
  });

  // request a secret that with particular permissions.
  alice.invite.create({modern: true}, (err, invite) => {
    t.error(err, 'no error');
    // test that invite is accepted with quotes around it.
    t.ok(/^ws/.test(invite), 'invite is a websocket address');
    bob.invite.accept(JSON.stringify(invite), (err, msg) => {
      t.error(err, 'no error');
      alice.friends.hops({source: alice.id, dest: bob.id}, (err, aliceHops) => {
        t.error(err, 'no error');
        t.equal(aliceHops[bob.id], 1, 'alice follows bob');
        carol.invite.accept(invite, (err) => {
          t.ok(err, 'carol invite.accept returns error');
          alice.friends.hops({source: alice.id, dest: bob.id}, (err, hops) => {
            t.error(err, 'no error');
            t.equal(hops[carol.id], undefined, 'alice hops has no carol');

            alice.close(true);
            bob.close(true);
            carol.close(true);

            t.end();
          });
        });
      });
    });
  });
});

tape('invite guest may NOT call get', (t) => {
  const keys = ssbKeys.generate();

  const alice = createSsbServer({
    temp: 'test-invite-alice6',
    timeout: 100,
    allowPrivate: true,
    keys: ssbKeys.generate(),
    connections: wsConnections,
    caps: caps,
  });

  alice.publish({type: 'test', okay: true}, (err, msg) => {
    t.error(err, 'no error');
    alice.invite.create({modern: true}, (err, invite) => {
      t.error(err, 'no error');
      ssbClient(
        keys,
        {
          remote: invite,
          manifest: {get: 'async', add: 'async'},
          caps: caps,
        },
        (err, rpc) => {
          t.error(err, 'no error');
          rpc.get(msg.key, (err, value) => {
            t.ok(err, 'get() returns error');
            rpc.add(msg.key, (err, value) => {
              t.ok(err, 'add() returns error');
              alice.close(true);
              t.end();
            });
          });
        },
      );
    });
  });
});

tape('test invite with note', (t) => {
  const alice = createSsbServer({
    temp: 'test-invite-alice7',
    timeout: 100,
    allowPrivate: true,
    keys: ssbKeys.generate(),
    caps: caps,
  });

  const bob = createSsbClient({
    temp: 'test-invite-bob7',
    timeout: 100,
    keys: ssbKeys.generate(),
    caps: caps,
  });

  alice.invite.create({uses: 1, note: 'bob'}, (err, invite) => {
    t.error(err, 'no error');
    bob.invite.accept(invite, (err) => {
      t.error(err, 'no error');

      all(alice.messagesByType('contact'), (err, ary) => {
        t.equal(ary.length, 1, 'alice has 1 "contact" message');

        t.deepEqual(ary[0].value.content, {
          type: 'contact',
          contact: bob.id,
          following: true,
          pub: true,
          note: 'bob',
        }, 'contact message has correct content');

        alice.close(true);
        bob.close(true);
        t.end();
      });
    });
  });
});

tape('test invite.accept accepts option shouldPublish=false', (t) => {
  const alice = createSsbServer({
    temp: 'test-invite-alice8',
    timeout: 100,
    allowPrivate: true,
    keys: ssbKeys.generate(),
    caps: caps,
  });

  const bob = createSsbClient({
    temp: 'test-invite-bob8',
    timeout: 100,
    keys: ssbKeys.generate(),
    caps: caps,
  });

  alice.invite.create(1, (err, invite) => {
    t.error(err, 'no error');
    bob.invite.accept({invite, shouldPublish: false}, (err) => {
      t.error(err, 'no error');
      bob.friends.hops(bob.id, (err, bobHops) => {
        t.error(err, 'no error');
        t.equal(bobHops[bob.id], 0, 'bob hops is correct');
        t.equal(bobHops[alice.id], undefined, 'bob hops has no alice');
        alice.close(true);
        bob.close(true);
        t.end();
      });
    });
  });
});
