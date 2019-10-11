# ssb-invite-client

Plugin to accept pub invites on the client side. This is fork of [ssb-invite](https://github.com/ssbc/ssb-invite) which is lighter to run on clients.

## api

### accept: async

Use an invite code.

 - invitecode (string)

```bash
accept {invitecode}
```

```js
accept(invitecode, cb)
```

This connects to the server address encoded in the invite-code, then calls `use()` on the server.
It will cause the server to follow the local user.

## License

MIT
